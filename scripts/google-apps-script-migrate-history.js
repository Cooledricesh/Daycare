/**
 * Google Apps Script: Wellington 진찰 히스토리 마이그레이션
 *
 * 목적: "Dr.박승현 진찰 comment" Google Sheets에서 2년치 진찰 기록을
 *       Supabase consultations 테이블로 마이그레이션
 *
 * 데이터 매핑:
 *   - Progress → consultations.note (전체 기간)
 *   - 약변경 → consultations.task_content (2026년만)
 *   - 시트명 → consultations.date
 *   - IDNO → patients.patient_id_no → consultations.patient_id
 *
 * 설정 방법:
 * 1. https://script.google.com 에서 새 프로젝트 생성 (또는 기존 프로젝트 사용)
 * 2. 이 코드 붙여넣기
 * 3. 스크립트 속성 설정:
 *    - SUPABASE_URL: Supabase 프로젝트 URL
 *    - SUPABASE_SERVICE_ROLE_KEY: Service Role Key
 *    - COMMENT_SPREADSHEET_ID: 진찰 comment 스프레드시트 ID
 *    - DOCTOR_ID: 박승현 의사 UUID
 * 4. testMigrationSetup() 실행하여 설정 확인
 * 5. startMigration() 실행하여 마이그레이션 시작
 * 6. 완료까지 continueMigration() 반복 실행 (또는 자동 트리거 사용)
 */

// =============================================================================
// 설정
// =============================================================================

function getMigrationConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl: props.getProperty('SUPABASE_URL'),
    serviceRoleKey: props.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    spreadsheetId: props.getProperty('COMMENT_SPREADSHEET_ID'),
    doctorId: props.getProperty('DOCTOR_ID'),
  };
}

// 한 번 실행 시 처리할 시트 수 (6분 제한 대응)
var BATCH_SIZE = 25;

// 날짜 시트 패턴: "YY.MM.DD" (예: "26.02.10", "24.12.30")
var DATE_SHEET_PATTERN = /^(\d{2})\.(\d{2})\.(\d{2})$/;

// =============================================================================
// Supabase REST API 헬퍼
// =============================================================================

function migrationSupabaseRequest(table, method, options) {
  var config = getMigrationConfig();
  var url = config.supabaseUrl + '/rest/v1/' + table;

  if (options && options.query) {
    url += '?' + options.query;
  }

  var fetchOptions = {
    method: method,
    headers: {
      'apikey': config.serviceRoleKey,
      'Authorization': 'Bearer ' + config.serviceRoleKey,
      'Content-Type': 'application/json',
      'Prefer': options && options.prefer ? options.prefer : 'return=representation',
    },
    muteHttpExceptions: true,
  };

  if (options && options.body) {
    fetchOptions.payload = JSON.stringify(options.body);
  }

  var response = UrlFetchApp.fetch(url, fetchOptions);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code < 200 || code >= 300) {
    // 409 Conflict는 중복 → 무시
    if (code === 409) return null;
    throw new Error('Supabase API [' + code + ']: ' + text);
  }

  if (!text || text === '') return null;
  return JSON.parse(text);
}

// =============================================================================
// 환자 IDNO → UUID 매핑 로드
// =============================================================================

function loadPatientIdMap() {
  var data = migrationSupabaseRequest('patients', 'get', {
    query: 'select=id,patient_id_no&patient_id_no=not.is.null',
  });

  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].patient_id_no) {
        map[String(data[i].patient_id_no).trim()] = data[i].id;
      }
    }
  }
  Logger.log('환자 매핑 로드: ' + Object.keys(map).length + '명');
  return map;
}

// =============================================================================
// 시트명 → 날짜 변환
// =============================================================================

/**
 * 시트명에서 날짜 추출 (예: "26.02.10" → "2026-02-10")
 * @returns {string|null} YYYY-MM-DD 형식 또는 null
 */
function parseSheetDate(sheetName) {
  var match = sheetName.match(DATE_SHEET_PATTERN);
  if (!match) return null;

  var year = parseInt(match[1], 10);
  var month = match[2];
  var day = match[3];

  // 24~26 → 2024~2026
  var fullYear = year < 50 ? 2000 + year : 1900 + year;
  return fullYear + '-' + month + '-' + day;
}

/**
 * 날짜가 2026년인지 확인
 */
function is2026(dateStr) {
  return dateStr && dateStr.startsWith('2026');
}

// =============================================================================
// 시트 데이터 파싱
// =============================================================================

/**
 * 날짜별 시트에서 환자 데이터 파싱
 * 컬럼: A(부서), B(이름), C(IDNO), D(담당ST), E(종), F(LAI),
 *        G(진찰), H(미내원표시), I(심리검사), J(약변경), K(Progress)
 *
 * @param {Sheet} sheet - Google Sheet 객체
 * @returns {Array<Object>} - 파싱된 환자 데이터
 */
function parseCommentSheet(sheet) {
  var data = sheet.getDataRange().getValues();
  var patients = [];

  // 헤더 행 찾기 (보통 3행째)
  var headerRow = -1;
  for (var i = 0; i < Math.min(5, data.length); i++) {
    var row = data[i];
    for (var j = 0; j < row.length; j++) {
      if (String(row[j]).trim() === 'IDNO') {
        headerRow = i;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) {
    return patients; // 헤더를 찾지 못함
  }

  // 헤더에서 컬럼 인덱스 찾기
  var headers = data[headerRow];
  var colMap = {};
  for (var h = 0; h < headers.length; h++) {
    var headerName = String(headers[h]).trim();
    if (headerName === 'IDNO') colMap.idno = h;
    else if (headerName === '이름') colMap.name = h;
    else if (headerName === '부서') colMap.dept = h;
    else if (headerName === '약변경') colMap.medChange = h;
    else if (headerName === 'Progress' || headerName === 'progress') colMap.progress = h;
    else if (headerName.indexOf('심리검사') >= 0) colMap.psychTest = h;
  }

  // IDNO 컬럼이 없으면 스킵
  if (colMap.idno === undefined) {
    return patients;
  }

  // 데이터 행 파싱
  for (var r = headerRow + 1; r < data.length; r++) {
    var row = data[r];
    var idno = String(row[colMap.idno] || '').trim();

    // IDNO 없으면 건너뛰기
    if (!idno || idno === '0' || idno === 'undefined') continue;

    var progress = colMap.progress !== undefined ? String(row[colMap.progress] || '').trim() : '';
    var medChange = colMap.medChange !== undefined ? String(row[colMap.medChange] || '').trim() : '';
    var psychTest = colMap.psychTest !== undefined ? String(row[colMap.psychTest] || '').trim() : '';

    // Progress와 약변경 모두 비어있으면 건너뛰기 (마이그레이션할 데이터 없음)
    if (!progress && !medChange && !psychTest) continue;

    // note 조합: Progress + 심리검사 (있으면)
    var noteParts = [];
    if (progress) noteParts.push(progress);
    if (psychTest) noteParts.push('[심리검사] ' + psychTest);
    var note = noteParts.join('\n');

    patients.push({
      idno: idno,
      note: note || null,
      medChange: medChange || null,
    });
  }

  return patients;
}

// =============================================================================
// 마이그레이션 코어
// =============================================================================

/**
 * 시트 배치 처리
 * @param {number} startIndex - 시작 시트 인덱스
 * @param {Array<Object>} datedSheets - { name, date } 배열
 * @param {Object} patientMap - IDNO → UUID 매핑
 * @param {string} doctorId - 의사 UUID
 * @returns {Object} - 처리 결과
 */
function processBatch(startIndex, datedSheets, patientMap, doctorId) {
  var endIndex = Math.min(startIndex + BATCH_SIZE, datedSheets.length);
  var config = getMigrationConfig();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

  var stats = {
    sheetsProcessed: 0,
    recordsInserted: 0,
    recordsSkipped: 0,
    patientsNotFound: 0,
    errors: 0,
  };

  for (var i = startIndex; i < endIndex; i++) {
    var sheetInfo = datedSheets[i];
    var sheet = spreadsheet.getSheetByName(sheetInfo.name);

    if (!sheet) {
      Logger.log('시트 없음: ' + sheetInfo.name);
      continue;
    }

    var patients = parseCommentSheet(sheet);

    if (patients.length === 0) {
      stats.sheetsProcessed++;
      continue;
    }

    // 배치 INSERT 준비
    var records = [];
    for (var p = 0; p < patients.length; p++) {
      var patient = patients[p];
      var patientId = patientMap[patient.idno];

      if (!patientId) {
        stats.patientsNotFound++;
        continue;
      }

      var record = {
        patient_id: patientId,
        date: sheetInfo.date,
        doctor_id: doctorId,
        note: patient.note,
        has_task: false,
        task_content: null,
        task_target: null,
      };

      // 2026년이고 약변경이 있으면 task 데이터 추가
      if (is2026(sheetInfo.date) && patient.medChange) {
        record.has_task = true;
        record.task_content = patient.medChange;
        record.task_target = 'nurse';
      }

      records.push(record);
    }

    // Supabase 배치 upsert (중복은 스킵)
    if (records.length > 0) {
      try {
        migrationSupabaseRequest('consultations', 'post', {
          body: records,
          prefer: 'resolution=ignore-duplicates,return=minimal',
        });
        stats.recordsInserted += records.length;
      } catch (e) {
        Logger.log('시트 ' + sheetInfo.name + ' 처리 오류: ' + e.message);
        stats.errors++;
      }
    }

    stats.recordsSkipped += (patients.length - records.length + stats.patientsNotFound);
    stats.sheetsProcessed++;
  }

  return stats;
}

// =============================================================================
// 마이그레이션 제어 함수
// =============================================================================

/**
 * 날짜별 시트 목록 가져오기 (날짜순 정렬)
 */
function getDatedSheets() {
  var config = getMigrationConfig();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var allSheets = spreadsheet.getSheets();

  var datedSheets = [];
  for (var i = 0; i < allSheets.length; i++) {
    var name = allSheets[i].getName();
    var date = parseSheetDate(name);
    if (date) {
      datedSheets.push({ name: name, date: date });
    }
  }

  // 날짜 오름차순 정렬
  datedSheets.sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });

  return datedSheets;
}

/**
 * 마이그레이션 시작 (처음부터)
 */
function startMigration() {
  var config = getMigrationConfig();

  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId || !config.doctorId) {
    Logger.log('오류: 필수 설정값 누락');
    Logger.log('필수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COMMENT_SPREADSHEET_ID, DOCTOR_ID');
    return;
  }

  Logger.log('=== 마이그레이션 시작 ===');

  var datedSheets = getDatedSheets();
  Logger.log('날짜별 시트: ' + datedSheets.length + '개');
  Logger.log('기간: ' + datedSheets[0].date + ' ~ ' + datedSheets[datedSheets.length - 1].date);

  // 환자 매핑 로드
  var patientMap = loadPatientIdMap();

  // 진행 상태 초기화
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MIGRATION_PROGRESS', '0');
  props.setProperty('MIGRATION_TOTAL_SHEETS', String(datedSheets.length));
  props.setProperty('MIGRATION_STATS', JSON.stringify({
    totalSheetsProcessed: 0,
    totalRecordsInserted: 0,
    totalRecordsSkipped: 0,
    totalPatientsNotFound: 0,
    totalErrors: 0,
  }));

  // 첫 배치 처리
  var stats = processBatch(0, datedSheets, patientMap, config.doctorId);

  // 진행 상태 업데이트
  var newProgress = Math.min(BATCH_SIZE, datedSheets.length);
  props.setProperty('MIGRATION_PROGRESS', String(newProgress));
  props.setProperty('MIGRATION_STATS', JSON.stringify({
    totalSheetsProcessed: stats.sheetsProcessed,
    totalRecordsInserted: stats.recordsInserted,
    totalRecordsSkipped: stats.recordsSkipped,
    totalPatientsNotFound: stats.patientsNotFound,
    totalErrors: stats.errors,
  }));

  Logger.log('배치 1 완료: ' + stats.sheetsProcessed + '개 시트 처리');
  Logger.log('삽입: ' + stats.recordsInserted + ', 스킵: ' + stats.recordsSkipped);

  if (newProgress >= datedSheets.length) {
    Logger.log('=== 마이그레이션 완료! ===');
  } else {
    Logger.log('남은 시트: ' + (datedSheets.length - newProgress) + '개');
    Logger.log('continueMigration() 실행하여 이어서 처리하세요.');
  }
}

/**
 * 마이그레이션 이어서 실행
 */
function continueMigration() {
  var config = getMigrationConfig();
  var props = PropertiesService.getScriptProperties();

  var progress = parseInt(props.getProperty('MIGRATION_PROGRESS') || '0', 10);
  var totalSheets = parseInt(props.getProperty('MIGRATION_TOTAL_SHEETS') || '0', 10);
  var totalStats = JSON.parse(props.getProperty('MIGRATION_STATS') || '{}');

  if (progress === 0 || totalSheets === 0) {
    Logger.log('마이그레이션이 시작되지 않았습니다. startMigration()을 먼저 실행하세요.');
    return;
  }

  if (progress >= totalSheets) {
    Logger.log('마이그레이션이 이미 완료되었습니다.');
    getMigrationStatus();
    return;
  }

  Logger.log('=== 마이그레이션 이어서 실행 (' + progress + '/' + totalSheets + ') ===');

  var datedSheets = getDatedSheets();
  var patientMap = loadPatientIdMap();

  var stats = processBatch(progress, datedSheets, patientMap, config.doctorId);

  // 누적 통계 업데이트
  var newProgress = Math.min(progress + BATCH_SIZE, datedSheets.length);
  totalStats.totalSheetsProcessed = (totalStats.totalSheetsProcessed || 0) + stats.sheetsProcessed;
  totalStats.totalRecordsInserted = (totalStats.totalRecordsInserted || 0) + stats.recordsInserted;
  totalStats.totalRecordsSkipped = (totalStats.totalRecordsSkipped || 0) + stats.recordsSkipped;
  totalStats.totalPatientsNotFound = (totalStats.totalPatientsNotFound || 0) + stats.patientsNotFound;
  totalStats.totalErrors = (totalStats.totalErrors || 0) + stats.errors;

  props.setProperty('MIGRATION_PROGRESS', String(newProgress));
  props.setProperty('MIGRATION_STATS', JSON.stringify(totalStats));

  Logger.log('배치 완료: 시트 ' + progress + '~' + (newProgress - 1));
  Logger.log('이번 배치: 삽입 ' + stats.recordsInserted + ', 스킵 ' + stats.recordsSkipped);

  if (newProgress >= datedSheets.length) {
    Logger.log('=== 마이그레이션 전체 완료! ===');
    getMigrationStatus();
  } else {
    Logger.log('남은 시트: ' + (datedSheets.length - newProgress) + '개');
  }
}

/**
 * 마이그레이션 진행 상태 확인
 */
function getMigrationStatus() {
  var props = PropertiesService.getScriptProperties();
  var progress = parseInt(props.getProperty('MIGRATION_PROGRESS') || '0', 10);
  var totalSheets = parseInt(props.getProperty('MIGRATION_TOTAL_SHEETS') || '0', 10);
  var stats = JSON.parse(props.getProperty('MIGRATION_STATS') || '{}');

  Logger.log('=== 마이그레이션 상태 ===');
  Logger.log('진행: ' + progress + '/' + totalSheets + ' 시트 (' + (totalSheets > 0 ? Math.round(progress / totalSheets * 100) : 0) + '%)');
  Logger.log('처리된 시트: ' + (stats.totalSheetsProcessed || 0));
  Logger.log('삽입된 레코드: ' + (stats.totalRecordsInserted || 0));
  Logger.log('스킵된 레코드: ' + (stats.totalRecordsSkipped || 0));
  Logger.log('환자 미매칭: ' + (stats.totalPatientsNotFound || 0));
  Logger.log('오류: ' + (stats.totalErrors || 0));
  Logger.log('완료 여부: ' + (progress >= totalSheets ? '완료' : '진행중'));
}

/**
 * 마이그레이션 초기화 (다시 시작하려면)
 */
function resetMigration() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('MIGRATION_PROGRESS');
  props.deleteProperty('MIGRATION_TOTAL_SHEETS');
  props.deleteProperty('MIGRATION_STATS');
  Logger.log('마이그레이션 상태 초기화 완료');
}

/**
 * 자동 연속 실행 트리거 생성
 * 1분 간격으로 continueMigration() 실행
 */
function createMigrationTrigger() {
  // 기존 마이그레이션 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'continueMigration') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('continueMigration')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('자동 실행 트리거 생성 완료 (1분 간격)');
  Logger.log('완료 후 deleteMigrationTrigger()로 트리거를 삭제하세요.');
}

/**
 * 자동 실행 트리거 삭제
 */
function deleteMigrationTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'continueMigration') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log(count + '개 마이그레이션 트리거 삭제됨');
}

// =============================================================================
// 테스트 및 미리보기
// =============================================================================

/**
 * 설정 테스트
 */
function testMigrationSetup() {
  var config = getMigrationConfig();

  Logger.log('=== 마이그레이션 설정 확인 ===');
  Logger.log('Supabase URL: ' + (config.supabaseUrl ? '설정됨' : '미설정'));
  Logger.log('Service Role Key: ' + (config.serviceRoleKey ? '설정됨' : '미설정'));
  Logger.log('Spreadsheet ID: ' + (config.spreadsheetId || '미설정'));
  Logger.log('Doctor ID: ' + (config.doctorId || '미설정'));

  if (config.spreadsheetId) {
    Logger.log('\n=== 스프레드시트 확인 ===');
    try {
      var datedSheets = getDatedSheets();
      Logger.log('날짜별 시트: ' + datedSheets.length + '개');
      if (datedSheets.length > 0) {
        Logger.log('첫 번째: ' + datedSheets[0].name + ' → ' + datedSheets[0].date);
        Logger.log('마지막: ' + datedSheets[datedSheets.length - 1].name + ' → ' + datedSheets[datedSheets.length - 1].date);

        // 2026년 시트 수
        var count2026 = datedSheets.filter(function (s) { return is2026(s.date); }).length;
        Logger.log('2026년 시트: ' + count2026 + '개 (약변경 마이그레이션 대상)');
      }
    } catch (e) {
      Logger.log('스프레드시트 접근 오류: ' + e.message);
    }
  }

  if (config.supabaseUrl && config.serviceRoleKey) {
    Logger.log('\n=== Supabase 확인 ===');
    try {
      var patientMap = loadPatientIdMap();
      Logger.log('환자 매핑: ' + Object.keys(patientMap).length + '명');

      var existing = migrationSupabaseRequest('consultations', 'get', {
        query: 'select=id&limit=1',
      });
      Logger.log('consultations 테이블 접근: OK');
    } catch (e) {
      Logger.log('Supabase 오류: ' + e.message);
    }
  }

  Logger.log('\n=== 테스트 완료 ===');
}

/**
 * 샘플 시트 미리보기 (마이그레이션 없이)
 */
function previewMigrationData() {
  var config = getMigrationConfig();
  var datedSheets = getDatedSheets();

  if (datedSheets.length === 0) {
    Logger.log('날짜별 시트가 없습니다.');
    return;
  }

  // 최근 3개 시트 미리보기
  var previewSheets = datedSheets.slice(-3);
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

  for (var i = 0; i < previewSheets.length; i++) {
    var info = previewSheets[i];
    var sheet = spreadsheet.getSheetByName(info.name);
    if (!sheet) continue;

    Logger.log('\n=== ' + info.name + ' (' + info.date + ') ===');

    var patients = parseCommentSheet(sheet);
    Logger.log('데이터 있는 환자: ' + patients.length + '명');

    for (var p = 0; p < Math.min(5, patients.length); p++) {
      var patient = patients[p];
      var preview = 'IDNO=' + patient.idno;
      if (patient.note) preview += ' | note=' + patient.note.substring(0, 50);
      if (patient.medChange) preview += ' | 약변경=' + patient.medChange.substring(0, 50);
      Logger.log('  ' + preview);
    }
    if (patients.length > 5) {
      Logger.log('  ... 외 ' + (patients.length - 5) + '명');
    }
  }
}

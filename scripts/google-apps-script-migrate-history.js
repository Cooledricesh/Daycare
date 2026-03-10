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
// 요일별 진찰 의사 매핑
// =============================================================================
// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Mon/Tue/Wed: 박승현 (DOCTOR_ID from config)
// Thu: 박명현, Fri: 신정욱
var DAY_DOCTOR_NAME_MAP = {
  4: '박명현',
  5: '신정욱',
};

var DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// =============================================================================
// Supabase REST API 헬퍼
// =============================================================================

/**
 * 해당 날짜의 기존 메시지를 조회하여 중복 메시지를 필터링
 * (patient_id, content) 조합이 이미 존재하면 제외
 * @param {string} date - YYYY-MM-DD 형식
 * @param {Array<Object>} messageRecords - 삽입할 메시지 배열
 * @returns {Array<Object>} - 중복 제거된 메시지 배열
 */
function filterDuplicateMessages(date, messageRecords) {
  if (!messageRecords || messageRecords.length === 0) return [];

  var existing = migrationSupabaseRequest('messages', 'get', {
    query: 'select=patient_id,content&date=eq.' + date,
  });

  if (!existing || existing.length === 0) return messageRecords;

  var existingSet = {};
  for (var i = 0; i < existing.length; i++) {
    var key = existing[i].patient_id + '|' + existing[i].content;
    existingSet[key] = true;
  }

  var filtered = [];
  for (var j = 0; j < messageRecords.length; j++) {
    var msgKey = messageRecords[j].patient_id + '|' + messageRecords[j].content;
    if (!existingSet[msgKey]) {
      filtered.push(messageRecords[j]);
    }
  }

  var skipped = messageRecords.length - filtered.length;
  if (skipped > 0) {
    Logger.log('  메시지 중복 ' + skipped + '건 스킵 (날짜: ' + date + ')');
  }

  return filtered;
}

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
// 요일별 의사 매핑 헬퍼
// =============================================================================

/**
 * staff 테이블에서 의사 이름 → UUID 매핑 로드
 * @returns {Object} - { '박명현': 'uuid', '신정욱': 'uuid', ... }
 */
function loadDoctorNameMap() {
  var data = migrationSupabaseRequest('staff', 'get', {
    query: 'role=eq.doctor&is_active=eq.true&select=id,name',
  });
  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      map[data[i].name] = data[i].id;
    }
  }
  Logger.log('의사 매핑 로드: ' + Object.keys(map).length + '명');
  return map;
}

/**
 * 요일(dayOfWeek)로부터 진찰 담당 의사 UUID를 반환
 * - 월/화/수: defaultDoctorId (박승현)
 * - 목: 박명현, 금: 신정욱
 * @param {number} dayOfWeek - 0=Sun ~ 6=Sat
 * @param {string} defaultDoctorId - 기본 의사 UUID (박승현)
 * @param {Object} doctorNameMap - 의사 이름 → UUID 매핑
 * @returns {string} - 의사 UUID
 */
function getDoctorIdForDay(dayOfWeek, defaultDoctorId, doctorNameMap) {
  var doctorName = DAY_DOCTOR_NAME_MAP[dayOfWeek];
  if (doctorName && doctorNameMap[doctorName]) {
    return doctorNameMap[doctorName];
  }
  return defaultDoctorId;
}

// =============================================================================
// 환자 IDNO → UUID 매핑 로드
// =============================================================================

function loadPatientIdMap() {
  var data = migrationSupabaseRequest('patients', 'get', {
    query: 'select=id,patient_id_no,coordinator_id&patient_id_no=not.is.null',
  });

  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].patient_id_no) {
        map[String(data[i].patient_id_no).trim()] = {
          id: data[i].id,
          coordinatorId: data[i].coordinator_id,
        };
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
    else if (headerName === '진찰') colMap.consulted = h;
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

    var consulted = colMap.consulted !== undefined ? (row[colMap.consulted] === true || String(row[colMap.consulted]).trim().toUpperCase() === 'TRUE') : false;
    var progress = colMap.progress !== undefined ? String(row[colMap.progress] || '').trim() : '';
    var medChange = colMap.medChange !== undefined ? String(row[colMap.medChange] || '').trim() : '';
    var psychTest = colMap.psychTest !== undefined ? String(row[colMap.psychTest] || '').trim() : '';

    // 진찰 체크도 없고 Progress와 약변경도 모두 비어있으면 건너뛰기
    if (!consulted && !progress && !medChange && !psychTest) continue;

    // note 조합: Progress + 심리검사 (있으면)
    var noteParts = [];
    if (progress) noteParts.push(progress);
    if (psychTest) noteParts.push('[심리검사] ' + psychTest);
    var note = noteParts.join('\n');

    patients.push({
      idno: idno,
      consulted: consulted,
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
 * 환자 데이터로부터 출석/진찰/메시지 레코드 빌드
 * @param {Array<Object>} patients - parseCommentSheet() 결과
 * @param {string} sheetDate - YYYY-MM-DD
 * @param {Object} patientMap - IDNO → { id, coordinatorId }
 * @param {string} sheetDoctorId - 해당 요일 의사 UUID
 * @param {boolean} isThuFri - 목/금 여부
 * @returns {Object} - { attendanceRecords, consultationRecords, messageRecords, patientsNotFound }
 */
function buildRecordsForSheet(patients, sheetDate, patientMap, sheetDoctorId, isThuFri) {
  var result = {
    attendanceRecords: [],
    consultationRecords: [],
    messageRecords: [],
    patientsNotFound: 0,
  };

  for (var p = 0; p < patients.length; p++) {
    var patient = patients[p];
    var patientInfo = patientMap[patient.idno];

    if (!patientInfo) {
      result.patientsNotFound++;
      continue;
    }

    var patientId = patientInfo.id;
    var coordinatorId = patientInfo.coordinatorId;
    if (!patient.consulted && !patient.note && !patient.medChange) continue;

    // J열 → messages (담당 코디)
    if (patient.note && coordinatorId) {
      result.messageRecords.push({
        patient_id: patientId,
        date: sheetDate,
        author_id: coordinatorId,
        author_role: 'coordinator',
        content: patient.note,
      });
    }

    // I열 → consultations (목/금 의사만)
    if (isThuFri && patient.medChange) {
      result.consultationRecords.push({
        patient_id: patientId,
        date: sheetDate,
        doctor_id: sheetDoctorId,
        note: null,
        has_task: true,
        task_content: patient.medChange,
        task_target: 'nurse',
      });
    }

    // 출석: 진찰 체크(F열)된 경우에만 출석 생성 (메시지만 있는 경우 미출석 유지)
    var shouldAttend = patient.consulted;
    if (shouldAttend) {
      result.attendanceRecords.push({
        patient_id: patientId,
        date: sheetDate,
      });
    }

    // 목/금 진찰 체크 + 약변경 없음 → 빈 진찰 기록
    if (isThuFri && patient.consulted && !patient.medChange) {
      result.consultationRecords.push({
        patient_id: patientId,
        date: sheetDate,
        doctor_id: sheetDoctorId,
        note: null,
        has_task: false,
        task_content: null,
        task_target: null,
      });
    }
  }

  return result;
}

/**
 * 빌드된 레코드를 DB에 삽입하고 stats 업데이트
 * @param {string} sheetName - 시트명 (로깅용)
 * @param {string} sheetDate - YYYY-MM-DD
 * @param {Object} records - buildRecordsForSheet() 결과
 * @param {Object} stats - 누적 통계 (mutated)
 */
function insertSheetRecords(sheetName, sheetDate, records, stats) {
  if (records.attendanceRecords.length > 0) {
    try {
      migrationSupabaseRequest('attendances', 'post', {
        body: records.attendanceRecords,
        prefer: 'resolution=ignore-duplicates,return=minimal',
      });
      stats.attendancesInserted += records.attendanceRecords.length;
    } catch (e) {
      Logger.log('시트 ' + sheetName + ' 출석 오류: ' + e.message);
      stats.errors++;
    }
  }

  if (records.consultationRecords.length > 0) {
    try {
      migrationSupabaseRequest('consultations', 'post', {
        body: records.consultationRecords,
        query: 'on_conflict=patient_id,date',
        prefer: 'resolution=ignore-duplicates,return=minimal',
      });
      stats.consultationsInserted += records.consultationRecords.length;
    } catch (e) {
      Logger.log('시트 ' + sheetName + ' 진찰 오류: ' + e.message);
      stats.errors++;
    }
  }

  var filteredMessages = filterDuplicateMessages(sheetDate, records.messageRecords);
  if (filteredMessages.length > 0) {
    try {
      migrationSupabaseRequest('messages', 'post', {
        body: filteredMessages,
        prefer: 'return=minimal',
      });
      stats.messagesInserted += filteredMessages.length;
    } catch (e) {
      Logger.log('시트 ' + sheetName + ' 메시지 오류: ' + e.message);
      stats.errors++;
    }
  }

  stats.patientsNotFound += records.patientsNotFound;
}

/**
 * 시트 배치 처리 (startMigration/continueMigration용)
 * daily_stats 재계산 없이 레코드만 삽입
 */
function processBatch(startIndex, datedSheets, patientMap, doctorId, doctorNameMap) {
  var endIndex = Math.min(startIndex + BATCH_SIZE, datedSheets.length);
  var config = getMigrationConfig();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

  if (!doctorNameMap) {
    doctorNameMap = loadDoctorNameMap();
  }

  var stats = {
    sheetsProcessed: 0,
    consultationsInserted: 0,
    messagesInserted: 0,
    attendancesInserted: 0,
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

    var sheetDay = new Date(sheetInfo.date + 'T00:00:00+09:00').getDay();
    var isThuFri = (sheetDay === 4 || sheetDay === 5);
    var sheetDoctorId = getDoctorIdForDay(sheetDay, doctorId, doctorNameMap);

    var records = buildRecordsForSheet(patients, sheetInfo.date, patientMap, sheetDoctorId, isThuFri);
    insertSheetRecords(sheetInfo.name, sheetInfo.date, records, stats);

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

  // 환자 매핑 & 의사 매핑 로드
  var patientMap = loadPatientIdMap();
  var doctorNameMap = loadDoctorNameMap();

  // 진행 상태 초기화
  var props = PropertiesService.getScriptProperties();
  props.setProperty('MIGRATION_PROGRESS', '0');
  props.setProperty('MIGRATION_TOTAL_SHEETS', String(datedSheets.length));
  props.setProperty('MIGRATION_STATS', JSON.stringify({
    totalSheetsProcessed: 0,
    totalConsultationsInserted: 0,
    totalMessagesInserted: 0,
    totalAttendancesInserted: 0,
    totalPatientsNotFound: 0,
    totalErrors: 0,
  }));

  // 첫 배치 처리
  var stats = processBatch(0, datedSheets, patientMap, config.doctorId, doctorNameMap);

  // 진행 상태 업데이트
  var newProgress = Math.min(BATCH_SIZE, datedSheets.length);
  props.setProperty('MIGRATION_PROGRESS', String(newProgress));
  props.setProperty('MIGRATION_STATS', JSON.stringify({
    totalSheetsProcessed: stats.sheetsProcessed,
    totalConsultationsInserted: stats.consultationsInserted,
    totalMessagesInserted: stats.messagesInserted,
    totalAttendancesInserted: stats.attendancesInserted,
    totalPatientsNotFound: stats.patientsNotFound,
    totalErrors: stats.errors,
  }));

  Logger.log('배치 1 완료: ' + stats.sheetsProcessed + '개 시트 처리');
  Logger.log('진찰: ' + stats.consultationsInserted + ', 메시지: ' + stats.messagesInserted + ', 출석: ' + stats.attendancesInserted);

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
  var doctorNameMap = loadDoctorNameMap();

  var stats = processBatch(progress, datedSheets, patientMap, config.doctorId, doctorNameMap);

  // 누적 통계 업데이트
  var newProgress = Math.min(progress + BATCH_SIZE, datedSheets.length);
  totalStats.totalSheetsProcessed = (totalStats.totalSheetsProcessed || 0) + stats.sheetsProcessed;
  totalStats.totalConsultationsInserted = (totalStats.totalConsultationsInserted || 0) + stats.consultationsInserted;
  totalStats.totalMessagesInserted = (totalStats.totalMessagesInserted || 0) + stats.messagesInserted;
  totalStats.totalAttendancesInserted = (totalStats.totalAttendancesInserted || 0) + stats.attendancesInserted;
  totalStats.totalPatientsNotFound = (totalStats.totalPatientsNotFound || 0) + stats.patientsNotFound;
  totalStats.totalErrors = (totalStats.totalErrors || 0) + stats.errors;

  props.setProperty('MIGRATION_PROGRESS', String(newProgress));
  props.setProperty('MIGRATION_STATS', JSON.stringify(totalStats));

  Logger.log('배치 완료: 시트 ' + progress + '~' + (newProgress - 1));
  Logger.log('이번 배치: 진찰 ' + stats.consultationsInserted + ', 메시지 ' + stats.messagesInserted + ', 출석 ' + stats.attendancesInserted);

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
  Logger.log('진찰: ' + (stats.totalConsultationsInserted || 0));
  Logger.log('메시지: ' + (stats.totalMessagesInserted || 0));
  Logger.log('출석: ' + (stats.totalAttendancesInserted || 0));
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

// =============================================================================
// 증분 동기화 (새로 추가된 날짜만 마이그레이션)
// =============================================================================

/**
 * DB에 이미 존재하는 진찰 날짜 목록 조회
 * @returns {Object} - { "2026-02-10": true, ... } 형태의 맵
 */
function getExistingDatesFromDB() {
  var dates = {};
  var offset = 0;
  var pageSize = 1000;

  while (true) {
    var data = migrationSupabaseRequest('consultations', 'get', {
      query: 'select=date&order=date&offset=' + offset + '&limit=' + pageSize,
    });

    if (!data || data.length === 0) break;

    for (var i = 0; i < data.length; i++) {
      dates[data[i].date] = true;
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return dates;
}

/**
 * 특정 시트 목록을 처리하여 DB에 삽입
 *
 * 규칙:
 *   - J열 (progress) 모든 요일 → messages 테이블 (author=담당코디)
 *   - I열 (약변경) 목/금만 → consultations 테이블 (목=박명현, 금=신정욱)
 *   - I열 (약변경) 월~수 → 무시 (입력 없음)
 *   - F열 (진찰) 목/금 체크 → 출석 + 진찰
 *   - 월~수 → 데이터 있으면 출석
 *
 * @param {Array<Object>} sheets - { name, date } 배열
 * @param {Object} patientMap - IDNO → { id, coordinatorId } 매핑
 * @param {string} doctorId - 기본 의사 UUID (박승현)
 * @param {Object} [optDoctorNameMap] - 의사 이름 → UUID (미전달 시 자동 로드)
 * @returns {Object} - 처리 통계
 */
function processSheetList(sheets, patientMap, doctorId, optDoctorNameMap) {
  var config = getMigrationConfig();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var doctorNameMap = optDoctorNameMap || loadDoctorNameMap();

  var stats = {
    sheetsProcessed: 0,
    consultationsInserted: 0,
    messagesInserted: 0,
    attendancesInserted: 0,
    patientsNotFound: 0,
    errors: 0,
  };

  var processedDates = [];

  for (var i = 0; i < sheets.length; i++) {
    var sheetInfo = sheets[i];
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

    var sheetDay = new Date(sheetInfo.date + 'T00:00:00+09:00').getDay();
    var isThuFri = (sheetDay === 4 || sheetDay === 5);
    var sheetDoctorId = getDoctorIdForDay(sheetDay, doctorId, doctorNameMap);
    Logger.log('시트 ' + sheetInfo.name + ' (' + DAY_NAMES[sheetDay] + ') ' + (isThuFri ? '의사=' + (DAY_DOCTOR_NAME_MAP[sheetDay]) : '코디 기록만'));

    var records = buildRecordsForSheet(patients, sheetInfo.date, patientMap, sheetDoctorId, isThuFri);
    insertSheetRecords(sheetInfo.name, sheetInfo.date, records, stats);

    processedDates.push(sheetInfo.date);
    stats.sheetsProcessed++;
  }

  if (processedDates.length > 0) {
    recalculateDailyStats(processedDates);
  }

  return stats;
}

/**
 * 지정된 날짜들의 daily_stats를 재계산
 * @param {Array<string>} dates - YYYY-MM-DD 형식 날짜 배열
 */
function recalculateDailyStats(dates) {
  Logger.log('daily_stats 재계산: ' + dates.length + '개 날짜');

  for (var i = 0; i < dates.length; i++) {
    var date = dates[i];

    try {
      // 해당 날짜의 출석 수 조회
      var attendances = migrationSupabaseRequest('attendances', 'get', {
        query: 'select=id&date=eq.' + date,
      });
      var attendanceCount = attendances ? attendances.length : 0;

      // 해당 날짜의 진찰 수 조회
      var consultations = migrationSupabaseRequest('consultations', 'get', {
        query: 'select=id&date=eq.' + date,
      });
      var consultationCount = consultations ? consultations.length : 0;

      // 해당 날짜의 예정 환자 수 조회 (scheduled_attendances)
      var scheduled = migrationSupabaseRequest('scheduled_attendances', 'get', {
        query: 'select=id&date=eq.' + date + '&is_cancelled=eq.false',
      });
      var scheduledCount = scheduled ? scheduled.length : 0;

      // scheduled가 없으면 출석 수를 예정 수로 사용 (과거 데이터)
      if (scheduledCount === 0 && attendanceCount > 0) {
        scheduledCount = attendanceCount;
      }

      var attendanceRate = scheduledCount > 0 ? (attendanceCount / scheduledCount * 100) : null;
      var consultationRate = scheduledCount > 0 ? (consultationCount / scheduledCount * 100) : null;

      // daily_stats upsert
      migrationSupabaseRequest('daily_stats', 'post', {
        body: [{
          date: date,
          scheduled_count: scheduledCount,
          attendance_count: attendanceCount,
          consultation_count: consultationCount,
          attendance_rate: attendanceRate,
          consultation_rate: consultationRate,
          calculated_at: new Date().toISOString(),
        }],
        query: 'on_conflict=date',
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
    } catch (e) {
      Logger.log('daily_stats 재계산 오류 (' + date + '): ' + e.message);
    }
  }

  Logger.log('daily_stats 재계산 완료');
}

/**
 * 기존 날짜에 대해 데이터 보충 마이그레이션
 * J열→messages(코디), I열→consultations(목금 의사), 출석 보충
 */
function syncAttendancesOnly() {
  var config = getMigrationConfig();

  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId || !config.doctorId) {
    Logger.log('오류: 필수 설정값 누락');
    return;
  }

  Logger.log('=== 데이터 보충 시작 ===');

  var datedSheets = getDatedSheets();
  Logger.log('스프레드시트 날짜 시트: ' + datedSheets.length + '개');

  var patientMap = loadPatientIdMap();
  var stats = processSheetList(datedSheets, patientMap, config.doctorId);

  Logger.log('\n출석: ' + stats.attendancesInserted + '건');
  Logger.log('진찰(목금): ' + stats.consultationsInserted + '건');
  Logger.log('메시지(코디): ' + stats.messagesInserted + '건');
  Logger.log('오류: ' + stats.errors + '건');

  Logger.log('=== 데이터 보충 완료 ===');
}

/**
 * DB에 없는 새 날짜만 찾아서 미리보기 (마이그레이션 없이)
 */
function previewNewSheets() {
  var existingDates = getExistingDatesFromDB();
  var dateCount = Object.keys(existingDates).length;
  Logger.log('DB에 있는 날짜: ' + dateCount + '개');

  var datedSheets = getDatedSheets();
  Logger.log('스프레드시트 날짜 시트: ' + datedSheets.length + '개');

  var newSheets = [];
  for (var i = 0; i < datedSheets.length; i++) {
    if (!existingDates[datedSheets[i].date]) {
      newSheets.push(datedSheets[i]);
    }
  }

  Logger.log('\n=== 새로 추가된 날짜: ' + newSheets.length + '개 ===');
  for (var j = 0; j < newSheets.length; j++) {
    Logger.log('  ' + newSheets[j].date + ' (' + newSheets[j].name + ')');
  }

  if (newSheets.length === 0) {
    Logger.log('마이그레이션할 새 데이터가 없습니다.');
  }
}

// 최근 N일 이내 시트는 DB에 데이터가 있어도 항상 재동기화
// (마이그레이션 과도기: 앱과 시트 양쪽에서 데이터 입력될 수 있음)
var RECENT_SYNC_DAYS = 7;

/**
 * 스프레드시트 → DB 증분 동기화
 * - DB에 없는 새 날짜: 항상 동기화
 * - 최근 N일 이내 날짜: DB에 데이터가 있어도 항상 재동기화
 *   (ignore-duplicates로 기존 레코드 보존, 새 레코드만 추가)
 * - J열(progress) → messages (담당코디)
 * - I열(약변경) 목/금 → consultations (목=박명현, 금=신정욱)
 * - F열(진찰) 목/금 체크 → 출석+진찰, 월~수 데이터있으면 출석
 */
function syncNewSheets() {
  var config = getMigrationConfig();

  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId || !config.doctorId) {
    Logger.log('오류: 필수 설정값 누락');
    return;
  }

  Logger.log('=== 증분 동기화 시작 (최근 ' + RECENT_SYNC_DAYS + '일 항상 포함) ===');

  // 1. DB에 있는 날짜 목록 조회
  var existingDates = getExistingDatesFromDB();
  var dateCount = Object.keys(existingDates).length;
  Logger.log('DB에 있는 날짜: ' + dateCount + '개');

  // 2. 스프레드시트의 모든 날짜 시트
  var datedSheets = getDatedSheets();
  Logger.log('스프레드시트 날짜 시트: ' + datedSheets.length + '개');

  // 3. 최근 N일 기준일 계산
  var today = new Date();
  var recentCutoff = new Date(today.getTime() - RECENT_SYNC_DAYS * 24 * 60 * 60 * 1000);
  var recentCutoffStr = formatDateKST(recentCutoff);

  // 4. 동기화 대상 필터: DB에 없는 날짜 + 최근 N일 이내
  // (ignore-duplicates + 메시지 중복 필터링으로 오늘 날짜도 안전하게 처리)
  var sheetsToSync = [];
  var newCount = 0;
  var recentCount = 0;
  for (var i = 0; i < datedSheets.length; i++) {
    var sheetDate = datedSheets[i].date;
    var isNew = !existingDates[sheetDate];
    var isRecent = sheetDate >= recentCutoffStr;

    if (isNew || isRecent) {
      sheetsToSync.push(datedSheets[i]);
      if (isNew) newCount++;
      if (isRecent && !isNew) recentCount++;
    }
  }

  Logger.log('새 날짜: ' + newCount + '개, 최근 재동기화: ' + recentCount + '개');

  if (sheetsToSync.length === 0) {
    Logger.log('동기화할 데이터가 없습니다.');
    return;
  }

  for (var j = 0; j < sheetsToSync.length; j++) {
    var tag = existingDates[sheetsToSync[j].date] ? '(재동기화)' : '(신규)';
    var d = new Date(sheetsToSync[j].date + 'T00:00:00+09:00');
    var dayName = DAY_NAMES[d.getDay()];
    var isThuFriLabel = (d.getDay() === 4 || d.getDay() === 5);
    var label = isThuFriLabel ? ('약변경→' + DAY_DOCTOR_NAME_MAP[d.getDay()]) : 'progress→코디 메시지';
    Logger.log('  ' + sheetsToSync[j].date + ' (' + dayName + ') ' + tag + ' [' + label + ']');
  }

  // 5. 환자 매핑 로드
  var patientMap = loadPatientIdMap();

  // 6. 대상 시트들 처리
  var stats = processSheetList(sheetsToSync, patientMap, config.doctorId);

  Logger.log('\n=== 증분 동기화 완료 ===');
  Logger.log('처리 시트: ' + stats.sheetsProcessed + '개');
  Logger.log('진찰(목금): ' + stats.consultationsInserted + '건');
  Logger.log('메시지(코디): ' + stats.messagesInserted + '건');
  Logger.log('출석: ' + stats.attendancesInserted + '건');
  Logger.log('환자 미매칭: ' + stats.patientsNotFound + '건');
  Logger.log('오류: ' + stats.errors + '건');
}

// =============================================================================
// 일일 정기 동기화 (평일 오전 9시 크론잡)
// =============================================================================

/**
 * 일일 정기 동기화: 전날 + 당일 시트만 처리
 *
 * - 주말(토/일) 실행 시 자동 스킵
 * - 전날 시트: 추가된 기록 반영 (기존 consultation 보존, 새 메시지만 추가)
 * - 당일 시트: 아침 시점까지 입력된 데이터 동기화
 * - 스케줄: createDailySyncTrigger()로 평일 오전 9시 설정
 */
function dailySync() {
  var config = getMigrationConfig();

  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId || !config.doctorId) {
    Logger.log('오류: 필수 설정값 누락');
    return;
  }

  // 주말 체크 (KST 기준)
  var now = new Date();
  var kstOffset = 9 * 60 * 60 * 1000;
  var kstNow = new Date(now.getTime() + kstOffset);
  var dayOfWeek = kstNow.getDay(); // 0=일, 6=토

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    Logger.log('주말이므로 동기화 스킵 (' + DAY_NAMES[dayOfWeek] + '요일)');
    return;
  }

  // 오늘/어제 날짜 계산 (KST)
  var todayStr = formatDateKST(kstNow);
  var yesterdayKST = new Date(kstNow.getTime() - 24 * 60 * 60 * 1000);
  var yesterdayStr = formatDateKST(yesterdayKST);

  // 어제가 일요일이면 금요일까지 확인 (월요일 실행 시)
  var targetDates = [yesterdayStr, todayStr];
  if (yesterdayKST.getDay() === 0) {
    // 어제=일요일 → 금요일, 토요일도 포함
    var fridayKST = new Date(kstNow.getTime() - 3 * 24 * 60 * 60 * 1000);
    var saturdayKST = new Date(kstNow.getTime() - 2 * 24 * 60 * 60 * 1000);
    targetDates = [formatDateKST(fridayKST), formatDateKST(saturdayKST), yesterdayStr, todayStr];
  }

  Logger.log('=== 일일 동기화 시작 ===');
  Logger.log('대상 날짜: ' + targetDates.join(', '));

  // 스프레드시트에서 대상 날짜 시트 찾기
  var datedSheets = getDatedSheets();
  var sheetsToSync = [];

  for (var i = 0; i < datedSheets.length; i++) {
    for (var j = 0; j < targetDates.length; j++) {
      if (datedSheets[i].date === targetDates[j]) {
        sheetsToSync.push(datedSheets[i]);
        break;
      }
    }
  }

  if (sheetsToSync.length === 0) {
    Logger.log('동기화할 시트가 없습니다.');
    return;
  }

  for (var k = 0; k < sheetsToSync.length; k++) {
    var d = new Date(sheetsToSync[k].date + 'T00:00:00+09:00');
    Logger.log('  ' + sheetsToSync[k].date + ' (' + DAY_NAMES[d.getDay()] + ') - ' + sheetsToSync[k].name);
  }

  // 환자 매핑 로드 & 처리
  var patientMap = loadPatientIdMap();
  var stats = processSheetList(sheetsToSync, patientMap, config.doctorId);

  Logger.log('\n=== 일일 동기화 완료 ===');
  Logger.log('처리 시트: ' + stats.sheetsProcessed + '개');
  Logger.log('출석: ' + stats.attendancesInserted + '건');
  Logger.log('진찰(목금): ' + stats.consultationsInserted + '건');
  Logger.log('메시지(코디): ' + stats.messagesInserted + '건');
  Logger.log('환자 미매칭: ' + stats.patientsNotFound + '건');
  Logger.log('오류: ' + stats.errors + '건');
}

/**
 * KST Date → YYYY-MM-DD 문자열
 */
function formatDateKST(kstDate) {
  return kstDate.getFullYear() + '-' +
    String(kstDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(kstDate.getDate()).padStart(2, '0');
}

/**
 * 일일 동기화 트리거 생성: 평일 매일 오전 9시 KST
 * 이 함수를 한 번만 수동 실행하면 됩니다.
 */
function createDailySyncTrigger() {
  // 기존 dailySync 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailySync') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('기존 dailySync 트리거 삭제됨');
    }
  }

  // 매일 오전 9시 KST (주말 스킵은 함수 내에서 처리)
  ScriptApp.newTrigger('dailySync')
    .timeBased()
    .atHour(9)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Seoul')
    .create();

  Logger.log('트리거 생성 완료: 매일 오전 9:00 KST (주말 자동 스킵)');
}

/**
 * 일일 동기화 트리거 삭제
 */
function deleteDailySyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailySync') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log(count + '개 dailySync 트리거 삭제됨');
}

// =============================================================================
// 테스트 및 미리보기
// =============================================================================

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

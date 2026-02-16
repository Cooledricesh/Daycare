/**
 * Google Apps Script: Wellington 낮병원 환자 동기화
 *
 * 목적: Google Drive의 환자 명단 스프레드시트를 읽어
 *       Supabase REST API로 직접 동기화
 *
 * 스케줄: 매일 오전 8:15 KST (Google Apps Script Triggers)
 *
 * 설정 방법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드 전체를 붙여넣기
 * 3. 프로젝트 설정 > 스크립트 속성에 아래 값 설정:
 *    - SUPABASE_URL: Supabase 프로젝트 URL
 *    - SUPABASE_SERVICE_ROLE_KEY: Service Role Key
 *    - SPREADSHEET_ID: Google Sheets 파일 ID
 *    - SHEET_NAME: 시트 탭 이름 (기본: Sheet1)
 * 4. testConnection() 실행하여 연결 확인
 * 5. createTimeTrigger() 실행하여 자동 트리거 설정
 */

// =============================================================================
// 설정
// =============================================================================

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl: props.getProperty('SUPABASE_URL'),
    serviceRoleKey: props.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME') || 'Sheet1',
  };
}

// =============================================================================
// Supabase REST API 헬퍼
// =============================================================================

/**
 * Supabase REST API 호출
 * @param {string} table - 테이블명
 * @param {string} method - HTTP 메서드
 * @param {Object} options - 추가 옵션 (query, body, headers)
 * @returns {Object} - 응답 데이터
 */
function supabaseRequest(table, method, options) {
  var config = getConfig();
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
      'Prefer': 'return=representation',
    },
    muteHttpExceptions: true,
  };

  if (options && options.headers) {
    for (var key in options.headers) {
      fetchOptions.headers[key] = options.headers[key];
    }
  }

  if (options && options.body) {
    fetchOptions.payload = JSON.stringify(options.body);
  }

  var response = UrlFetchApp.fetch(url, fetchOptions);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Supabase API 오류 [' + code + ']: ' + text);
  }

  if (!text || text === '') return null;
  return JSON.parse(text);
}

// =============================================================================
// 스프레드시트 읽기
// =============================================================================

/**
 * Google Drive의 Excel 파일에서 환자 데이터 읽기
 *
 * Drive API로 Excel을 임시 Google Sheets로 변환 후 읽음
 * 사전 준비: Apps Script 편집기 > 서비스 > Drive API v2 추가 필요
 *
 * @returns {Array<Object>} - 파싱된 환자 데이터 배열
 */
function readPatientData() {
  var config = getConfig();
  var data = readExcelFromDrive(config.spreadsheetId, config.sheetName);

  Logger.log('총 ' + data.length + '행 읽음');

  if (data.length <= 1) {
    Logger.log('데이터 없음 (헤더만 존재)');
    return [];
  }

  // 헤더 확인 (첫 번째 행)
  Logger.log('헤더: ' + JSON.stringify(data[0]));

  // 컬럼 인덱스 (0-based)
  // A(0):No, B(1):호실, C(2):IDNO, D(3):환자명, E(4):성/나, F(5):급종,
  // G(6):입원일, H(7):일, I(8):과, J(9):의사명, K(10):수술일, L(11):병명, M(12):수술명

  var patients = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var patientIdNo = String(row[2] || '').trim();

    // IDNO 없으면 건너뛰기
    if (!patientIdNo || patientIdNo === 'undefined' || patientIdNo === 'null' || patientIdNo === '0') {
      continue;
    }

    patients.push({
      no: row[0] || 0,
      roomNumber: String(row[1] || '').trim(),
      patientIdNo: patientIdNo,
      name: String(row[3] || '').trim(),
      genderAge: String(row[4] || '').trim(),
      insuranceType: String(row[5] || '').trim(),
      admissionDate: String(row[6] || '').trim(),
      days: Number(row[7]) || 0,
      department: String(row[8] || '').trim(),
      doctorName: String(row[9] || '').trim(),
      surgeryDate: String(row[10] || '').trim(),
      diagnosis: String(row[11] || '').trim(),
      surgeryName: String(row[12] || '').trim(),
    });
  }

  Logger.log('파싱된 환자 수: ' + patients.length);
  return patients;
}

/**
 * Google Drive의 Excel 파일을 임시 Google Sheets로 변환하여 읽기
 * Drive API 고급 서비스 필요 (편집기 > 서비스 > Drive API v2 추가)
 *
 * @param {string} fileId - Google Drive 파일 ID
 * @param {string} sheetName - 읽을 시트 탭 이름
 * @returns {Array<Array>} - 2D 배열
 */
function readExcelFromDrive(fileId, sheetName) {
  var file = DriveApp.getFileById(fileId);
  Logger.log('파일 읽기: ' + file.getName() + ' (' + file.getMimeType() + ')');

  // Excel -> Google Sheets 임시 변환
  var tempTitle = 'TempConversion_' + new Date().getTime();
  var convertedFile = Drive.Files.copy(
    { title: tempTitle, mimeType: MimeType.GOOGLE_SHEETS },
    fileId
  );

  Logger.log('임시 변환 파일 생성: ' + convertedFile.id);

  try {
    var spreadsheet = SpreadsheetApp.openById(convertedFile.id);
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.getSheets()[0];
      Logger.log('시트 "' + sheetName + '" 없음, 첫 번째 시트 사용: ' + sheet.getName());
    }
    var data = sheet.getDataRange().getValues();
    Logger.log('Excel에서 ' + data.length + '행 읽음');
    return data;
  } finally {
    // 임시 파일 삭제
    Drive.Files.remove(convertedFile.id);
    Logger.log('임시 파일 삭제 완료');
  }
}

// =============================================================================
// 동기화 로직 (PatientSyncService 포팅)
// =============================================================================

/**
 * 성별 파싱 (예: "M/45" -> "M")
 */
function parseGender(genderAge) {
  if (!genderAge) return null;
  var gender = genderAge.split('/')[0].trim().toUpperCase();
  if (gender === 'M' || gender === 'F') return gender;
  return null;
}

/**
 * 호실-담당자 매핑 조회
 * @returns {Object} - { room_prefix: coordinator_id }
 */
function getRoomMappings() {
  var data = supabaseRequest('room_coordinator_mapping', 'get', {
    query: 'is_active=eq.true&select=room_prefix,coordinator_id',
  });

  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      map[data[i].room_prefix] = data[i].coordinator_id;
    }
  }
  return map;
}

/**
 * 의사명 -> 의사 ID 매핑 조회
 * @returns {Object} - { doctor_name: doctor_id }
 */
function getDoctorMappings() {
  var data = supabaseRequest('staff', 'get', {
    query: 'role=eq.doctor&is_active=eq.true&select=id,name',
  });

  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      map[data[i].name] = data[i].id;
    }
  }
  return map;
}

/**
 * 기존 환자 목록 조회 (patient_id_no 기준)
 * @returns {Object} - { patient_id_no: patient_data }
 */
function getExistingPatients() {
  var data = supabaseRequest('patients', 'get', {
    query: 'select=*',
  });

  var map = {};
  if (data) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].patient_id_no) {
        map[data[i].patient_id_no] = data[i];
      }
    }
  }
  return map;
}

/**
 * 동기화 로그 생성
 * @returns {string} - sync log ID
 */
function createSyncLog() {
  var data = supabaseRequest('sync_logs', 'post', {
    body: {
      source: 'google_sheets',
      triggered_by: 'apps_script_scheduler',
      status: 'running',
    },
  });

  return data[0].id;
}

/**
 * 동기화 로그 업데이트
 */
function updateSyncLog(syncId, result, status) {
  supabaseRequest('sync_logs', 'patch', {
    query: 'id=eq.' + syncId,
    body: {
      status: status,
      completed_at: new Date().toISOString(),
      total_in_source: result.totalInSource,
      total_processed: result.totalProcessed,
      inserted: result.inserted,
      updated: result.updated,
      discharged: result.discharged,
      reactivated: result.reactivated,
      unchanged: result.unchanged,
      skipped: result.skipped,
      error_message: result.errorMessage || null,
      details: {
        changes: result.changes.slice(0, 100), // 최대 100개까지만 저장
        skipped_reasons: result.skippedReasons.slice(0, 50),
      },
    },
  });
}

/**
 * 메인 동기화 함수
 * PatientSyncService.syncPatients() 로직을 그대로 포팅
 */
function syncPatientDepartments() {
  var config = getConfig();

  // 설정 검증
  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId) {
    Logger.log('오류: 필수 설정값이 없습니다. 스크립트 속성을 확인해주세요.');
    Logger.log('필수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPREADSHEET_ID');
    throw new Error('필수 설정값 누락');
  }

  Logger.log('=== Wellington 환자 동기화 시작 ===');
  Logger.log('시간: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

  var syncId = '';
  var result = {
    totalInSource: 0,
    totalProcessed: 0,
    inserted: 0,
    updated: 0,
    discharged: 0,
    reactivated: 0,
    unchanged: 0,
    skipped: 0,
    changes: [],
    skippedReasons: [],
    errorMessage: null,
  };

  try {
    // 동기화 로그 생성
    syncId = createSyncLog();
    Logger.log('동기화 로그 ID: ' + syncId);

    // 1. 스프레드시트에서 환자 데이터 읽기
    var allPatients = readPatientData();
    result.totalInSource = allPatients.length;

    // 2. 낮병원 환자만 필터링 (호실 >= 3000)
    var daycarePatients = allPatients.filter(function (p) {
      var roomNum = parseInt(p.roomNumber, 10);
      return !isNaN(roomNum) && roomNum >= 3000;
    });

    Logger.log('전체 환자: ' + allPatients.length + ', 낮병원 환자: ' + daycarePatients.length);

    // 3. 매핑 데이터 조회
    var roomMappings = getRoomMappings();
    var doctorMappings = getDoctorMappings();
    var existingPatients = getExistingPatients();

    Logger.log('호실 매핑: ' + Object.keys(roomMappings).length + '개');
    Logger.log('의사 매핑: ' + Object.keys(doctorMappings).length + '개');
    Logger.log('기존 환자: ' + Object.keys(existingPatients).length + '명');

    // 소스에 있는 환자 ID 목록 (퇴원 처리용)
    var sourcePatientIdNos = {};

    // 4. 각 환자 처리
    for (var i = 0; i < daycarePatients.length; i++) {
      var patient = daycarePatients[i];

      if (!patient.patientIdNo) {
        result.skipped++;
        result.skippedReasons.push({
          patientIdNo: '',
          name: patient.name,
          reason: '병록번호(IDNO) 없음',
        });
        continue;
      }

      sourcePatientIdNos[patient.patientIdNo] = true;

      var existing = existingPatients[patient.patientIdNo];
      var gender = parseGender(patient.genderAge);
      var coordinatorId = roomMappings[patient.roomNumber] || null;
      var doctorId = doctorMappings[patient.doctorName] || null;

      if (!existing) {
        // 신규 환자 - INSERT
        result.inserted++;
        result.changes.push({
          patientIdNo: patient.patientIdNo,
          name: patient.name,
          action: 'insert',
        });

        supabaseRequest('patients', 'post', {
          body: {
            name: patient.name,
            patient_id_no: patient.patientIdNo,
            room_number: patient.roomNumber,
            gender: gender,
            coordinator_id: coordinatorId,
            doctor_id: doctorId,
            status: 'active',
            last_synced_at: new Date().toISOString(),
            sync_source: 'google_sheets',
          },
        });

      } else if (existing.status === 'discharged') {
        // 퇴원했다가 재입원 - REACTIVATE
        result.reactivated++;
        result.changes.push({
          patientIdNo: patient.patientIdNo,
          name: patient.name,
          action: 'reactivate',
          fields: { status: { old: 'discharged', new: 'active' } },
        });

        supabaseRequest('patients', 'patch', {
          query: 'id=eq.' + existing.id,
          body: {
            status: 'active',
            room_number: patient.roomNumber,
            coordinator_id: coordinatorId,
            doctor_id: doctorId,
            last_synced_at: new Date().toISOString(),
            sync_source: 'google_sheets',
          },
        });

      } else {
        // 기존 환자 - 변경사항 확인
        var changes = {};
        var updateData = {};
        var hasChanges = false;

        if (existing.name !== patient.name) {
          changes['name'] = { old: existing.name, new: patient.name };
          updateData.name = patient.name;
          hasChanges = true;
        }
        if (existing.room_number !== patient.roomNumber) {
          changes['room_number'] = { old: existing.room_number, new: patient.roomNumber };
          updateData.room_number = patient.roomNumber;
          hasChanges = true;
        }
        if (existing.coordinator_id !== coordinatorId) {
          changes['coordinator_id'] = { old: existing.coordinator_id, new: coordinatorId };
          updateData.coordinator_id = coordinatorId;
          hasChanges = true;
        }
        if (existing.doctor_id !== doctorId) {
          changes['doctor_id'] = { old: existing.doctor_id, new: doctorId };
          updateData.doctor_id = doctorId;
          hasChanges = true;
        }
        if (existing.gender !== gender) {
          changes['gender'] = { old: existing.gender, new: gender };
          updateData.gender = gender;
          hasChanges = true;
        }

        if (hasChanges) {
          result.updated++;
          result.changes.push({
            patientIdNo: patient.patientIdNo,
            name: patient.name,
            action: 'update',
            fields: changes,
          });

          updateData.last_synced_at = new Date().toISOString();
          updateData.sync_source = 'google_sheets';

          supabaseRequest('patients', 'patch', {
            query: 'id=eq.' + existing.id,
            body: updateData,
          });
        } else {
          result.unchanged++;
        }
      }

      result.totalProcessed++;
    }

    // 5. 명단에서 제외된 환자 퇴원 처리
    var existingKeys = Object.keys(existingPatients);
    for (var j = 0; j < existingKeys.length; j++) {
      var patientIdNo = existingKeys[j];
      var p = existingPatients[patientIdNo];

      // 이미 퇴원 상태거나 소스에 있는 환자는 건너뛰기
      if (p.status === 'discharged' || sourcePatientIdNos[patientIdNo]) {
        continue;
      }

      // 호실이 3000 미만인 환자는 병동 환자이므로 건너뛰기
      var roomNum = parseInt(p.room_number || '0', 10);
      if (isNaN(roomNum) || roomNum < 3000) {
        continue;
      }

      // 명단에서 삭제됨 - 퇴원 처리
      result.discharged++;
      result.changes.push({
        patientIdNo: patientIdNo,
        name: p.name,
        action: 'discharge',
      });

      supabaseRequest('patients', 'patch', {
        query: 'id=eq.' + p.id,
        body: {
          status: 'discharged',
          last_synced_at: new Date().toISOString(),
          sync_source: 'google_sheets',
        },
      });
    }

    // 동기화 로그 업데이트
    updateSyncLog(syncId, result, 'completed');

    // 결과 로깅
    Logger.log('=== 동기화 결과 ===');
    Logger.log('전체 소스: ' + result.totalInSource);
    Logger.log('처리됨: ' + result.totalProcessed);
    Logger.log('신규: ' + result.inserted);
    Logger.log('업데이트: ' + result.updated);
    Logger.log('퇴원: ' + result.discharged);
    Logger.log('재활성화: ' + result.reactivated);
    Logger.log('변경없음: ' + result.unchanged);
    Logger.log('건너뜀: ' + result.skipped);

    // 이슈가 있으면 알림 메일
    if (result.skipped > 5) {
      sendNotificationEmail(result);
    }

    Logger.log('=== 동기화 완료! ===');

  } catch (error) {
    Logger.log('오류: ' + error.message);
    Logger.log('스택: ' + error.stack);

    result.errorMessage = error.message;

    if (syncId) {
      try {
        updateSyncLog(syncId, result, 'failed');
      } catch (logError) {
        Logger.log('로그 업데이트 실패: ' + logError.message);
      }
    }

    sendErrorEmail(error);
    throw error;
  }
}

// =============================================================================
// 테스트 및 유틸리티
// =============================================================================

/**
 * 연결 테스트
 */
function testConnection() {
  var config = getConfig();

  Logger.log('=== 설정 확인 ===');
  Logger.log('Supabase URL: ' + (config.supabaseUrl ? '설정됨' : '미설정'));
  Logger.log('Service Role Key: ' + (config.serviceRoleKey ? '설정됨 (' + config.serviceRoleKey.substring(0, 20) + '...)' : '미설정'));
  Logger.log('Spreadsheet ID: ' + (config.spreadsheetId || '미설정'));
  Logger.log('Sheet Name: ' + config.sheetName);

  // 스프레드시트 접근 테스트
  if (config.spreadsheetId) {
    Logger.log('\n=== 스프레드시트 접근 테스트 ===');
    try {
      // 먼저 파일 존재 확인
      var file = DriveApp.getFileById(config.spreadsheetId);
      Logger.log('파일 이름: ' + file.getName());
      Logger.log('파일 타입: ' + file.getMimeType());

      // 데이터 읽기 시도 (Excel이면 자동 변환)
      var data = readPatientData();
      Logger.log('데이터 행 수: ' + data.length);
      if (data.length > 0) {
        Logger.log('첫 번째 환자: ' + data[0].patientIdNo + ' ' + data[0].name);
      }
      Logger.log('스프레드시트 접근: OK');
    } catch (e) {
      Logger.log('스프레드시트 접근 오류: ' + e.message);
      Logger.log('Excel 파일인 경우: 편집기 > 서비스 > Drive API v2를 추가해주세요.');
    }
  }

  // Supabase 연결 테스트
  if (config.supabaseUrl && config.serviceRoleKey) {
    Logger.log('\n=== Supabase 연결 테스트 ===');
    try {
      var patients = supabaseRequest('patients', 'get', {
        query: 'select=id&limit=1',
      });
      Logger.log('Supabase 연결: OK');
      Logger.log('patients 테이블 접근 가능');

      // 매핑 테이블 확인
      var roomMappings = getRoomMappings();
      Logger.log('호실 매핑: ' + Object.keys(roomMappings).length + '개');

      var doctorMappings = getDoctorMappings();
      Logger.log('의사 매핑: ' + Object.keys(doctorMappings).length + '개');
      for (var name in doctorMappings) {
        Logger.log('  ' + name + ': ' + doctorMappings[name]);
      }
    } catch (e) {
      Logger.log('Supabase 연결 오류: ' + e.message);
    }
  }

  Logger.log('\n=== 테스트 완료 ===');
}

/**
 * 데이터 미리보기 (실제 동기화 없이)
 */
function previewData() {
  var config = getConfig();

  if (!config.spreadsheetId) {
    Logger.log('오류: SPREADSHEET_ID 미설정');
    return;
  }

  Logger.log('=== 데이터 미리보기 ===');

  try {
    var allPatients = readPatientData();

    // 낮병원 환자만 필터링
    var daycarePatients = allPatients.filter(function (p) {
      var roomNum = parseInt(p.roomNumber, 10);
      return !isNaN(roomNum) && roomNum >= 3000;
    });

    Logger.log('전체 환자: ' + allPatients.length);
    Logger.log('낮병원 환자 (호실>=3000): ' + daycarePatients.length);
    Logger.log('');

    // 첫 20명 출력
    Logger.log('낮병원 환자 (처음 20명):');
    for (var i = 0; i < Math.min(20, daycarePatients.length); i++) {
      var p = daycarePatients[i];
      Logger.log(
        '  ' + (i + 1) + '. ' +
        '호실=' + p.roomNumber + ', ' +
        'IDNO=' + p.patientIdNo + ', ' +
        '이름=' + p.name + ', ' +
        '성별/나이=' + p.genderAge + ', ' +
        '의사=' + p.doctorName
      );
    }

    // 호실별 분포
    var roomCounts = {};
    for (var j = 0; j < daycarePatients.length; j++) {
      var room = daycarePatients[j].roomNumber;
      roomCounts[room] = (roomCounts[room] || 0) + 1;
    }
    Logger.log('');
    Logger.log('호실별 환자 수:');
    var rooms = Object.keys(roomCounts).sort();
    for (var k = 0; k < rooms.length; k++) {
      Logger.log('  ' + rooms[k] + '호: ' + roomCounts[rooms[k]] + '명');
    }

  } catch (e) {
    Logger.log('오류: ' + e.message);
  }
}

/**
 * 동기화 시뮬레이션 (DB 변경 없이 결과만 확인)
 */
function dryRunSync() {
  var config = getConfig();

  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId) {
    Logger.log('오류: 필수 설정값이 없습니다.');
    return;
  }

  Logger.log('=== Dry Run (시뮬레이션) ===');
  Logger.log('실제 DB에는 변경사항이 저장되지 않습니다.\n');

  try {
    var allPatients = readPatientData();

    // 낮병원 환자만 필터링
    var daycarePatients = allPatients.filter(function (p) {
      var roomNum = parseInt(p.roomNumber, 10);
      return !isNaN(roomNum) && roomNum >= 3000;
    });

    // 매핑 데이터 조회
    var roomMappings = getRoomMappings();
    var doctorMappings = getDoctorMappings();
    var existingPatients = getExistingPatients();

    var sourcePatientIdNos = {};
    var inserts = [], updates = [], reactivates = [], unchanged = 0, skipped = 0;

    for (var i = 0; i < daycarePatients.length; i++) {
      var patient = daycarePatients[i];

      if (!patient.patientIdNo) {
        skipped++;
        continue;
      }

      sourcePatientIdNos[patient.patientIdNo] = true;
      var existing = existingPatients[patient.patientIdNo];
      var gender = parseGender(patient.genderAge);
      var coordinatorId = roomMappings[patient.roomNumber] || null;
      var doctorId = doctorMappings[patient.doctorName] || null;

      if (!existing) {
        inserts.push(patient.patientIdNo + ' (' + patient.name + ')');
      } else if (existing.status === 'discharged') {
        reactivates.push(patient.patientIdNo + ' (' + patient.name + ')');
      } else {
        var hasChanges = false;
        var changesDesc = [];
        if (existing.name !== patient.name) { changesDesc.push('이름'); hasChanges = true; }
        if (existing.room_number !== patient.roomNumber) { changesDesc.push('호실'); hasChanges = true; }
        if (existing.coordinator_id !== coordinatorId) { changesDesc.push('담당자'); hasChanges = true; }
        if (existing.doctor_id !== doctorId) { changesDesc.push('의사'); hasChanges = true; }
        if (existing.gender !== gender) { changesDesc.push('성별'); hasChanges = true; }

        if (hasChanges) {
          updates.push(patient.patientIdNo + ' (' + patient.name + '): ' + changesDesc.join(', '));
        } else {
          unchanged++;
        }
      }
    }

    // 퇴원 처리 대상
    var discharges = [];
    var existingKeys = Object.keys(existingPatients);
    for (var j = 0; j < existingKeys.length; j++) {
      var pid = existingKeys[j];
      var p = existingPatients[pid];
      if (p.status === 'discharged' || sourcePatientIdNos[pid]) continue;
      var roomNum = parseInt(p.room_number || '0', 10);
      if (isNaN(roomNum) || roomNum < 3000) continue;
      discharges.push(pid + ' (' + p.name + ')');
    }

    Logger.log('=== 시뮬레이션 결과 ===');
    Logger.log('전체 소스: ' + allPatients.length);
    Logger.log('낮병원 환자: ' + daycarePatients.length);
    Logger.log('');
    Logger.log('신규 추가 (' + inserts.length + '명):');
    for (var a = 0; a < inserts.length; a++) Logger.log('  + ' + inserts[a]);
    Logger.log('');
    Logger.log('정보 변경 (' + updates.length + '명):');
    for (var b = 0; b < updates.length; b++) Logger.log('  ~ ' + updates[b]);
    Logger.log('');
    Logger.log('재입원 (' + reactivates.length + '명):');
    for (var c = 0; c < reactivates.length; c++) Logger.log('  ↩ ' + reactivates[c]);
    Logger.log('');
    Logger.log('퇴원 처리 (' + discharges.length + '명):');
    for (var d = 0; d < discharges.length; d++) Logger.log('  - ' + discharges[d]);
    Logger.log('');
    Logger.log('변경없음: ' + unchanged + '명');
    Logger.log('건너뜀: ' + skipped + '명');

  } catch (e) {
    Logger.log('오류: ' + e.message);
    Logger.log('스택: ' + e.stack);
  }
}

// =============================================================================
// 알림
// =============================================================================

function sendNotificationEmail(result) {
  var recipient = Session.getActiveUser().getEmail();
  if (!recipient) return;

  var subject = '[Wellington] 환자 동기화 완료 (주의사항 있음)';
  var body = 'Wellington 환자 동기화 결과\n\n';
  body += '시간: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + '\n\n';
  body += '전체 소스: ' + result.totalInSource + '\n';
  body += '신규: ' + result.inserted + '\n';
  body += '업데이트: ' + result.updated + '\n';
  body += '퇴원: ' + result.discharged + '\n';
  body += '재활성화: ' + result.reactivated + '\n';
  body += '변경없음: ' + result.unchanged + '\n';
  body += '건너뜀: ' + result.skipped + '\n';

  if (result.skippedReasons && result.skippedReasons.length > 0) {
    body += '\n건너뛴 환자:\n';
    for (var i = 0; i < Math.min(20, result.skippedReasons.length); i++) {
      body += '  - ' + result.skippedReasons[i].name + ': ' + result.skippedReasons[i].reason + '\n';
    }
  }

  try {
    MailApp.sendEmail(recipient, subject, body);
    Logger.log('알림 메일 발송: ' + recipient);
  } catch (e) {
    Logger.log('메일 발송 실패: ' + e.message);
  }
}

function sendErrorEmail(error) {
  var recipient = Session.getActiveUser().getEmail();
  if (!recipient) return;

  var subject = '[Wellington] 환자 동기화 실패!';
  var body = 'Wellington 환자 동기화 오류 발생!\n\n';
  body += '시간: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + '\n\n';
  body += '오류: ' + error.message + '\n\n';
  body += '스택:\n' + error.stack;

  try {
    MailApp.sendEmail(recipient, subject, body);
    Logger.log('오류 메일 발송: ' + recipient);
  } catch (e) {
    Logger.log('메일 발송 실패: ' + e.message);
  }
}

// =============================================================================
// 트리거 관리
// =============================================================================

/**
 * 매일 오전 8:15 KST 자동 실행 트리거 생성
 * 이 함수를 한 번만 수동 실행하면 됩니다.
 */
function createTimeTrigger() {
  // 기존 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncPatientDepartments') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('기존 트리거 삭제됨');
    }
  }

  // 새 트리거 생성: 매일 오전 8:15 KST
  ScriptApp.newTrigger('syncPatientDepartments')
    .timeBased()
    .atHour(8)
    .nearMinute(15)
    .everyDays(1)
    .inTimezone('Asia/Seoul')
    .create();

  Logger.log('트리거 생성 완료: 매일 오전 8:15 KST');
}

/**
 * 모든 트리거 삭제
 */
function deleteAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    count++;
  }
  Logger.log(count + '개 트리거 삭제됨');
}

/**
 * 수동 실행
 */
function runSyncNow() {
  Logger.log('수동 동기화 시작...');
  syncPatientDepartments();
}

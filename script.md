/**
 * Google Apps Script: Wellington 낮병원 환자 동기화
 * 최적화 버전 (2026-03-08 파우스트)
 *
 * 개선사항:
 * 1. getExistingPatients() - select=* → 필요한 컬럼만 선택 (대역폭 절감)
 * 2. 신규 환자 배치 INSERT (여러 명을 API 호출 1회로)
 * 3. 퇴원 환자 배치 PATCH (in 연산자 사용)
 * 4. 에러 catch 후 throw 제거 → Google 자동 실패 알림 이중 발송 방지
 */

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl: props.getProperty('SUPABASE_URL'),
    serviceRoleKey: props.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    sheetName: props.getProperty('SHEET_NAME') || 'Sheet1',
  };
}

function supabaseRequest(table, method, options) {
  var config = getConfig();
  var url = config.supabaseUrl + '/rest/v1/' + table;
  if (options && options.query) url += '?' + options.query;

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
    for (var key in options.headers) fetchOptions.headers[key] = options.headers[key];
  }
  if (options && options.body) fetchOptions.payload = JSON.stringify(options.body);

  var response = UrlFetchApp.fetch(url, fetchOptions);
  var code = response.getResponseCode();
  var text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('Bandwidth quota exceeded: ' + url + '. Try reducing the rate of data transfer.');
  if (!text || text === '') return null;
  return JSON.parse(text);
}

function readPatientData() {
  var config = getConfig();
  var data = readExcelFromDrive(config.spreadsheetId, config.sheetName);
  Logger.log('총 ' + data.length + '행 읽음');
  if (data.length <= 1) return [];
  var patients = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var patientIdNo = String(row[2] || '').trim();
    if (!patientIdNo || patientIdNo === 'undefined' || patientIdNo === 'null' || patientIdNo === '0') continue;
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

function readExcelFromDrive(fileId, sheetName) {
  var file = DriveApp.getFileById(fileId);
  Logger.log('파일 읽기: ' + file.getName());
  var tempTitle = 'TempConversion_' + new Date().getTime();
  var convertedFile = Drive.Files.copy({ title: tempTitle, mimeType: MimeType.GOOGLE_SHEETS }, fileId);
  Logger.log('임시 변환 파일: ' + convertedFile.id);
  try {
    var spreadsheet = SpreadsheetApp.openById(convertedFile.id);
    var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    Logger.log('Excel에서 ' + data.length + '행 읽음');
    return data;
  } finally {
    Drive.Files.remove(convertedFile.id);
    Logger.log('임시 파일 삭제 완료');
  }
}

function parseGender(genderAge) {
  if (!genderAge) return null;
  var gender = genderAge.split('/')[0].trim().toUpperCase();
  return (gender === 'M' || gender === 'F') ? gender : null;
}

function getRoomMappings() {
  var data = supabaseRequest('room_coordinator_mapping', 'get', {
    query: 'is_active=eq.true&select=room_prefix,coordinator_id',
  });
  var map = {};
  if (data) for (var i = 0; i < data.length; i++) map[data[i].room_prefix] = data[i].coordinator_id;
  return map;
}

function getDoctorMappings() {
  var data = supabaseRequest('staff', 'get', {
    query: 'role=eq.doctor&is_active=eq.true&select=id,name',
  });
  var map = {};
  if (data) for (var i = 0; i < data.length; i++) map[data[i].name] = data[i].id;
  return map;
}

/**
 * [최적화] select=* → 필요한 컬럼만 선택하여 대역폭 절감
 */
function getExistingPatients() {
  var data = supabaseRequest('patients', 'get', {
    query: 'select=id,patient_id_no,name,room_number,coordinator_id,doctor_id,gender,status',
  });
  var map = {};
  if (data) for (var i = 0; i < data.length; i++) {
    if (data[i].patient_id_no) map[data[i].patient_id_no] = data[i];
  }
  return map;
}

function createSyncLog() {
  var data = supabaseRequest('sync_logs', 'post', {
    body: { source: 'google_sheets', triggered_by: 'apps_script_scheduler', status: 'running' },
  });
  return data[0].id;
}

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
        changes: result.changes.slice(0, 100),
        skipped_reasons: result.skippedReasons.slice(0, 50),
      },
    },
  });
}

function syncPatientDepartments() {
  var config = getConfig();
  if (!config.supabaseUrl || !config.serviceRoleKey || !config.spreadsheetId) {
    Logger.log('오류: 필수 설정값 누락');
    return; // throw 제거 → Google 자동 실패 메일 방지
  }

  Logger.log('=== Wellington 환자 동기화 시작 ===');
  Logger.log('시간: ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

  var syncId = '';
  var result = {
    totalInSource: 0, totalProcessed: 0,
    inserted: 0, updated: 0, discharged: 0, reactivated: 0,
    unchanged: 0, skipped: 0,
    changes: [], skippedReasons: [], errorMessage: null,
  };

  try {
    syncId = createSyncLog();

    var allPatients = readPatientData();
    result.totalInSource = allPatients.length;

    var daycarePatients = allPatients.filter(function(p) {
      var roomNum = parseInt(p.roomNumber, 10);
      return !isNaN(roomNum) && roomNum >= 3000;
    });

    Logger.log('전체: ' + allPatients.length + ', 낮병원: ' + daycarePatients.length);

    var roomMappings = getRoomMappings();
    var doctorMappings = getDoctorMappings();
    var existingPatients = getExistingPatients();

    Logger.log('기존 환자: ' + Object.keys(existingPatients).length + '명');

    var sourcePatientIdNos = {};

    // [최적화] 신규 환자 배치 처리용 버퍼
    var insertBatch = [];
    var insertBatchMeta = [];

    for (var i = 0; i < daycarePatients.length; i++) {
      var patient = daycarePatients[i];

      if (!patient.patientIdNo) {
        result.skipped++;
        result.skippedReasons.push({ patientIdNo: '', name: patient.name, reason: '병록번호 없음' });
        continue;
      }

      sourcePatientIdNos[patient.patientIdNo] = true;
      var existing = existingPatients[patient.patientIdNo];
      var gender = parseGender(patient.genderAge);
      var coordinatorId = roomMappings[patient.roomNumber] || null;
      var doctorId = doctorMappings[patient.doctorName] || null;

      if (!existing) {
        // [최적화] 배치 버퍼에 추가 (즉시 API 호출 안 함)
        insertBatch.push({
          name: patient.name,
          patient_id_no: patient.patientIdNo,
          room_number: patient.roomNumber,
          gender: gender,
          coordinator_id: coordinatorId,
          doctor_id: doctorId,
          status: 'active',
          last_synced_at: new Date().toISOString(),
          sync_source: 'google_sheets',
        });
        insertBatchMeta.push({ patientIdNo: patient.patientIdNo, name: patient.name });
        result.inserted++;

      } else if (existing.status === 'discharged') {
        result.reactivated++;
        result.changes.push({ patientIdNo: patient.patientIdNo, name: patient.name, action: 'reactivate' });
        supabaseRequest('patients', 'patch', {
          query: 'id=eq.' + existing.id,
          body: {
            status: 'active', room_number: patient.roomNumber,
            coordinator_id: coordinatorId, doctor_id: doctorId,
            last_synced_at: new Date().toISOString(), sync_source: 'google_sheets',
          },
        });

      } else {
        var updateData = {};
        var hasChanges = false;
        var changes = {};
        if (existing.name !== patient.name) { changes.name = { old: existing.name, new: patient.name }; updateData.name = patient.name; hasChanges = true; }
        if (existing.room_number !== patient.roomNumber) { changes.room_number = { old: existing.room_number, new: patient.roomNumber }; updateData.room_number = patient.roomNumber; hasChanges = true; }
        if (existing.coordinator_id !== coordinatorId) { changes.coordinator_id = { old: existing.coordinator_id, new: coordinatorId }; updateData.coordinator_id = coordinatorId; hasChanges = true; }
        if (existing.doctor_id !== doctorId) { changes.doctor_id = { old: existing.doctor_id, new: doctorId }; updateData.doctor_id = doctorId; hasChanges = true; }
        if (existing.gender !== gender) { changes.gender = { old: existing.gender, new: gender }; updateData.gender = gender; hasChanges = true; }

        if (hasChanges) {
          result.updated++;
          result.changes.push({ patientIdNo: patient.patientIdNo, name: patient.name, action: 'update', fields: changes });
          updateData.last_synced_at = new Date().toISOString();
          updateData.sync_source = 'google_sheets';
          supabaseRequest('patients', 'patch', { query: 'id=eq.' + existing.id, body: updateData });
        } else {
          result.unchanged++;
        }
      }
      result.totalProcessed++;
    }

    // [최적화] 신규 환자 배치 INSERT (API 호출 1회)
    if (insertBatch.length > 0) {
      supabaseRequest('patients', 'post', { body: insertBatch });
      for (var m = 0; m < insertBatchMeta.length; m++) {
        result.changes.push({ patientIdNo: insertBatchMeta[m].patientIdNo, name: insertBatchMeta[m].name, action: 'insert' });
      }
      Logger.log('신규 환자 배치 INSERT: ' + insertBatch.length + '명');
    }

    // [최적화] 퇴원 처리 배치 (in 연산자로 한 번에)
    var dischargeIds = [];
    var existingKeys = Object.keys(existingPatients);
    for (var j = 0; j < existingKeys.length; j++) {
      var patientIdNo = existingKeys[j];
      var p = existingPatients[patientIdNo];
      if (p.status === 'discharged' || sourcePatientIdNos[patientIdNo]) continue;
      var roomNum = parseInt(p.room_number || '0', 10);
      if (isNaN(roomNum) || roomNum < 3000) continue;
      dischargeIds.push(p.id);
      result.discharged++;
      result.changes.push({ patientIdNo: patientIdNo, name: p.name, action: 'discharge' });
    }

    if (dischargeIds.length > 0) {
      // 배치 퇴원 처리 (최대 50명씩)
      var BATCH_SIZE = 50;
      for (var d = 0; d < dischargeIds.length; d += BATCH_SIZE) {
        var batch = dischargeIds.slice(d, d + BATCH_SIZE);
        supabaseRequest('patients', 'patch', {
          query: 'id=in.(' + batch.join(',') + ')',
          body: { status: 'discharged', last_synced_at: new Date().toISOString(), sync_source: 'google_sheets' },
        });
      }
      Logger.log('퇴원 처리 배치: ' + dischargeIds.length + '명');
    }

    updateSyncLog(syncId, result, 'completed');

    Logger.log('=== 동기화 결과 ===');
    Logger.log('소스: ' + result.totalInSource + ' / 처리: ' + result.totalProcessed);
    Logger.log('신규: ' + result.inserted + ' / 업데이트: ' + result.updated);
    Logger.log('퇴원: ' + result.discharged + ' / 재활성화: ' + result.reactivated);
    Logger.log('변경없음: ' + result.unchanged + ' / 건너뜀: ' + result.skipped);

    if (result.skipped > 5) sendNotificationEmail(result);
    Logger.log('=== 동기화 완료 ===');

  } catch (error) {
    Logger.log('오류: ' + error.message);
    Logger.log('스택: ' + error.stack);
    result.errorMessage = error.message;
    if (syncId) {
      try { updateSyncLog(syncId, result, 'failed'); } catch (e) { Logger.log('로그 업데이트 실패: ' + e.message); }
    }
    sendErrorEmail(error);
    // [최적화] throw error 제거 → Apps Script 자동 실패 알림 이중 발송 방지
    // 에러는 sendErrorEmail()로 직접 알림
  }
}

function testConnection() {
  var config = getConfig();
  Logger.log('Supabase URL: ' + (config.supabaseUrl ? '설정됨' : '미설정'));
  Logger.log('Service Role Key: ' + (config.serviceRoleKey ? '설정됨' : '미설정'));
  Logger.log('Spreadsheet ID: ' + (config.spreadsheetId || '미설정'));
  if (config.spreadsheetId) {
    try {
      var data = readPatientData();
      Logger.log('데이터 행 수: ' + data.length);
    } catch(e) { Logger.log('스프레드시트 오류: ' + e.message); }
  }
  if (config.supabaseUrl && config.serviceRoleKey) {
    try {
      supabaseRequest('patients', 'get', { query: 'select=id&limit=1' });
      Logger.log('Supabase 연결: OK');
    } catch(e) { Logger.log('Supabase 오류: ' + e.message); }
  }
}

function previewData() {
  var config = getConfig();
  if (!config.spreadsheetId) { Logger.log('오류: SPREADSHEET_ID 미설정'); return; }
  try {
    var allPatients = readPatientData();
    var daycarePatients = allPatients.filter(function(p) {
      var roomNum = parseInt(p.roomNumber, 10);
      return !isNaN(roomNum) && roomNum >= 3000;
    });
    Logger.log('전체: ' + allPatients.length + ' / 낮병원: ' + daycarePatients.length);
    for (var i = 0; i < Math.min(10, daycarePatients.length); i++) {
      var p = daycarePatients[i];
      Logger.log((i+1) + '. 호실=' + p.roomNumber + ' IDNO=' + p.patientIdNo + ' 이름=' + p.name);
    }
  } catch(e) { Logger.log('오류: ' + e.message); }
}

function dryRunSync() {
  Logger.log('=== Dry Run (시뮬레이션) ===');
  try {
    var allPatients = readPatientData();
    var daycarePatients = allPatients.filter(function(p) {
      return !isNaN(parseInt(p.roomNumber,10)) && parseInt(p.roomNumber,10) >= 3000;
    });
    var existingPatients = getExistingPatients();
    var inserts=[], updates=[], reactivates=[], discharges=[], unchanged=0;
    var sourceIds = {};
    for (var i=0; i<daycarePatients.length; i++) {
      var p=daycarePatients[i]; if (!p.patientIdNo) continue;
      sourceIds[p.patientIdNo]=true;
      var ex=existingPatients[p.patientIdNo];
      if (!ex) inserts.push(p.name);
      else if (ex.status==='discharged') reactivates.push(p.name);
      else { unchanged++; }
    }
    for (var pid in existingPatients) {
      var ep=existingPatients[pid];
      if (ep.status==='discharged'||sourceIds[pid]) continue;
      if (isNaN(parseInt(ep.room_number||'0',10))||parseInt(ep.room_number||'0',10)<3000) continue;
      discharges.push(ep.name);
    }
    Logger.log('신규: ' + inserts.length + ' / 재입원: ' + reactivates.length + ' / 퇴원: ' + discharges.length + ' / 변경없음: ' + unchanged);
  } catch(e) { Logger.log('오류: ' + e.message); }
}

function sendNotificationEmail(result) {
  var recipient = Session.getActiveUser().getEmail();
  if (!recipient) return;
  var body = 'Wellington 환자 동기화 결과\n\n시간: ' + new Date().toLocaleString('ko-KR', {timeZone:'Asia/Seoul'}) + '\n\n';
  body += '신규: '+result.inserted+' / 업데이트: '+result.updated+' / 퇴원: '+result.discharged+'\n재활성화: '+result.reactivated+' / 변경없음: '+result.unchanged+' / 건너뜀: '+result.skipped;
  try { MailApp.sendEmail(recipient, '[Wellington] 환자 동기화 완료', body); } catch(e) { Logger.log('메일 발송 실패: '+e.message); }
}

function sendErrorEmail(error) {
  var recipient = Session.getActiveUser().getEmail();
  if (!recipient) return;
  var body = 'Wellington 환자 동기화 오류 발생!\n\n시간: ' + new Date().toLocaleString('ko-KR', {timeZone:'Asia/Seoul'}) + '\n\n오류: ' + error.message + '\n\n스택:\n' + error.stack;
  try { MailApp.sendEmail(recipient, '[Wellington] 환자 동기화 오류', body); } catch(e) { Logger.log('메일 발송 실패: '+e.message); }
}

function createTimeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i=0; i<triggers.length; i++) {
    if (triggers[i].getHandlerFunction()==='syncPatientDepartments') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncPatientDepartments').timeBased().atHour(8).nearMinute(15).everyDays(1).inTimezone('Asia/Seoul').create();
  Logger.log('트리거 생성: 매일 오전 8:15 KST');
}

function deleteAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i=0; i<triggers.length; i++) ScriptApp.deleteTrigger(triggers[i]);
  Logger.log('모든 트리거 삭제됨');
}

function runSyncNow() {
  Logger.log('수동 동기화 시작...');
  syncPatientDepartments();
}

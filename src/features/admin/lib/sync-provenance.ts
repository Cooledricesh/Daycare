import type { SyncLogItem, SyncProvenance } from '../backend/schema';

export interface SyncProvenanceLabels {
  artifact: string;
  engine: string;
  trigger: string;
  actor: string;
  operationId: string | null;
  isVerifiedOverlay: boolean;
}

const artifactLabels: Record<SyncProvenance['artifact'], string> = {
  emr_excel_drive_archive: 'EMR Excel · Drive 보관본',
  uploaded_excel: '직접 업로드 Excel',
  google_sheet: 'Google Sheets',
  unknown: '입력 자료 미확인',
};

const engineLabels: Record<SyncProvenance['engine'], string> = {
  nas_direct: 'NAS 직접 동기화',
  google_apps_script: 'Google Apps Script',
  web_admin: 'Daycare 웹',
  unknown: '실행 엔진 미확인',
};

const triggerLabels: Record<SyncProvenance['trigger'], string> = {
  scheduled_room2: '2진료실 예약 작업',
  maintenance_manual: '유지보수 수동 실행',
  user_manual: '관리자 수동 실행',
  unknown: '호출 방식 미확인',
};

const actorLabels: Record<SyncProvenance['actor'], string> = {
  room2_windows_runner: '2진료실 실행기',
  ara_recovery: 'ARA 복구 작업',
  staff: '관리자',
  unknown: '확인되지 않음',
};

function isSyncProvenance(value: unknown): value is SyncProvenance {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schema === 'daycare.sync-provenance.v1' &&
    typeof candidate.artifact === 'string' &&
    candidate.artifact in artifactLabels &&
    typeof candidate.engine === 'string' &&
    candidate.engine in engineLabels &&
    typeof candidate.trigger === 'string' &&
    candidate.trigger in triggerLabels &&
    typeof candidate.actor === 'string' &&
    candidate.actor in actorLabels
  );
}

export function resolveSyncProvenance(log: SyncLogItem): SyncProvenanceLabels {
  const provenance = log.details?.provenance;
  if (isSyncProvenance(provenance)) {
    return {
      artifact: artifactLabels[provenance.artifact],
      engine: engineLabels[provenance.engine],
      trigger: triggerLabels[provenance.trigger],
      actor: provenance.actor_label || actorLabels[provenance.actor],
      operationId: provenance.operation_id || null,
      isVerifiedOverlay: provenance.verified === true,
    };
  }

  if (log.source === 'google_sheets') {
    return {
      artifact: 'Drive 보관 EMR Excel',
      engine: 'Google Apps Script (기존 기록)',
      trigger: '기존 기록 · 자동/수동 미확인',
      actor: '확인되지 않음',
      operationId: null,
      isVerifiedOverlay: false,
    };
  }

  if (log.source === 'excel_upload') {
    return {
      artifact: '직접 업로드 Excel',
      engine: 'Daycare 웹 (기존 기록)',
      trigger: '관리자 수동 실행',
      actor: log.triggered_by || '확인되지 않음',
      operationId: null,
      isVerifiedOverlay: false,
    };
  }

  return {
    artifact: '입력 자료 미확인',
    engine: '실행 엔진 미확인',
    trigger: '호출 방식 미확인',
    actor: '확인되지 않음',
    operationId: null,
    isVerifiedOverlay: false,
  };
}

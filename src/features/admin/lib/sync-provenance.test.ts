import { describe, expect, it } from 'vitest';
import type { SyncLogItem, SyncProvenance } from '../backend/schema';
import { resolveSyncProvenance } from './sync-provenance';

function log(overrides: Partial<SyncLogItem> = {}): SyncLogItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    started_at: '2026-09-22T00:00:00Z',
    completed_at: '2026-09-22T00:00:01Z',
    source: 'google_sheets',
    triggered_by: 'apps_script_scheduler',
    status: 'completed',
    total_in_source: 529,
    total_processed: 291,
    inserted: 0,
    updated: 0,
    discharged: 0,
    reactivated: 0,
    unchanged: 291,
    skipped: 0,
    error_message: null,
    details: null,
    ...overrides,
  };
}

function provenance(overrides: Partial<SyncProvenance> = {}): SyncProvenance {
  return {
    schema: 'daycare.sync-provenance.v1',
    artifact: 'emr_excel_drive_archive',
    engine: 'nas_direct',
    trigger: 'scheduled_room2',
    actor: 'room2_windows_runner',
    verified: true,
    ...overrides,
  };
}

describe('resolveSyncProvenance', () => {
  it('preserves legacy Google history without claiming a scheduler or actor', () => {
    expect(resolveSyncProvenance(log())).toMatchObject({
      artifact: 'Drive 보관 EMR Excel',
      engine: 'Google Apps Script (기존 기록)',
      trigger: '기존 기록 · 자동/수동 미확인',
      actor: '확인되지 않음',
    });
  });

  it('separates scheduled NAS artifact, engine, trigger and actor', () => {
    expect(resolveSyncProvenance(log({
      source: 'excel_upload',
      triggered_by: 'room2_scheduled',
      details: {provenance: provenance({operation_id: 'room2-operation'})},
    }))).toEqual({
      artifact: 'EMR Excel · Drive 보관본',
      engine: 'NAS 직접 동기화',
      trigger: '2진료실 예약 작업',
      actor: '2진료실 실행기',
      operationId: 'room2-operation',
      isVerifiedOverlay: true,
    });
  });

  it('shows verified Google maintenance execution without renaming it as NAS', () => {
    expect(resolveSyncProvenance(log({
      details: {provenance: provenance({
        engine: 'google_apps_script',
        trigger: 'maintenance_manual',
        actor: 'ara_recovery',
        operation_id: undefined,
      })},
    }))).toMatchObject({
      engine: 'Google Apps Script',
      trigger: '유지보수 수동 실행',
      actor: 'ARA 복구 작업',
    });
  });

  it('uses honest unknown labels for unrecognized metadata', () => {
    expect(resolveSyncProvenance(log({
      source: 'unrecognized' as SyncLogItem['source'],
      triggered_by: '',
      details: {provenance: {schema: 'unexpected'} as unknown as SyncProvenance},
    }))).toMatchObject({
      artifact: '입력 자료 미확인',
      engine: '실행 엔진 미확인',
      trigger: '호출 방식 미확인',
      actor: '확인되지 않음',
    });
  });
});

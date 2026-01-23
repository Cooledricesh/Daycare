import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, SyncDetails, SyncChange } from '@/lib/supabase/types';

// Excel 데이터 구조 (파싱된 행)
interface ExcelPatientRow {
  no: number;
  roomNumber: string;       // B열: 호실
  patientIdNo: string;      // C열: IDNO (병록번호)
  name: string;             // D열: 환자명
  genderAge: string;        // E열: 성/나 (예: M/45)
  insuranceType: string;    // F열: 급종
  admissionDate: string;    // G열: 입원일
  days: number;             // H열: 일
  department: string;       // I열: 과
  doctorName: string;       // J열: 의사명
  surgeryDate: string;      // K열: 수술일
  diagnosis: string;        // L열: 병명
  surgeryName: string;      // M열: 수술명
}

// 동기화 결과
export interface SyncResult {
  success: boolean;
  syncId: string;
  summary: {
    totalInSource: number;
    totalProcessed: number;
    inserted: number;
    updated: number;
    discharged: number;
    reactivated: number;
    unchanged: number;
    skipped: number;
  };
  changes: SyncChange[];
  skippedReasons: { patientIdNo: string; name: string; reason: string }[];
  errorMessage?: string;
}

// 동기화 옵션
export interface SyncOptions {
  dryRun?: boolean;         // true면 실제 저장 없이 변경 예정 내역만 반환
  source: 'google_sheets' | 'excel_upload';
  triggeredBy: string;      // 트리거한 사용자 이름 또는 'scheduler'
}

/**
 * Excel 파일 버퍼를 파싱하여 환자 데이터 배열로 변환
 */
export function parseExcelBuffer(buffer: Buffer): ExcelPatientRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 헤더를 건너뛰고 데이터만 가져오기
  const rawData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

  // 첫 번째 행은 헤더이므로 건너뜀
  const dataRows = rawData.slice(1);

  const patients: ExcelPatientRow[] = [];

  for (const row of dataRows) {
    // 빈 행 건너뛰기
    if (!row || !row[2]) continue; // IDNO(C열)가 없으면 건너뛰기

    const patient: ExcelPatientRow = {
      no: row[0] || 0,
      roomNumber: String(row[1] || '').trim(),
      patientIdNo: String(row[2] || '').trim(),
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
    };

    patients.push(patient);
  }

  return patients;
}

/**
 * 성별/나이 문자열에서 성별 추출 (예: "M/45" -> "M")
 */
function parseGender(genderAge: string): 'M' | 'F' | null {
  if (!genderAge) return null;
  const gender = genderAge.split('/')[0]?.trim().toUpperCase();
  if (gender === 'M' || gender === 'F') return gender;
  return null;
}

/**
 * 환자 데이터 동기화 서비스
 */
export class PatientSyncService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 호실-담당자 매핑 조회
   */
  private async getRoomMappings(): Promise<Map<string, string | null>> {
    const { data, error } = await (this.supabase
      .from('room_coordinator_mapping') as any)
      .select('room_prefix, coordinator_id')
      .eq('is_active', true);

    if (error) throw error;

    const map = new Map<string, string | null>();
    for (const mapping of data || []) {
      map.set(mapping.room_prefix, mapping.coordinator_id);
    }
    return map;
  }

  /**
   * 의사명 -> 의사 ID 매핑 조회
   */
  private async getDoctorMappings(): Promise<Map<string, string>> {
    const { data, error } = await (this.supabase
      .from('staff') as any)
      .select('id, name')
      .eq('role', 'doctor')
      .eq('is_active', true);

    if (error) throw error;

    const map = new Map<string, string>();
    for (const doctor of data || []) {
      map.set(doctor.name, doctor.id);
    }
    return map;
  }

  /**
   * 기존 환자 목록 조회 (patient_id_no 기준)
   */
  private async getExistingPatients(): Promise<Map<string, any>> {
    const { data, error } = await (this.supabase
      .from('patients') as any)
      .select('*');

    if (error) throw error;

    const map = new Map<string, any>();
    for (const patient of data || []) {
      if (patient.patient_id_no) {
        map.set(patient.patient_id_no, patient);
      }
    }
    return map;
  }

  /**
   * 동기화 로그 생성
   */
  private async createSyncLog(options: SyncOptions): Promise<string> {
    const { data, error } = await (this.supabase
      .from('sync_logs') as any)
      .insert({
        source: options.source,
        triggered_by: options.triggeredBy,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * 동기화 로그 업데이트
   */
  private async updateSyncLog(
    syncId: string,
    result: SyncResult,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const details: SyncDetails = {
      changes: result.changes,
      skipped_reasons: result.skippedReasons,
    };

    const { error } = await (this.supabase
      .from('sync_logs') as any)
      .update({
        status,
        completed_at: new Date().toISOString(),
        total_in_source: result.summary.totalInSource,
        total_processed: result.summary.totalProcessed,
        inserted: result.summary.inserted,
        updated: result.summary.updated,
        discharged: result.summary.discharged,
        reactivated: result.summary.reactivated,
        unchanged: result.summary.unchanged,
        skipped: result.summary.skipped,
        error_message: result.errorMessage,
        details,
      })
      .eq('id', syncId);

    if (error) throw error;
  }

  /**
   * Excel 데이터로 환자 동기화 실행
   */
  async syncPatients(
    excelBuffer: Buffer,
    options: SyncOptions
  ): Promise<SyncResult> {
    let syncId = '';

    // 결과 초기화
    const result: SyncResult = {
      success: true,
      syncId: '',
      summary: {
        totalInSource: 0,
        totalProcessed: 0,
        inserted: 0,
        updated: 0,
        discharged: 0,
        reactivated: 0,
        unchanged: 0,
        skipped: 0,
      },
      changes: [],
      skippedReasons: [],
    };

    try {
      // Dry-run이 아닌 경우 동기화 로그 생성
      if (!options.dryRun) {
        syncId = await this.createSyncLog(options);
        result.syncId = syncId;
      }

      // 1. Excel 파싱
      const allPatients = parseExcelBuffer(excelBuffer);
      result.summary.totalInSource = allPatients.length;

      // 2. 낮병원 환자만 필터링 (호실 >= 3000)
      const daycarePatients = allPatients.filter((p) => {
        const roomNum = parseInt(p.roomNumber, 10);
        return !isNaN(roomNum) && roomNum >= 3000;
      });

      // 3. 매핑 데이터 조회
      const roomMappings = await this.getRoomMappings();
      const doctorMappings = await this.getDoctorMappings();
      const existingPatients = await this.getExistingPatients();

      // 소스에 있는 환자 ID 목록 (퇴원 처리용)
      const sourcePatientIdNos = new Set<string>();

      // 4. 각 환자 처리
      for (const patient of daycarePatients) {
        // IDNO 없으면 건너뛰기
        if (!patient.patientIdNo) {
          result.summary.skipped++;
          result.skippedReasons.push({
            patientIdNo: '',
            name: patient.name,
            reason: '병록번호(IDNO) 없음',
          });
          continue;
        }

        sourcePatientIdNos.add(patient.patientIdNo);

        const existing = existingPatients.get(patient.patientIdNo);
        const gender = parseGender(patient.genderAge);
        const coordinatorId = roomMappings.get(patient.roomNumber) || null;
        const doctorId = doctorMappings.get(patient.doctorName) || null;

        if (!existing) {
          // 신규 환자 - INSERT
          result.summary.inserted++;
          result.changes.push({
            patientIdNo: patient.patientIdNo,
            name: patient.name,
            action: 'insert',
          });

          if (!options.dryRun) {
            await (this.supabase.from('patients') as any).insert({
              name: patient.name,
              patient_id_no: patient.patientIdNo,
              room_number: patient.roomNumber,
              gender,
              coordinator_id: coordinatorId,
              doctor_id: doctorId,
              status: 'active',
            });
          }
        } else if (existing.status === 'discharged') {
          // 퇴원했다가 재입원 - REACTIVATE
          result.summary.reactivated++;
          result.changes.push({
            patientIdNo: patient.patientIdNo,
            name: patient.name,
            action: 'reactivate',
            fields: {
              status: { old: 'discharged', new: 'active' },
            },
          });

          if (!options.dryRun) {
            await (this.supabase
              .from('patients') as any)
              .update({
                status: 'active',
                room_number: patient.roomNumber,
                coordinator_id: coordinatorId,
                doctor_id: doctorId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          }
        } else {
          // 기존 환자 - 변경사항 확인
          const changes: Record<string, { old: string | null; new: string | null }> = {};

          if (existing.name !== patient.name) {
            changes['name'] = { old: existing.name, new: patient.name };
          }
          if (existing.room_number !== patient.roomNumber) {
            changes['room_number'] = {
              old: existing.room_number,
              new: patient.roomNumber,
            };
          }
          if (existing.coordinator_id !== coordinatorId) {
            changes['coordinator_id'] = {
              old: existing.coordinator_id,
              new: coordinatorId,
            };
          }
          if (existing.doctor_id !== doctorId) {
            changes['doctor_id'] = {
              old: existing.doctor_id,
              new: doctorId,
            };
          }
          if (existing.gender !== gender) {
            changes['gender'] = { old: existing.gender, new: gender };
          }

          if (Object.keys(changes).length > 0) {
            // 변경사항 있음 - UPDATE
            result.summary.updated++;
            result.changes.push({
              patientIdNo: patient.patientIdNo,
              name: patient.name,
              action: 'update',
              fields: changes,
            });

            if (!options.dryRun) {
              await (this.supabase
                .from('patients') as any)
                .update({
                  name: patient.name,
                  room_number: patient.roomNumber,
                  gender,
                  coordinator_id: coordinatorId,
                  doctor_id: doctorId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            }
          } else {
            // 변경사항 없음
            result.summary.unchanged++;
          }
        }

        result.summary.totalProcessed++;
      }

      // 5. 명단에서 제외된 환자 퇴원 처리
      for (const [patientIdNo, patient] of existingPatients) {
        // 이미 퇴원 상태거나 소스에 있는 환자는 건너뛰기
        if (patient.status === 'discharged' || sourcePatientIdNos.has(patientIdNo)) {
          continue;
        }

        // 호실이 3000 미만인 환자는 병동 환자이므로 건너뛰기
        const roomNum = parseInt(patient.room_number || '0', 10);
        if (isNaN(roomNum) || roomNum < 3000) {
          continue;
        }

        // 명단에서 삭제됨 - 퇴원 처리
        result.summary.discharged++;
        result.changes.push({
          patientIdNo,
          name: patient.name,
          action: 'discharge',
        });

        if (!options.dryRun) {
          await (this.supabase
            .from('patients') as any)
            .update({
              status: 'discharged',
              updated_at: new Date().toISOString(),
            })
            .eq('id', patient.id);
        }
      }

      // 동기화 로그 업데이트
      if (!options.dryRun && syncId) {
        await this.updateSyncLog(syncId, result, 'completed');
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.errorMessage = error.message || 'Unknown error';

      // 에러 발생 시 로그 업데이트
      if (syncId) {
        await this.updateSyncLog(syncId, result, 'failed');
      }

      throw error;
    }
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import bcrypt from 'bcryptjs';
import { formatScheduleDays } from '@/lib/date';
import { AdminError, AdminErrorCode } from './error';
import type {
  GetPatientsQuery,
  CreatePatientRequest,
  UpdatePatientRequest,
  PatientWithCoordinator,
  PatientDetail,
  GetStaffQuery,
  CreateStaffRequest,
  UpdateStaffRequest,
  ResetPasswordRequest,
  StaffPublic,
  GetSchedulePatternsQuery,
  UpdateSchedulePatternRequest,
  SchedulePatternItem,
  GetDailyScheduleQuery,
  AddManualScheduleRequest,
  CancelScheduleRequest,
  DailyScheduleResponse,
  DailyScheduleItem,
  GetStatsSummaryQuery,
  StatsSummary,
  GetDailyStatsQuery,
  DailyStatsItem,
  BatchGenerateRequest,
  BatchOperationResult,
  UpdateRoomMappingRequest,
  CreateRoomMappingRequest,
  RoomMappingItem,
  GetSyncLogsQuery,
  SyncLogItem,
} from './schema';

const SALT_ROUNDS = 10;

// ========== Patients Service ==========

export async function getPatients(
  supabase: SupabaseClient<Database>,
  query: GetPatientsQuery,
): Promise<{ data: PatientWithCoordinator[]; total: number; page: number; limit: number }> {
  const offset = (query.page - 1) * query.limit;

  let queryBuilder = supabase
    .from('patients')
    .select(`
      id,
      name,
      gender,
      room_number,
      patient_id_no,
      coordinator_id,
      doctor_id,
      status,
      memo,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(name),
      doctor:staff!doctor_id(name)
    `, { count: 'exact' });

  // 필터 적용
  if (query.search) {
    queryBuilder = queryBuilder.ilike('name', `%${query.search}%`);
  }
  if (query.status !== 'all') {
    queryBuilder = queryBuilder.eq('status', query.status);
  }
  if (query.coordinator_id) {
    queryBuilder = queryBuilder.eq('coordinator_id', query.coordinator_id);
  }

  const { data, error, count } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + query.limit - 1);

  if (error) {
    throw new AdminError(
      AdminErrorCode.PATIENT_CREATE_FAILED,
      `환자 목록 조회 실패: ${error.message}`,
    );
  }

  // schedule_pattern 가져오기
  const patientIds = (data as any)?.map((p: any) => p.id) || [];
  const { data: patterns } = await supabase
    .from('scheduled_patterns')
    .select('patient_id, day_of_week')
    .in('patient_id', patientIds)
    .eq('is_active', true);

  const patternMap = new Map<string, number[]>();
  (patterns as any)?.forEach((p: any) => {
    if (!patternMap.has(p.patient_id)) {
      patternMap.set(p.patient_id, []);
    }
    patternMap.get(p.patient_id)!.push(p.day_of_week);
  });

  const result: PatientWithCoordinator[] = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    room_number: p.room_number,
    patient_id_no: p.patient_id_no,
    coordinator_id: p.coordinator_id,
    coordinator_name: p.coordinator?.name || null,
    doctor_id: p.doctor_id,
    doctor_name: p.doctor?.name || null,
    status: p.status,
    memo: p.memo,
    created_at: p.created_at,
    updated_at: p.updated_at,
    schedule_pattern: formatScheduleDays(patternMap.get(p.id) || []),
  }));

  return {
    data: result,
    total: count || 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function getPatientDetail(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<PatientDetail> {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      id,
      name,
      gender,
      room_number,
      patient_id_no,
      coordinator_id,
      doctor_id,
      status,
      memo,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(name),
      doctor:staff!doctor_id(name)
    `)
    .eq('id', patientId)
    .single();

  if (error || !data) {
    throw new AdminError(AdminErrorCode.PATIENT_NOT_FOUND, '환자를 찾을 수 없습니다');
  }

  const { data: patterns } = await supabase
    .from('scheduled_patterns')
    .select('id, day_of_week, is_active')
    .eq('patient_id', patientId);

  const scheduleDays = ((patterns as any) || [])
    .filter((p: any) => p.is_active)
    .map((p: any) => p.day_of_week);

  const patientData = data as any;
  return {
    id: patientData.id,
    name: patientData.name,
    gender: patientData.gender,
    room_number: patientData.room_number,
    patient_id_no: patientData.patient_id_no,
    coordinator_id: patientData.coordinator_id,
    coordinator_name: patientData.coordinator?.name || null,
    doctor_id: patientData.doctor_id,
    doctor_name: patientData.doctor?.name || null,
    status: patientData.status,
    memo: patientData.memo,
    created_at: patientData.created_at,
    updated_at: patientData.updated_at,
    schedule_pattern: formatScheduleDays(scheduleDays),
    schedule_patterns: (patterns as any) || [],
  };
}

export async function createPatient(
  supabase: SupabaseClient<Database>,
  request: CreatePatientRequest,
): Promise<PatientWithCoordinator> {
  // 트랜잭션: 환자 생성 + 스케줄 패턴 생성
  const { data: patient, error: patientError } = await (supabase
    .from('patients') as any)
    .insert({
      name: request.name,
      gender: request.gender || null,
      room_number: request.room_number || null,
      patient_id_no: request.patient_id_no || null,
      coordinator_id: request.coordinator_id || null,
      doctor_id: request.doctor_id || null,
      memo: request.memo || null,
      status: 'active',
    })
    .select()
    .single();

  if (patientError || !patient) {
    throw new AdminError(
      AdminErrorCode.PATIENT_CREATE_FAILED,
      `환자 생성 실패: ${patientError?.message}`,
    );
  }

  // 스케줄 패턴 생성
  if (request.schedule_days.length > 0) {
    const patterns = request.schedule_days.map((day) => ({
      patient_id: patient.id,
      day_of_week: day,
      is_active: true,
    }));

    const { error: patternError } = await (supabase
      .from('scheduled_patterns') as any)
      .insert(patterns);

    if (patternError) {
      // 롤백을 위해 환자 삭제
      await (supabase.from('patients') as any).delete().eq('id', patient.id);
      throw new AdminError(
        AdminErrorCode.PATIENT_CREATE_FAILED,
        `스케줄 패턴 생성 실패: ${patternError.message}`,
      );
    }
  }

  // 코디네이터/주치의 이름 가져오기
  let coordinatorName: string | null = null;
  let doctorName: string | null = null;

  if (patient.coordinator_id || patient.doctor_id) {
    const staffIds = [patient.coordinator_id, patient.doctor_id].filter(Boolean);
    const { data: staffList } = await (supabase
      .from('staff') as any)
      .select('id, name')
      .in('id', staffIds);

    if (staffList) {
      const staffMap = new Map<string, string>(staffList.map((s: any) => [s.id, s.name]));
      coordinatorName = staffMap.get(patient.coordinator_id) ?? null;
      doctorName = staffMap.get(patient.doctor_id) ?? null;
    }
  }

  return {
    id: patient.id,
    name: patient.name,
    gender: patient.gender,
    room_number: patient.room_number,
    patient_id_no: patient.patient_id_no,
    coordinator_id: patient.coordinator_id,
    coordinator_name: coordinatorName,
    doctor_id: patient.doctor_id,
    doctor_name: doctorName,
    status: patient.status,
    memo: patient.memo,
    created_at: patient.created_at,
    updated_at: patient.updated_at,
    schedule_pattern: formatScheduleDays(request.schedule_days),
  };
}

export async function updatePatient(
  supabase: SupabaseClient<Database>,
  patientId: string,
  request: UpdatePatientRequest,
): Promise<PatientWithCoordinator> {
  // 환자 정보 업데이트
  const updateData: any = {};
  if (request.name !== undefined) updateData.name = request.name;
  if (request.gender !== undefined) updateData.gender = request.gender || null;
  if (request.room_number !== undefined) updateData.room_number = request.room_number || null;
  if (request.patient_id_no !== undefined) updateData.patient_id_no = request.patient_id_no || null;
  if (request.coordinator_id !== undefined) updateData.coordinator_id = request.coordinator_id || null;
  if (request.doctor_id !== undefined) updateData.doctor_id = request.doctor_id || null;
  if (request.status !== undefined) updateData.status = request.status;
  if (request.memo !== undefined) updateData.memo = request.memo || null;

  const { data: patient, error: patientError } = await (supabase
    .from('patients') as any)
    .update(updateData)
    .eq('id', patientId)
    .select()
    .single();

  if (patientError || !patient) {
    throw new AdminError(
      AdminErrorCode.PATIENT_UPDATE_FAILED,
      `환자 정보 수정 실패: ${patientError?.message}`,
    );
  }

  // 스케줄 패턴 업데이트
  if (request.schedule_days !== undefined) {
    // 기존 패턴 삭제
    await (supabase
      .from('scheduled_patterns') as any)
      .delete()
      .eq('patient_id', patientId);

    // 새 패턴 생성
    if (request.schedule_days.length > 0) {
      const patterns = request.schedule_days.map((day) => ({
        patient_id: patientId,
        day_of_week: day,
        is_active: true,
      }));

      const { error: patternError } = await (supabase
        .from('scheduled_patterns') as any)
        .insert(patterns);

      if (patternError) {
        throw new AdminError(
          AdminErrorCode.PATIENT_UPDATE_FAILED,
          `스케줄 패턴 수정 실패: ${patternError.message}`,
        );
      }
    }
  }

  // 최종 데이터 조회
  return getPatientDetail(supabase, patientId);
}

// ========== Staff Service ==========

export async function getStaff(
  supabase: SupabaseClient<Database>,
  query: GetStaffQuery,
): Promise<{ data: StaffPublic[]; total: number; page: number; limit: number }> {
  const offset = (query.page - 1) * query.limit;

  let queryBuilder = supabase
    .from('staff')
    .select('id, login_id, name, role, is_active, created_at, updated_at', { count: 'exact' });

  if (query.role !== 'all') {
    queryBuilder = queryBuilder.eq('role', query.role);
  }
  if (query.status === 'active') {
    queryBuilder = queryBuilder.eq('is_active', true);
  } else if (query.status === 'inactive') {
    queryBuilder = queryBuilder.eq('is_active', false);
  }

  const { data, error, count } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + query.limit - 1);

  if (error) {
    throw new AdminError(
      AdminErrorCode.STAFF_CREATE_FAILED,
      `직원 목록 조회 실패: ${error.message}`,
    );
  }

  return {
    data: (data || []) as StaffPublic[],
    total: count || 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function getStaffById(
  supabase: SupabaseClient<Database>,
  staffId: string,
): Promise<StaffPublic> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, login_id, name, role, is_active, created_at, updated_at')
    .eq('id', staffId)
    .single();

  if (error || !data) {
    throw new AdminError(AdminErrorCode.STAFF_NOT_FOUND, '직원을 찾을 수 없습니다');
  }

  return data as StaffPublic;
}

export async function createStaff(
  supabase: SupabaseClient<Database>,
  request: CreateStaffRequest,
): Promise<StaffPublic> {
  // 비밀번호 해싱
  const passwordHash = await bcrypt.hash(request.password, SALT_ROUNDS);

  const { data, error } = await (supabase
    .from('staff') as any)
    .insert({
      name: request.name,
      login_id: request.login_id,
      password_hash: passwordHash,
      role: request.role,
      is_active: true,
    })
    .select('id, login_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation
      throw new AdminError(
        AdminErrorCode.DUPLICATE_LOGIN_ID,
        '이미 사용 중인 로그인 ID입니다',
      );
    }
    throw new AdminError(
      AdminErrorCode.STAFF_CREATE_FAILED,
      `직원 생성 실패: ${error.message}`,
    );
  }

  return data as StaffPublic;
}

export async function updateStaff(
  supabase: SupabaseClient<Database>,
  staffId: string,
  request: UpdateStaffRequest,
  currentUserId: string,
): Promise<StaffPublic> {
  // 본인 비활성화 방지
  if (request.is_active === false && staffId === currentUserId) {
    throw new AdminError(
      AdminErrorCode.CANNOT_DEACTIVATE_SELF,
      '본인 계정은 비활성화할 수 없습니다',
    );
  }

  const updateData: any = {};
  if (request.name !== undefined) updateData.name = request.name;
  if (request.role !== undefined) updateData.role = request.role;
  if (request.is_active !== undefined) updateData.is_active = request.is_active;

  const { data, error } = await (supabase
    .from('staff') as any)
    .update(updateData)
    .eq('id', staffId)
    .select('id, login_id, name, role, is_active, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.STAFF_UPDATE_FAILED,
      `직원 정보 수정 실패: ${error?.message}`,
    );
  }

  return data as StaffPublic;
}

export async function resetStaffPassword(
  supabase: SupabaseClient<Database>,
  staffId: string,
  request: ResetPasswordRequest,
): Promise<{ success: boolean }> {
  const passwordHash = await bcrypt.hash(request.new_password, SALT_ROUNDS);

  const { error } = await (supabase
    .from('staff') as any)
    .update({ password_hash: passwordHash })
    .eq('id', staffId);

  if (error) {
    throw new AdminError(
      AdminErrorCode.PASSWORD_RESET_FAILED,
      `비밀번호 초기화 실패: ${error.message}`,
    );
  }

  return { success: true };
}

export async function getCoordinators(
  supabase: SupabaseClient<Database>,
): Promise<StaffPublic[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, login_id, name, role, is_active, created_at, updated_at')
    .eq('role', 'coordinator')
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw new AdminError(
      AdminErrorCode.STAFF_CREATE_FAILED,
      `코디네이터 목록 조회 실패: ${error.message}`,
    );
  }

  return (data || []) as StaffPublic[];
}

// ========== Schedule Service ==========

export async function getSchedulePatterns(
  supabase: SupabaseClient<Database>,
  query: GetSchedulePatternsQuery,
): Promise<{ data: SchedulePatternItem[]; total: number; page: number; limit: number }> {
  const offset = (query.page - 1) * query.limit;

  let queryBuilder = supabase
    .from('patients')
    .select(`
      id,
      name,
      coordinator:staff!coordinator_id(name)
    `, { count: 'exact' })
    .eq('status', 'active');

  if (query.search) {
    queryBuilder = queryBuilder.ilike('name', `%${query.search}%`);
  }

  const { data, error, count } = await queryBuilder
    .order('name')
    .range(offset, offset + query.limit - 1);

  if (error) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_PATTERN_UPDATE_FAILED,
      `스케줄 패턴 조회 실패: ${error.message}`,
    );
  }

  const patientIds = (data as any)?.map((p: any) => p.id) || [];
  const { data: patterns } = await (supabase
    .from('scheduled_patterns') as any)
    .select('patient_id, day_of_week')
    .in('patient_id', patientIds)
    .eq('is_active', true);

  const patternMap = new Map<string, number[]>();
  (patterns as any)?.forEach((p: any) => {
    if (!patternMap.has(p.patient_id)) {
      patternMap.set(p.patient_id, []);
    }
    patternMap.get(p.patient_id)!.push(p.day_of_week);
  });

  const result: SchedulePatternItem[] = (data || []).map((p: any) => ({
    patient_id: p.id,
    patient_name: p.name,
    coordinator_name: p.coordinator?.name || null,
    schedule_days: (patternMap.get(p.id) || []).sort((a, b) => a - b),
  }));

  return {
    data: result,
    total: count || 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function updateSchedulePattern(
  supabase: SupabaseClient<Database>,
  patientId: string,
  request: UpdateSchedulePatternRequest,
): Promise<{ success: boolean }> {
  // 기존 패턴 삭제
  await (supabase
    .from('scheduled_patterns') as any)
    .delete()
    .eq('patient_id', patientId);

  // 새 패턴 생성
  if (request.schedule_days.length > 0) {
    const patterns = request.schedule_days.map((day) => ({
      patient_id: patientId,
      day_of_week: day,
      is_active: true,
    }));

    const { error } = await (supabase
      .from('scheduled_patterns') as any)
      .insert(patterns);

    if (error) {
      throw new AdminError(
        AdminErrorCode.SCHEDULE_PATTERN_UPDATE_FAILED,
        `스케줄 패턴 수정 실패: ${error.message}`,
      );
    }
  }

  return { success: true };
}

// ========== Schedule Generation ==========

export async function generateScheduledAttendances(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<{ generated: number; skipped: number }> {
  // 타임존 이슈 방지: 로컬 Date 생성
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  // 해당 요일의 active 패턴 조회 (active 환자만)
  const { data: patterns, error: patternsError } = await (supabase
    .from('scheduled_patterns') as any)
    .select('patient_id, patients!inner(status)')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .eq('patients.status', 'active');

  if (patternsError) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_GENERATE_FAILED,
      `패턴 조회 실패: ${patternsError.message}`,
    );
  }

  if (!patterns || patterns.length === 0) {
    return { generated: 0, skipped: 0 };
  }

  const rows = patterns.map((p: any) => ({
    patient_id: p.patient_id,
    date,
    source: 'auto',
    is_cancelled: false,
  }));

  // ignoreDuplicates: 기존 수동/취소 레코드 보존
  const { data: inserted, error: insertError } = await (supabase
    .from('scheduled_attendances') as any)
    .upsert(rows, { onConflict: 'patient_id,date', ignoreDuplicates: true })
    .select('id');

  if (insertError) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_GENERATE_FAILED,
      `자동 스케줄 생성 실패: ${insertError.message}`,
    );
  }

  const generated = inserted?.length ?? 0;
  return { generated, skipped: rows.length - generated };
}

export async function calculateDailyStats(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<DailyStatsItem> {
  const { count: scheduledCount } = await (supabase
    .from('scheduled_attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', date)
    .eq('is_cancelled', false);

  const { count: attendanceCount } = await (supabase
    .from('attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', date);

  const { count: consultationCount } = await (supabase
    .from('consultations') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', date);

  const sc = scheduledCount ?? 0;
  const ac = attendanceCount ?? 0;
  const cc = consultationCount ?? 0;

  const attendanceRate = sc > 0 ? Math.round((ac / sc) * 10000) / 100 : null;
  const consultationRate = sc > 0 ? Math.round((cc / sc) * 10000) / 100 : null;

  const { data, error } = await (supabase
    .from('daily_stats') as any)
    .upsert({
      date,
      scheduled_count: sc,
      attendance_count: ac,
      consultation_count: cc,
      attendance_rate: attendanceRate,
      consultation_rate: consultationRate,
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'date' })
    .select()
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.STATS_FETCH_FAILED,
      `통계 계산 실패: ${error?.message}`,
    );
  }

  return data as DailyStatsItem;
}

async function ensureTodayScheduleGenerated(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<void> {
  const { count } = await (supabase
    .from('scheduled_attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', date)
    .eq('source', 'auto');

  if ((count ?? 0) === 0) {
    await generateScheduledAttendances(supabase, date);
  }
}

async function ensureYesterdayStatsClosed(
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { count } = await (supabase
    .from('daily_stats') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', yesterdayStr);

  if ((count ?? 0) === 0) {
    // 전일 스케줄도 생성되어 있어야 통계 의미 있음
    await ensureTodayScheduleGenerated(supabase, yesterdayStr);
    await calculateDailyStats(supabase, yesterdayStr);
  }
}

export async function batchGenerateSchedules(
  supabase: SupabaseClient<Database>,
  request: BatchGenerateRequest,
): Promise<BatchOperationResult> {
  const results: Array<{ date: string; generated: number; skipped: number }> = [];
  const errors: Array<{ date: string; error: string }> = [];

  const start = new Date(request.start_date + 'T00:00:00');
  const end = new Date(request.end_date + 'T00:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    try {
      const result = await generateScheduledAttendances(supabase, dateStr);
      results.push({ date: dateStr, ...result });
    } catch (err: any) {
      errors.push({ date: dateStr, error: err.message });
    }
  }

  return {
    processed: results.length,
    total_generated: results.reduce((sum, r) => sum + r.generated, 0),
    total_skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    errors,
  };
}

export async function batchCalculateStats(
  supabase: SupabaseClient<Database>,
  request: BatchGenerateRequest,
): Promise<BatchOperationResult> {
  const results: Array<{ date: string }> = [];
  const errors: Array<{ date: string; error: string }> = [];

  const start = new Date(request.start_date + 'T00:00:00');
  const end = new Date(request.end_date + 'T00:00:00');
  const today = new Date().toISOString().split('T')[0];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (dateStr >= today) continue; // 오늘 이후는 스킵 (실시간 집계)
    try {
      await calculateDailyStats(supabase, dateStr);
      results.push({ date: dateStr });
    } catch (err: any) {
      errors.push({ date: dateStr, error: err.message });
    }
  }

  return {
    processed: results.length,
    total_generated: results.length,
    total_skipped: 0,
    errors,
  };
}

export async function getDailySchedule(
  supabase: SupabaseClient<Database>,
  query: GetDailyScheduleQuery,
): Promise<DailyScheduleResponse> {
  // Lazy 생성: 해당 날짜에 auto 레코드 없으면 패턴에서 생성
  await ensureTodayScheduleGenerated(supabase, query.date);

  let queryBuilder = supabase
    .from('scheduled_attendances')
    .select(`
      id,
      patient_id,
      source,
      is_cancelled,
      created_at,
      patient:patients!patient_id(name, coordinator_id),
      coordinator:patients!patient_id(coordinator:staff!coordinator_id(name))
    `)
    .eq('date', query.date);

  if (query.source !== 'all') {
    queryBuilder = queryBuilder.eq('source', query.source);
  }
  if (query.status === 'active') {
    queryBuilder = queryBuilder.eq('is_cancelled', false);
  } else if (query.status === 'cancelled') {
    queryBuilder = queryBuilder.eq('is_cancelled', true);
  }

  const { data, error } = await queryBuilder.order('created_at');

  if (error) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_CREATE_FAILED,
      `일일 스케줄 조회 실패: ${error.message}`,
    );
  }

  const items: DailyScheduleItem[] = (data || []).map((item: any) => ({
    id: item.id,
    patient_id: item.patient_id,
    patient_name: item.patient?.name || '',
    coordinator_name: item.patient?.coordinator?.name || null,
    source: item.source,
    is_cancelled: item.is_cancelled,
    created_at: item.created_at,
  }));

  // 통계 계산
  const stats = {
    total: items.length,
    auto: items.filter((i) => i.source === 'auto').length,
    manual: items.filter((i) => i.source === 'manual').length,
    cancelled: items.filter((i) => i.is_cancelled).length,
  };

  return {
    date: query.date,
    stats,
    data: items,
  };
}

export async function addManualSchedule(
  supabase: SupabaseClient<Database>,
  request: AddManualScheduleRequest,
): Promise<DailyScheduleItem> {
  // 중복 확인
  const { data: existing } = await (supabase
    .from('scheduled_attendances') as any)
    .select('id')
    .eq('patient_id', request.patient_id)
    .eq('date', request.date)
    .single();

  if (existing) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_ALREADY_EXISTS,
      '이미 예정된 환자입니다',
    );
  }

  const { data, error } = await (supabase
    .from('scheduled_attendances') as any)
    .insert({
      patient_id: request.patient_id,
      date: request.date,
      source: 'manual',
      is_cancelled: false,
    })
    .select(`
      id,
      patient_id,
      source,
      is_cancelled,
      created_at,
      patient:patients!patient_id(name, coordinator_id),
      coordinator:patients!patient_id(coordinator:staff!coordinator_id(name))
    `)
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_CREATE_FAILED,
      `수동 스케줄 추가 실패: ${error?.message}`,
    );
  }

  return {
    id: data.id,
    patient_id: data.patient_id,
    patient_name: (data as any).patient?.name || '',
    coordinator_name: (data as any).patient?.coordinator?.name || null,
    source: data.source as 'auto' | 'manual',
    is_cancelled: data.is_cancelled,
    created_at: data.created_at,
  };
}

export async function cancelSchedule(
  supabase: SupabaseClient<Database>,
  scheduleId: string,
  request: CancelScheduleRequest,
): Promise<{ id: string; is_cancelled: boolean }> {
  const { data, error } = await (supabase
    .from('scheduled_attendances') as any)
    .update({ is_cancelled: request.is_cancelled })
    .eq('id', scheduleId)
    .select('id, is_cancelled')
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_CREATE_FAILED,
      `스케줄 취소 실패: ${error?.message}`,
    );
  }

  return data as { id: string; is_cancelled: boolean };
}

export async function deleteSchedule(
  supabase: SupabaseClient<Database>,
  scheduleId: string,
): Promise<{ success: boolean }> {
  // source='manual'만 삭제 가능
  const { data: schedule } = await (supabase
    .from('scheduled_attendances') as any)
    .select('source')
    .eq('id', scheduleId)
    .single();

  if ((schedule as any)?.source !== 'manual') {
    throw new AdminError(
      AdminErrorCode.CANNOT_DELETE_AUTO_SCHEDULE,
      '자동 생성된 스케줄은 삭제할 수 없습니다. 취소로만 처리 가능합니다.',
    );
  }

  const { error } = await (supabase
    .from('scheduled_attendances') as any)
    .delete()
    .eq('id', scheduleId);

  if (error) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_DELETE_FAILED,
      `스케줄 삭제 실패: ${error.message}`,
    );
  }

  return { success: true };
}

// ========== Stats Service ==========

export async function getStatsSummary(
  supabase: SupabaseClient<Database>,
  query: GetStatsSummaryQuery,
): Promise<StatsSummary> {
  // Lazy 마감: 전일 통계 미존재 시 계산
  await ensureYesterdayStatsClosed(supabase);

  // 기간 통계
  const { data: periodStats } = await (supabase
    .from('daily_stats') as any)
    .select('*')
    .gte('date', query.start_date)
    .lte('date', query.end_date);

  const totalScheduled = (periodStats as any)?.reduce((sum: number, s: any) => sum + s.scheduled_count, 0) || 0;
  const totalAttendance = (periodStats as any)?.reduce((sum: number, s: any) => sum + s.attendance_count, 0) || 0;
  const totalConsultation = (periodStats as any)?.reduce((sum: number, s: any) => sum + s.consultation_count, 0) || 0;

  const validDays = (periodStats as any)?.filter((s: any) => s.attendance_rate !== null) || [];
  const avgAttendanceRate = validDays.length > 0
    ? validDays.reduce((sum: number, s: any) => sum + (s.attendance_rate || 0), 0) / validDays.length
    : 0;
  const avgConsultationRate = validDays.length > 0
    ? validDays.reduce((sum: number, s: any) => sum + (s.consultation_rate || 0), 0) / validDays.length
    : 0;

  // 오늘 통계 (실시간)
  const today = new Date().toISOString().split('T')[0];
  const { data: todayScheduled, count: scheduledCount } = await (supabase
    .from('scheduled_attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', today)
    .eq('is_cancelled', false);

  const { data: todayAttendance, count: attendanceCount } = await (supabase
    .from('attendances') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', today);

  const { data: todayConsultation, count: consultationCount } = await (supabase
    .from('consultations') as any)
    .select('*', { count: 'exact', head: true })
    .eq('date', today);

  // 이전 기간 통계 (비교용)
  const daysDiff = Math.ceil(
    (new Date(query.end_date).getTime() - new Date(query.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const prevStartDate = new Date(new Date(query.start_date).getTime() - daysDiff * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const prevEndDate = new Date(new Date(query.start_date).getTime() - 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data: prevStats } = await (supabase
    .from('daily_stats') as any)
    .select('*')
    .gte('date', prevStartDate)
    .lte('date', prevEndDate);

  const prevValidDays = (prevStats as any)?.filter((s: any) => s.attendance_rate !== null) || [];
  const prevAvgAttendanceRate = prevValidDays.length > 0
    ? prevValidDays.reduce((sum: number, s: any) => sum + (s.attendance_rate || 0), 0) / prevValidDays.length
    : 0;
  const prevAvgConsultationRate = prevValidDays.length > 0
    ? prevValidDays.reduce((sum: number, s: any) => sum + (s.consultation_rate || 0), 0) / prevValidDays.length
    : 0;

  return {
    period: {
      start: query.start_date,
      end: query.end_date,
    },
    average_attendance_rate: avgAttendanceRate,
    average_consultation_rate: avgConsultationRate,
    total_scheduled: totalScheduled,
    total_attendance: totalAttendance,
    total_consultation: totalConsultation,
    today: {
      scheduled: scheduledCount || 0,
      attendance: attendanceCount || 0,
      consultation: consultationCount || 0,
    },
    previous_period: {
      average_attendance_rate: prevAvgAttendanceRate,
      average_consultation_rate: prevAvgConsultationRate,
    },
  };
}

export async function getDailyStats(
  supabase: SupabaseClient<Database>,
  query: GetDailyStatsQuery,
): Promise<DailyStatsItem[]> {
  // Lazy 마감: 전일 통계 미존재 시 계산
  await ensureYesterdayStatsClosed(supabase);

  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .gte('date', query.start_date)
    .lte('date', query.end_date)
    .order('date');

  if (error) {
    throw new AdminError(
      AdminErrorCode.STATS_FETCH_FAILED,
      `통계 조회 실패: ${error.message}`,
    );
  }

  return (data || []) as DailyStatsItem[];
}

// ========== Room Mapping Service ==========

export async function getRoomMappings(
  supabase: SupabaseClient<Database>,
): Promise<RoomMappingItem[]> {
  // 매핑 데이터 조회
  const { data: mappings, error } = await (supabase
    .from('room_coordinator_mapping') as any)
    .select(`
      id,
      room_prefix,
      coordinator_id,
      description,
      is_active,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(id, name)
    `)
    .order('room_prefix');

  if (error) {
    throw new AdminError(
      AdminErrorCode.STAFF_CREATE_FAILED,
      `호실 매핑 조회 실패: ${error.message}`,
    );
  }

  // 각 호실별 환자 수 계산
  const roomPrefixes = (mappings || []).map((m: any) => m.room_prefix);
  const patientCounts: Record<string, number> = {};

  if (roomPrefixes.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('room_number')
      .eq('status', 'active');

    (patients || []).forEach((p: any) => {
      if (p.room_number) {
        const prefix = p.room_number.toString().substring(0, 4);
        if (roomPrefixes.includes(prefix)) {
          patientCounts[prefix] = (patientCounts[prefix] || 0) + 1;
        }
      }
    });
  }

  return (mappings || []).map((m: any) => ({
    id: m.id,
    room_prefix: m.room_prefix,
    coordinator_id: m.coordinator_id,
    coordinator_name: m.coordinator?.name || null,
    description: m.description,
    is_active: m.is_active,
    patient_count: patientCounts[m.room_prefix] || 0,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }));
}

export async function updateRoomMapping(
  supabase: SupabaseClient<Database>,
  roomPrefix: string,
  request: UpdateRoomMappingRequest,
): Promise<RoomMappingItem> {
  const updateData: any = {};
  if (request.coordinator_id !== undefined) {
    updateData.coordinator_id = request.coordinator_id || null;
  }
  if (request.description !== undefined) {
    updateData.description = request.description || null;
  }
  if (request.is_active !== undefined) {
    updateData.is_active = request.is_active;
  }

  const { data, error } = await (supabase
    .from('room_coordinator_mapping') as any)
    .update(updateData)
    .eq('room_prefix', roomPrefix)
    .select(`
      id,
      room_prefix,
      coordinator_id,
      description,
      is_active,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(id, name)
    `)
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.STAFF_UPDATE_FAILED,
      `호실 매핑 수정 실패: ${error?.message}`,
    );
  }

  // 하이브리드 방식: coordinator_id가 변경되면 해당 호실 환자들 일괄 업데이트
  if (request.coordinator_id !== undefined) {
    const newCoordinatorId = request.coordinator_id || null;
    await (supabase
      .from('patients') as any)
      .update({ coordinator_id: newCoordinatorId })
      .eq('room_number', roomPrefix)
      .eq('status', 'active');
    // 에러는 무시 (환자가 없을 수도 있음)
  }

  return {
    id: data.id,
    room_prefix: data.room_prefix,
    coordinator_id: data.coordinator_id,
    coordinator_name: (data as any).coordinator?.name || null,
    description: data.description,
    is_active: data.is_active,
    patient_count: 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createRoomMapping(
  supabase: SupabaseClient<Database>,
  request: CreateRoomMappingRequest,
): Promise<RoomMappingItem> {
  const { data, error } = await (supabase
    .from('room_coordinator_mapping') as any)
    .insert({
      room_prefix: request.room_prefix,
      coordinator_id: request.coordinator_id || null,
      description: request.description || null,
      is_active: true,
    })
    .select(`
      id,
      room_prefix,
      coordinator_id,
      description,
      is_active,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(id, name)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AdminError(
        AdminErrorCode.ROOM_MAPPING_ALREADY_EXISTS,
        '이미 존재하는 호실입니다. 수정 버튼을 사용해 주세요.',
      );
    }
    throw new AdminError(
      AdminErrorCode.ROOM_MAPPING_CREATE_FAILED,
      `호실 매핑 생성 실패: ${error.message}`,
    );
  }

  // 하이브리드 방식: 새 매핑 추가 시 해당 호실 환자들 coordinator_id 업데이트
  if (request.coordinator_id) {
    await (supabase
      .from('patients') as any)
      .update({ coordinator_id: request.coordinator_id })
      .eq('room_number', request.room_prefix)
      .eq('status', 'active');
    // 에러는 무시 (환자가 없을 수도 있음)
  }

  return {
    id: data.id,
    room_prefix: data.room_prefix,
    coordinator_id: data.coordinator_id,
    coordinator_name: (data as any).coordinator?.name || null,
    description: data.description,
    is_active: data.is_active,
    patient_count: 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deleteRoomMapping(
  supabase: SupabaseClient<Database>,
  roomPrefix: string,
): Promise<{ success: boolean }> {
  const { error } = await (supabase
    .from('room_coordinator_mapping') as any)
    .delete()
    .eq('room_prefix', roomPrefix);

  if (error) {
    throw new AdminError(
      AdminErrorCode.SCHEDULE_DELETE_FAILED,
      `호실 매핑 삭제 실패: ${error.message}`,
    );
  }

  return { success: true };
}

// ========== Sync Logs Service ==========

export async function getSyncLogs(
  supabase: SupabaseClient<Database>,
  query: GetSyncLogsQuery,
): Promise<{ data: SyncLogItem[]; total: number; page: number; limit: number }> {
  const offset = (query.page - 1) * query.limit;

  const { data, error, count } = await (supabase
    .from('sync_logs') as any)
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + query.limit - 1);

  if (error) {
    throw new AdminError(
      AdminErrorCode.STATS_FETCH_FAILED,
      `동기화 로그 조회 실패: ${error.message}`,
    );
  }

  return {
    data: (data || []) as SyncLogItem[],
    total: count || 0,
    page: query.page,
    limit: query.limit,
  };
}

export async function getSyncLogById(
  supabase: SupabaseClient<Database>,
  logId: string,
): Promise<any> {
  const { data, error } = await (supabase
    .from('sync_logs') as any)
    .select('*')
    .eq('id', logId)
    .single();

  if (error || !data) {
    throw new AdminError(
      AdminErrorCode.STAFF_NOT_FOUND,
      '동기화 로그를 찾을 수 없습니다',
    );
  }

  return data;
}

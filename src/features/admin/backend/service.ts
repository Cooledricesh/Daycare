import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import bcrypt from 'bcryptjs';
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
      birth_date,
      gender,
      coordinator_id,
      status,
      memo,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(name)
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

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const result: PatientWithCoordinator[] = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    birth_date: p.birth_date,
    gender: p.gender,
    coordinator_id: p.coordinator_id,
    coordinator_name: p.coordinator?.name || null,
    status: p.status,
    memo: p.memo,
    created_at: p.created_at,
    updated_at: p.updated_at,
    schedule_pattern: (patternMap.get(p.id) || [])
      .sort((a, b) => a - b)
      .map((d) => dayNames[d])
      .join(','),
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
      birth_date,
      gender,
      coordinator_id,
      status,
      memo,
      created_at,
      updated_at,
      coordinator:staff!coordinator_id(name)
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

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const scheduleDays = ((patterns as any) || [])
    .filter((p: any) => p.is_active)
    .map((p: any) => p.day_of_week)
    .sort((a: number, b: number) => a - b);

  const patientData = data as any;
  return {
    id: patientData.id,
    name: patientData.name,
    birth_date: patientData.birth_date,
    gender: patientData.gender,
    coordinator_id: patientData.coordinator_id,
    coordinator_name: patientData.coordinator?.name || null,
    status: patientData.status,
    memo: patientData.memo,
    created_at: patientData.created_at,
    updated_at: patientData.updated_at,
    schedule_pattern: scheduleDays.map((d: number) => dayNames[d]).join(','),
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
      birth_date: request.birth_date || null,
      gender: request.gender || null,
      coordinator_id: request.coordinator_id || null,
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

  // 코디네이터 이름 가져오기
  let coordinatorName: string | null = null;
  if (patient.coordinator_id) {
    const { data: coordinator } = await (supabase
      .from('staff') as any)
      .select('name')
      .eq('id', patient.coordinator_id)
      .single();
    coordinatorName = (coordinator as any)?.name || null;
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const schedulePattern = request.schedule_days
    .sort((a, b) => a - b)
    .map((d) => dayNames[d])
    .join(',');

  return {
    id: patient.id,
    name: patient.name,
    birth_date: patient.birth_date,
    gender: patient.gender,
    coordinator_id: patient.coordinator_id,
    coordinator_name: coordinatorName,
    status: patient.status,
    memo: patient.memo,
    created_at: patient.created_at,
    updated_at: patient.updated_at,
    schedule_pattern: schedulePattern,
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
  if (request.birth_date !== undefined) updateData.birth_date = request.birth_date || null;
  if (request.gender !== undefined) updateData.gender = request.gender || null;
  if (request.coordinator_id !== undefined) updateData.coordinator_id = request.coordinator_id || null;
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

export async function getDailySchedule(
  supabase: SupabaseClient<Database>,
  query: GetDailyScheduleQuery,
): Promise<DailyScheduleResponse> {
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

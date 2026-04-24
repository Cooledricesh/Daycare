export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

// Enum Types
export type StaffRole = 'doctor' | 'coordinator' | 'nurse' | 'admin';
export type PatientStatus = 'active' | 'discharged';
export type Gender = 'M' | 'F';
export type TaskTarget = 'coordinator' | 'nurse' | 'both';
export type ScheduleSource = 'auto' | 'manual';
export type SyncSource = 'google_sheets' | 'excel_upload';
export type SyncStatus = 'running' | 'completed' | 'failed';

// 동기화 관련 타입
export interface RoomCoordinatorMapping {
    id: string;
    room_prefix: string;
    coordinator_id: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface RoomCoordinatorMappingWithCoordinator extends RoomCoordinatorMapping {
    coordinator?: { id: string; name: string } | null;
}

export interface SyncLog {
    id: string;
    started_at: string;
    completed_at: string | null;
    source: SyncSource;
    triggered_by: string;
    status: SyncStatus;
    total_in_source: number;
    total_processed: number;
    inserted: number;
    updated: number;
    discharged: number;
    reactivated: number;
    unchanged: number;
    skipped: number;
    error_message: string | null;
    details: SyncDetails | null;
    created_at: string;
}

export interface SyncDetails {
    changes: SyncChange[];
    skipped_reasons: { patientIdNo: string; name: string; reason: string }[];
}

export interface SyncChange {
    patientIdNo: string;
    name: string;
    action: 'insert' | 'update' | 'discharge' | 'ward_admission' | 'activity_stop' | 'reactivate';
    fields?: {
        [key: string]: { old: string | null; new: string | null };
    };
}

export interface Database {
    public: {
        Tables: {
            staff: {
                Row: {
                    id: string;
                    login_id: string;
                    password_hash: string;
                    name: string;
                    role: StaffRole;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    login_id: string;
                    password_hash: string;
                    name: string;
                    role: StaffRole;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    login_id?: string;
                    password_hash?: string;
                    name?: string;
                    role?: StaffRole;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            patients: {
                Row: {
                    id: string;
                    name: string;
                    display_name: string | null;
                    avatar_url: string | null;
                    gender: Gender | null;
                    birth_date: string | null;
                    room_number: string | null;
                    patient_id_no: string | null;
                    coordinator_id: string | null;
                    doctor_id: string | null;
                    status: PatientStatus;
                    memo: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    gender?: Gender | null;
                    birth_date?: string | null;
                    room_number?: string | null;
                    patient_id_no?: string | null;
                    coordinator_id?: string | null;
                    doctor_id?: string | null;
                    status?: PatientStatus;
                    memo?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    gender?: Gender | null;
                    birth_date?: string | null;
                    room_number?: string | null;
                    patient_id_no?: string | null;
                    coordinator_id?: string | null;
                    doctor_id?: string | null;
                    status?: PatientStatus;
                    memo?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            scheduled_patterns: {
                Row: {
                    id: string;
                    patient_id: string;
                    day_of_week: number;
                    is_active: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    day_of_week: number;
                    is_active?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    day_of_week?: number;
                    is_active?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            scheduled_attendances: {
                Row: {
                    id: string;
                    patient_id: string;
                    date: string;
                    source: ScheduleSource;
                    is_cancelled: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    date: string;
                    source?: ScheduleSource;
                    is_cancelled?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    date?: string;
                    source?: ScheduleSource;
                    is_cancelled?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            attendances: {
                Row: {
                    id: string;
                    patient_id: string;
                    date: string;
                    checked_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    date: string;
                    checked_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    date?: string;
                    checked_at?: string;
                };
                Relationships: [];
            };
            vitals: {
                Row: {
                    id: string;
                    patient_id: string;
                    date: string;
                    systolic: number | null;
                    diastolic: number | null;
                    blood_sugar: number | null;
                    memo: string | null;
                    recorded_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    date: string;
                    systolic?: number | null;
                    diastolic?: number | null;
                    blood_sugar?: number | null;
                    memo?: string | null;
                    recorded_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    date?: string;
                    systolic?: number | null;
                    diastolic?: number | null;
                    blood_sugar?: number | null;
                    memo?: string | null;
                    recorded_at?: string;
                };
                Relationships: [];
            };
            consultations: {
                Row: {
                    id: string;
                    patient_id: string;
                    date: string;
                    doctor_id: string;
                    note: string | null;
                    has_task: boolean;
                    task_content: string | null;
                    task_target: TaskTarget | null;
                    checked_by_coordinator: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    date: string;
                    doctor_id: string;
                    note?: string | null;
                    has_task?: boolean;
                    task_content?: string | null;
                    task_target?: TaskTarget | null;
                    checked_by_coordinator?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    date?: string;
                    doctor_id?: string;
                    note?: string | null;
                    has_task?: boolean;
                    task_content?: string | null;
                    task_target?: TaskTarget | null;
                    checked_by_coordinator?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            task_completions: {
                Row: {
                    id: string;
                    consultation_id: string;
                    completed_by: string;
                    role: 'coordinator' | 'nurse';
                    is_completed: boolean;
                    completed_at: string | null;
                    memo: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    consultation_id: string;
                    completed_by: string;
                    role: 'coordinator' | 'nurse';
                    is_completed?: boolean;
                    completed_at?: string | null;
                    memo?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    consultation_id?: string;
                    completed_by?: string;
                    role?: 'coordinator' | 'nurse';
                    is_completed?: boolean;
                    completed_at?: string | null;
                    memo?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            messages: {
                Row: {
                    id: string;
                    patient_id: string;
                    date: string;
                    author_id: string;
                    author_role: 'coordinator' | 'nurse';
                    content: string;
                    is_read: boolean;
                    read_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    patient_id: string;
                    date: string;
                    author_id: string;
                    author_role: 'coordinator' | 'nurse';
                    content: string;
                    is_read?: boolean;
                    read_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    patient_id?: string;
                    date?: string;
                    author_id?: string;
                    author_role?: 'coordinator' | 'nurse';
                    content?: string;
                    is_read?: boolean;
                    read_at?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            daily_stats: {
                Row: {
                    id: string;
                    date: string;
                    scheduled_count: number;
                    attendance_count: number;
                    consultation_count: number;
                    registered_count: number;
                    attendance_rate: number | null;
                    consultation_rate: number | null;
                    consultation_rate_vs_attendance: number | null;
                    calculated_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    scheduled_count?: number;
                    attendance_count?: number;
                    consultation_count?: number;
                    registered_count?: number;
                    attendance_rate?: number | null;
                    consultation_rate?: number | null;
                    consultation_rate_vs_attendance?: number | null;
                    calculated_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    scheduled_count?: number;
                    attendance_count?: number;
                    consultation_count?: number;
                    registered_count?: number;
                    attendance_rate?: number | null;
                    consultation_rate?: number | null;
                    consultation_rate_vs_attendance?: number | null;
                    calculated_at?: string;
                };
                Relationships: [];
            };
            room_coordinator_mapping: {
                Row: {
                    id: string;
                    room_prefix: string;
                    coordinator_id: string | null;
                    description: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    room_prefix: string;
                    coordinator_id?: string | null;
                    description?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    room_prefix?: string;
                    coordinator_id?: string | null;
                    description?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            sync_logs: {
                Row: {
                    id: string;
                    started_at: string;
                    completed_at: string | null;
                    source: SyncSource;
                    triggered_by: string;
                    status: SyncStatus;
                    total_in_source: number;
                    total_processed: number;
                    inserted: number;
                    updated: number;
                    discharged: number;
                    reactivated: number;
                    unchanged: number;
                    skipped: number;
                    error_message: string | null;
                    details: SyncDetails | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    started_at?: string;
                    completed_at?: string | null;
                    source: SyncSource;
                    triggered_by: string;
                    status?: SyncStatus;
                    total_in_source?: number;
                    total_processed?: number;
                    inserted?: number;
                    updated?: number;
                    discharged?: number;
                    reactivated?: number;
                    unchanged?: number;
                    skipped?: number;
                    error_message?: string | null;
                    details?: SyncDetails | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    started_at?: string;
                    completed_at?: string | null;
                    source?: SyncSource;
                    triggered_by?: string;
                    status?: SyncStatus;
                    total_in_source?: number;
                    total_processed?: number;
                    inserted?: number;
                    updated?: number;
                    discharged?: number;
                    reactivated?: number;
                    unchanged?: number;
                    skipped?: number;
                    error_message?: string | null;
                    details?: SyncDetails | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            holidays: {
                Row: {
                    id: string;
                    date: string;
                    reason: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    reason: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    reason?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            notification_dismissals: {
                Row: {
                    id: string;
                    staff_id: string;
                    last_dismissed_sync_id: string | null;
                    dismissed_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    staff_id: string;
                    last_dismissed_sync_id?: string | null;
                    dismissed_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    staff_id?: string;
                    last_dismissed_sync_id?: string | null;
                    dismissed_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            monthly_reports: {
                Row: {
                    id: string;
                    year: number;
                    month: number;
                    total_attendance_days: number;
                    per_patient_avg_days: string;
                    daily_avg_attendance: string;
                    consultation_attendance_rate: string;
                    registered_count_eom: number;
                    new_patient_count: number;
                    discharged_count: number;
                    weekly_trend: Json;
                    weekday_avg: Json;
                    prev_month_comparison: Json;
                    coordinator_performance: Json;
                    patient_segments: Json;
                    consultation_stats: Json;
                    special_notes: Json;
                    action_items: string;
                    generated_at: string;
                    generated_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    year: number;
                    month: number;
                    total_attendance_days?: number;
                    per_patient_avg_days?: string | number;
                    daily_avg_attendance?: string | number;
                    consultation_attendance_rate?: string | number;
                    registered_count_eom?: number;
                    new_patient_count?: number;
                    discharged_count?: number;
                    weekly_trend?: Json;
                    weekday_avg?: Json;
                    prev_month_comparison?: Json;
                    coordinator_performance?: Json;
                    patient_segments?: Json;
                    consultation_stats?: Json;
                    special_notes?: Json;
                    action_items?: string;
                    generated_at?: string;
                    generated_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    year?: number;
                    month?: number;
                    total_attendance_days?: number;
                    per_patient_avg_days?: string | number;
                    daily_avg_attendance?: string | number;
                    consultation_attendance_rate?: string | number;
                    registered_count_eom?: number;
                    new_patient_count?: number;
                    discharged_count?: number;
                    weekly_trend?: Json;
                    weekday_avg?: Json;
                    prev_month_comparison?: Json;
                    coordinator_performance?: Json;
                    patient_segments?: Json;
                    consultation_stats?: Json;
                    special_notes?: Json;
                    action_items?: string;
                    generated_at?: string;
                    generated_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}

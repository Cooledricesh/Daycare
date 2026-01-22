export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

// Enum Types
export type StaffRole = 'doctor' | 'coordinator' | 'nurse' | 'admin';
export type PatientStatus = 'active' | 'discharged' | 'suspended';
export type Gender = 'M' | 'F';
export type TaskTarget = 'coordinator' | 'nurse' | 'both';
export type ScheduleSource = 'auto' | 'manual';

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
            };
            patients: {
                Row: {
                    id: string;
                    name: string;
                    gender: Gender | null;
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
                    gender?: Gender | null;
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
                    gender?: Gender | null;
                    room_number?: string | null;
                    patient_id_no?: string | null;
                    coordinator_id?: string | null;
                    doctor_id?: string | null;
                    status?: PatientStatus;
                    memo?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
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
                    created_at?: string;
                    updated_at?: string;
                };
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
            };
            daily_stats: {
                Row: {
                    id: string;
                    date: string;
                    scheduled_count: number;
                    attendance_count: number;
                    consultation_count: number;
                    attendance_rate: number | null;
                    consultation_rate: number | null;
                    calculated_at: string;
                };
                Insert: {
                    id?: string;
                    date: string;
                    scheduled_count?: number;
                    attendance_count?: number;
                    consultation_count?: number;
                    attendance_rate?: number | null;
                    consultation_rate?: number | null;
                    calculated_at?: string;
                };
                Update: {
                    id?: string;
                    date?: string;
                    scheduled_count?: number;
                    attendance_count?: number;
                    consultation_count?: number;
                    attendance_rate?: number | null;
                    consultation_rate?: number | null;
                    calculated_at?: string;
                };
            };
        };
    };
}

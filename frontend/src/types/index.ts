export type UserRole = "director" | "senior_doctor" | "junior_doctor" | "receptionist" | "patient";

export interface User {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  phone?: string;
  last_login?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

export interface Patient {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: "male" | "female" | "other";
  date_of_birth: string;
  age: number;
  national_id: string;
  phone: string;
  email: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  blood_type?: string;
  assigned_doctor_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface CTScan {
  id: string;
  patient_id: string;
  status: "pending" | "assigned" | "processing" | "predicted" | "under_review" | "confirmed" | "published";
  priority: "low" | "normal" | "high" | "urgent";
  file_name: string;
  file_type: string;
  file_size_kb: number;
  prediction_id?: string;
  report_id?: string;
  heatmap_path?: string;
  notes?: string;
  scan_date?: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  ct_scan_id: string;
  patient_id: string;
  prediction: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  model_version: string;
  heatmap_generated: boolean;
  heatmap_path?: string;
  created_at: string;
}

export interface Report {
  id: string;
  patient_id: string;
  ct_scan_id: string;
  prediction_id: string;
  junior_doctor_id: string;
  senior_doctor_id?: string;
  status: "draft" | "pending_review" | "under_review" | "approved" | "rejected" | "published" | "re_evaluation";
  junior_notes?: string;
  senior_notes?: string;
  recommendations: string[];
  gemini_explanation?: string;
  pdf_path?: string;
  submitted_at?: string;
  reviewed_at?: string;
  published_at?: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id?: string;
  appointment_type: "ct_scan" | "follow_up" | "consultation" | "new_scan";
  status: "requested" | "scheduled" | "rescheduled" | "cancelled" | "completed" | "no_show";
  scheduled_at?: string;
  duration_minutes: number;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totals: {
    patients: number;
    ct_scans: number;
    cancer_cases: number;
    normal_cases: number;
    published_reports: number;
    total_reports: number;
  };
  today: { scans: number };
  monthly: { scans: number };
  staff: {
    junior_doctors: number;
    senior_doctors: number;
    receptionists: number;
  };
  accuracy: { prediction_accuracy: number };
}

export interface ApiError {
  detail: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

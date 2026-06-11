import axios, { AxiosInstance, AxiosError } from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Request interceptor - attach access token
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = Cookies.get("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          Cookies.set("access_token", data.access_token, { expires: 1 });
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    api.post("/auth/change-password", { current_password, new_password, confirm_password }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

// Users
export const usersApi = {
  list: (params?: any) => api.get("/users", { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post("/users", data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  toggleActive: (id: string) => api.post(`/users/${id}/toggle-active`),
};

// Patients
export const patientsApi = {
  list: (params?: any) => api.get("/patients", { params }),
  get: (id: string) => api.get(`/patients/${id}`),
  create: (data: any) => api.post("/patients", data),
  update: (id: string, data: any) => api.patch(`/patients/${id}`, data),
  assignDoctor: (patientId: string, doctorId: string) =>
    api.post(`/patients/${patientId}/assign-doctor`, null, { params: { doctor_id: doctorId } }),
};

// CT Scans
export const ctScansApi = {
  list: (params?: any) => api.get("/ct-scans", { params }),
  get: (id: string) => api.get(`/ct-scans/${id}`),
  request: (data: FormData) => api.post("/ct-scans/request", data, { headers: { "Content-Type": "multipart/form-data" } }),
  createForPatient: (patientId: string, doctorId: string, notes?: string) => {
    const fd = new FormData();
    fd.append("patient_id", patientId);
    fd.append("doctor_id", doctorId);
    if (notes) fd.append("notes", notes);
    return api.post("/ct-scans/request", fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  upload: (scanId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/ct-scans/${scanId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  predict: (scanId: string) => api.post(`/ct-scans/${scanId}/predict`),
};

// Reports
export const reportsApi = {
  list: (params?: any) => api.get("/reports", { params }),
  get: (id: string) => api.get(`/reports/${id}`),
  create: (data: any) => api.post("/reports", data),
  submit: (id: string, data: any) => api.post(`/reports/${id}/submit`, data),
  queue: () => api.get("/reports/queue"),
  review: (id: string, data: any) => api.post(`/reports/${id}/review`, data),
  publish: (id: string) => api.post(`/reports/${id}/publish`),
  activitySummary: (data: { notes?: string; period?: string }) =>
    api.post("/reports/activity-summary", data),
  downloadPdf: (id: string) =>
    api.get(`/reports/${id}/pdf`, { responseType: "blob" }),
  exportCsv: (params?: any) =>
    api.get("/reports/export-csv", { params, responseType: "blob" }),
};

// Appointments
export const appointmentsApi = {
  list: (params?: any) => api.get("/appointments", { params }),
  create: (data: any) => api.post("/appointments", data),
  update: (id: string, data: any) => api.patch(`/appointments/${id}`, data),
  confirm: (id: string, data: { slot_id: string; notes?: string }) =>
    api.post(`/appointments/${id}/confirm`, data),
  reject: (id: string, data: { reason: string; next_available?: string }) =>
    api.post(`/appointments/${id}/reject`, data),
};

// Schedule
export const scheduleApi = {
  getDoctors: () => api.get("/schedule/doctors"),
  getSlots: (params?: any) => api.get("/schedule/slots", { params }),
};

// Analytics
export const analyticsApi = {
  dashboard: () => api.get("/analytics/dashboard"),
  cancerDistribution: () => api.get("/analytics/cancer-distribution"),
  monthlyActivity: (year?: number) => api.get("/analytics/monthly-activity", { params: { year } }),
  auditLogs: (params?: any) => api.get("/analytics/audit-logs", { params }),
};

// Notifications
export const notificationsApi = {
  list: (params?: any) => api.get("/notifications", { params }),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(", ");
  }
  return "An unexpected error occurred";
}

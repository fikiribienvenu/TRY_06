"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, appointmentsApi, notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { FileText, Calendar, Bell, Download } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default function PatientDashboard() {
  const { user } = useAuthStore();

  const { data: reports } = useQuery({
    queryKey: ["patient-reports"],
    queryFn: () => reportsApi.list({ page_size: 10 }),
  });
  const { data: appointments } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: () => appointmentsApi.list({ page_size: 5 }),
  });
  const { data: notifications } = useQuery({
    queryKey: ["patient-notifications"],
    queryFn: () => notificationsApi.list({ unread_only: true, page_size: 5 }),
  });

  const reportsList = reports?.data ?? [];
  const aptList = appointments?.data?.appointments ?? [];
  const unreadNotifs = notifications?.data?.notifications ?? [];
  const publishedReports = reportsList.filter((r: any) => r.status === "published");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.full_name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm mt-1">Your health portal — CT scan results and appointments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Published Reports" value={publishedReports.length} icon={<FileText className="w-6 h-6" />} color="blue" />
        <StatCard title="Appointments" value={aptList.length} icon={<Calendar className="w-6 h-6" />} color="green" />
        <StatCard title="Notifications" value={notifications?.data?.unread_count ?? 0} icon={<Bell className="w-6 h-6" />} color="amber" description="Unread" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Reports</h3>
            <Link href="/patient/reports" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {publishedReports.slice(0, 4).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="font-medium text-sm">CT Scan Report</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.published_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.pdf_path && (
                    <a
                      href={`/api/v1/reports/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-primary transition"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {publishedReports.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-6">No published reports yet</p>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Notifications</h3>
          </div>
          <div className="space-y-3">
            {unreadNotifs.map((n: any) => (
              <div key={n.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="font-medium text-sm text-blue-800 dark:text-blue-200">{n.title}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{n.message}</p>
                <p className="text-xs text-blue-500 mt-1">{formatDateTime(n.created_at)}</p>
              </div>
            ))}
            {unreadNotifs.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-6">No new notifications</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Appointments</h3>
          <Link href="/patient/appointments" className="text-xs text-primary hover:underline">Manage</Link>
        </div>
        {aptList.length > 0 ? (
          <div className="space-y-3">
            {aptList.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="font-medium text-sm capitalize">{a.appointment_type.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.scheduled_at) || "Pending scheduling"}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No appointments scheduled</p>
            <Link
              href="/patient/appointments"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Request an appointment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

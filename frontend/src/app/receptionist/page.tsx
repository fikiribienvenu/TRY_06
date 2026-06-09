"use client";
import { useQuery } from "@tanstack/react-query";
import { patientsApi, appointmentsApi, ctScansApi } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users, Calendar, Scan, UserPlus } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import type { Patient, Appointment } from "@/types";

export default function ReceptionistDashboard() {
  const { data: patientsData } = useQuery({
    queryKey: ["patients-receptionist"],
    queryFn: () => patientsApi.list({ page_size: 5 }),
  });
  const { data: appointmentsData } = useQuery({
    queryKey: ["appointments-receptionist"],
    queryFn: () => appointmentsApi.list({ page_size: 5 }),
  });
  const { data: scansData } = useQuery({
    queryKey: ["scans-pending"],
    queryFn: () => ctScansApi.list({ status: "pending", page_size: 5 }),
  });

  const recentPatients: Patient[] = patientsData?.data?.patients ?? [];
  const appointments: Appointment[] = appointmentsData?.data?.appointments ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Receptionist Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage patients and appointments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Patients" value={patientsData?.data?.total ?? 0} icon={<Users className="w-6 h-6" />} color="blue" />
        <StatCard title="Appointments Today" value={appointments.filter(a => a.status === "scheduled").length} icon={<Calendar className="w-6 h-6" />} color="green" />
        <StatCard title="Pending Scans" value={scansData?.data?.total ?? 0} icon={<Scan className="w-6 h-6" />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Patients</h3>
            <Link href="/receptionist/patients" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentPatients.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.patient_id} · {p.phone}</p>
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0">{formatDate(p.created_at)}</p>
              </div>
            ))}
            {recentPatients.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No patients registered yet</p>
            )}
          </div>
        </div>

        {/* Appointments */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Appointments</h3>
            <Link href="/receptionist/appointments" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm capitalize">{a.appointment_type.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.scheduled_at) || "Not scheduled"}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {appointments.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No appointments yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { href: "/receptionist/register", label: "Register Patient", icon: <UserPlus className="w-6 h-6" />, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30" },
          { href: "/receptionist/patients", label: "Search Patient", icon: <Users className="w-6 h-6" />, color: "bg-green-50 text-green-600 dark:bg-green-900/30" },
          { href: "/receptionist/appointments", label: "Appointments", icon: <Calendar className="w-6 h-6" />, color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30" },
          { href: "/receptionist/scans", label: "Request CT Scan", icon: <Scan className="w-6 h-6" />, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow text-center"
          >
            <div className={`p-3 rounded-xl ${item.color}`}>{item.icon}</div>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

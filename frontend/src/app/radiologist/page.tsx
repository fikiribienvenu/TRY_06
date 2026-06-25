"use client";
import { useQuery } from "@tanstack/react-query";
import { patientsApi, ctScansApi, reportsApi } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users, Scan, ClipboardList, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function RadiologistDashboard() {
  const { data: patients } = useQuery({
    queryKey: ["my-patients"],
    queryFn: () => patientsApi.list({ page_size: 5 }),
  });
  const { data: scans } = useQuery({
    queryKey: ["my-scans"],
    queryFn: () => ctScansApi.list({ page_size: 5 }),
  });
  const { data: reports } = useQuery({
    queryKey: ["my-reports"],
    queryFn: () => reportsApi.list({ page_size: 5 }),
  });

  const pendingScans = scans?.data?.scans?.filter((s: any) => s.status === "assigned" || s.status === "pending") ?? [];
  const draftReports = reports?.data?.filter((r: any) => r.status === "draft") ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Radiologist Dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage your assigned patients and CT scans</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Assigned Patients" value={patients?.data?.total ?? 0} icon={<Users className="w-6 h-6" />} color="blue" />
        <StatCard title="Pending Scans" value={pendingScans.length} icon={<Scan className="w-6 h-6" />} color="amber" />
        <StatCard title="Draft Reports" value={draftReports.length} icon={<ClipboardList className="w-6 h-6" />} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Patients</h3>
            <Link href="/radiologist/patients" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(patients?.data?.patients ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  {p.first_name[0]}{p.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.patient_id} · Age {p.age}</p>
                </div>
                <Link href={`/radiologist/patients/${p.id}`} className="text-xs text-primary hover:underline">View</Link>
              </div>
            ))}
            {(patients?.data?.patients ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No assigned patients</p>
            )}
          </div>
        </div>

        {/* Pending Scans */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">CT Scans Queue</h3>
            <Link href="/radiologist/scans" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(scans?.data?.scans ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{s.file_name || "CT Scan Request"}</p>
                  <p className="text-xs text-muted-foreground">Patient: {s.patient_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.priority} />
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
            {(scans?.data?.scans ?? []).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">No CT scans assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { href: "/radiologist/patients", label: "View Patients", icon: <Users className="w-6 h-6" />, color: "bg-blue-50 text-blue-600" },
          { href: "/radiologist/scans", label: "Upload CT Scan", icon: <Upload className="w-6 h-6" />, color: "bg-teal-50 text-teal-600" },
          { href: "/radiologist/reports", label: "My Reports", icon: <ClipboardList className="w-6 h-6" />, color: "bg-purple-50 text-purple-600" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow text-center"
          >
            <div className={`p-3 rounded-xl dark:bg-opacity-20 ${item.color}`}>{item.icon}</div>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

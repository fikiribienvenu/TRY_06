"use client";
import { useQuery } from "@tanstack/react-query";
import { patientsApi, ctScansApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users, ScanLine, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

// Maps CT scan status → display info
const SCAN_STATUS_INFO: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  pending:      { label: "Pending",        color: "text-gray-500",               icon: <Clock className="w-3.5 h-3.5" />,        bg: "bg-gray-100 dark:bg-gray-800" },
  assigned:     { label: "Assigned",       color: "text-blue-600 dark:text-blue-400",   icon: <ScanLine className="w-3.5 h-3.5" />,     bg: "bg-blue-50 dark:bg-blue-900/20" },
  processing:   { label: "Scan Uploaded",  color: "text-amber-600 dark:text-amber-400", icon: <AlertCircle className="w-3.5 h-3.5" />,  bg: "bg-amber-50 dark:bg-amber-900/20" },
  predicted:    { label: "Analyzed",       color: "text-purple-600 dark:text-purple-400",icon: <AlertCircle className="w-3.5 h-3.5" />, bg: "bg-purple-50 dark:bg-purple-900/20" },
  under_review: { label: "Under Review",   color: "text-orange-600 dark:text-orange-400",icon: <Clock className="w-3.5 h-3.5" />,       bg: "bg-orange-50 dark:bg-orange-900/20" },
  confirmed:    { label: "Confirmed",      color: "text-green-600 dark:text-green-400",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, bg: "bg-green-50 dark:bg-green-900/20" },
  published:    { label: "Done ✓",         color: "text-green-700 dark:text-green-400",  icon: <CheckCircle2 className="w-3.5 h-3.5" />, bg: "bg-green-100 dark:bg-green-900/30" },
};

function ScanStatusBadge({ status }: { status: string }) {
  const info = SCAN_STATUS_INFO[status] ?? {
    label: status.replace(/_/g, " "),
    color: "text-muted-foreground",
    icon: <Clock className="w-3.5 h-3.5" />,
    bg: "bg-muted",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${info.color} ${info.bg}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

export default function RadiologistPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["my-patients", search, page],
    queryFn: () => patientsApi.list({ search, page, page_size: 20 }),
  });

  // Load all CT scans assigned to this radiologist to match against patients
  const { data: scansData } = useQuery({
    queryKey: ["my-scans-for-patients"],
    queryFn: () => ctScansApi.list({ page_size: 200 }),
  });

  const patients = data?.data?.patients ?? [];
  const total    = data?.data?.total ?? 0;
  const scans: any[] = scansData?.data?.scans ?? [];

  // Build a map: patient_id → most recent scan
  const scanByPatient: Record<string, any> = {};
  scans.forEach((s: any) => {
    const existing = scanByPatient[s.patient_id];
    if (!existing || new Date(s.created_at) > new Date(existing.created_at)) {
      scanByPatient[s.patient_id] = s;
    }
  });

  // Derive workflow status per patient
  function getPatientStatus(patient: any) {
    const scan = scanByPatient[patient.id];
    if (!scan) return { status: "no_scan", label: "No Scan Requested", color: "text-muted-foreground", bg: "bg-muted/40" };
    return scan;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">My Patients</h1>
        <p className="text-muted-foreground text-sm">
          Patients assigned to you — with CT scan workflow status
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Status:</span>
        {[
          { label: "No Scan",     color: "bg-gray-100 text-gray-500 dark:bg-gray-800" },
          { label: "Assigned",    color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" },
          { label: "Scan Uploaded", color: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" },
          { label: "Analyzed",    color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
          { label: "Under Review",color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
          { label: "Done ✓",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
        ].map(s => (
          <span key={s.label} className={`px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No patients assigned yet</p>
          <p className="text-sm mt-1">Patients will appear here once the Receptionist assigns them to you.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Patient", "ID", "Age / Gender", "Scan Status", "Last Scan", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((p: any) => {
                const scan = scanByPatient[p.id];
                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    {/* Patient name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs flex-shrink-0">
                          {p.first_name?.[0]?.toUpperCase()}{p.last_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Patient ID */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.patient_id}</td>

                    {/* Age / Gender */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.age ? `${p.age}y` : "—"} / <span className="capitalize">{p.gender ?? "—"}</span>
                    </td>

                    {/* Scan Status */}
                    <td className="px-4 py-3">
                      {scan ? (
                        <ScanStatusBadge status={scan.status} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted/40">
                          <XCircle className="w-3.5 h-3.5" />
                          No Scan Yet
                        </span>
                      )}
                    </td>

                    {/* Last scan date */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {scan ? formatDate(scan.created_at) : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/radiologist/scans?patient_id=${p.id}`}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#0f2a42] transition"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          CT Scans
                        </Link>
                        {scan?.report_id && (
                          <Link
                            href={`/radiologist/reports`}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-border rounded-lg hover:bg-muted transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Report
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} total patient{total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition text-xs">Prev</button>
              <span className="px-2 text-xs">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={patients.length < 20}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition text-xs">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

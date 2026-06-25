"use client";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, usersApi, analyticsApi, handleApiError } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { MonthlyActivityChart, CancerDistributionChart } from "@/components/charts/BarChartComponent";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  FileText, Download, Filter, BarChart3,
  ChevronDown, AlertTriangle, CheckCircle,
  Users, Activity,
} from "lucide-react";

const DATE_OPTIONS = [
  { value: "all",   label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week",  label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year",  label: "This Year" },
];

const STATUS_OPTIONS = [
  { value: "",              label: "All Statuses" },
  { value: "pending_review",label: "Pending Review" },
  { value: "under_review",  label: "Under Review" },
  { value: "approved",      label: "Approved" },
  { value: "published",     label: "Published" },
  { value: "rejected",      label: "Rejected" },
  { value: "re_evaluation", label: "Re-evaluation" },
];

function Select({
  value, onChange, children, className = "",
}: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function DirectorReportsPage() {
  const [activeTab, setActiveTab]         = useState<"reports" | "analytics">("reports");
  const [datePeriod, setDatePeriod]       = useState("all");
  const [statusFilter, setStatusFilter]   = useState("");
  const [radiologistId, setRadiologistId] = useState("");
  const [seniorDrId, setSeniorDrId]       = useState("");
  const [page, setPage]                   = useState(1);
  const [exporting, setExporting]         = useState(false);

  const resetPage = useCallback(() => setPage(1), []);

  const { data, isLoading } = useQuery({
    queryKey: ["director-reports", datePeriod, statusFilter, radiologistId, seniorDrId, page],
    queryFn: () =>
      reportsApi.list({
        date_filter:       datePeriod !== "all" ? datePeriod : undefined,
        status:            statusFilter || undefined,
        radiologist_id:    radiologistId || undefined,
        senior_doctor_id:  seniorDrId  || undefined,
        page,
        page_size: 20,
      }),
    enabled: activeTab === "reports",
  });
  const reports: any[]       = data?.data?.reports       ?? [];
  const totalReports         = data?.data?.total         ?? 0;
  const statusCounts: any    = data?.data?.status_counts ?? {};

  const { data: jdData } = useQuery({
    queryKey: ["radiologists"],
    queryFn: () => usersApi.list({ role: "radiologist", page_size: 100, is_active: true }),
  });
  const radiologists: any[] = jdData?.data?.users ?? jdData?.data ?? [];

  const { data: sdData } = useQuery({
    queryKey: ["senior-doctors"],
    queryFn: () => usersApi.list({ role: "senior_doctor", page_size: 100, is_active: true }),
  });
  const seniorDoctors: any[] = sdData?.data?.users ?? sdData?.data ?? [];

  const { data: monthly } = useQuery({
    queryKey: ["monthly-activity"],
    queryFn: () => analyticsApi.monthlyActivity(),
    enabled: activeTab === "analytics",
  });
  const { data: cancerDist } = useQuery({
    queryKey: ["cancer-distribution"],
    queryFn: () => analyticsApi.cancerDistribution(),
    enabled: activeTab === "analytics",
  });

  const stats = {
    total:     totalReports,
    published: statusCounts["published"]    ?? 0,
    approved:  statusCounts["approved"]     ?? 0,
    rejected:  statusCounts["rejected"]     ?? 0,
    pending:   (statusCounts["pending_review"] ?? 0) + (statusCounts["under_review"] ?? 0),
  };

  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await reportsApi.exportCsv({
        date_filter:      datePeriod !== "all" ? datePeriod : undefined,
        status:           statusFilter || undefined,
        radiologist_id:   radiologistId || undefined,
        senior_doctor_id: seniorDrId  || undefined,
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `pulmoscan_reports_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch (e) {
      toast.error(handleApiError(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground text-sm">Full system overview with filtering and export</p>
          </div>
        </div>

        {activeTab === "reports" && (
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition disabled:opacity-60"
          >
            {exporting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Exporting...</>
              : <><Download className="w-4 h-4" />Export CSV</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["reports", "analytics"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "reports" ? (
              <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" />All Reports</span>
            ) : (
              <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" />Analytics</span>
            )}
          </button>
        ))}
      </div>

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && (
        <>
          {/* Filter bar */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
              <Filter className="w-4 h-4" /> Filters
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Date Period</label>
                <Select value={datePeriod} onChange={(v) => { setDatePeriod(v); resetPage(); }}>
                  {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); resetPage(); }}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Radiologist</label>
                <Select value={radiologistId} onChange={(v) => { setRadiologistId(v); resetPage(); }}>
                  <option value="">All Radiologists</option>
                  {radiologists.map((d: any) => (
                    <option key={d.id ?? d._id} value={d.id ?? d._id}>{d.full_name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Senior Doctor</label>
                <Select value={seniorDrId} onChange={(v) => { setSeniorDrId(v); resetPage(); }}>
                  <option value="">All Senior Doctors</option>
                  {seniorDoctors.map((d: any) => (
                    <option key={d.id ?? d._id} value={d.id ?? d._id}>{d.full_name}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Total Reports" value={stats.total}     color="text-foreground" />
            <StatCard label="Pending"       value={stats.pending}   color="text-amber-500" />
            <StatCard label="Approved"      value={stats.approved}  color="text-green-600 dark:text-green-400" />
            <StatCard label="Published"     value={stats.published} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Rejected"      value={stats.rejected}  color="text-red-600 dark:text-red-400" />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="font-medium">No reports match the current filters</p>
              <p className="text-muted-foreground text-sm mt-1">
                Try changing the date period or clearing some filters
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Patient", "AI Finding", "Radiologist", "Senior Doctor", "Status", "Submitted", "Published", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reports.map((r: any) => {
                      const isNormal = r.prediction_label === "No Cancer" || r.prediction_label === "Normal";
                      return (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-medium">{r.patient_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {r.patient_code ?? r.patient_id?.slice(-8)}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.prediction_label ? (
                              <span className={`flex items-center gap-1 text-xs font-medium ${
                                isNormal
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}>
                                {isNormal
                                  ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                  : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                                {r.prediction_label}
                                {r.prediction_confidence != null && (
                                  <span className="text-muted-foreground font-normal">
                                    ({r.prediction_confidence}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {r.radiologist_name ? `Dr. ${r.radiologist_name}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {r.senior_doctor_name ? `Dr. ${r.senior_doctor_name}` : <span className="italic">Not reviewed</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(r.submitted_at ?? r.created_at)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {r.published_at ? formatDate(r.published_at) : <span className="italic">—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Link
                              href={`/director/reports/${r.id}`}
                              className="text-primary text-xs hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {reports.length} record{reports.length !== 1 ? "s" : ""} on this page
                  {(radiologistId || seniorDrId || statusFilter || datePeriod !== "all") && (
                    <button
                      onClick={() => {
                        setDatePeriod("all");
                        setStatusFilter("");
                        setRadiologistId("");
                        setSeniorDrId("");
                        resetPage();
                      }}
                      className="ml-3 text-xs text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition text-xs"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-xs">Page {page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={reports.length < 20}
                    className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Monthly Activity ({new Date().getFullYear()})</h3>
            <div className="h-72">
              {monthly?.data
                ? <MonthlyActivityChart data={monthly.data} />
                : <p className="text-muted-foreground text-sm">No data</p>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Cancer Type Distribution</h3>
            <div className="h-72">
              {cancerDist?.data?.length
                ? <CancerDistributionChart data={cancerDist.data} />
                : <p className="text-muted-foreground text-sm">No predictions yet</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

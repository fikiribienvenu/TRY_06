"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi, handleApiError } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  FileText, CheckCircle, XCircle, RotateCcw, Send,
  AlertTriangle, Activity, X, ChevronDown,
} from "lucide-react";

const PERIODS = ["This Week", "This Month", "This Quarter", "This Year", "Overall"];

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export default function SeniorDoctorReportsPage() {
  const qc = useQueryClient();
  const [page, setPage]           = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes]         = useState("");
  const [period, setPeriod]       = useState("Overall");

  // Paginated list for the table
  const { data, isLoading } = useQuery({
    queryKey: ["my-reviewed-reports", page],
    queryFn: () => reportsApi.list({ my_reviews: true, page, page_size: 20 }),
  });
  const reports: any[] = data?.data?.reports ?? [];
  const total: number  = data?.data?.total   ?? 0;

  // Fetch all (up to 500) for accurate stat counts
  const { data: allData } = useQuery({
    queryKey: ["my-reviewed-reports-all"],
    queryFn: () => reportsApi.list({ my_reviews: true, page: 1, page_size: 500 }),
  });
  const allReports: any[] = allData?.data?.reports ?? [];

  const stats = {
    total:     allData?.data?.total ?? 0,
    approved:  allReports.filter((r) => r.status === "approved" || r.status === "published").length,
    published: allReports.filter((r) => r.status === "published").length,
    rejected:  allReports.filter((r) => r.status === "rejected").length,
    reEval:    allReports.filter((r) => r.status === "re_evaluation").length,
  };

  const submitMutation = useMutation({
    mutationFn: () => reportsApi.activitySummary({ notes, period }),
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Activity report submitted to Director");
      setShowModal(false);
      setNotes("");
      setPeriod("Overall");
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Reviews</h1>
          <p className="text-muted-foreground text-sm">Reports you have personally reviewed and confirmed</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <Send className="w-4 h-4" /> Submit Report to Director
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Reviewed"  value={stats.total}     color="text-foreground" />
        <StatCard label="Approved"        value={stats.approved}  color="text-green-600 dark:text-green-400" />
        <StatCard label="Published"       value={stats.published} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Rejected"        value={stats.rejected}  color="text-red-600 dark:text-red-400" />
        <StatCard label="Re-evaluated"    value={stats.reEval}    color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Report table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reviewed reports yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Reports you approve, reject, or re-evaluate will appear here
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Patient", "Radiologist", "AI Finding", "Status", "Reviewed", "Action"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r: any) => {
                const isNormal = r.prediction_label === "No Cancer" || r.prediction_label === "Normal";
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.patient_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.patient_code ?? r.patient_id?.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {r.radiologist_name ? `Dr. ${r.radiologist_name}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.prediction_label ? (
                        <span className={`flex items-center gap-1 text-xs font-medium ${
                          isNormal ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}>
                          {isNormal
                            ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                          {r.prediction_label}
                          {r.prediction_confidence != null && (
                            <span className="text-muted-foreground font-normal">({r.prediction_confidence}%)</span>
                          )}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.reviewed_at ?? r.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/senior-doctor/queue/${r.id}`}
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
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} total reviews</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition">Prev</button>
              <span className="px-2">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={reports.length < 20}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit to Director Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#1a3c5e]">
              <div>
                <h2 className="font-semibold text-white">Submit Activity Report</h2>
                <p className="text-blue-300 text-xs mt-0.5">Director will receive a notification with your summary</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Stats preview */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{stats.published}</p>
                  <p className="text-xs text-muted-foreground">Published</p>
                </div>
              </div>

              {/* Period */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Reporting Period</label>
                <div className="relative">
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full appearance-none px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-8"
                  >
                    {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Additional Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any observations, concerns, or highlights for the Director..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="flex-1 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitMutation.isPending
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
                    : <><Send className="w-4 h-4" />Submit to Director</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

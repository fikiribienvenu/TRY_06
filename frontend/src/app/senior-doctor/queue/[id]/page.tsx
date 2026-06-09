"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi, ctScansApi, handleApiError } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, Send, Brain, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime, getPredictionColor, getConfidenceColor } from "@/lib/utils";

export default function ReportReviewPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const reportId = params.id as string;

  const [action, setAction] = useState<"approve" | "reject" | "re_evaluate" | null>(null);
  const [seniorNotes, setSeniorNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [newRec, setNewRec] = useState("");

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => reportsApi.get(reportId),
  });

  const reviewMutation = useMutation({
    mutationFn: (data: any) => reportsApi.review(reportId, data),
    onSuccess: (res) => {
      toast.success(`Report ${action}d successfully`);
      if (action === "approve") {
        toast("Gemini AI explanation generated", { icon: "🤖" });
      }
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      router.push("/senior-doctor/queue");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const publishMutation = useMutation({
    mutationFn: () => reportsApi.publish(reportId),
    onSuccess: () => {
      toast.success("Report published. Patient notified.");
      router.push("/senior-doctor/reports");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  if (isLoading) return <LoadingSpinner />;

  const report = reportData?.data;
  if (!report) return <div className="text-center py-12">Report not found</div>;

  const handleSubmitReview = () => {
    if (!action) { toast.error("Select an action"); return; }
    if (action === "reject" && !rejectionReason) { toast.error("Provide rejection reason"); return; }
    reviewMutation.mutate({
      action,
      senior_notes: seniorNotes,
      rejection_reason: rejectionReason,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    });
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/senior-doctor/queue" className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Report Review</h1>
          <p className="text-muted-foreground text-sm">ID: {reportId.slice(-8)}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report details */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Prediction Summary</h3>
            {/* Mock prediction display - would normally query prediction */}
            <div className="text-center p-4 bg-muted/30 rounded-xl">
              <p className="text-lg font-bold text-foreground">Awaiting prediction data</p>
              <p className="text-xs text-muted-foreground mt-1">Prediction ID: {report.prediction_id?.slice(-8)}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Junior Doctor Notes</h3>
            <p className="text-sm text-muted-foreground">
              {report.junior_notes || "No notes provided"}
            </p>
          </div>
        </div>

        {/* Review panel */}
        <div className="space-y-4">
          {(report.status === "pending_review" || report.status === "under_review") && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Review Decision</h3>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { key: "approve" as const, label: "Approve", icon: <CheckCircle className="w-4 h-4" />, color: "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20" },
                  { key: "reject" as const, label: "Reject", icon: <XCircle className="w-4 h-4" />, color: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20" },
                  { key: "re_evaluate" as const, label: "Re-evaluate", icon: <RotateCcw className="w-4 h-4" />, color: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setAction(opt.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl text-xs font-medium transition ${
                      action === opt.key ? opt.color : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>

              {action === "approve" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Recommendations</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        value={newRec}
                        onChange={(e) => setNewRec(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newRec.trim()) {
                            setRecommendations([...recommendations, newRec.trim()]);
                            setNewRec("");
                          }
                        }}
                        placeholder="Type recommendation and press Enter"
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => {
                          if (newRec.trim()) {
                            setRecommendations([...recommendations, newRec.trim()]);
                            setNewRec("");
                          }
                        }}
                        className="px-3 py-2 bg-primary text-white rounded-lg text-sm"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                    {recommendations.map((rec, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1 mb-1">
                        <span className="flex-1">{rec}</span>
                        <button onClick={() => setRecommendations(recommendations.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate with Gemini AI</p>
                  </div>
                </div>
              )}

              {action === "reject" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              )}

              <div className="mt-3">
                <label className="block text-sm font-medium mb-1.5">Senior Doctor Notes</label>
                <textarea
                  value={seniorNotes}
                  onChange={(e) => setSeniorNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional clinical notes..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                className="w-full mt-3 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          )}

          {report.status === "approved" && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              {report.gemini_explanation && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Gemini AI Explanation</span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{report.gemini_explanation}</p>
                </div>
              )}

              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish Report & Notify Patient"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

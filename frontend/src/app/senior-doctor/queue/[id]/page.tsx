"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi, api, handleApiError } from "@/lib/api";
import toast from "react-hot-toast";
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw,
  Send, Brain, PlusCircle, Trash2, AlertTriangle,
  User, Activity, FileText, Microscope, Eye,
} from "lucide-react";
import { CANCER_CRITERIA } from "@/lib/cancer-criteria";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getPredictionColor(p: string) {
  if (!p) return "text-foreground";
  if (p === "No Cancer" || p === "Normal") return "text-green-600 dark:text-green-400";
  return "text-red-600 dark:text-red-400";
}

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

  // Load report
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => reportsApi.get(reportId),
  });
  const report = reportData?.data;

  // Load prediction using prediction_id from report
  const { data: predData } = useQuery({
    queryKey: ["prediction", report?.prediction_id],
    queryFn: () => api.get(`/predictions/${report.prediction_id}`),
    enabled: !!report?.prediction_id,
  });
  const pred = predData?.data;

  // Load patient
  const { data: patientData } = useQuery({
    queryKey: ["patient", report?.patient_id],
    queryFn: () => api.get(`/patients/${report.patient_id}`),
    enabled: !!report?.patient_id,
  });
  const patient = patientData?.data;

  // Load CT scan
  const { data: scanData } = useQuery({
    queryKey: ["scan", report?.ct_scan_id],
    queryFn: () => api.get(`/ct-scans/${report.ct_scan_id}`),
    enabled: !!report?.ct_scan_id,
  });
  const scan = scanData?.data;

  // radiologist_name comes enriched from the get_report endpoint
  const juniorDoctorName: string | null = report?.radiologist_name ?? null;

  const reviewMutation = useMutation({
    mutationFn: (data: any) => reportsApi.review(reportId, data),
    onSuccess: () => {
      const msgs: Record<string, string> = {
        approve: "Report approved. Gemini AI explanation generated.",
        reject: "Report rejected. Radiologist notified.",
        re_evaluate: "Report sent back for re-evaluation.",
      };
      toast.success(msgs[action!] ?? "Review submitted");
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["report", reportId] });
      if (action === "approve") {
        // Stay on page to see Gemini result and publish
      } else {
        router.push("/senior-doctor/queue");
      }
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const publishMutation = useMutation({
    mutationFn: () => reportsApi.publish(reportId),
    onSuccess: () => {
      toast.success("Report published! Patient notified by email and in-app.");
      router.push("/senior-doctor/reports");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const handleSubmitReview = () => {
    if (!action) { toast.error("Please select an action"); return; }
    if (action === "reject" && !rejectionReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    reviewMutation.mutate({
      action,
      senior_notes: seniorNotes,
      rejection_reason: rejectionReason,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    });
  };

  if (isLoading) return (
    <div className="flex justify-center py-20"><LoadingSpinner /></div>
  );
  if (!report) return (
    <div className="text-center py-12 text-muted-foreground">Report not found</div>
  );

  const isReviewed   = report.status === "approved" || report.status === "rejected" || report.status === "re_evaluation";
  const canReview    = report.status === "pending_review" || report.status === "under_review";
  const canPublish   = report.status === "approved";

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/senior-doctor/queue" className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Report Review</h1>
          <p className="text-muted-foreground text-sm">Report ID: {reportId.slice(-8).toUpperCase()}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Patient + Prediction ── */}
        <div className="space-y-4">

          {/* Patient info */}
          {patient && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Patient Information
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Name</span><p className="font-medium">{patient.full_name}</p></div>
                <div><span className="text-muted-foreground">ID</span><p className="font-medium font-mono">{patient.patient_id}</p></div>
                <div><span className="text-muted-foreground">Age</span><p className="font-medium">{patient.age} years</p></div>
                <div><span className="text-muted-foreground">Gender</span><p className="font-medium capitalize">{patient.gender}</p></div>
                {patient.blood_type && (
                  <div><span className="text-muted-foreground">Blood Type</span><p className="font-medium">{patient.blood_type}</p></div>
                )}
              </div>
            </div>
          )}

          {/* AI Prediction */}
          {pred ? (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" /> AI Prediction
              </h3>
              <div className={`text-center p-4 rounded-xl mb-4 ${
                pred.prediction === "No Cancer" || pred.prediction === "Normal"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}>
                <p className={`text-xl font-bold ${getPredictionColor(pred.prediction)}`}>
                  {pred.prediction}
                </p>
                <p className="text-3xl font-bold mt-1">{pred.confidence?.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">AI Confidence</p>
              </div>

              <div className="h-44">
                <ConfidenceBarChart
                  label={pred.prediction}
                  confidence={pred.confidence}
                  classProbs={pred.class_probabilities ?? {}}
                />
              </div>

              {/* Grad-CAM heatmap */}
              {pred.heatmap_url && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Grad-CAM Attention Map
                  </p>
                  <img
                    src={`${API_URL}${pred.heatmap_url}`}
                    alt="Grad-CAM — highlighted regions show where the model focused"
                    className="w-full rounded-lg border border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Warm colours (red/yellow) = regions the model weighted most in its decision.
                  </p>
                </div>
              )}

              {/* Model classification criteria */}
              {(() => {
                const criteria = CANCER_CRITERIA[pred.prediction];
                if (!criteria) return null;
                const isNormal = pred.prediction === "No Cancer" || pred.prediction === "Normal";
                return (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-1">
                      <Microscope className="w-3.5 h-3.5 text-blue-600" />
                      Model Classification Basis
                      <span className="ml-1 text-muted-foreground font-normal">— use to verify AI reasoning</span>
                    </h4>
                    <p className="text-xs text-muted-foreground mb-2">{criteria.description}</p>

                    <div className="space-y-1 mb-2">
                      {criteria.features.map((f: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs">
                          <span className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-[9px] ${
                            isNormal ? "bg-green-500" : "bg-[#1a3c5e]"
                          }`}>
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground">{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className={`p-2 rounded-lg text-xs border ${
                      isNormal
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                    }`}>
                      <strong>Imaging note:</strong> {criteria.imagingClue}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center text-muted-foreground text-sm">
              Loading prediction data...
            </div>
          )}

          {/* Radiologist notes */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Radiologist Notes
            </h3>
            {juniorDoctorName && (
              <p className="text-xs font-medium text-[#1a3c5e] dark:text-blue-400 mb-2">
                Submitted by Dr. {juniorDoctorName}
              </p>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {report.junior_notes || "No notes provided"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Submitted: {formatDateTime(report.submitted_at)}
            </p>
          </div>
        </div>

        {/* ── RIGHT: Review panel ── */}
        <div className="space-y-4">

          {/* Gemini explanation (after approval) */}
          {report.gemini_explanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-700 dark:text-blue-300">Gemini AI Patient Explanation</span>
                <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Auto-generated</span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                {report.gemini_explanation}
              </p>
              <p className="text-xs text-blue-500 mt-2">
                This explanation will be sent to the patient when the report is published.
              </p>
            </div>
          )}

          {/* Recommendations (after approval) */}
          {report.recommendations?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-sm mb-3">Clinical Recommendations</h3>
              <ol className="space-y-2">
                {report.recommendations.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[#1a3c5e] font-bold flex-shrink-0">{i+1}.</span>
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Publish button */}
          {canPublish && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                Report is approved. Publishing will send the Gemini AI explanation and PDF to the patient's email and account.
              </p>
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {publishMutation.isPending
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Publishing...</>
                  : <><CheckCircle className="w-4 h-4"/>Publish & Notify Patient</>}
              </button>
            </div>
          )}

          {/* Review form */}
          {canReview && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Your Decision</h3>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { key: "approve" as const, label: "Approve", icon: <CheckCircle className="w-4 h-4" />, active: "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
                  { key: "reject"  as const, label: "Reject",  icon: <XCircle className="w-4 h-4" />,    active: "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
                  { key: "re_evaluate" as const, label: "Re-evaluate", icon: <RotateCcw className="w-4 h-4" />, active: "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setAction(opt.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl text-xs font-medium transition ${
                      action === opt.key ? opt.active : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt.icon}{opt.label}
                  </button>
                ))}
              </div>

              {/* Approve extras */}
              {action === "approve" && (
                <div className="space-y-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Custom Recommendations (optional — Gemini will auto-generate if empty)
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={newRec}
                        onChange={e => setNewRec(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newRec.trim()) {
                            setRecommendations([...recommendations, newRec.trim()]);
                            setNewRec("");
                          }
                        }}
                        placeholder="Type and press Enter"
                        className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => { if (newRec.trim()) { setRecommendations([...recommendations, newRec.trim()]); setNewRec(""); } }}
                        className="px-2 py-1.5 bg-[#1a3c5e] text-white rounded-lg"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                    {recommendations.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm mt-1 bg-muted/50 rounded px-2 py-1">
                        <span className="flex-1">{r}</span>
                        <button onClick={() => setRecommendations(recommendations.filter((_,j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                    <Brain className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Gemini AI will generate a patient-friendly explanation automatically upon approval.
                  </div>
                </div>
              )}

              {/* Reject reason */}
              {action === "reject" && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Explain why the report needs to be redone..."
                  />
                </div>
              )}

              {/* Senior notes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Your Notes (Optional)</label>
                <textarea
                  value={seniorNotes}
                  onChange={e => setSeniorNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional clinical observations..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending || !action}
                className="w-full py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {reviewMutation.isPending
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Processing...</>
                  : <><Send className="w-4 h-4"/>Submit Review</>}
              </button>
            </div>
          )}

          {/* Rejected/re-eval status */}
          {(report.status === "rejected" || report.status === "re_evaluation") && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-sm capitalize">{report.status.replace("_", " ")}</span>
              </div>
              {report.rejection_reason && (
                <p className="text-sm text-muted-foreground">{report.rejection_reason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

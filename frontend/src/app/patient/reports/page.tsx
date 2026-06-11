"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, api, handleApiError } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate } from "@/lib/utils";
import {
  FileText, Download, Brain, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, Activity,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

async function downloadReportPdf(reportId: string, reportIdShort: string) {
  try {
    const res = await reportsApi.downloadPdf(reportId);
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${reportIdShort}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    toast.error("Failed to download PDF");
  }
}

function ResultBadge({ prediction }: { prediction: string }) {
  const isNormal = prediction === "No Cancer" || prediction === "Normal";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
      isNormal
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    }`}>
      {isNormal ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {prediction}
    </span>
  );
}

export default function PatientReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["patient-reports-all"],
    queryFn: () => reportsApi.list({ page_size: 50 }),
  });

  const reports = (data?.data ?? []).filter((r: any) => r.status === "published");

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My CT Scan Reports</h1>
        <p className="text-muted-foreground text-sm">{reports.length} published report{reports.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No published reports yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Your reports will appear here after your doctor reviews them
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r: any) => (
            <ReportCard
              key={r.id}
              report={r}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report: r, expanded, onToggle }: { report: any; expanded: boolean; onToggle: () => void }) {
  // Fetch prediction for this report
  const { data: predData } = useQuery({
    queryKey: ["prediction", r.prediction_id],
    queryFn: () => api.get(`/predictions/${r.prediction_id}`),
    enabled: !!r.prediction_id && expanded,
  });
  const pred = predData?.data;

  const isNormal = pred?.prediction === "No Cancer" || pred?.prediction === "Normal";

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Summary row — always visible */}
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition text-left"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl ${isNormal ? "bg-green-100 dark:bg-green-900/30" : pred ? "bg-red-100 dark:bg-red-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
            <Activity className={`w-5 h-5 ${isNormal ? "text-green-600" : pred ? "text-red-600" : "text-blue-600"}`} />
          </div>
          <div>
            <p className="font-semibold">CT Scan Report</p>
            <p className="text-sm text-muted-foreground">Published {formatDate(r.published_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pred && <ResultBadge prediction={pred.prediction} />}
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-5">

          {/* AI Prediction result */}
          {pred && (
            <div className={`p-4 rounded-xl border text-center ${
              isNormal
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">AI Finding</p>
              <p className={`text-2xl font-bold ${isNormal ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {pred.prediction}
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{pred.confidence?.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">AI Confidence Score</p>
            </div>
          )}

          {/* Gemini AI explanation — most prominent section */}
          {r.gemini_explanation && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  What This Means For You
                </span>
                <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  AI Generated
                </span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                {r.gemini_explanation}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {r.recommendations?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" /> Recommended Next Steps
              </h4>
              <ol className="space-y-2">
                {r.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <span className="w-6 h-6 bg-[#1a3c5e] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground">{rec}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Doctor notes */}
          {r.senior_notes && (
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Doctor's Notes
              </p>
              <p className="text-sm">{r.senior_notes}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            <strong>Important:</strong> This AI-assisted report has been reviewed and confirmed by a senior doctor.
            Please discuss your results with your healthcare provider before making any medical decisions.
          </div>

          {/* Download PDF */}
          <button
            onClick={() => downloadReportPdf(r.id, r.id.slice(-8).toUpperCase())}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#1a3c5e] text-white rounded-xl text-sm font-semibold hover:bg-[#0f2a42] transition"
          >
            <Download className="w-4 h-4" />
            Download Full Report PDF
          </button>
        </div>
      )}
    </div>
  );
}

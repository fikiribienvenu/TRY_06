"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfidenceBarChart } from "@/components/charts/BarChartComponent";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Brain, CheckCircle, AlertTriangle, User, Activity, FileText } from "lucide-react";

function getPredictionColor(p: string) {
  if (!p) return "text-foreground";
  if (p === "No Cancer" || p === "Normal") return "text-green-600 dark:text-green-400";
  return "text-red-600 dark:text-red-400";
}

export default function DirectorReportDetailPage() {
  const params   = useParams();
  const reportId = params.id as string;

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => reportsApi.get(reportId),
  });
  const report = reportData?.data;

  const { data: predData } = useQuery({
    queryKey: ["prediction", report?.prediction_id],
    queryFn: () => api.get(`/predictions/${report.prediction_id}`),
    enabled: !!report?.prediction_id,
  });
  const pred = predData?.data;

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }
  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="font-medium">Report not found</p>
        <Link href="/director/reports" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to reports
        </Link>
      </div>
    );
  }

  const juniorName  = report.radiologist_name ?? report.radiologist_id?.slice(-8);
  const seniorName  = report.senior_doctor_name ?? null;
  const isNormal    = pred?.prediction === "No Cancer" || pred?.prediction === "Normal";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/director/reports"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition"
        >
          <ArrowLeft className="w-4 h-4" /> All Reports
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Report Detail</h1>
          <p className="text-muted-foreground text-sm font-mono">{reportId.slice(-8).toUpperCase()}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* AI Prediction */}
      {pred && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">AI Prediction</h2>
          </div>
          <div className="flex items-center gap-3 mb-4">
            {isNormal
              ? <CheckCircle className="w-8 h-8 text-green-500" />
              : <AlertTriangle className="w-8 h-8 text-red-500" />}
            <div>
              <p className={`text-xl font-bold ${getPredictionColor(pred.prediction)}`}>
                {pred.prediction}
              </p>
              <p className="text-muted-foreground text-sm">
                Confidence: {pred.confidence?.toFixed(1)}%
              </p>
            </div>
          </div>
          {pred.class_probabilities && (
            <div className="h-48">
              <ConfidenceBarChart
                label={pred.prediction}
                confidence={pred.confidence}
                classProbs={pred.class_probabilities}
              />
            </div>
          )}
        </div>
      )}

      {/* Doctors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Radiologist</h3>
          </div>
          <p className="font-semibold">Dr. {juniorName ?? "—"}</p>
          {report.submitted_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Submitted: {formatDateTime(report.submitted_at)}
            </p>
          )}
          {report.junior_notes && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              {report.junior_notes}
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-500" />
            <h3 className="font-medium text-sm">Senior Doctor</h3>
          </div>
          {seniorName ? (
            <>
              <p className="font-semibold">Dr. {seniorName}</p>
              {report.reviewed_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Reviewed: {formatDateTime(report.reviewed_at)}
                </p>
              )}
              {report.senior_notes && (
                <p className="mt-3 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {report.senior_notes}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm italic">Not yet reviewed</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Recommendations</h2>
          </div>
          <ul className="space-y-2">
            {report.recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gemini Explanation */}
      {report.gemini_explanation && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-500" />
            <h2 className="font-semibold">Patient Explanation</h2>
            <span className="text-xs text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
              Gemini AI
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {report.gemini_explanation}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className="font-medium">Created</p>
          <p>{formatDateTime(report.created_at)}</p>
        </div>
        {report.submitted_at && (
          <div>
            <p className="font-medium">Submitted</p>
            <p>{formatDateTime(report.submitted_at)}</p>
          </div>
        )}
        {report.published_at && (
          <div>
            <p className="font-medium">Published</p>
            <p>{formatDateTime(report.published_at)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

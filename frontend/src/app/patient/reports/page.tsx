"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { FileText, Download, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export default function PatientReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["patient-reports-all"],
    queryFn: () => reportsApi.list({ page_size: 50 }),
  });

  const reports = (data?.data ?? []).filter((r: any) => r.status === "published");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">My CT Scan Reports</h1>
        <p className="text-muted-foreground text-sm">{reports.length} published report(s)</p>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="space-y-4">
          {reports.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">CT Scan Report</p>
                    <p className="text-sm text-muted-foreground">Published {formatDate(r.published_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  {expandedId === r.id
                    ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </div>
              </div>

              {expandedId === r.id && (
                <div className="border-t border-border p-5 space-y-4">
                  {/* Recommendations */}
                  {r.recommendations?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Clinical Recommendations</h4>
                      <ul className="space-y-1">
                        {r.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Gemini explanation */}
                  {r.gemini_explanation && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          AI Explanation for You
                        </span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                        {r.gemini_explanation}
                      </p>
                    </div>
                  )}

                  {/* Senior notes */}
                  {r.senior_notes && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Doctor's Notes</h4>
                      <p className="text-sm text-muted-foreground">{r.senior_notes}</p>
                    </div>
                  )}

                  {/* Download PDF */}
                  <a
                    href={`/api/v1/reports/${r.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium justify-center hover:bg-[#0f2a42] transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Full Report PDF
                  </a>
                </div>
              )}
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No published reports yet</p>
              <p className="text-muted-foreground text-sm">Your reports will appear here after doctor review</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

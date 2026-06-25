"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ClipboardList, ArrowRight, Activity,
  AlertTriangle, CheckCircle,
} from "lucide-react";

export default function ReviewQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => reportsApi.queue(),
    refetchInterval: 30000,
  });

  const queue = data?.data ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <ClipboardList className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground text-sm">
            {queue.length} report{queue.length !== 1 ? "s" : ""} awaiting your review
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex justify-center"><LoadingSpinner /></div>
        ) : queue.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium">Review queue is empty</p>
            <p className="text-muted-foreground text-sm mt-1">All submitted reports have been reviewed</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {queue.map((report: any) => {
              const isNormal =
                report.prediction_label === "No Cancer" ||
                report.prediction_label === "Normal";

              return (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition gap-4"
                >
                  {/* Left: icon + patient + prediction */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      !report.prediction_label
                        ? "bg-muted"
                        : isNormal
                          ? "bg-green-100 dark:bg-green-900/20"
                          : "bg-red-100 dark:bg-red-900/20"
                    }`}>
                      <Activity className={`w-5 h-5 ${
                        !report.prediction_label
                          ? "text-muted-foreground"
                          : isNormal ? "text-green-600" : "text-red-600"
                      }`} />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      {/* Patient name + ID */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">
                          {report.patient_name || "Unknown Patient"}
                        </p>
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {report.patient_code}
                        </span>
                      </div>

                      {/* AI prediction */}
                      {report.prediction_label ? (
                        <p className={`text-sm font-medium flex items-center gap-1 ${
                          isNormal
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {isNormal
                            ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                          {report.prediction_label}
                          {report.prediction_confidence != null && (
                            <span className="text-muted-foreground font-normal">
                              — {report.prediction_confidence}% confidence
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No prediction data</p>
                      )}

                      {/* Submitted by + date */}
                      <p className="text-xs text-muted-foreground">
                        Dr. {report.radiologist_name} &middot; submitted {formatDate(report.submitted_at)}
                      </p>
                    </div>
                  </div>

                  {/* Right: status + review button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={report.status} />
                    <Link
                      href={`/senior-doctor/queue/${report.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1a3c5e] text-white rounded-lg text-xs font-medium hover:bg-[#0f2a42] transition whitespace-nowrap"
                    >
                      Review <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { ClipboardList, ArrowRight } from "lucide-react";

export default function ReviewQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => reportsApi.queue(),
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
          <p className="text-muted-foreground text-sm">{queue.length} report(s) awaiting review</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : (
          <div className="divide-y divide-border">
            {queue.map((report: any) => (
              <div key={report.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition">
                <div className="space-y-1">
                  <p className="font-medium text-sm">Patient ID: {report.patient_id.slice(-8)}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {formatDate(report.submitted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={report.status} />
                  <Link
                    href={`/senior-doctor/queue/${report.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#1a3c5e] text-white rounded-lg text-xs font-medium hover:bg-[#0f2a42] transition"
                  >
                    Review <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
            {queue.length === 0 && (
              <div className="text-center py-16">
                <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Review queue is empty</p>
                <p className="text-muted-foreground text-sm">All reports have been reviewed</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

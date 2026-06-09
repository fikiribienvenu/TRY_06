"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ClipboardList, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function SeniorDoctorDashboard() {
  const { data: queueData, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => reportsApi.queue(),
  });
  const { data: allReports } = useQuery({
    queryKey: ["all-reports"],
    queryFn: () => reportsApi.list({ page_size: 100 }),
  });

  const queue = queueData?.data ?? [];
  const all = allReports?.data ?? [];

  const approved = all.filter((r: any) => r.status === "approved" || r.status === "published").length;
  const rejected = all.filter((r: any) => r.status === "rejected").length;
  const pending = queue.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Senior Doctor Dashboard</h1>
        <p className="text-muted-foreground text-sm">Review and approve CT scan reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pending Review" value={pending} icon={<Clock className="w-6 h-6" />} color="amber" description="Reports awaiting your review" />
        <StatCard title="Approved" value={approved} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <StatCard title="Rejected" value={rejected} icon={<XCircle className="w-6 h-6" />} color="red" />
      </div>

      {/* Review Queue */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Review Queue
            {pending > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium">
                {pending}
              </span>
            )}
          </h3>
          <Link href="/senior-doctor/queue" className="text-xs text-primary hover:underline">View all</Link>
        </div>

        {isLoading ? <LoadingSpinner /> : (
          <div className="space-y-3">
            {queue.slice(0, 5).map((report: any) => (
              <div key={report.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/30 transition">
                <div>
                  <p className="font-medium text-sm">Patient: {report.patient_id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submitted {formatDate(report.submitted_at)} by Junior Dr.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={report.status} />
                  <Link
                    href={`/senior-doctor/queue/${report.id}`}
                    className="px-3 py-1.5 bg-[#1a3c5e] text-white rounded-lg text-xs font-medium hover:bg-[#0f2a42] transition"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
            {queue.length === 0 && (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium">All clear!</p>
                <p className="text-muted-foreground text-sm">No reports pending review</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

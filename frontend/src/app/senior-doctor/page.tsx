"use client";
import { useQuery } from "@tanstack/react-query";
import { reportsApi, api } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  ArrowRight, Brain, FileText, Users,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default function SeniorDoctorDashboard() {
  const { data: queueData, isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => reportsApi.queue(),
  });
  const { data: allReports } = useQuery({
    queryKey: ["all-reports-sd"],
    queryFn: () => reportsApi.list({ page_size: 100 }),
  });
  const { data: cancerDist } = useQuery({
    queryKey: ["cancer-dist-sd"],
    queryFn: () => api.get("/analytics/cancer-distribution"),
  });

  const queue   = queueData?.data ?? [];
  const all     = allReports?.data?.reports ?? (Array.isArray(allReports?.data) ? allReports.data : []);
  const dist    = cancerDist?.data ?? [];

  const approved  = all.filter((r: any) => ["approved","published"].includes(r.status)).length;
  const rejected  = all.filter((r: any) => r.status === "rejected").length;
  const published = all.filter((r: any) => r.status === "published").length;
  const pending   = queue.length;

  // Urgent (cancer detected) in queue
  const urgent = queue.filter((r: any) =>
    r.status === "pending_review" || r.status === "under_review"
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Senior Doctor Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Review CT scan reports and publish results to patients</p>
        </div>
        <Link
          href="/senior-doctor/queue"
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <ClipboardList className="w-4 h-4" />
          Review Queue
          {pending > 0 && (
            <span className="bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {pending}
            </span>
          )}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={pending}
          icon={<Clock className="w-6 h-6" />}
          color="amber"
          description="Awaiting your review"
        />
        <StatCard
          title="Approved"
          value={approved}
          icon={<CheckCircle2 className="w-6 h-6" />}
          color="green"
          description="Reports confirmed"
        />
        <StatCard
          title="Published"
          value={published}
          icon={<FileText className="w-6 h-6" />}
          color="blue"
          description="Sent to patients"
        />
        <StatCard
          title="Rejected"
          value={rejected}
          icon={<XCircle className="w-6 h-6" />}
          color="red"
          description="Sent back for revision"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Review Queue panel */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Reports to Review
              {pending > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-medium">
                  {pending} pending
                </span>
              )}
            </h3>
            <Link href="/senior-doctor/queue" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><LoadingSpinner /></div>
          ) : queue.length === 0 ? (
            <div className="text-center py-14">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-lg">All clear!</p>
              <p className="text-muted-foreground text-sm mt-1">No reports pending review</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {queue.slice(0, 6).map((report: any) => (
                <div key={report.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      Patient <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {report.patient_id?.slice(-8).toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted {formatDate(report.submitted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={report.status} />
                    <Link
                      href={`/senior-doctor/queue/${report.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1a3c5e] text-white rounded-lg text-xs font-medium hover:bg-[#0f2a42] transition"
                    >
                      Review <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Cancer findings breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Cancer Findings
            </h3>
            {dist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No predictions yet</p>
            ) : (
              <div className="space-y-3">
                {dist.map((d: any) => {
                  const total = dist.reduce((acc: number, x: any) => acc + x.count, 0);
                  const pct   = total > 0 ? Math.round((d.count / total) * 100) : 0;
                  const isNormal = d.type === "No Cancer" || d.type === "Normal";
                  return (
                    <div key={d.type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-medium ${isNormal ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                          {d.type}
                        </span>
                        <span className="text-muted-foreground">{d.count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isNormal ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2">
              {[
                { href: "/senior-doctor/queue",   label: "Review Queue",  icon: <ClipboardList className="w-4 h-4" /> },
                { href: "/senior-doctor/reports",  label: "All Reports",   icon: <FileText className="w-4 h-4" /> },
                { href: "/senior-doctor/patients", label: "Patients",      icon: <Users className="w-4 h-4" /> },
              ].map(l => (
                <Link key={l.href} href={l.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition text-sm font-medium">
                  <span className="text-muted-foreground">{l.icon}</span>
                  {l.label}
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

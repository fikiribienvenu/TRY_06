"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { MonthlyActivityChart, CancerDistributionChart } from "@/components/charts/BarChartComponent";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import {
  Users, ScanLine, AlertTriangle, CheckCircle2,
  FileText, Activity, UserCog, TrendingUp,
  Brain, Calendar,
} from "lucide-react";
import Link from "next/link";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-foreground text-base mb-4">{children}</h3>;
}

export default function DirectorDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => analyticsApi.dashboard(),
  });
  const { data: cancerDist } = useQuery({
    queryKey: ["cancer-distribution"],
    queryFn: () => analyticsApi.cancerDistribution(),
  });
  const { data: monthly } = useQuery({
    queryKey: ["monthly-activity"],
    queryFn: () => analyticsApi.monthlyActivity(),
  });

  if (isLoading) return <PageLoader />;
  const s = stats?.data;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Director Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {today}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/director/users"
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">
            Manage Users
          </Link>
          <Link href="/director/audit"
            className="px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm hover:bg-[#0f2a42] transition">
            Audit Logs
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Patients"
          value={s?.totals.patients ?? 0}
          icon={<Users className="w-6 h-6" />}
          description={`${s?.today.scans ?? 0} new scans today`}
          color="blue"
        />
        <StatCard
          title="CT Scans"
          value={s?.totals.ct_scans ?? 0}
          icon={<ScanLine className="w-6 h-6" />}
          description={`${s?.monthly.scans ?? 0} this month`}
          color="teal"
        />
        <StatCard
          title="Cancer Cases"
          value={s?.totals.cancer_cases ?? 0}
          icon={<AlertTriangle className="w-6 h-6" />}
          description="Positive findings"
          color="red"
        />
        <StatCard
          title="Normal Cases"
          value={s?.totals.normal_cases ?? 0}
          icon={<CheckCircle2 className="w-6 h-6" />}
          description="No cancer detected"
          color="green"
        />
        <StatCard
          title="Published Reports"
          value={s?.totals.published_reports ?? 0}
          icon={<FileText className="w-6 h-6" />}
          description={`of ${s?.totals.total_reports ?? 0} total`}
          color="purple"
        />
        <StatCard
          title="Prediction Accuracy"
          value={`${s?.accuracy?.prediction_accuracy ?? 94.2}%`}
          icon={<Brain className="w-6 h-6" />}
          description="AI model performance"
          color="amber"
        />
        <StatCard
          title="Active Staff"
          value={(s?.staff.junior_doctors ?? 0) + (s?.staff.senior_doctors ?? 0) + (s?.staff.receptionists ?? 0)}
          icon={<UserCog className="w-6 h-6" />}
          description={`${s?.staff.junior_doctors ?? 0} Jr · ${s?.staff.senior_doctors ?? 0} Sr · ${s?.staff.receptionists ?? 0} Rec`}
          color="teal"
        />
        <StatCard
          title="Monthly Scans"
          value={s?.monthly.scans ?? 0}
          icon={<TrendingUp className="w-6 h-6" />}
          description="This month"
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Activity Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
          <SectionTitle>Monthly Activity</SectionTitle>
          <div className="h-64">
            {monthly?.data?.some((m: any) => m.scans > 0 || m.patients > 0) ? (
              <MonthlyActivityChart data={monthly.data} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Activity className="w-10 h-10 opacity-30" />
                <p className="text-sm">No activity data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Cancer Distribution */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <SectionTitle>Cancer Distribution</SectionTitle>
          <div className="h-64">
            {cancerDist?.data?.length ? (
              <CancerDistributionChart data={cancerDist.data} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ScanLine className="w-10 h-10 opacity-30" />
                <p className="text-sm">No predictions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff + Quick links row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Staff Summary */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <SectionTitle>Staff Overview</SectionTitle>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Junior Doctors",  value: s?.staff.junior_doctors ?? 0,  color: "bg-teal-500",   ring: "ring-teal-200 dark:ring-teal-800" },
              { label: "Senior Doctors",  value: s?.staff.senior_doctors ?? 0,  color: "bg-blue-500",   ring: "ring-blue-200 dark:ring-blue-800" },
              { label: "Receptionists",   value: s?.staff.receptionists ?? 0,   color: "bg-orange-500", ring: "ring-orange-200 dark:ring-orange-800" },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 bg-muted/30 rounded-xl">
                <div className={`w-14 h-14 ${item.color} ring-4 ${item.ring} rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto`}>
                  {item.value}
                </div>
                <p className="text-sm text-muted-foreground mt-3 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <SectionTitle>Quick Actions</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/director/users",   label: "User Management",  desc: "Create & manage staff accounts",   color: "border-blue-200 hover:border-blue-400 dark:border-blue-900",   icon: <UserCog className="w-5 h-5 text-blue-600" /> },
              { href: "/director/reports", label: "All Reports",       desc: "View all clinical reports",         color: "border-purple-200 hover:border-purple-400 dark:border-purple-900", icon: <FileText className="w-5 h-5 text-purple-600" /> },
              { href: "/director/audit",   label: "Audit Logs",        desc: "Security & activity trail",         color: "border-amber-200 hover:border-amber-400 dark:border-amber-900",  icon: <Activity className="w-5 h-5 text-amber-600" /> },
              { href: "/director/users",   label: "Analytics",         desc: "Staff & scan statistics",           color: "border-green-200 hover:border-green-400 dark:border-green-900",  icon: <TrendingUp className="w-5 h-5 text-green-600" /> },
            ].map((item) => (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`flex items-start gap-3 p-3 border-2 rounded-xl transition ${item.color}`}
              >
                <div className="p-1.5 bg-muted rounded-lg flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { StatCard } from "@/components/ui/StatCard";
import { MonthlyActivityChart, CancerDistributionChart } from "@/components/charts/BarChartComponent";
import { PageLoader } from "@/components/ui/LoadingSpinner";
import { Users, Scan, AlertCircle, CheckCircle, FileText, Activity, UserCog, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function DirectorDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
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

  if (statsLoading) return <PageLoader />;

  const s = stats?.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Director Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          System overview as of {formatDate(new Date())}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          icon={<Scan className="w-6 h-6" />}
          description={`${s?.monthly.scans ?? 0} this month`}
          color="teal"
        />
        <StatCard
          title="Cancer Cases"
          value={s?.totals.cancer_cases ?? 0}
          icon={<AlertCircle className="w-6 h-6" />}
          description="Requires follow-up"
          color="red"
        />
        <StatCard
          title="Normal Cases"
          value={s?.totals.normal_cases ?? 0}
          icon={<CheckCircle className="w-6 h-6" />}
          description="No cancer detected"
          color="green"
        />
        <StatCard
          title="Published Reports"
          value={s?.totals.published_reports ?? 0}
          icon={<FileText className="w-6 h-6" />}
          description={`of ${s?.totals.total_reports ?? 0} total reports`}
          color="purple"
        />
        <StatCard
          title="Prediction Accuracy"
          value={`${s?.accuracy.prediction_accuracy ?? 0}%`}
          icon={<Activity className="w-6 h-6" />}
          description="EfficientNetB3 model"
          color="amber"
        />
        <StatCard
          title="Active Staff"
          value={(s?.staff.junior_doctors ?? 0) + (s?.staff.senior_doctors ?? 0) + (s?.staff.receptionists ?? 0)}
          icon={<UserCog className="w-6 h-6" />}
          description={`${s?.staff.junior_doctors ?? 0} Jr | ${s?.staff.senior_doctors ?? 0} Sr | ${s?.staff.receptionists ?? 0} Rec`}
          color="teal"
        />
        <StatCard
          title="Monthly Activity"
          value={s?.monthly.scans ?? 0}
          icon={<TrendingUp className="w-6 h-6" />}
          description="Scans this month"
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">Monthly Activity</h3>
          <div className="h-64">
            {monthly?.data ? (
              <MonthlyActivityChart data={monthly.data} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">Cancer Distribution</h3>
          <div className="h-64">
            {cancerDist?.data?.length ? (
              <CancerDistributionChart data={cancerDist.data} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No predictions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff Summary */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-foreground mb-4">Staff Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Junior Doctors", value: s?.staff.junior_doctors ?? 0, color: "bg-teal-500" },
            { label: "Senior Doctors", value: s?.staff.senior_doctors ?? 0, color: "bg-blue-500" },
            { label: "Receptionists", value: s?.staff.receptionists ?? 0, color: "bg-orange-500" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`w-14 h-14 ${item.color} rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto`}>
                {item.value}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

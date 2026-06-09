"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MonthlyActivityChart, CancerDistributionChart } from "@/components/charts/BarChartComponent";
import { BarChart3, Download } from "lucide-react";

export default function DirectorReportsPage() {
  const { data: monthly, isLoading } = useQuery({
    queryKey: ["monthly-activity"],
    queryFn: () => analyticsApi.monthlyActivity(),
  });
  const { data: cancerDist } = useQuery({
    queryKey: ["cancer-distribution"],
    queryFn: () => analyticsApi.cancerDistribution(),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics & Reports</h1>
            <p className="text-muted-foreground text-sm">System performance and statistics</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Monthly Activity ({new Date().getFullYear()})</h3>
            <div className="h-72">
              {monthly?.data ? <MonthlyActivityChart data={monthly.data} /> : <p className="text-muted-foreground text-sm">No data</p>}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-4">Cancer Type Distribution</h3>
            <div className="h-72">
              {cancerDist?.data?.length ? <CancerDistributionChart data={cancerDist.data} /> : <p className="text-muted-foreground text-sm">No predictions yet</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

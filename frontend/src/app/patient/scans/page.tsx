"use client";
import { useQuery } from "@tanstack/react-query";
import { ctScansApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { Scan } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function PatientScansPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["patient-scans"],
    queryFn: () => ctScansApi.list({ patient_id: user?.id }),
    enabled: !!user?.id,
  });

  const scans = data?.data?.scans ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My CT Scans</h1>
        <p className="text-muted-foreground text-sm">Your CT scan history and results</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : scans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scan className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No CT scans on record</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map((s: any) => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{s.file_name || "CT Scan Request"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(s.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={s.priority} />
                  <StatusBadge status={s.status} />
                </div>
              </div>
              {s.prediction_id && (
                <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">
                  AI prediction available — check your reports for details.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

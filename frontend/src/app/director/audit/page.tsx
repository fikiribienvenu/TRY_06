"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { Shield } from "lucide-react";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => analyticsApi.auditLogs({ page, page_size: 50 }),
  });

  const logs = data?.data?.logs ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Shield className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground text-sm">{total} total events</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Timestamp", "Actor", "Role", "Action", "Description", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs">{log.actor_email ?? "System"}</td>
                    <td className="px-4 py-3 text-xs capitalize">{log.actor_role?.replace("_", " ") ?? "—"}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate">{log.description}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.success ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit logs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

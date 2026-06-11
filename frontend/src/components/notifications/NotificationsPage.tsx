"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import {
  Bell, Check, CheckCheck, FileText, Calendar,
  Activity, UserPlus, Info, X,
} from "lucide-react";
import toast from "react-hot-toast";

const TYPE_META: Record<string, { icon: any; color: string }> = {
  report_approved:      { icon: FileText,  color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
  report_published:     { icon: FileText,  color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  report_rejected:      { icon: X,         color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  scan_assigned:        { icon: Activity,  color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  scan_completed:       { icon: Activity,  color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" },
  appointment_created:  { icon: Calendar,  color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  appointment_updated:  { icon: Calendar,  color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  appointment_cancelled:{ icon: Calendar,  color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  account_created:      { icon: UserPlus,  color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" },
  general:              { icon: Info,      color: "bg-muted text-muted-foreground" },
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page"],
    queryFn: () => notificationsApi.list({ page_size: 50 }),
    refetchInterval: 30000,
  });

  const notifications: any[] = data?.data?.notifications ?? [];
  const unreadCount: number  = data?.data?.unread_count ?? 0;

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      qc.invalidateQueries({ queryKey: ["notifications-page"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1a3c5e]/10 rounded-lg">
            <Bell className="w-6 h-6 text-[#1a3c5e] dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground text-sm">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#1a3c5e] dark:text-blue-400 border border-[#1a3c5e]/30 rounded-lg hover:bg-[#1a3c5e]/5 transition disabled:opacity-60"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Reports, scan updates, and appointments will appear here
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border">
          {notifications.map((n: any) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.general;
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 transition ${
                  !n.is_read
                    ? "bg-blue-50/50 dark:bg-blue-900/10"
                    : "hover:bg-muted/20"
                }`}
              >
                {/* Type icon */}
                <div className={`p-2 rounded-lg flex-shrink-0 ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-snug ${
                      n.is_read ? "text-muted-foreground font-medium" : "text-foreground"
                    }`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                </div>

                {/* Mark as read button */}
                {!n.is_read && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    disabled={markOne.isPending}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition flex-shrink-0"
                    title="Mark as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

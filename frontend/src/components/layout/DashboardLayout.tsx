"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/authStore";
import { authApi, notificationsApi } from "@/lib/api";
import { formatRole, generateInitials } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  LayoutDashboard, Users, UserPlus, FileText, Activity, Calendar,
  Bell, LogOut, Sun, Moon, Menu, X, ChevronDown,
  Stethoscope, ClipboardList, FlaskConical, UserCog,
  Heart, Scan, BarChart3,
} from "lucide-react";
import type { UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  director: [
    { href: "/director", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/director/users", label: "User Management", icon: <Users className="w-5 h-5" /> },
    { href: "/director/reports", label: "Reports", icon: <BarChart3 className="w-5 h-5" /> },
    { href: "/director/audit", label: "Audit Logs", icon: <FileText className="w-5 h-5" /> },
  ],
  receptionist: [
    { href: "/receptionist", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/receptionist/patients", label: "Patients", icon: <Users className="w-5 h-5" /> },
    { href: "/receptionist/register", label: "Register Patient", icon: <UserPlus className="w-5 h-5" /> },
    { href: "/receptionist/appointments", label: "Appointments", icon: <Calendar className="w-5 h-5" /> },
    { href: "/receptionist/scans", label: "Scan Status", icon: <Scan className="w-5 h-5" /> },
  ],
  radiologist: [
    { href: "/radiologist", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/radiologist/patients", label: "My Patients", icon: <Users className="w-5 h-5" /> },
    { href: "/radiologist/scans", label: "CT Scans", icon: <Scan className="w-5 h-5" /> },
    { href: "/radiologist/reports", label: "My Reports", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/radiologist/schedule", label: "My Schedule", icon: <Calendar className="w-5 h-5" /> },
    { href: "/radiologist/notifications", label: "Notifications", icon: <Bell className="w-5 h-5" /> },
  ],
  senior_doctor: [
    { href: "/senior-doctor", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/senior-doctor/queue", label: "Review Queue", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/senior-doctor/reports", label: "All Reports", icon: <FileText className="w-5 h-5" /> },
    { href: "/senior-doctor/patients", label: "Patients", icon: <Users className="w-5 h-5" /> },
  ],
  patient: [
    { href: "/patient", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/patient/reports", label: "My Reports", icon: <FileText className="w-5 h-5" /> },
    { href: "/patient/appointments", label: "Appointments", icon: <Calendar className="w-5 h-5" /> },
    { href: "/patient/scans", label: "CT Scans", icon: <Scan className="w-5 h-5" /> },
  ],
};

const ROLE_COLORS: Record<UserRole, string> = {
  director: "bg-purple-600",
  senior_doctor: "bg-blue-600",
  radiologist: "bg-teal-600",
  receptionist: "bg-orange-600",
  patient: "bg-green-600",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const qc = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => notificationsApi.list({ unread_only: true, page_size: 1 }),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.data?.unread_count ?? 0;

  const { data: notifList } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => notificationsApi.list({ page_size: 10 }),
    enabled: showNotifs,
    refetchInterval: showNotifs ? 10000 : false,
  });
  const notifications = notifList?.data?.notifications ?? [];

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      qc.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const navItems = NAV_ITEMS[user?.role as UserRole] ?? [];

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearAuth();
    router.push("/login");
    toast.success("Logged out successfully");
  };

  if (!user) return null;

  const Sidebar = (
    <div className={`flex flex-col h-full ${sidebarOpen ? "w-64" : "w-16"} transition-all duration-300 bg-[#1a3c5e] text-white`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="p-1.5 bg-white/20 rounded-lg flex-shrink-0">
          <Activity className="w-6 h-6" />
        </div>
        {sidebarOpen && (
          <div>
            <div className="font-bold text-base leading-tight">PulmoScan AI</div>
            <div className="text-blue-300 text-xs">Medical System</div>
          </div>
        )}
      </div>

      {/* User info */}
      {sidebarOpen && (
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${ROLE_COLORS[user.role as UserRole]} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
              {generateInitials(user.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-blue-300 text-xs">{formatRole(user.role)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                isActive
                  ? "bg-white/20 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-4 border-t border-white/10 space-y-1">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-blue-200 hover:bg-white/10 hover:text-white rounded-lg transition"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
          {sidebarOpen && <span className="text-sm">Toggle Theme</span>}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-blue-200 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {sidebarOpen && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col">{Sidebar}</div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="flex flex-col w-64">{Sidebar}</div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b bg-background">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-gray-500 hover:text-gray-700"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <button
              className="hidden lg:block text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* ── Notification Bell with Dropdown ── */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllMutation.mutate()}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : notifications.map((n: any) => (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.is_read) markOneMutation.mutate(n.id); }}
                        className={`px-4 py-3 cursor-pointer hover:bg-muted/40 transition ${
                          !n.is_read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                          )}
                          <div className={!n.is_read ? "" : "pl-4"}>
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.created_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-center">
                    <button
                      onClick={() => setShowNotifs(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[user.role as UserRole]} flex items-center justify-center text-xs font-bold text-white`}>
              {generateInitials(user.full_name)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

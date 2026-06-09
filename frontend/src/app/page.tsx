"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, mustChangePassword } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (mustChangePassword) {
      router.replace("/change-password");
      return;
    }
    const roleRoutes: Record<string, string> = {
      director: "/director",
      senior_doctor: "/senior-doctor",
      junior_doctor: "/junior-doctor",
      receptionist: "/receptionist",
      patient: "/patient",
    };
    router.replace(roleRoutes[user?.role ?? ""] ?? "/login");
  }, [isAuthenticated, user, mustChangePassword, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-medical-blue">
      <div className="text-white text-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium">Loading PulmoScan AI...</p>
      </div>
    </div>
  );
}

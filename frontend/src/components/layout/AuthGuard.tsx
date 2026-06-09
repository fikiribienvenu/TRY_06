"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";
import { PageLoader } from "@/components/ui/LoadingSpinner";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
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
    if (allowedRoles && user && !allowedRoles.includes(user.role as UserRole)) {
      router.replace("/");
    }
  }, [isAuthenticated, user, mustChangePassword, allowedRoles, router]);

  if (!isAuthenticated || !user) return <PageLoader />;
  if (mustChangePassword) return <PageLoader />;
  if (allowedRoles && !allowedRoles.includes(user.role as UserRole)) return <PageLoader />;

  return <>{children}</>;
}

import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function RadiologistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["radiologist"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

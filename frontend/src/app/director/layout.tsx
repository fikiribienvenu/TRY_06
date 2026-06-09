import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function DirectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["director"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

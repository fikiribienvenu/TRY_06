import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["patient"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

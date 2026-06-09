import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function SeniorDoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["senior_doctor"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

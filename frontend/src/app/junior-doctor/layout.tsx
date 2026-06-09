import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function JuniorDoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["junior_doctor"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

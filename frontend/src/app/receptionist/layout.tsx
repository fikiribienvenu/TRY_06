import DashboardLayout from "@/components/layout/DashboardLayout";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["receptionist"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}

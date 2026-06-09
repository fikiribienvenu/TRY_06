"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi, handleApiError } from "@/lib/api";
import toast from "react-hot-toast";
import { Calendar, Plus, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

export default function PatientAppointmentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [aptType, setAptType] = useState("follow_up");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: () => appointmentsApi.list({ page_size: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => appointmentsApi.create(data),
    onSuccess: () => {
      toast.success("Appointment requested. Receptionist will confirm.");
      qc.invalidateQueries({ queryKey: ["patient-appointments"] });
      setShowModal(false);
      setNotes("");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const appointments = data?.data?.appointments ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">{appointments.length} appointment(s)</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <Plus className="w-4 h-4" /> Request Appointment
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : (
          <div className="divide-y divide-border">
            {appointments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm capitalize">{a.appointment_type.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.scheduled_at) || "Awaiting scheduling"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {appointments.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">No appointments yet</p>
                <p className="text-muted-foreground text-sm">Request your first appointment</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Request Appointment</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Appointment Type</label>
                <select
                  value={aptType}
                  onChange={(e) => setAptType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="follow_up">Follow-up Visit</option>
                  <option value="new_scan">New CT Scan</option>
                  <option value="consultation">General Consultation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe your symptoms or reason..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate({
                    patient_id: "me",
                    appointment_type: aptType,
                    notes,
                  })}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition disabled:opacity-60"
                >
                  {createMutation.isPending ? "Sending..." : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi, handleApiError } from "@/lib/api";
import { useState } from "react";
import toast from "react-hot-toast";
import { Calendar, Plus, X, Clock, User, Stethoscope } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function formatScheduled(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" }),
    time: d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true }),
  };
}

export default function PatientAppointmentsPage() {
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
      toast.success("Appointment requested. Receptionist will confirm shortly.");
      qc.invalidateQueries({ queryKey: ["patient-appointments"] });
      setShowModal(false);
      setNotes("");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const appointments = data?.data?.appointments ?? [];
  const scheduled = appointments.filter((a: any) => a.status === "scheduled" || a.status === "rescheduled");
  const pending   = appointments.filter((a: any) => a.status === "requested");
  const past      = appointments.filter((a: any) => ["completed","cancelled","no_show"].includes(a.status));

  const AppointmentCard = ({ a }: { a: any }) => {
    const dt = formatScheduled(a.scheduled_at);
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm capitalize">
                {a.appointment_type?.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Requested {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <StatusBadge status={a.status} />
        </div>

        {dt ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{dt.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>{dt.time}</span>
            </div>
            {a.doctor_id && (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <User className="w-4 h-4 flex-shrink-0" />
                <span>Your assigned doctor will be present</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Awaiting scheduling from receptionist
          </div>
        )}

        {a.notes && (
          <p className="text-xs text-muted-foreground border-t border-border pt-2">{a.notes}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="text-muted-foreground text-sm">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <Plus className="w-4 h-4" /> Request Appointment
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No appointments yet</p>
          <p className="text-sm mt-1">Request your first appointment using the button above</p>
        </div>
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
              <div className="space-y-3">
                {scheduled.map((a: any) => <AppointmentCard key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending</h3>
              <div className="space-y-3">
                {pending.map((a: any) => <AppointmentCard key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h3>
              <div className="space-y-3 opacity-70">
                {past.map((a: any) => <AppointmentCard key={a.id} a={a} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Request Appointment</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-muted rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
                Your request will be sent to the receptionist who will schedule a specific date and time with your doctor.
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Appointment Type</label>
                <select value={aptType} onChange={e => setAptType(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="follow_up">Follow-up Visit</option>
                  <option value="new_scan">New CT Scan</option>
                  <option value="consultation">General Consultation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes (Optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Describe your symptoms or reason..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate({ patient_id: "me", appointment_type: aptType, notes })}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition disabled:opacity-60">
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

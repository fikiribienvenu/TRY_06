"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi, handleApiError, api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { Search, UserPlus, Calendar, X, CheckCircle, ChevronRight, UserCheck } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import type { Patient } from "@/types";

// ── Booking Modal ──────────────────────────────────────────────────────

function BookingModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"doctor" | "slot" | "confirm">("doctor");
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [aptType, setAptType] = useState("ct_scan");
  const [notes, setNotes] = useState("");

  // Step 1: load all doctors with availability
  const { data: doctorsData, isLoading: loadingDoctors } = useQuery({
    queryKey: ["doctors-availability"],
    queryFn: () => api.get("/schedule/doctors"),
  });
  const doctors: any[] = doctorsData?.data?.doctors ?? [];

  // Step 2: load slots for selected doctor
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ["doctor-slots", selectedDoctor?.doctor_id],
    queryFn: () => api.get(`/schedule/doctors/${selectedDoctor.doctor_id}/slots`),
    enabled: !!selectedDoctor,
  });
  const slots: any[] = slotsData?.data?.slots ?? [];
  const availableSlots = slots.filter((s: any) => !s.is_full && s.is_active);

  const bookMutation = useMutation({
    mutationFn: () => api.post("/schedule/book", {
      slot_id: selectedSlot.id,
      patient_id: (patient as any).id,
      appointment_type: aptType,
      notes: notes || undefined,
    }),
    onSuccess: (res) => {
      const d = res.data;
      toast.success(`Booked! ${d.patient_name} → Dr. ${d.doctor_name} on ${d.date} at ${d.start_time}`);
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["doctors-availability"] });
      onClose();
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const inputCls = "w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  function formatSlotDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#1a3c5e]">
          <div>
            <h2 className="text-base font-semibold text-white">Schedule Appointment</h2>
            <p className="text-blue-200 text-xs mt-0.5">Patient: {patient.full_name} · {patient.patient_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-border">
          {[
            { key: "doctor", label: "1. Select Doctor" },
            { key: "slot",   label: "2. Select Slot" },
            { key: "confirm",label: "3. Confirm" },
          ].map((s, i) => (
            <div key={s.key} className={`flex-1 px-3 py-2.5 text-xs font-medium text-center border-b-2 transition ${
              step === s.key ? "border-[#1a3c5e] text-[#1a3c5e] dark:text-blue-400 dark:border-blue-400" :
              ["doctor","slot","confirm"].indexOf(step) > i ? "border-green-500 text-green-600" :
              "border-transparent text-muted-foreground"
            }`}>
              {s.label}
            </div>
          ))}
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">

          {/* ── STEP 1: Choose doctor ── */}
          {step === "doctor" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">Select an available junior doctor:</p>
              {loadingDoctors ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No junior doctors found. Please create one first.
                </div>
              ) : doctors.map((doc: any) => (
                <button
                  key={doc.doctor_id}
                  onClick={() => { setSelectedDoctor(doc); setStep("slot"); }}
                  disabled={doc.available_slots === 0}
                  className={`w-full flex items-center justify-between p-4 border rounded-xl text-left transition ${
                    doc.available_slots > 0
                      ? "border-border hover:border-[#1a3c5e] hover:bg-[#1a3c5e]/5 cursor-pointer"
                      : "border-border opacity-40 cursor-not-allowed bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm">
                      {doc.doctor_name?.charAt(0) ?? "D"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Dr. {doc.doctor_name}</p>
                      <p className="text-xs text-muted-foreground">{doc.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      doc.available_slots > 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {doc.available_slots > 0 ? `${doc.available_slots} slot${doc.available_slots>1?"s":""} free` : "Fully booked"}
                    </span>
                    {doc.available_slots > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Choose slot ── */}
          {step === "slot" && selectedDoctor && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep("doctor")} className="text-xs text-primary hover:underline">← Back</button>
                <span className="text-sm text-muted-foreground">Slots for Dr. {selectedDoctor.doctor_name}:</span>
              </div>

              {loadingSlots ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No available slots for this doctor. Please check back later.
                </div>
              ) : availableSlots.map((slot: any) => (
                <button
                  key={slot.id}
                  onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                  className="w-full flex items-center justify-between p-4 border border-border rounded-xl hover:border-[#1a3c5e] hover:bg-[#1a3c5e]/5 transition text-left cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-sm">{formatSlotDate(slot.date)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {slot.start_time} – {slot.end_time}
                      {slot.notes && <span className="ml-2 italic">· {slot.notes}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      {slot.available} spot{slot.available > 1 ? "s" : ""} left
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === "confirm" && selectedDoctor && selectedSlot && (
            <div className="space-y-4">
              <button onClick={() => setStep("slot")} className="text-xs text-primary hover:underline">← Back</button>

              {/* Summary card */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient</span>
                  <span className="font-medium">{patient.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium">Dr. {selectedDoctor.doctor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(selectedSlot.date + "T00:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{selectedSlot.start_time} – {selectedSlot.end_time}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Appointment Type</label>
                <select value={aptType} onChange={e => setAptType(e.target.value)} className={inputCls}>
                  <option value="ct_scan">CT Scan</option>
                  <option value="consultation">Consultation</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="new_scan">New Scan</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any additional notes..."
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
                A confirmation email will be sent to <strong>{patient.email}</strong> with appointment details.
              </div>

              <button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3c5e] text-white rounded-xl font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60"
              >
                {bookMutation.isPending
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Booking...</>
                  : <><CheckCircle className="w-4 h-4"/>Confirm Appointment</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ReceptionistPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [bookingPatient, setBookingPatient] = useState<Patient | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search, page],
    queryFn: () => patientsApi.list({ search, page, page_size: 20 }),
  });

  const patients: Patient[] = data?.data?.patients ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patient Registry</h1>
          <p className="text-muted-foreground text-sm">{total} registered patients</p>
        </div>
        <Link
          href="/receptionist/register"
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <UserPlus className="w-4 h-4" /> Register Patient
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, patient ID, national ID, phone or email..."
          className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Patient ID", "Name", "Age/Gender", "Phone", "Status", "Doctor", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.patient_id}</td>
                    <td className="px-4 py-3 font-medium">{p.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.age}y / {p.gender}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3">
                      {(p as any).assigned_doctor_id ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Assigned
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setBookingPatient(p)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#0f2a42] transition"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No patients found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm ${page === p ? "bg-[#1a3c5e] text-white" : "bg-card border border-border hover:bg-muted"}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {bookingPatient && (
        <BookingModal patient={bookingPatient} onClose={() => setBookingPatient(null)} />
      )}
    </div>
  );
}

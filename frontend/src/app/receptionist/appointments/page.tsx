"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi, scheduleApi, ctScansApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Calendar, Clock, User, Mail, CheckCircle2, XCircle,
  AlertCircle, Users, CalendarCheck, ScanLine, PlusCircle,
} from "lucide-react";

type Tab = "requested" | "scheduled" | "all";

interface Appointment {
  id: string;
  patient_id: string;
  patient_name?: string;
  patient_code?: string;
  patient_email?: string;
  doctor_id?: string;
  doctor_name?: string;
  appointment_type: string;
  status: string;
  scheduled_at?: string;
  notes?: string;
  ct_scan_id?: string;
  created_at: string;
}

interface Slot {
  id: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  start_time: string;
  end_time: string;
  max_patients: number;
  booked_count: number;
  available: number;
  is_active: boolean;
  is_full: boolean;
}

interface Doctor {
  doctor_id: string;
  doctor_name: string;
  email: string;
  available_slots: number;
  slots: Slot[];
}

export default function ReceptionistAppointmentsPage() {
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("requested");
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // rejection form
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNextDate, setRejectNextDate] = useState("");

  // confirm notes
  const [confirmNotes, setConfirmNotes] = useState("");

  const statusParam = tab === "all" ? undefined : tab;

  const { data: aptData, isLoading: aptLoading } = useQuery({
    queryKey: ["appointments", "receptionist", tab],
    queryFn: () => appointmentsApi.list({ page: 1, page_size: 50, status: statusParam }),
  });

  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ["schedule", "doctors"],
    queryFn: () => scheduleApi.getDoctors(),
    enabled: !!selectedApt,
  });

  const appointments: Appointment[] = aptData?.data?.appointments ?? [];
  const doctors: Doctor[] = doctorsData?.data?.doctors ?? [];

  const pending = (aptData?.data?.appointments ?? []).filter(
    (a: Appointment) => a.status === "requested"
  ).length;

  const confirmMutation = useMutation({
    mutationFn: ({ id, slot_id, notes }: { id: string; slot_id: string; notes?: string }) =>
      appointmentsApi.confirm(id, { slot_id, notes }),
    onSuccess: (_, vars) => {
      const res = _ as any;
      const ctScanId = res?.data?.ct_scan_id;
      toast.success(
        ctScanId
          ? "Appointment confirmed — CT scan created in doctor's queue"
          : "Appointment confirmed — patient notified by email"
      );
      qc.invalidateQueries({ queryKey: ["appointments", "receptionist"] });
      setSelectedApt(null);
      setSelectedSlot(null);
      setConfirmNotes("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Failed to confirm appointment");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason, next_available }: { id: string; reason: string; next_available?: string }) =>
      appointmentsApi.reject(id, { reason, next_available }),
    onSuccess: () => {
      toast.success("Request rejected — patient notified by email");
      qc.invalidateQueries({ queryKey: ["appointments", "receptionist"] });
      setSelectedApt(null);
      setShowRejectForm(false);
      setRejectReason("");
      setRejectNextDate("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Failed to reject appointment");
    },
  });

  const createScanMutation = useMutation({
    mutationFn: ({ patientId, doctorId, notes }: { patientId: string; doctorId: string; notes?: string }) =>
      ctScansApi.createForPatient(patientId, doctorId, notes),
    onSuccess: () => {
      toast.success("CT scan created and assigned to the doctor");
      qc.invalidateQueries({ queryKey: ["appointments", "receptionist"] });
      // Refresh selected apt to show updated ct_scan_id
      setSelectedApt(prev => prev ? { ...prev, ct_scan_id: "created" } : prev);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? "Failed to create CT scan");
    },
  });

  function selectApt(apt: Appointment) {
    setSelectedApt(apt);
    setSelectedSlot(null);
    setShowRejectForm(false);
    setRejectReason("");
    setRejectNextDate("");
    setConfirmNotes("");
  }

  const tabCfg: { key: Tab; label: string; status?: string }[] = [
    { key: "requested", label: "Pending Requests" },
    { key: "scheduled", label: "Scheduled" },
    { key: "all",       label: "All" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Review requests and assign patients to doctors</p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>{pending} pending request{pending !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabCfg.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSelectedApt(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      {aptLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className={`grid gap-6 ${selectedApt ? "grid-cols-[340px_1fr]" : "grid-cols-1"}`}>

          {/* Left — appointment list */}
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {appointments.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No appointments in this view</p>
              </div>
            ) : (
              appointments.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => selectApt(apt)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedApt?.id === apt.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{apt.patient_name ?? apt.patient_id}</p>
                      {apt.patient_code && (
                        <p className="text-xs text-muted-foreground">{apt.patient_code}</p>
                      )}
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="capitalize">{apt.appointment_type.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{formatDate(apt.created_at)}</span>
                  </div>
                  {apt.doctor_name && apt.status === "scheduled" && (
                    <p className="mt-1 text-xs text-primary">Dr. {apt.doctor_name}</p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Right — action panel */}
          {selectedApt && (
            <div className="space-y-5">

              {/* Patient info */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Patient
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedApt.patient_name ?? selectedApt.patient_id}</p>
                    {selectedApt.patient_code && (
                      <p className="text-xs text-muted-foreground">{selectedApt.patient_code}</p>
                    )}
                  </div>
                </div>
                {selectedApt.patient_email && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{selectedApt.patient_email}</span>
                  </div>
                )}
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="capitalize">{selectedApt.appointment_type.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <StatusBadge status={selectedApt.status} />
                  </div>
                </div>
                {selectedApt.notes && (
                  <p className="mt-3 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">
                    {selectedApt.notes}
                  </p>
                )}
              </div>

              {/* Show confirm/reject only for requested */}
              {selectedApt.status === "requested" && (
                <>
                  {/* Doctor availability */}
                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Doctor Availability
                      </h3>
                      {selectedSlot && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                          Slot selected
                        </span>
                      )}
                    </div>

                    {doctorsLoading ? (
                      <div className="flex justify-center py-6"><LoadingSpinner /></div>
                    ) : doctors.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No doctors have available slots</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {doctors.map((doc) => (
                          <div key={doc.doctor_id}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Dr. {doc.doctor_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {doc.available_slots} slot{doc.available_slots !== 1 ? "s" : ""} available
                                </p>
                              </div>
                            </div>

                            {doc.slots.length === 0 ? (
                              <p className="text-xs text-muted-foreground ml-9 mb-1">No upcoming slots</p>
                            ) : (
                              <div className="ml-9 grid grid-cols-2 gap-2">
                                {doc.slots.map((slot) => {
                                  const isFull = slot.is_full;
                                  const isSelected = selectedSlot?.id === slot.id;
                                  return (
                                    <button
                                      key={slot.id}
                                      disabled={isFull}
                                      onClick={() => setSelectedSlot(isSelected ? null : slot)}
                                      className={`text-left p-3 rounded-lg border text-xs transition-all ${
                                        isFull
                                          ? "border-border bg-muted/20 opacity-50 cursor-not-allowed"
                                          : isSelected
                                          ? "border-primary bg-primary/10 shadow-sm"
                                          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-medium mb-1">
                                        <Calendar className="w-3 h-3" />
                                        {slot.date}
                                      </div>
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {slot.start_time} – {slot.end_time}
                                      </div>
                                      <div className={`mt-1 font-medium ${isFull ? "text-red-500" : "text-green-600"}`}>
                                        {isFull
                                          ? "Full"
                                          : `${slot.available}/${slot.max_patients} open`}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirm section */}
                  {selectedSlot && !showRejectForm && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarCheck className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold text-green-800">Confirm Appointment</h4>
                      </div>
                      <p className="text-sm text-green-700 mb-3">
                        Dr. {selectedSlot.doctor_name} · {selectedSlot.date} · {selectedSlot.start_time} – {selectedSlot.end_time}
                      </p>
                      <textarea
                        rows={2}
                        placeholder="Optional notes for the doctor..."
                        value={confirmNotes}
                        onChange={(e) => setConfirmNotes(e.target.value)}
                        className="w-full text-sm border border-green-300 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
                      />
                      <button
                        onClick={() =>
                          confirmMutation.mutate({
                            id: selectedApt.id,
                            slot_id: selectedSlot.id,
                            notes: confirmNotes || undefined,
                          })
                        }
                        disabled={confirmMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
                      >
                        {confirmMutation.isPending ? (
                          <LoadingSpinner />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm &amp; Notify Patient
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Reject toggle button */}
                  {!showRejectForm ? (
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl transition text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Request
                    </button>
                  ) : (
                    /* Reject form */
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-semibold text-red-800">Reject Appointment Request</h4>
                      </div>

                      <label className="block text-sm font-medium text-red-700 mb-1">
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Explain why the appointment cannot be confirmed..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
                      />

                      <label className="block text-sm font-medium text-red-700 mb-1">
                        Next Available Date <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <input
                        type="date"
                        value={rejectNextDate}
                        onChange={(e) => setRejectNextDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
                      />

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason("");
                            setRejectNextDate("");
                          }}
                          className="flex-1 border border-border text-muted-foreground hover:bg-muted py-2 rounded-lg text-sm transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() =>
                            rejectMutation.mutate({
                              id: selectedApt.id,
                              reason: rejectReason.trim(),
                              next_available: rejectNextDate || undefined,
                            })
                          }
                          disabled={rejectMutation.isPending || !rejectReason.trim()}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-60 text-sm"
                        >
                          {rejectMutation.isPending ? (
                            <LoadingSpinner />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              Send Rejection
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Already scheduled view */}
              {selectedApt.status === "scheduled" && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <h4 className="font-semibold text-green-800">Confirmed Appointment</h4>
                    </div>
                    {selectedApt.doctor_name && (
                      <p className="text-sm text-green-700">
                        Assigned to Dr. {selectedApt.doctor_name}
                      </p>
                    )}
                    {selectedApt.scheduled_at && (
                      <p className="text-sm text-green-700">
                        {formatDate(selectedApt.scheduled_at)}
                      </p>
                    )}
                  </div>

                  {/* CT Scan status & creation */}
                  {selectedApt.ct_scan_id ? (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <ScanLine className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800">CT Scan Created</p>
                        <p className="text-xs text-blue-600">
                          The doctor can now upload and analyze the CT image from their queue.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">No CT Scan Assigned Yet</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            The doctor cannot upload or analyze the CT image until a scan request is created.
                          </p>
                        </div>
                      </div>
                      {selectedApt.doctor_id ? (
                        <button
                          onClick={() =>
                            createScanMutation.mutate({
                              patientId: selectedApt.patient_id,
                              doctorId: selectedApt.doctor_id!,
                              notes: selectedApt.notes,
                            })
                          }
                          disabled={createScanMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 text-sm"
                        >
                          {createScanMutation.isPending ? (
                            <LoadingSpinner />
                          ) : (
                            <>
                              <PlusCircle className="w-4 h-4" />
                              Create CT Scan for This Patient
                            </>
                          )}
                        </button>
                      ) : (
                        <p className="text-xs text-amber-600">
                          No doctor assigned to this appointment — cannot create a scan.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}

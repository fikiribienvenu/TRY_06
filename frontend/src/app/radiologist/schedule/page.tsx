"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, handleApiError } from "@/lib/api";
import toast from "react-hot-toast";
import { Clock, Plus, Trash2, CalendarDays, Users, ChevronDown, ChevronUp } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";

const TIMES: string[] = [];
for (let h = 7; h <= 20; h++) {
  TIMES.push(`${String(h).padStart(2,"0")}:00`);
  TIMES.push(`${String(h).padStart(2,"0")}:30`);
}

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}

export default function RadiologistSchedulePage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    date: today,
    start_time: "09:00",
    end_time: "10:00",
    max_patients: 1,
    notes: "",
  });
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-slots"],
    queryFn: () => api.get("/schedule/my-slots"),
  });
  const slots: any[] = data?.data?.slots ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.post("/schedule/my-slots", form),
    onSuccess: () => {
      toast.success("Availability slot added");
      qc.invalidateQueries({ queryKey: ["my-slots"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/schedule/my-slots/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-slots"] }),
    onError: (e) => toast.error(handleApiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/my-slots/${id}`),
    onSuccess: () => {
      toast.success("Slot removed");
      qc.invalidateQueries({ queryKey: ["my-slots"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const inputCls = "w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  // Group by date
  const byDate: Record<string, any[]> = {};
  slots.forEach((s: any) => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6" /> My Availability Schedule
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add specific dates and time slots when you are available. Receptionist will book patients into these slots.
        </p>
      </div>

      {/* Add slot form */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add New Availability Slot
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
            <input type="date" min={today} value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
            <select value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className={inputCls}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">End Time</label>
            <select value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className={inputCls}>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Patients</label>
            <input type="number" min={1} max={10} value={form.max_patients}
              onChange={e => setForm({...form, max_patients: parseInt(e.target.value)||1})}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (opt.)</label>
            <input type="text" value={form.notes} placeholder="e.g. CT scans only"
              onChange={e => setForm({...form, notes: e.target.value})}
              className={inputCls} />
          </div>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition disabled:opacity-60"
        >
          {createMutation.isPending
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Saving...</>
            : <><Plus className="w-4 h-4"/>Add Slot</>}
        </button>
      </div>

      {/* Slots list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No availability slots yet</p>
          <p className="text-xs mt-1">Add your first slot above so receptionist can book patients</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Date header */}
              <div className="px-4 py-3 bg-[#1a3c5e]/10 dark:bg-[#1a3c5e]/20 border-b border-border">
                <p className="font-semibold text-sm">{formatDateDisplay(date)}</p>
              </div>

              <div className="divide-y divide-border">
                {byDate[date].map((slot: any) => (
                  <div key={slot.id} className={!slot.is_active ? "opacity-50" : ""}>
                    {/* Slot row */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="font-medium text-sm">{slot.start_time} – {slot.end_time}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            · {slot.booked_count}/{slot.max_patients} booked
                          </span>
                          {slot.notes && <span className="text-xs text-muted-foreground ml-2">· {slot.notes}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Capacity bar */}
                        <div className="hidden sm:flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${slot.is_full ? "bg-red-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(100, (slot.booked_count / slot.max_patients) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{slot.available} left</span>
                        </div>

                        {slot.booked_count > 0 && (
                          <button
                            onClick={() => setExpandedSlot(expandedSlot === slot.id ? null : slot.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Users className="w-3.5 h-3.5" />
                            {slot.booked_count} patient{slot.booked_count > 1 ? "s" : ""}
                            {expandedSlot === slot.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}

                        <button
                          onClick={() => toggleMutation.mutate({ id: slot.id, is_active: !slot.is_active })}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                            slot.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800"
                          }`}
                        >
                          {slot.is_active ? "Active" : "Inactive"}
                        </button>

                        <button
                          onClick={() => { if (confirm("Remove this slot?")) deleteMutation.mutate(slot.id); }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Delete slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Booked patients panel */}
                    {expandedSlot === slot.id && slot.booked_patients?.length > 0 && (
                      <div className="mx-4 mb-3 border border-border rounded-lg overflow-hidden">
                        <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Booked Patients
                        </div>
                        <div className="divide-y divide-border">
                          {slot.booked_patients.map((bp: any) => (
                            <div key={bp.appointment_id} className="flex items-center justify-between px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs">
                                  {bp.patient_name?.charAt(0) ?? "P"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{bp.patient_name}</p>
                                  <p className="text-xs text-muted-foreground">{bp.patient_pid}</p>
                                </div>
                              </div>
                              <StatusBadge status={bp.status} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

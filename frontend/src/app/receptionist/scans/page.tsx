"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ctScansApi, patientsApi, handleApiError } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { ScanLine, Plus, X, Search, Info } from "lucide-react";
import toast from "react-hot-toast";

export default function ReceptionistScansPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-scans-r", page],
    queryFn: () => ctScansApi.list({ page, page_size: 20 }),
  });

  const { data: patientSearch } = useQuery({
    queryKey: ["patient-search-scan", searchPatient],
    queryFn: () => patientsApi.list({ search: searchPatient, page_size: 10 }),
    enabled: searchPatient.length > 1,
  });

  const requestMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("patient_id", selectedPatient.id);
      fd.append("priority", priority);
      if (notes) fd.append("notes", notes);
      return ctScansApi.request(fd);
    },
    onSuccess: () => {
      toast.success("CT scan requested — assigned to doctor");
      closeModal();
      qc.invalidateQueries({ queryKey: ["all-scans-r"] });
    },
    onError: (e) => toast.error(handleApiError(e)),
  });

  const closeModal = () => {
    setShowModal(false);
    setSelectedPatient(null);
    setSearchPatient("");
    setNotes("");
    setPriority("normal");
  };

  const scans = data?.data?.scans ?? [];
  const total = data?.data?.total ?? 0;
  const searchResults = patientSearch?.data?.patients ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CT Scan Requests</h1>
          <p className="text-muted-foreground text-sm">{total} total — uploading &amp; analysis done by the Radiologist</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm font-medium hover:bg-[#0f2a42] transition"
        >
          <Plus className="w-4 h-4" /> Request CT Scan
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Your role is to <strong>request CT scans</strong> for patients and assign them to a Radiologist.
          The Radiologist will upload the lung image, run the AI prediction, and submit a report.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : scans.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No CT scan requests yet</p>
          <button onClick={() => setShowModal(true)} className="text-primary text-sm hover:underline mt-2">
            Request the first CT scan
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Patient", "Priority", "Status", "Assigned Doctor", "Created"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scans.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.patient_id?.slice(-8)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {s.assigned_doctor_id
                      ? <span className="text-green-600 dark:text-green-400 font-medium">Assigned</span>
                      : <span className="italic">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} requests</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted">Prev</button>
              <span className="px-3 py-1">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={scans.length < 20}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request CT Scan Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-[#1a3c5e]">
              <h2 className="font-semibold text-white">Request CT Scan</h2>
              <button onClick={closeModal} className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Patient search */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Patient <span className="text-red-500">*</span></label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPatient.patient_id}</p>
                    </div>
                    <button onClick={() => { setSelectedPatient(null); setSearchPatient(""); }}
                      className="p-1 hover:bg-green-100 rounded">
                      <X className="w-4 h-4 text-green-600" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchPatient}
                      onChange={e => setSearchPatient(e.target.value)}
                      placeholder="Search patient by name or ID..."
                      className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {searchResults.length > 0 && searchPatient.length > 1 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                        {searchResults.map((p: any) => (
                          <button key={p.id}
                            onClick={() => { setSelectedPatient(p); setSearchPatient(""); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-muted transition flex items-center justify-between">
                            <span className="font-medium text-sm">{p.full_name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{p.patient_id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Any relevant clinical notes..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition">
                  Cancel
                </button>
                <button
                  onClick={() => requestMutation.mutate()}
                  disabled={!selectedPatient || requestMutation.isPending}
                  className="flex-1 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {requestMutation.isPending
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Requesting...</>
                    : <><ScanLine className="w-4 h-4" />Request Scan</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

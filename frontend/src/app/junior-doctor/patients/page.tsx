"use client";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function JuniorDoctorPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search, page],
    queryFn: () => patientsApi.list({ search, page, page_size: 20 }),
  });

  const patients = data?.data?.patients ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Patients</h1>
        <p className="text-muted-foreground text-sm">Patients assigned to you</p>
      </div>

      <input
        type="text"
        placeholder="Search patients..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No patients assigned yet</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Patient</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Age</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gender</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {patients.map((p: any) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.patient_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.age ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.gender ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/junior-doctor/scans?patient_id=${p.id}`} className="text-primary text-xs hover:underline">
                      View Scans
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} total patients</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition">Prev</button>
              <span className="px-3 py-1">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={patients.length < 20}
                className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { Search, UserPlus } from "lucide-react";
import Link from "next/link";
import type { Patient } from "@/types";

export default function ReceptionistPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

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
        {isLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Patient ID", "Name", "Age/Gender", "Phone", "Email", "Status", "Registered"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      {h}
                    </th>
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
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No patients found
                    </td>
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
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm ${page === p ? "bg-[#1a3c5e] text-white" : "bg-card border border-border hover:bg-muted"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

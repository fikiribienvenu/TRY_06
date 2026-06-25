"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, handleApiError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { UserPlus, Search, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate, formatRole } from "@/lib/utils";
import type { User } from "@/types";

const schema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(["radiologist", "senior_doctor", "receptionist"]),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["users", search, roleFilter, page],
    queryFn: () => usersApi.list({ search, role: roleFilter || undefined, page, page_size: 20 }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => usersApi.create(data),
    onSuccess: () => {
      toast.success("User created. Credentials sent by email.");
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowModal(false);
      reset();
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => usersApi.toggleActive(id),
    onSuccess: () => {
      toast.success("User status updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const users: User[] = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">{total} users total</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a3c5e] text-white rounded-lg hover:bg-[#0f2a42] transition text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Roles</option>
          <option value="radiologist">Radiologist</option>
          <option value="senior_doctor">Senior Doctor</option>
          <option value="receptionist">Receptionist</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{user.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium">{formatRole(user.role)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(user.last_login) || "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {user.role !== "director" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(user.id)}
                            className="text-muted-foreground hover:text-primary transition"
                            title={user.is_active ? "Disable" : "Enable"}
                          >
                            {user.is_active
                              ? <ToggleRight className="w-5 h-5 text-green-500" />
                              : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${user.full_name}?`)) deleteMutation.mutate(user.id);
                            }}
                            className="text-muted-foreground hover:text-red-500 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Create New User</h2>
              <button onClick={() => { setShowModal(false); reset(); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              {([
                ["email", "Email Address", "email"],
                ["first_name", "First Name", "text"],
                ["last_name", "Last Name", "text"],
                ["phone", "Phone (optional)", "tel"],
              ] as const).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input
                    {...register(field)}
                    type={type}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field]?.message}</p>}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  {...register("role")}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select role...</option>
                  <option value="radiologist">Radiologist</option>
                  <option value="senior_doctor">Senior Doctor</option>
                  <option value="receptionist">Receptionist</option>
                </select>
                {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); reset(); }}
                  className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-[#1a3c5e] text-white rounded-lg text-sm hover:bg-[#0f2a42] transition disabled:opacity-60"
                >
                  {createMutation.isPending ? "Creating..." : "Create & Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
import { authApi, handleApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const schema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[a-z]/, "Must contain lowercase")
      .regex(/\d/, "Must contain a number")
      .regex(/[!@#$%^&*]/, "Must contain a special character (!@#$%^&*)"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

const ROLE_ROUTES: Record<string, string> = {
  director: "/director",
  senior_doctor: "/senior-doctor",
  radiologist: "/radiologist",
  receptionist: "/receptionist",
  patient: "/patient",
};

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600" : "text-gray-400"}`}>
      {met ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setMustChangePassword } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [shows, setShows] = useState({ current: false, new: false, confirm: false });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const newPw = watch("new_password") ?? "";
  const rules = [
    { met: newPw.length >= 8, label: "At least 8 characters" },
    { met: /[A-Z]/.test(newPw), label: "Uppercase letter" },
    { met: /[a-z]/.test(newPw), label: "Lowercase letter" },
    { met: /\d/.test(newPw), label: "Number" },
    { met: /[!@#$%^&*]/.test(newPw), label: "Special character (!@#$%^&*)" },
  ];

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authApi.changePassword(data.current_password, data.new_password, data.confirm_password);
      toast.success("Password changed successfully! Redirecting...");
      setMustChangePassword(false);
      setTimeout(() => {
        router.push(ROLE_ROUTES[user?.role ?? ""] ?? "/");
      }, 1500);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (field: keyof typeof shows) =>
    setShows((prev) => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a3c5e] to-[#0891b2] p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="p-3 bg-[#1a3c5e] rounded-full">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change Your Password</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            You must set a new password before accessing the system.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            { field: "current_password" as const, label: "Current Password", key: "current" as const },
            { field: "new_password" as const, label: "New Password", key: "new" as const },
            { field: "confirm_password" as const, label: "Confirm New Password", key: "confirm" as const },
          ].map(({ field, label, key }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {label}
              </label>
              <div className="relative">
                <input
                  {...register(field)}
                  type={shows[key] ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] transition"
                />
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {shows[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors[field] && (
                <p className="text-red-500 text-xs mt-1">{errors[field]?.message}</p>
              )}
            </div>
          ))}

          {/* Password strength rules */}
          {newPw && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 grid grid-cols-2 gap-1">
              {rules.map((r, i) => (
                <PasswordRule key={i} {...r} />
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-[#1a3c5e] hover:bg-[#0f2a42] text-white font-semibold rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              "Set New Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

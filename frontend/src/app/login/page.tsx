"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Stethoscope, Shield, Activity } from "lucide-react";
import { authApi, handleApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const ROLE_ROUTES: Record<string, string> = {
  director: "/director",
  senior_doctor: "/senior-doctor",
  radiologist: "/radiologist",
  receptionist: "/receptionist",
  patient: "/patient",
};

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      const { access_token, refresh_token, role, user_id, full_name, must_change_password } = res.data;

      const user: User = {
        id: user_id,
        email: data.email,
        full_name,
        first_name: full_name?.split(" ")[0] ?? "",
        last_name: full_name?.split(" ").slice(1).join(" ") ?? "",
        role,
        is_active: true,
        must_change_password,
        created_at: new Date().toISOString(),
      };

      setAuth({ user, accessToken: access_token, refreshToken: refresh_token, mustChangePassword: must_change_password });

      if (must_change_password) {
        toast("Please change your password before continuing.", { icon: "🔐" });
        window.location.href = "/change-password";
        return;
      }

      toast.success(`Welcome, ${full_name}!`);
      window.location.href = ROLE_ROUTES[role] ?? "/";
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1a3c5e] to-[#0891b2] flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PulmoScan AI</h1>
            <p className="text-blue-200 text-sm">Lung Cancer Prediction System</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight mb-4">
              AI-Powered<br />Lung Cancer Detection
            </h2>
            <p className="text-blue-200 leading-relaxed">
              Advanced CT scan analysis using deep learning for early and accurate lung cancer prediction.
              Supporting clinical decisions with explainable AI.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: <Stethoscope className="w-5 h-5" />, text: "Multi-role clinical workflow management" },
              { icon: <Shield className="w-5 h-5" />, text: "HIPAA-compliant secure patient data" },
              { icon: <Activity className="w-5 h-5" />, text: "EfficientNetB3 model with 94%+ accuracy" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-blue-100">
                <div className="p-1.5 bg-white/20 rounded-lg">{item.icon}</div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300 text-xs">
          © {new Date().getFullYear()} PulmoScan AI. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <Activity className="w-8 h-8 text-[#1a3c5e]" />
            <h1 className="text-2xl font-bold text-[#1a3c5e]">PulmoScan AI</h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sign In</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Enter your credentials to access the system</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Email Address
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@hospital.com"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent transition"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#1a3c5e] hover:bg-[#0f2a42] text-white font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Demo Credentials</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Director: director@pulmoscan.ai / Director@2024!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

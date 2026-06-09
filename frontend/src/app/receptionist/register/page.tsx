"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { patientsApi, handleApiError } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  gender: z.enum(["male", "female", "other"]),
  date_of_birth: z.string().min(1, "Required"),
  national_id: z.string().min(5, "Min 5 characters"),
  phone: z.string().min(8, "Valid phone required"),
  email: z.string().email("Valid email required"),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  blood_type: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-foreground">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputClass = "w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary transition";

export default function RegisterPatientPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => patientsApi.create(data),
    onSuccess: (res) => {
      toast.success(`Patient ${res.data.patient_id} registered. Credentials sent by email.`);
      router.push("/receptionist/patients");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/receptionist" className="p-2 hover:bg-muted rounded-lg transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Register New Patient</h1>
          <p className="text-muted-foreground text-sm">Create patient profile and auto-generate account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
        {/* Personal Info */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" error={errors.first_name?.message}>
              <input {...register("first_name")} className={inputClass} />
            </Field>
            <Field label="Last Name" error={errors.last_name?.message}>
              <input {...register("last_name")} className={inputClass} />
            </Field>
            <Field label="Gender" error={errors.gender?.message}>
              <select {...register("gender")} className={inputClass}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Date of Birth" error={errors.date_of_birth?.message}>
              <input {...register("date_of_birth")} type="date" className={inputClass} />
            </Field>
            <Field label="National ID" error={errors.national_id?.message}>
              <input {...register("national_id")} className={inputClass} />
            </Field>
            <Field label="Blood Type" error={errors.blood_type?.message}>
              <select {...register("blood_type")} className={inputClass}>
                <option value="">Unknown</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bt => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number" error={errors.phone?.message}>
              <input {...register("phone")} type="tel" className={inputClass} />
            </Field>
            <Field label="Email Address" error={errors.email?.message}>
              <input {...register("email")} type="email" className={inputClass} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <input {...register("address")} className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contact Name" error={errors.emergency_contact_name?.message}>
              <input {...register("emergency_contact_name")} className={inputClass} />
            </Field>
            <Field label="Contact Phone" error={errors.emergency_contact_phone?.message}>
              <input {...register("emergency_contact_phone")} type="tel" className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/receptionist"
            className="flex-1 py-2.5 border border-border rounded-lg text-sm font-medium text-center hover:bg-muted transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-[#1a3c5e] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a42] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering...</>
            ) : (
              <><UserPlus className="w-4 h-4" /> Register & Send Credentials</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM dd, yyyy");
}

export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM dd, yyyy HH:mm");
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "text-green-600 dark:text-green-400";
  if (confidence >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    predicted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    under_review: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    pending_review: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    published: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    re_evaluation: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export function getPredictionColor(prediction: string): string {
  if (prediction === "No Cancer" || prediction === "Normal") return "text-green-600";
  return "text-red-600";
}

export function generateInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function formatFileSize(sizeKb: number): string {
  if (sizeKb < 1024) return `${sizeKb.toFixed(1)} KB`;
  return `${(sizeKb / 1024).toFixed(2)} MB`;
}

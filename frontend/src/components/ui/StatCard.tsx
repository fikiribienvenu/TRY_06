import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: { value: number; label: string };
  color?: "blue" | "green" | "red" | "amber" | "purple" | "teal";
  className?: string;
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
};

export function StatCard({ title, value, icon, description, trend, color = "blue", className }: StatCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-xs mt-2 px-1.5 py-0.5 rounded",
              trend.value >= 0
                ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

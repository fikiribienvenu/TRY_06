import { cn, getStatusBadgeClass } from "@/lib/utils";

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
      getStatusBadgeClass(status),
      className
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

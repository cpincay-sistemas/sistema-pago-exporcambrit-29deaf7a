import { formatUSD } from "@/lib/business-rules";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "danger" | "success" | "warning" | "info";
}

const variantStyles: Record<string, string> = {
  default: "border-l-primary",
  danger: "border-l-danger",
  success: "border-l-success",
  warning: "border-l-warning",
  info: "border-l-primary",
};

export function KPICard({ title, value, subtitle, variant = "default" }: KPICardProps) {
  return (
    <div className={`bg-card rounded-lg p-5 card-shadow border-l-4 ${variantStyles[variant]} animate-fade-in`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{typeof value === "number" ? formatUSD(value) : value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

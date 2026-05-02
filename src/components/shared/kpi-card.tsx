import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  meta?: string;
  metaColor?: string;
  progress?: number;
  className?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-[#eca826]",
  meta,
  metaColor,
  progress,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("p-4 flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
        <span className="text-xs font-medium text-[#737373]">{title}</span>
      </div>
      <p
        className="text-2xl font-bold text-[#1d1d1b] mt-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      {meta && (
        <p className={cn("text-xs font-medium", metaColor || "text-[#737373]")}>
          {meta}
        </p>
      )}
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-[#e5e5e5] rounded-full mt-1">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

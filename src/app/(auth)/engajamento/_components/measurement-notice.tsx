import { Info } from "lucide-react";
import { measurementNotice } from "@/modules/admin/application/engagement-format";
import type { EngagementPeriod } from "@/modules/admin/infrastructure/engagement-api";

export { measurementNotice };

export function MeasurementNotice({
  measuredSince,
  period,
}: {
  measuredSince: string | null;
  period: EngagementPeriod;
}) {
  const text = measurementNotice(measuredSince, period);
  if (!text) return null;
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

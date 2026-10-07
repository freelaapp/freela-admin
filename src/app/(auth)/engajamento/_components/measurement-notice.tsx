import { Info } from "lucide-react";
import { brasiliaDayOf, dateBR } from "@/modules/admin/application/engagement-format";
import type { EngagementPeriod } from "@/modules/admin/infrastructure/engagement-api";

/**
 * Aviso de medição (spec §5.1). A janela anterior começa antes da atual, então
 * basta olhar `previousStart`: se ela começa antes de `measuredSince`, algum
 * número de "abriram" (o atual ou o anterior) fica sem dado.
 */
export function measurementNotice(measuredSince: string | null, period: EngagementPeriod): string | null {
  if (!measuredSince) {
    return 'As aberturas do app e do site ainda não estão sendo medidas. Os números de "abriram" aparecem como — (não é zero).';
  }
  if (brasiliaDayOf(period.previousStart) >= measuredSince) return null;
  return `Aberturas medidas desde ${dateBR(measuredSince)}. Antes disso não há medição: os números de "abriram" aparecem como — (não é zero), e a comparação com o período anterior pode ficar sem número.`;
}

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

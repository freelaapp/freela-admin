import type { HistoryCriteria } from "@/modules/admin/infrastructure/orientation-api";
import type { BuildResult } from "../../_lib/session-form";

export interface HistoryForm {
  minServices: string;
  minRating: string;
}

export const DEFAULT_HISTORY_FORM: HistoryForm = { minServices: "1", minRating: "4,0" };

/** Formulário do "Aprovar por histórico" → critérios da API (serviços 1 a 1000, nota 0 a 5 com 1 casa). */
export function buildHistoryCriteria(form: HistoryForm): BuildResult<HistoryCriteria> {
  const services = form.minServices.trim();
  if (!/^\d{1,4}$/.test(services) || Number(services) < 1 || Number(services) > 1000) {
    return { ok: false, error: "Serviços concluídos: um número inteiro de 1 a 1.000." };
  }
  const rating = form.minRating.trim().replace(",", ".");
  if (!/^\d(\.\d)?$/.test(rating) || Number(rating) > 5) {
    return { ok: false, error: "Nota: de 0 a 5, com no máximo uma casa (ex.: 4,0)." };
  }
  return { ok: true, payload: { minCompletedServices: Number(services), minRating: Number(rating) } };
}

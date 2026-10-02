import type { CampaignLastRun } from "@/modules/admin/infrastructure/campaign-templates-api";
import type {
  AudienceExclusions,
  AudienceFilters,
  CampaignResults,
} from "@/modules/admin/infrastructure/referrals-api";
import { formatPrice } from "./campaign-wizard";

/**
 * Contas e textos da aba Resultados, do histórico e da contagem do passo 1 (spec 2026-10-01
 * parte 2 §3, §6–§8). Puros: a tela só desenha.
 */

/** Sinal de menos da spec ("−n por já ter contratado"), não o hífen. */
export const MINUS = "−";

/** 0,9474 → "95%". Zero, negativo ou inválido → "0%" (nunca "NaN%"). */
export function formatPercent(rate: number | null | undefined): string {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return "0%";
  return `${Math.round(value * 100)}%`;
}

/** "R$ 63,00" (custo com centavos). */
export function formatCost(value: number | null | undefined): string {
  const amount = Number(value);
  return formatPrice(Number.isFinite(amount) ? amount : 0);
}

/** Largura da barra do funil (0–100), em relação aos enviados. */
export function barWidth(
  value: number | null | undefined,
  base: number,
): number {
  if (!value || !(base > 0)) return 0;
  return Math.min(100, Math.round((value / base) * 100));
}

export interface FunnelStep {
  key: "sent" | "delivered" | "read" | "clicked";
  label: string;
  /** `null` = não se aplica (modelo sem "Contar cliques"). */
  value: number | null;
  percent: string | null;
  hint: string;
}

/** Enviados → entregues → lidos → clicaram, cada % com a base dita na tela. */
export function funnelSteps(
  results: Pick<
    CampaignResults,
    "sent" | "delivered" | "read" | "clicked" | "rates" | "clickTracking"
  >,
): FunnelStep[] {
  return [
    {
      key: "sent",
      label: "Enviados",
      value: results.sent,
      percent: null,
      hint: "saíram pela Meta",
    },
    {
      key: "delivered",
      label: "Entregues",
      value: results.delivered,
      percent: formatPercent(results.rates.deliveredRate),
      hint: "dos enviados",
    },
    {
      key: "read",
      label: "Lidos",
      value: results.read,
      percent: formatPercent(results.rates.readRate),
      hint: "dos entregues",
    },
    results.clickTracking
      ? {
          key: "clicked",
          label: "Clicaram",
          value: results.clicked,
          percent: formatPercent(results.rates.clickRate),
          hint: "dos entregues",
        }
      : {
          key: "clicked",
          label: "Clicaram",
          value: null,
          percent: null,
          hint: "Este modelo não conta cliques",
        },
  ];
}

export function lastDaysLabel(days: number | null | undefined): string {
  if (!days || days <= 0) return "nos últimos dias";
  return days === 1 ? "no último dia" : `nos últimos ${days} dias`;
}

/** "−5 por já ter contratado" etc., na ordem da spec; só os que tiraram alguém. */
export function excludedLines(
  excluded: AudienceExclusions | null | undefined,
  filters: AudienceFilters | null | undefined,
): string[] {
  if (!excluded) return [];
  const lines: string[] = [];
  if (excluded.noVacancy > 0) {
    lines.push(
      `${MINUS}${excluded.noVacancy} por ter publicado vaga ${lastDaysLabel(filters?.noVacancyForDays)}`,
    );
  }
  if (excluded.hired > 0)
    lines.push(`${MINUS}${excluded.hired} por já ter contratado`);
  if (excluded.recentlyContacted > 0) {
    lines.push(
      `${MINUS}${excluded.recentlyContacted} por ter recebido campanha ${lastDaysLabel(
        filters?.excludeContactedWithinDays,
      )}`,
    );
  }
  return lines;
}

/** "2026-10-02" → "02/10/2026". */
export function occurrenceLabel(occurrence: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(occurrence ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

/** Linha da última execução na lista das automáticas. */
export function lastRunSummary(
  run: CampaignLastRun | null | undefined,
): string {
  if (!run) return "Ainda não rodou";
  const when = occurrenceLabel(run.occurrence);
  if (run.channel === "PUSH") return `${when} · ${run.sent} enviados (push)`;
  return `${when} · ${run.delivered ?? 0} entregues · ${run.read ?? 0} lidos · ${run.clicked ?? 0} cliques`;
}

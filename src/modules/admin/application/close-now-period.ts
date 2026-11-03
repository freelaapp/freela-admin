import type { AdminInvoiceListItem } from "../infrastructure/billing-api";
import type { DateKey } from "../infrastructure/billing-mode-api";
import { dayLabel } from "./invoice-presentation";

/**
 * O período da fatura extraordinária ("Fechar agora"), com a MESMA regra da API
 * (`planClosing` com `extraordinary`): do dia seguinte ao fim da última fatura
 * que vale (as CANCELADAS não contam; os serviços delas voltam a abertos) até
 * hoje. Sem fatura que valha, começa no 1º serviço ainda sem fatura.
 */
export interface CloseNowPeriod {
  /** Dia seguinte ao fim da última fatura que vale; `null` sem fatura que valha. */
  start: DateKey | null;
  /** Hoje (Brasília): a extraordinária fecha no dia. */
  end: DateKey;
  /** A última fatura que vale (não cancelada), de onde sai o início. */
  lastInvoice: { number: string; periodEnd: DateKey } | null;
  /** Canceladas depois dela: os serviços delas voltam e entram nesta. */
  cancelledAfter: string[];
  /** A última fatura já termina hoje (ou depois): hoje não sai outra. */
  alreadyUpToToday: boolean;
  /**
   * Canceladas que terminam hoje: o banco aceita uma fatura só por empresa e
   * último dia (UNIQUE contractor + period_end, a cancelada conta), então a
   * extraordinária de hoje bate nela (409 ALREADY_CLOSED_TODAY). Só amanhã.
   */
  cancelledEndingToday: string[];
}

type InvoiceLike = Pick<AdminInvoiceListItem, "number" | "status" | "periodEnd">;

/** "2026-10-31" → "2026-11-01" (calendário em UTC, sem fuso). */
export function nextDayKey(key: DateKey): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function closeNowPeriod(invoices: InvoiceLike[], todayKey: DateKey): CloseNowPeriod {
  let last: InvoiceLike | null = null;
  for (const invoice of invoices) {
    if (invoice.status === "CANCELLED") continue;
    if (!last || invoice.periodEnd > last.periodEnd) last = invoice;
  }
  const cancelledAfter = invoices
    .filter((i) => i.status === "CANCELLED" && (!last || i.periodEnd > last.periodEnd))
    .map((i) => i.number);
  return {
    start: last ? nextDayKey(last.periodEnd) : null,
    end: todayKey,
    lastInvoice: last ? { number: last.number, periodEnd: last.periodEnd } : null,
    cancelledAfter,
    alreadyUpToToday: Boolean(last && last.periodEnd >= todayKey),
    cancelledEndingToday: invoices
      .filter((i) => i.status === "CANCELLED" && i.periodEnd >= todayKey)
      .map((i) => i.number),
  };
}

/** Hoje não dá para fechar (a API responderia 409): o diálogo não deixa enviar. */
export function closeNowBlockedToday(period: CloseNowPeriod): boolean {
  return period.alreadyUpToToday || period.cancelledEndingToday.length > 0;
}

/** O texto do período no diálogo: a data, de onde ela vem e o que acontece com as canceladas. */
export function closeNowPeriodText(period: CloseNowPeriod): string[] {
  const lines: string[] = [];
  if (period.cancelledEndingToday.length > 0 && !period.alreadyUpToToday) {
    lines.push(
      `A fatura cancelada ${period.cancelledEndingToday.join(", ")} terminava hoje, ${dayLabel(period.end)}. O sistema guarda uma fatura só por empresa com o mesmo último dia (a cancelada conta), então a fatura de agora não sai hoje: feche amanhã — os serviços dela entram nessa.`,
    );
    return lines;
  }
  if (period.alreadyUpToToday && period.lastInvoice) {
    lines.push(
      `A fatura ${period.lastInvoice.number} já vai até ${dayLabel(period.lastInvoice.periodEnd)}: hoje não sai outra. Os serviços novos entram no próximo fechamento.`,
    );
    return lines;
  }
  if (period.start && period.lastInvoice) {
    lines.push(
      `Período: ${dayLabel(period.start)} até hoje, ${dayLabel(period.end)}. Começa no dia seguinte ao fim da ${period.lastInvoice.number} (${dayLabel(period.lastInvoice.periodEnd)}), a última fatura que vale.`,
    );
  } else {
    lines.push(
      `Período: do 1º serviço ainda sem fatura até hoje, ${dayLabel(period.end)} (a empresa não tem fatura anterior que valha).`,
    );
  }
  if (period.cancelledAfter.length > 0) {
    const many = period.cancelledAfter.length > 1;
    lines.push(
      `${many ? "As faturas" : "A fatura"} ${period.cancelledAfter.join(", ")} ${
        many ? "foram canceladas e não contam: os serviços delas voltam" : "foi cancelada e não conta: os serviços dela voltam"
      } e entram nesta.`,
    );
  }
  return lines;
}

/** Sem a lista de faturas (carregando ou com erro): a regra em palavras. */
export const CLOSE_NOW_PERIOD_RULE =
  "Período: do dia seguinte ao fim da última fatura que vale (as canceladas não contam) até hoje.";

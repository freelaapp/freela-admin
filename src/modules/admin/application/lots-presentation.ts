import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type { AdminLot } from "@/modules/admin/infrastructure/lots-api";

/**
 * Lotes sem a API: qualquer 404 (a chave desligada, `VACANCY_LOTS_DISABLED`, ou a API de antes,
 * que nem tem a rota). Não tenta de novo; a tela mostra "ainda não ligado", nunca erro.
 */
export function isLotsUnavailable(error: unknown): boolean {
  return apiErrorOf(error).status === 404;
}

/** O lote não existe (ou a chave desligou): `404 LOT_NOT_FOUND`. Sem código = API antiga. */
export function isLotNotFound(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "LOT_NOT_FOUND";
}

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * "sáb 14/11" a partir de `AAAA-MM-DD`, só com as partes do texto (sem `Date` local, que
 * deslocaria o dia). O dia da semana vem de `Date.UTC`, que é o mesmo dia civil em qualquer fuso.
 */
export function formatServiceDate(serviceDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(serviceDate ?? "");
  if (!m) return "—";
  const [, y, mo, d] = m;
  const weekday = WEEKDAY[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return `${weekday} ${d}/${mo}`;
}

/** Hoje em Brasília (`AAAA-MM-DD`). */
export function todayInBrasilia(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Amanhã em Brasília (`AAAA-MM-DD`). */
export function tomorrowInBrasilia(now: Date = new Date()): string {
  return new Date(now.getTime() + 21 * 3_600_000).toISOString().slice(0, 10);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "18 vagas · 7 escolhidas · 3 pagas · 11 livres". Só contagem, nunca reais. */
export function lotCountsLine(lot: Pick<AdminLot, "totals">): string {
  const t = lot.totals;
  return [
    plural(t.vacancies, "vaga", "vagas"),
    plural(t.chosen, "escolhida", "escolhidas"),
    plural(t.paid, "paga", "pagas"),
    plural(t.free, "livre", "livres"),
  ].join(" · ");
}

/** A1: "Lote: 12 vagas · 5 escolhidas · 3 pagas". */
export function lotLineText(lot: Pick<AdminLot, "totals">): string {
  const t = lot.totals;
  return `Lote: ${plural(t.vacancies, "vaga", "vagas")} · ${plural(t.chosen, "escolhida", "escolhidas")} · ${plural(t.paid, "paga", "pagas")}`;
}

const ATTENTION_LABEL: Record<string, (lot: Pick<AdminLot, "totals">) => string> = {
  FREE_SOON: (lot) =>
    `Faltam ${lot.totals.free} escolhas e começa em menos de 6 h`,
  UNPAID_SOON: (lot) =>
    `${plural(lot.totals.chosenUnpaid, "escolhido sem pagar", "escolhidos sem pagar")} e começa em menos de 3 h`,
  NO_CANDIDATES: () => "Ninguém se candidatou a alguma função",
};

/** Os motivos de atenção em português (motivo desconhecido da API é ignorado). */
export function attentionReasons(lot: Pick<AdminLot, "totals" | "attention">): string[] {
  return lot.attention.flatMap((code) => {
    const label = ATTENTION_LABEL[code];
    return label ? [label(lot)] : [];
  });
}

/** "começa em 3 h", "começa em 40 min", "já começou". Sem horário: nada. */
export function startsInText(firstStartTime: string | null, now: Date = new Date()): string | null {
  if (!firstStartTime) return null;
  const start = new Date(firstStartTime).getTime();
  if (Number.isNaN(start)) return null;
  const minutes = Math.round((start - now.getTime()) / 60_000);
  if (minutes <= 0) return "já começou";
  if (minutes < 60) return `começa em ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `começa em ${hours} h`;
  return null;
}

const NEXT_STEP_LABEL: Record<string, string> = {
  ALL_CANCELLED: "Todas as vagas foram canceladas.",
  PAST: "O dia já passou.",
  PAY: "Há escolhidos sem pagamento confirmado.",
  CHOOSE: "Faltam escolhas, e há candidatos esperando.",
  NO_CANDIDATES: "Faltam escolhas e ninguém se candidatou ainda.",
  ALL_FILLED: "Todas as vagas estão preenchidas.",
};

/** O que a empresa está vendo, só com contagem (nenhum valor em reais nesta fatia). */
export function companySeesText(lot: Pick<AdminLot, "nextStep" | "totals">): string | null {
  if (!lot.nextStep) return null;
  const base = NEXT_STEP_LABEL[lot.nextStep];
  if (!base) return null;
  const t = lot.totals;
  if (lot.nextStep === "PAY") {
    return `Falta pagar ${plural(t.chosenUnpaid, "escolhido", "escolhidos")}. ${base}`;
  }
  if (lot.nextStep === "CHOOSE") {
    return `Faltam ${plural(t.free, "escolha", "escolhas")}; ${plural(t.candidatesToChoose, "candidato espera", "candidatos esperam")}.`;
  }
  return base;
}

/** Filtros do topo da lista (A2). */
export type LotFilter = "all" | "today" | "tomorrow" | "attention";

export function filterLots(lots: AdminLot[], filter: LotFilter, now: Date = new Date()): AdminLot[] {
  if (filter === "today") return lots.filter((l) => l.serviceDate === todayInBrasilia(now));
  if (filter === "tomorrow") return lots.filter((l) => l.serviceDate === tomorrowInBrasilia(now));
  if (filter === "attention") return lots.filter((l) => attentionReasons(l).length > 0);
  return lots;
}

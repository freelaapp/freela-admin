import type {
  ContractorSegment,
  EngagementStatus,
  FreelancerSegment,
  ModuleKey,
  EngagementPeriod,
  SeriesUnit,
} from "../infrastructure/engagement-api";

/**
 * Formatos e rótulos do engajamento. Funções puras: a tela, o Excel e o PDF
 * usam as mesmas, para o número nunca sair diferente em cada lugar.
 */
export type ValueKind = "int" | "decimal" | "pct" | "hours" | "brl";
export type EngagementSide = "freelancer" | "contractor";

/** Sem dado (ex.: aberturas antes da medição). Nunca mostrar 0 no lugar. */
export const DASH = "—";

const BRT_OFFSET_MS = 3 * 3_600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const ONE = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NEUTRAL = "text-[#737373]";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `brl` recebe CENTAVOS (a API manda `contractedCents`). */
export function formatValue(v: number | null | undefined, kind: ValueKind = "int"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  switch (kind) {
    case "int":
      return INT.format(v);
    case "decimal":
      return DEC.format(v);
    case "pct":
      return `${ONE.format(v)}%`;
    case "hours":
      return v < 1 ? `${INT.format(Math.round(v * 60))} min` : `${ONE.format(v)} h`;
    case "brl":
      return BRL.format(v / 100);
  }
}

/** Variação em % com 1 casa; null quando falta um lado ou o anterior é 0. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** "+12%", "-5%", "0%". Sinal ASCII: o "−" (U+2212) não existe na fonte do PDF. */
export function signedPct(p: number | null): string {
  if (p === null) return DASH;
  const r = Math.round(p);
  const sign = r > 0 ? "+" : r < 0 ? "-" : "";
  return `${sign}${INT.format(Math.abs(r))}%`;
}

export interface DeltaInfo {
  text: string;
  color: string;
}

/**
 * Comparação do cartão, com as mesmas cores do dashboard. `higherIsBetter=false`
 * inverte (ex.: vaga sem candidato). Empate fica neutro.
 */
export function deltaInfo(
  m: { current: number | null; previous: number | null },
  kind: ValueKind,
  higherIsBetter = true,
): DeltaInfo {
  const { current, previous } = m;
  if (current === null || previous === null) return { text: "sem comparação", color: NEUTRAL };
  const prev = `anterior: ${formatValue(previous, kind)}`;
  if (previous === 0) {
    return { text: `${prev} · ${current === 0 ? "sem movimento" : "sem base"}`, color: NEUTRAL };
  }
  if (current === previous) return { text: `${prev} · 0%`, color: NEUTRAL };
  const up = current > previous;
  return {
    text: `${prev} · ${signedPct(pctChange(current, previous))}`,
    color: up === higherIsBetter ? "text-green-500" : "text-red-500",
  };
}

// ─── Rótulos ────────────────────────────────────────────────────────────────

export function statusLabel(status: EngagementStatus, side: EngagementSide): string {
  const fem = side === "contractor";
  switch (status) {
    case "active":
      return fem ? "Ativa" : "Ativo";
    case "cooling":
      return "Esfriando";
    case "stopped":
      return fem ? "Parada" : "Parado";
    case "never":
      return fem ? "Nunca publicou" : "Nunca se candidatou";
  }
}

export const STATUS_BADGE: Record<EngagementStatus, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  cooling: "warning",
  stopped: "destructive",
  never: "muted",
};

export const FREELANCER_SEGMENTS: { id: FreelancerSegment | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "opened_no_apply", label: "Abriram e não se candidataram" },
  { id: "applied", label: "Se candidataram" },
  { id: "active", label: "Ativos" },
  { id: "cooling", label: "Esfriando" },
  { id: "stopped", label: "Parados" },
  { id: "never", label: "Nunca se candidataram" },
];

export const CONTRACTOR_SEGMENTS: { id: ContractorSegment | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "opened_no_publish", label: "Abriram e não publicaram" },
  { id: "published", label: "Publicaram vaga" },
  { id: "active", label: "Ativas" },
  { id: "cooling", label: "Esfriando" },
  { id: "stopped", label: "Paradas" },
  { id: "never", label: "Nunca publicaram" },
];

export const PRODUCT_LABEL: Record<ModuleKey, string> = {
  bars_restaurants: "Empresa",
  home_services: "Casa",
};

export function productsLabel(list: ModuleKey[]): string {
  return list.length ? list.map((p) => PRODUCT_LABEL[p]).join(" + ") : DASH;
}

const CANDIDACY_STATUS: Record<string, string> = {
  PENDING: "Aguardando",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  CANCELLED_BY_CONTRACTOR: "Cancelada pela empresa",
  WITHDRAWN: "Desistiu",
  NOT_SELECTED: "Não selecionado",
};

export function candidacyStatusLabel(status: string): string {
  return CANDIDACY_STATUS[status] ?? status;
}

/** Situação da vaga em uma palavra, olhando primeiro o serviço (job). */
export function vacancySituation(status: string, jobStatus: string | null): string {
  if (jobStatus === "COMPLETED") return "Concluída";
  if (status === "CANCELLED_BY_CONTRACTOR") return "Cancelada pela empresa";
  if (status === "CANCELLED") return "Cancelada";
  if (jobStatus === "IN_PROGRESS") return "Em andamento";
  if (jobStatus === "SCHEDULED") return "Agendada";
  if (jobStatus === "CANCELLED") return "Serviço cancelado";
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Fechada";
  return status;
}

// ─── Datas (Brasília = UTC−3 fixo, como a API) ──────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function toBrasilia(value: string | Date): Date | null {
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isNaN(t) ? null : new Date(t - BRT_OFFSET_MS);
}

/** "DD/MM/AAAA" em Brasília. Um dia puro ("2026-10-07") só é reformatado, sem fuso. */
export function dateBR(value: string | Date | null | undefined): string {
  if (!value) return DASH;
  if (typeof value === "string" && ISO_DAY.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const b = toBrasilia(value);
  if (!b) return DASH;
  return `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}/${b.getUTCFullYear()}`;
}

export function dateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return DASH;
  const b = toBrasilia(value);
  if (!b) return DASH;
  return `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}/${b.getUTCFullYear()} ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

/** Último dia (inclusivo) de uma janela `[start, end)`. */
export function lastDayBR(endIso: string): string {
  return dateBR(new Date(Date.parse(endIso) - 1));
}

/** Dia de Brasília ("YYYY-MM-DD") de um instante ISO; "" se inválido. */
export function brasiliaDayOf(iso: string): string {
  const b = toBrasilia(iso);
  return b ? b.toISOString().slice(0, 10) : "";
}

/** Eixo do gráfico: "05/09" (dia), "sem. 06/07" (semana), "set/26" (mês). */
export function bucketLabel(key: string, unit: SeriesUnit): string {
  const [y, m, d] = key.split("-");
  if (unit === "month") return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
  if (unit === "week") return `sem. ${d}/${m}`;
  return `${d}/${m}`;
}

// ─── Contato e arquivo ──────────────────────────────────────────────────────

/** Link do WhatsApp. Número sem DDI (10–11 dígitos) ganha 55; menos de 10 dígitos não dá link. */
export function waLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

export function fileSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "engajamento";
}

/**
 * Data da VAGA ("dia do serviço"): a API grava à meia-noite UTC do dia, então
 * converter para Brasília voltaria um dia. Lê só a parte "YYYY-MM-DD".
 */
export function vacancyDayBR(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : DASH;
}

/**
 * Aviso de medição (spec §5.1) — regra única da tela, do PDF e do Excel. A
 * janela anterior começa antes da atual, então basta olhar `previousStart`: se
 * ela começa antes de `measuredSince`, algum número de "abriram" fica sem dado.
 */
export function measurementNotice(
  measuredSince: string | null,
  period: Pick<EngagementPeriod, "previousStart">,
): string | null {
  if (!measuredSince) {
    return 'As aberturas do app e do site ainda não estão sendo medidas. Os números de "abriram" aparecem como — (não é zero).';
  }
  if (brasiliaDayOf(period.previousStart) >= measuredSince) return null;
  return `Aberturas medidas desde ${dateBR(measuredSince)}. Antes disso não há medição: os números de "abriram" aparecem como — (não é zero), e a comparação com o período anterior pode ficar sem número.`;
}

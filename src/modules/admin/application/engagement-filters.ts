import type {
  EngagementChannel,
  EngagementFilters,
  EngagementPeriod,
  EngagementPeriodPreset,
  EngagementProduct,
} from "../infrastructure/engagement-api";
import { dateBR, type EngagementSide } from "./engagement-format";

/**
 * Filtros do engajamento e o espelho deles na URL (chaves em português:
 * periodo, de, ate, cidade, uf, produto, canal, aba). Valor inválido na URL
 * cai no padrão: um link velho ou digitado errado nunca quebra a página.
 */

export const PERIOD_PRESETS: { id: EngagementPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

export const PRODUCT_OPTIONS: { id: EngagementProduct; label: string }[] = [
  { id: "all", label: "Empresa + Casa" },
  { id: "bars_restaurants", label: "Só Empresa" },
  { id: "home_services", label: "Só Casa" },
];

export const CHANNEL_OPTIONS: { id: EngagementChannel; label: string }[] = [
  { id: "all", label: "App + site" },
  { id: "app", label: "Só app" },
  { id: "web", label: "Só site" },
];

export const ENGAGEMENT_TABS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "freelancers", label: "Freelancers" },
  { id: "empresas", label: "Empresas" },
  { id: "vagas", label: "Vagas" },
] as const;
export type EngagementTab = (typeof ENGAGEMENT_TABS)[number]["id"];

export function parseEngagementTab(value: string | null | undefined): EngagementTab {
  return ENGAGEMENT_TABS.find((t) => t.id === value)?.id ?? "visao-geral";
}

/** Mesmo teto da API (`MAX_CUSTOM_DAYS`): acima disso ela devolve 400. */
export const MAX_CUSTOM_DAYS = 731;
const DAY_MS = 86_400_000;
const BRT_OFFSET_MS = 3 * 3_600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" de hoje (ou de N dias atrás) em Brasília. */
export function isoDayBrasilia(daysAgo = 0, now: Date = new Date()): string {
  return new Date(now.getTime() - daysAgo * DAY_MS - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Dia que existe no calendário (2026-02-30 não passa). */
export function isValidIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Mês corrente; o personalizado já vem sugerido com os últimos 30 dias. */
export function defaultFilters(now: Date = new Date()): EngagementFilters {
  return {
    period: "this_month",
    from: isoDayBrasilia(29, now),
    to: isoDayBrasilia(0, now),
    city: "",
    uf: "",
    product: "all",
    channel: "all",
  };
}

interface ParamReader {
  get(name: string): string | null;
}

function pick<T extends string>(value: string | null, options: readonly { id: T }[], fallback: T): T {
  return options.find((o) => o.id === value)?.id ?? fallback;
}

export function filtersFromSearchParams(sp: ParamReader, now: Date = new Date()): EngagementFilters {
  const base = defaultFilters(now);
  const de = sp.get("de");
  const ate = sp.get("ate");
  const city = (sp.get("cidade") ?? "").trim().slice(0, 80);
  const uf = (sp.get("uf") ?? "").trim().toUpperCase();
  return {
    period: pick(sp.get("periodo"), PERIOD_PRESETS, base.period),
    from: isValidIsoDay(de) ? de : base.from,
    to: isValidIsoDay(ate) ? ate : base.to,
    city,
    uf: city && /^[A-Z]{2}$/.test(uf) ? uf : "",
    product: pick(sp.get("produto"), PRODUCT_OPTIONS, base.product),
    channel: pick(sp.get("canal"), CHANNEL_OPTIONS, base.channel),
  };
}

/** Só escreve o que foge do padrão (URL curta); `extra` entra no fim (ex.: `aba`). */
export function filtersToSearchParams(
  f: EngagementFilters,
  extra: Record<string, string> = {},
): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.period !== "this_month") sp.set("periodo", f.period);
  if (f.period === "custom") {
    if (f.from) sp.set("de", f.from);
    if (f.to) sp.set("ate", f.to);
  }
  if (f.city) sp.set("cidade", f.city);
  if (f.city && f.uf) sp.set("uf", f.uf);
  if (f.product !== "all") sp.set("produto", f.product);
  if (f.channel !== "all") sp.set("canal", f.channel);
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  return sp;
}

export function withQuery(path: string, sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** O que falta no personalizado, em linguagem simples; null = pode consultar. */
export function customRangeError(f: EngagementFilters): string | null {
  if (f.period !== "custom") return null;
  if (!isValidIsoDay(f.from) || !isValidIsoDay(f.to)) return "Escolha a data inicial e a final.";
  if (f.from > f.to) return "A data inicial precisa ser antes da final.";
  const days = (Date.parse(`${f.to}T00:00:00Z`) - Date.parse(`${f.from}T00:00:00Z`)) / DAY_MS + 1;
  if (days > MAX_CUSTOM_DAYS) return "Escolha um período de até 2 anos.";
  return null;
}

/** Personalizado incompleto não consulta: a API cairia no padrão com o rótulo errado. */
export function isFilterReady(f: EngagementFilters): boolean {
  return customRangeError(f) === null;
}

/** Link da ficha levando os filtros e a aba de volta. */
export function fichaHref(side: EngagementSide, userId: string, f: EngagementFilters): string {
  const seg = side === "freelancer" ? "freelancer" : "empresa";
  const aba = side === "freelancer" ? "freelancers" : "empresas";
  return withQuery(`/engajamento/${seg}/${encodeURIComponent(userId)}`, filtersToSearchParams(f, { aba }));
}

export interface FilterEntry {
  label: string;
  value: string;
}

/** Rótulo do período: o da API quando já chegou; senão o do preset (ou as datas). */
export function periodText(f: EngagementFilters, period?: EngagementPeriod | null): string {
  if (period) return period.label;
  if (f.period === "custom") return `${dateBR(f.from)} a ${dateBR(f.to)}`;
  return PERIOD_PRESETS.find((p) => p.id === f.period)?.label ?? f.period;
}

export function filterEntries(f: EngagementFilters, period?: EngagementPeriod | null): FilterEntry[] {
  return [
    { label: "Período", value: periodText(f, period) },
    { label: "Cidade", value: f.city ? (f.uf ? `${f.city} - ${f.uf}` : f.city) : "Todas" },
    { label: "Produto", value: PRODUCT_OPTIONS.find((o) => o.id === f.product)?.label ?? f.product },
    { label: "Canal", value: CHANNEL_OPTIONS.find((o) => o.id === f.channel)?.label ?? f.channel },
  ];
}

/** "Período: … · Cidade: … · Produto: … · Canal: …" (cabeçalho do PDF, resumo no celular). */
export function describeFilters(f: EngagementFilters, period?: EngagementPeriod | null): string {
  return filterEntries(f, period)
    .map((e) => `${e.label}: ${e.value}`)
    .join(" · ");
}

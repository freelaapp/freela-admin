import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Dashboard de engajamento (spec 2026-10-07 §4–§5). Os tipos espelham
 * `api-freela/src/common/engagement-reports/engagement.types.ts`, com as datas
 * como string ISO (é o que chega pelo JSON). Sem Zod, como os outros *-api.ts.
 */
const engagementApi = createAuthedClient("/v1/admin/engagement");

// ─── Tipos da API ───────────────────────────────────────────────────────────

export type EngagementPeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "custom";
export type EngagementProduct = "all" | "bars_restaurants" | "home_services";
export type EngagementChannel = "all" | "app" | "web";
export type ModuleKey = "bars_restaurants" | "home_services";
export type EngagementStatus = "active" | "cooling" | "stopped" | "never";
export type SeriesUnit = "day" | "week" | "month";
export type FreelancerSegment =
  | "opened_no_apply"
  | "applied"
  | "active"
  | "cooling"
  | "stopped"
  | "never";
export type ContractorSegment =
  | "opened_no_publish"
  | "published"
  | "active"
  | "cooling"
  | "stopped"
  | "never";

/** `null` = sem dado (ex.: aberturas antes de a medição começar). Nunca tratar como 0. */
export interface Metric {
  current: number | null;
  previous: number | null;
  /** Só nos números de vaga (contam linhas de cada produto). */
  byModule?: { barsRestaurants: number; homeServices: number };
}

/** Janela resolvida pela API. `end` e `previousEnd` são exclusivos. */
export interface EngagementPeriod {
  preset: EngagementPeriodPreset;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  label: string;
  previousLabel: string;
}

export interface SeriesPoint {
  /** "YYYY-MM-DD" do começo do balde (dia, semana a partir da segunda, ou mês). */
  bucket: string;
  vacanciesPublished: number;
  vacanciesCompleted: number;
  candidacies: number;
  freelancersOpened: number | null;
  contractorsOpened: number | null;
}

export interface CityRow {
  city: string;
  uf: string | null;
  vacanciesPublished: number;
  candidacies: number;
  avgCandidaciesPerVacancy: number | null;
  /** null = sem medição de aberturas na janela. */
  freelancersOpened: number | null;
}

export interface CityOption {
  city: string;
  uf: string | null;
  label: string;
}

export interface EngagementOverview {
  period: EngagementPeriod;
  /** "YYYY-MM-DD" do 1º dia com aberturas registradas; null = ainda sem medição. */
  measuredSince: string | null;
  openedAvailable: { current: boolean; previous: boolean };
  freelancers: {
    baseTotal: Metric;
    baseWithAccess: Metric;
    baseNew: Metric;
    opened: Metric;
    openedNoApply: Metric;
    applied: Metric;
    candidacies: Metric;
    avgCandidaciesPerApplicant: Metric;
    accepted: Metric;
    completed: Metric;
  };
  contractors: {
    baseTotal: Metric;
    baseNew: Metric;
    opened: Metric;
    openedNoPublish: Metric;
    published: Metric;
    vacancies: Metric;
    completed: Metric;
  };
  vacancies: {
    published: Metric;
    completed: Metric;
    cancelledByContractor: Metric;
    cancelledByAdmin: Metric;
    cancelledBySystem: Metric;
    noCandidate: Metric;
    candidacies: Metric;
    avgCandidaciesPerVacancy: Metric;
    withCandidatePct: Metric;
    medianHoursToFirstCandidacy: Metric;
  };
  series: { unit: SeriesUnit; points: SeriesPoint[] };
  byCity: CityRow[];
  filterOptions: { cities: CityOption[] };
}

export interface FreelancerListRow {
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  products: ModuleKey[];
  hasAccess: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lastCandidacyAt: string | null;
  candidaciesInPeriod: number;
  completedInPeriod: number;
  openedInPeriod: boolean;
  status: EngagementStatus;
}

export interface ContractorListRow {
  userId: string;
  name: string;
  /** Só CNPJ: a API nunca devolve CPF. */
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  products: ModuleKey[];
  hasAccess: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lastVacancyAt: string | null;
  vacanciesInPeriod: number;
  completedInPeriod: number;
  openedInPeriod: boolean;
  status: EngagementStatus;
}

export interface PeriodPair {
  current: number;
  previous: number;
}

export type ChannelDays = Record<"app" | "web" | "other", number>;

export interface FreelancerDetail {
  period: EngagementPeriod;
  summary: {
    userId: string;
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    uf: string | null;
    products: ModuleKey[];
    hasAccess: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    lastCandidacyAt: string | null;
    status: EngagementStatus;
  };
  numbers: {
    candidacies: PeriodPair;
    accepted: PeriodPair;
    completed: PeriodPair;
    activeDays: PeriodPair;
  };
  activeDaysByChannel: ChannelDays;
  candidacies: Array<{
    candidacyId: string;
    vacancyId: string;
    module: ModuleKey;
    companyName: string | null;
    serviceType: string | null;
    title: string | null;
    vacancyDate: string | null;
    status: string;
    createdAt: string;
    completed: boolean;
  }>;
}

export interface ContractorDetail {
  period: EngagementPeriod;
  summary: {
    userId: string;
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    uf: string | null;
    products: ModuleKey[];
    hasAccess: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    lastVacancyAt: string | null;
    status: EngagementStatus;
  };
  numbers: {
    published: PeriodPair;
    completed: PeriodPair;
    cancelled: PeriodPair;
    noCandidate: PeriodPair;
    candidaciesReceived: PeriodPair;
    distinctHired: PeriodPair;
    contractedCents: PeriodPair;
    activeDays: PeriodPair;
    avgCandidaciesPerVacancy: { current: number | null; previous: number | null };
  };
  activeDaysByChannel: ChannelDays;
  vacancies: Array<{
    vacancyId: string;
    module: ModuleKey;
    serviceType: string | null;
    title: string | null;
    vacancyDate: string | null;
    city: string | null;
    createdAt: string;
    status: string;
    jobStatus: string | null;
    candidates: number;
    workerFirstNames: string[];
  }>;
}

// ─── Tipos da tela ──────────────────────────────────────────────────────────

/**
 * Filtros como a tela guarda (e escreve na URL). `city`/`uf` vazios = todas as
 * cidades. `from`/`to` só valem no personalizado.
 */
export interface EngagementFilters {
  period: EngagementPeriodPreset;
  from: string;
  to: string;
  city: string;
  uf: string;
  product: EngagementProduct;
  channel: EngagementChannel;
}

export interface EngagementListParams {
  segment?: string | null;
  search?: string;
  includeNoAccess?: boolean;
  page?: number;
  limit?: number;
  /** Exportação: a API devolve até 20.000 linhas de uma vez (`meta.truncated` se cortou). */
  exportAll?: boolean;
}

export interface ListPage<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  truncated: boolean;
}

interface ListEnvelope<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; truncated: boolean };
}

// ─── Query string ───────────────────────────────────────────────────────────

/** Só manda o que foge do padrão da API (mês corrente, tudo). `from`/`to` só no personalizado. */
export function engagementQuery(f: EngagementFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.period !== "this_month") q.period = f.period;
  if (f.period === "custom") {
    q.from = f.from;
    q.to = f.to;
  }
  if (f.city) q.city = f.city;
  if (f.uf) q.uf = f.uf;
  if (f.product !== "all") q.product = f.product;
  if (f.channel !== "all") q.channel = f.channel;
  return q;
}

/** Fichas: a API só usa o período, então cidade/produto/canal nem vão (e não refazem a consulta). */
export function engagementPeriodQuery(f: EngagementFilters): Record<string, string> {
  return engagementQuery({ ...f, city: "", uf: "", product: "all", channel: "all" });
}

export function engagementListQuery(
  f: EngagementFilters,
  p: EngagementListParams,
): Record<string, string> {
  const q = engagementQuery(f);
  if (p.segment) q.segment = p.segment;
  const search = p.search?.trim();
  if (search) q.search = search;
  if (p.includeNoAccess) q.includeNoAccess = "true";
  if (p.exportAll) {
    q.export = "1";
  } else {
    if (p.page) q.page = String(p.page);
    if (p.limit) q.limit = String(p.limit);
  }
  return q;
}

// ─── Chamadas ───────────────────────────────────────────────────────────────

export async function getEngagementOverview(f: EngagementFilters): Promise<EngagementOverview> {
  const res = await engagementApi.get<{ data: EngagementOverview }>("/overview", {
    params: engagementQuery(f),
  });
  return res.data.data;
}

async function getList<T>(
  path: string,
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<T>> {
  const res = await engagementApi.get<ListEnvelope<T>>(path, { params: engagementListQuery(f, p) });
  const { data, meta } = res.data;
  return { rows: data, total: meta.total, page: meta.page, limit: meta.limit, truncated: meta.truncated };
}

export function listEngagementFreelancers(
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<FreelancerListRow>> {
  return getList<FreelancerListRow>("/freelancers", f, p);
}

export function listEngagementContractors(
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<ContractorListRow>> {
  return getList<ContractorListRow>("/contractors", f, p);
}

export async function getFreelancerEngagement(
  userId: string,
  f: EngagementFilters,
): Promise<FreelancerDetail> {
  const res = await engagementApi.get<{ data: FreelancerDetail }>(
    `/freelancers/${encodeURIComponent(userId)}`,
    { params: engagementPeriodQuery(f) },
  );
  return res.data.data;
}

export async function getContractorEngagement(
  userId: string,
  f: EngagementFilters,
): Promise<ContractorDetail> {
  const res = await engagementApi.get<{ data: ContractorDetail }>(
    `/contractors/${encodeURIComponent(userId)}`,
    { params: engagementPeriodQuery(f) },
  );
  return res.data.data;
}

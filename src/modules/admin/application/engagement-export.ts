import type {
  ChannelDays,
  ContractorDetail,
  ContractorListRow,
  EngagementOverview,
  FreelancerDetail,
  FreelancerListRow,
  ListPage,
} from "../infrastructure/engagement-api";
import type { FilterEntry } from "./engagement-filters";
import {
  DASH,
  PRODUCT_LABEL,
  candidacyStatusLabel,
  dateBR,
  dateTimeBR,
  formatValue,
  pctChange,
  productsLabel,
  signedPct,
  statusLabel,
  vacancySituation,
  waLink,
  type ValueKind,
  vacancyDayBR,
} from "./engagement-format";
import {
  ALL_METRIC_GROUPS,
  CLIENT_REPORT_NUMBERS,
  CONTRACTOR_DETAIL_NUMBERS,
  FREELANCER_DETAIL_NUMBERS,
  SERIES_LINES,
  contractorFunnel,
  freelancerFunnel,
  funnelBars,
  type DetailNumberDef,
  type FunnelStep,
} from "./engagement-metrics";

/**
 * Dados → linhas de planilha e tabelas de PDF (spec §5.2). Funções puras: o
 * código que chama `xlsx`/`jspdf` só desenha o que sai daqui.
 */

/** Número fica número (soma no Excel); null = célula vazia (sem dado, nunca 0). */
export type Cell = string | number | null;

export interface Sheet {
  name: string;
  rows: Cell[][];
}

export interface PdfTable {
  title: string;
  head: string[];
  rows: string[][];
}

const UNIT_SUFFIX: Partial<Record<ValueKind, string>> = { pct: " (%)", hours: " (horas)", brl: " (R$)" };

/** brl chega em centavos; a planilha leva reais. */
function cellValue(v: number | null, kind: ValueKind): Cell {
  if (v === null) return null;
  return kind === "brl" ? v / 100 : v;
}

const yesNo = (b: boolean) => (b ? "Sim" : "Não");

function filtersRows(entries: FilterEntry[], generatedAt: Date, extra: [string, Cell][] = []): Cell[][] {
  return [
    ["Filtro", "Valor"],
    ...entries.map((e): Cell[] => [e.label, e.value]),
    ...extra,
    ["Gerado em", dateTimeBR(generatedAt)],
  ];
}

export function measurementText(o: Pick<EngagementOverview, "measuredSince">): string {
  return o.measuredSince
    ? `Aberturas medidas desde ${dateBR(o.measuredSince)}`
    : "Aberturas ainda sem medição";
}

// ─── Excel do painel ────────────────────────────────────────────────────────

export function overviewSheets(o: EngagementOverview, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const resumo: Cell[][] = [["Grupo", "Indicador", "Atual", "Anterior", "Variação (%)"]];
  for (const g of ALL_METRIC_GROUPS) {
    for (const def of g.metrics) {
      const m = def.pick(o);
      resumo.push([
        g.title,
        `${def.label}${UNIT_SUFFIX[def.kind] ?? ""}`,
        cellValue(m.current, def.kind),
        cellValue(m.previous, def.kind),
        pctChange(m.current, m.previous),
      ]);
    }
  }
  const first = o.series.unit === "day" ? "Dia" : o.series.unit === "week" ? "Semana (início)" : "Mês (início)";
  const serie: Cell[][] = [
    [first, ...SERIES_LINES.map((l) => l.label)],
    ...o.series.points.map((p): Cell[] => [dateBR(p.bucket), ...SERIES_LINES.map((l) => p[l.key])]),
  ];
  const cidades: Cell[][] = [
    ["Cidade", "UF", "Vagas publicadas", "Candidaturas", "Candidaturas por vaga", "Freelancers que abriram"],
    ...o.byCity.map((c): Cell[] => [
      c.city,
      c.uf,
      c.vacanciesPublished,
      c.candidacies,
      c.avgCandidaciesPerVacancy,
      c.freelancersOpened,
    ]),
  ];
  return [
    {
      name: "Filtros",
      rows: filtersRows(entries, generatedAt, [
        ["Comparado com", o.period.previousLabel],
        ["Medição", measurementText(o)],
      ]),
    },
    { name: "Resumo", rows: resumo },
    { name: "Série", rows: serie },
    { name: "Cidades", rows: cidades },
  ];
}

// ─── Excel das listas ───────────────────────────────────────────────────────

function listExtra(segment: string, page: ListPage<unknown>): [string, Cell][] {
  const extra: [string, Cell][] = [
    ["Segmento", segment],
    ["Linhas na lista", page.total],
  ];
  if (page.truncated) {
    extra.push([
      "Atenção",
      `A lista tem ${formatValue(page.total)} linhas; este arquivo traz só as primeiras ${formatValue(page.rows.length)}. Use um filtro mais estreito (cidade, segmento ou período) para ver o resto.`,
    ]);
  }
  return extra;
}

export function freelancerListSheets(
  page: ListPage<FreelancerListRow>,
  entries: FilterEntry[],
  segment: string,
  generatedAt: Date,
): Sheet[] {
  const head: Cell[] = [
    "Nome",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Cidade",
    "UF",
    "Produtos",
    "Status",
    "Última atividade conhecida",
    "Última candidatura",
    "Candidaturas no período",
    "Concluídos no período",
    "Abriu no período",
    "Tem acesso",
    "Cadastro",
  ];
  const rows = page.rows.map((r): Cell[] => [
    r.name,
    r.phone,
    waLink(r.phone),
    r.email,
    r.city,
    r.uf,
    productsLabel(r.products),
    statusLabel(r.status, "freelancer"),
    dateBR(r.lastSeenAt),
    dateBR(r.lastCandidacyAt),
    r.candidaciesInPeriod,
    r.completedInPeriod,
    yesNo(r.openedInPeriod),
    yesNo(r.hasAccess),
    dateBR(r.createdAt),
  ]);
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt, listExtra(segment, page)) },
    { name: "Lista", rows: [head, ...rows] },
  ];
}

export function contractorListSheets(
  page: ListPage<ContractorListRow>,
  entries: FilterEntry[],
  segment: string,
  generatedAt: Date,
): Sheet[] {
  const head: Cell[] = [
    "Empresa",
    "CNPJ",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Cidade",
    "UF",
    "Produtos",
    "Status",
    "Última atividade conhecida",
    "Última vaga",
    "Vagas no período",
    "Concluídas no período",
    "Abriu no período",
    "Tem acesso",
    "Cadastro",
  ];
  const rows = page.rows.map((r): Cell[] => [
    r.name,
    r.document,
    r.phone,
    waLink(r.phone),
    r.email,
    r.city,
    r.uf,
    productsLabel(r.products),
    statusLabel(r.status, "contractor"),
    dateBR(r.lastSeenAt),
    dateBR(r.lastVacancyAt),
    r.vacanciesInPeriod,
    r.completedInPeriod,
    yesNo(r.openedInPeriod),
    yesNo(r.hasAccess),
    dateBR(r.createdAt),
  ]);
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt, listExtra(segment, page)) },
    { name: "Lista", rows: [head, ...rows] },
  ];
}

// ─── Excel das fichas ───────────────────────────────────────────────────────

function numbersRows<D>(defs: DetailNumberDef<D>[], d: D): Cell[][] {
  return [
    ["Indicador", "No período", "Período anterior", "Variação (%)"],
    ...defs.map((def): Cell[] => {
      const p = def.pick(d);
      return [
        `${def.label}${UNIT_SUFFIX[def.kind] ?? ""}`,
        cellValue(p.current, def.kind),
        cellValue(p.previous, def.kind),
        pctChange(p.current, p.previous),
      ];
    }),
  ];
}

function channelRows(c: ChannelDays): Cell[][] {
  return [
    ["Dias em que abriu, por canal", null],
    ["App", c.app],
    ["Site", c.web],
    ["Outros", c.other],
  ];
}

export function freelancerDetailSheets(d: FreelancerDetail, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const s = d.summary;
  const resumo: Cell[][] = [
    ["Campo", "Valor"],
    ["Nome", s.name],
    ["Telefone", s.phone],
    ["WhatsApp", waLink(s.phone)],
    ["E-mail", s.email],
    ["Cidade", s.city],
    ["UF", s.uf],
    ["Produtos", productsLabel(s.products)],
    ["Status", statusLabel(s.status, "freelancer")],
    ["Última atividade conhecida", dateBR(s.lastSeenAt)],
    ["Última candidatura", dateBR(s.lastCandidacyAt)],
    ["Cadastro", dateBR(s.createdAt)],
    ["Tem acesso", yesNo(s.hasAccess)],
    [],
    ...numbersRows(FREELANCER_DETAIL_NUMBERS, d),
    [],
    ...channelRows(d.activeDaysByChannel),
  ];
  const cands: Cell[][] = [
    ["Candidatura em", "Data da vaga", "Empresa", "Cargo", "Produto", "Situação", "Concluiu"],
    ...d.candidacies.map((c): Cell[] => [
      dateBR(c.createdAt),
      vacancyDayBR(c.vacancyDate),
      c.companyName,
      c.title ?? c.serviceType,
      PRODUCT_LABEL[c.module],
      candidacyStatusLabel(c.status),
      yesNo(c.completed),
    ]),
  ];
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt) },
    { name: "Resumo", rows: resumo },
    { name: "Candidaturas", rows: cands },
  ];
}

export function contractorDetailSheets(d: ContractorDetail, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const s = d.summary;
  const resumo: Cell[][] = [
    ["Campo", "Valor"],
    ["Empresa", s.name],
    ["CNPJ", s.document],
    ["Telefone", s.phone],
    ["WhatsApp", waLink(s.phone)],
    ["E-mail", s.email],
    ["Cidade", s.city],
    ["UF", s.uf],
    ["Produtos", productsLabel(s.products)],
    ["Status", statusLabel(s.status, "contractor")],
    ["Última atividade conhecida", dateBR(s.lastSeenAt)],
    ["Última vaga", dateBR(s.lastVacancyAt)],
    ["Cadastro", dateBR(s.createdAt)],
    ["Tem acesso", yesNo(s.hasAccess)],
    [],
    ...numbersRows(CONTRACTOR_DETAIL_NUMBERS, d),
    [],
    ...channelRows(d.activeDaysByChannel),
  ];
  const vagas: Cell[][] = [
    ["Publicada em", "Data da vaga", "Cargo", "Cidade", "Produto", "Candidatos", "Situação", "Quem trabalhou"],
    ...d.vacancies.map((v): Cell[] => [
      dateBR(v.createdAt),
      vacancyDayBR(v.vacancyDate),
      v.title ?? v.serviceType,
      v.city,
      PRODUCT_LABEL[v.module],
      v.candidates,
      vacancySituation(v.status, v.jobStatus),
      v.workerFirstNames.join(", ") || null,
    ]),
  ];
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt) },
    { name: "Resumo", rows: resumo },
    { name: "Vagas", rows: vagas },
  ];
}

// ─── Tabelas do PDF (texto pronto; "—" no lugar de sem dado) ────────────────

export function overviewSummaryTables(o: EngagementOverview): PdfTable[] {
  return ALL_METRIC_GROUPS.map((g) => ({
    title: g.title,
    head: ["Indicador", "Atual", "Anterior", "Variação"],
    rows: g.metrics.map((def) => {
      const m = def.pick(o);
      return [
        def.label,
        formatValue(m.current, def.kind),
        formatValue(m.previous, def.kind),
        signedPct(pctChange(m.current, m.previous)),
      ];
    }),
  }));
}

export function overviewFunnelLines(o: EngagementOverview): { title: string; lines: string[] }[] {
  const toLines = (steps: FunnelStep[]) =>
    funnelBars(steps).map((b) => `${b.label}: ${formatValue(b.value)}${b.share === null ? "" : ` (${b.share}%)`}`);
  return [
    { title: "Funil de freelancers", lines: toLines(freelancerFunnel(o)) },
    { title: "Funil de empresas", lines: toLines(contractorFunnel(o)) },
  ];
}

export function cityTable(o: EngagementOverview, limit = 15): PdfTable {
  return {
    title: "Cidades com mais vagas",
    head: ["Cidade", "Vagas", "Candidaturas", "Cand. por vaga", "Freelas que abriram"],
    rows: o.byCity.slice(0, limit).map((c) => [
      c.uf ? `${c.city} - ${c.uf}` : c.city,
      formatValue(c.vacanciesPublished),
      formatValue(c.candidacies),
      formatValue(c.avgCandidaciesPerVacancy, "decimal"),
      formatValue(c.freelancersOpened),
    ]),
  };
}

/**
 * Relatório para o cliente (spec §5.2): só números e vagas da empresa, com o
 * 1º nome de quem trabalhou. NUNCA telefone, e-mail ou documento: este
 * builder não lê `summary.phone/email/document`.
 */
export function contractorReportTables(d: ContractorDetail): { numbers: PdfTable; vacancies: PdfTable } {
  return {
    numbers: {
      title: "Resumo do período",
      head: ["Indicador", "No período", "Período anterior"],
      rows: CLIENT_REPORT_NUMBERS.map((def) => {
        const p = def.pick(d);
        return [def.label, formatValue(p.current, def.kind), formatValue(p.previous, def.kind)];
      }),
    },
    vacancies: {
      title: "Vagas do período",
      head: ["Data", "Cargo", "Cidade", "Candidatos", "Situação", "Quem trabalhou"],
      rows: d.vacancies.map((v) => [
        v.vacancyDate ? vacancyDayBR(v.vacancyDate) : dateBR(v.createdAt),
        v.title ?? v.serviceType ?? DASH,
        v.city ?? DASH,
        formatValue(v.candidates),
        vacancySituation(v.status, v.jobStatus),
        v.workerFirstNames.length ? v.workerFirstNames.join(", ") : DASH,
      ]),
    },
  };
}

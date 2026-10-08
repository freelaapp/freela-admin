import type { ElementType } from "react";
import {
  Activity,
  Ban,
  Briefcase,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Inbox,
  Percent,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import type {
  ContractorDetail,
  EngagementIndicators,
  EngagementOverview,
  FreelancerDetail,
  Metric,
  SeriesPoint,
} from "../infrastructure/engagement-api";
import { dateBR, formatValue, type ValueKind } from "./engagement-format";

/**
 * Cada número do painel em um lugar só: rótulo, ajuda (spec §3), formato e
 * sentido bom. Tela, Excel e PDF leem daqui. Os cartões ficaram só na aba
 * Vagas; visão geral, freelancers e empresas usam as tabelas de indicadores.
 */
export interface MetricDef {
  key: string;
  label: string;
  help: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  icon: ElementType;
  pick: (o: EngagementOverview) => Metric;
}

// ─── Vagas (§3.3) ───────────────────────────────────────────────────────────

const V_PUBLISHED: MetricDef = {
  key: "vacancies.published",
  label: "Vagas publicadas",
  help: "Vagas criadas no período, sem as excluídas. No Empresa, uma vaga com vários serviços conta como uma.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.vacancies.published,
};
const V_COMPLETED: MetricDef = {
  key: "vacancies.completed",
  label: "Vagas concluídas",
  help: "Serviços concluídos no período, pela data de término (mesma regra do dashboard).",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.vacancies.completed,
};
const V_CANCEL_CONTRACTOR: MetricDef = {
  key: "vacancies.cancelledByContractor",
  label: "Canceladas pela empresa",
  help: "Vagas criadas no período que a própria empresa cancelou.",
  kind: "int",
  higherIsBetter: false,
  icon: CircleX,
  pick: (o) => o.vacancies.cancelledByContractor,
};
const V_CANCEL_ADMIN: MetricDef = {
  key: "vacancies.cancelledByAdmin",
  label: "Canceladas pelo admin",
  help: "Vagas criadas no período que a equipe cancelou pelo painel.",
  kind: "int",
  higherIsBetter: false,
  icon: Ban,
  pick: (o) => o.vacancies.cancelledByAdmin,
};
const V_CANCEL_SYSTEM: MetricDef = {
  key: "vacancies.cancelledBySystem",
  label: "Canceladas pelo sistema",
  help: "Vagas criadas no período canceladas automaticamente, sem registro de cancelamento pelo admin.",
  kind: "int",
  higherIsBetter: false,
  icon: Ban,
  pick: (o) => o.vacancies.cancelledBySystem,
};
const V_NO_CANDIDATE: MetricDef = {
  key: "vacancies.noCandidate",
  label: "Sem candidato",
  help: "Vagas publicadas no período que não receberam nenhuma candidatura.",
  kind: "int",
  higherIsBetter: false,
  icon: Hourglass,
  pick: (o) => o.vacancies.noCandidate,
};
const V_CANDIDACIES: MetricDef = {
  key: "vacancies.candidacies",
  label: "Candidaturas recebidas",
  help: "Candidaturas nas vagas publicadas no período (todas as linhas, mesmo numa vaga com vários serviços).",
  kind: "int",
  higherIsBetter: true,
  icon: Inbox,
  pick: (o) => o.vacancies.candidacies,
};
const V_AVG: MetricDef = {
  key: "vacancies.avgCandidaciesPerVacancy",
  label: "Candidaturas por vaga",
  help: "Candidaturas das vagas publicadas no período divididas pelo número dessas vagas.",
  kind: "decimal",
  higherIsBetter: true,
  icon: Activity,
  pick: (o) => o.vacancies.avgCandidaciesPerVacancy,
};
const V_WITH_CANDIDATE: MetricDef = {
  key: "vacancies.withCandidatePct",
  label: "Vagas com candidato",
  help: "Parte das vagas publicadas no período que recebeu pelo menos uma candidatura.",
  kind: "pct",
  higherIsBetter: true,
  icon: Percent,
  pick: (o) => o.vacancies.withCandidatePct,
};
const V_MEDIAN_HOURS: MetricDef = {
  key: "vacancies.medianHoursToFirstCandidacy",
  label: "Tempo até a 1ª candidatura",
  help: "Mediana do tempo entre publicar a vaga e chegar a primeira candidatura, nas vagas do período que receberam alguma.",
  kind: "hours",
  higherIsBetter: false,
  icon: Clock,
  pick: (o) => o.vacancies.medianHoursToFirstCandidacy,
};

export const VACANCY_METRICS: MetricDef[] = [
  V_PUBLISHED,
  V_COMPLETED,
  V_CANCEL_CONTRACTOR,
  V_CANCEL_ADMIN,
  V_CANCEL_SYSTEM,
  V_NO_CANDIDATE,
  V_CANDIDACIES,
  V_AVG,
  V_WITH_CANDIDATE,
  V_MEDIAN_HOURS,
];

// ─── Indicadores da diretoria (tabelas Contratante e Freelancer) ────────────

export type PeriodSide = "current" | "previous";

/**
 * Uma linha das tabelas de indicadores. Regra do dono: deixar exposto o que é,
 * como se calcula e de onde veio cada valor. `parts` escreve as parcelas da
 * conta ("12 de 40 cadastrados") com os MESMOS campos que a API dividiu.
 */
export interface IndicatorDef {
  key: string;
  label: string;
  /** "Como calcular", em linguagem simples. */
  how: string;
  /** "Fonte": de onde sai o dado, em linguagem simples. */
  source: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  /** Vem do registro de acessos: a fonte ganha "medido desde…" e o null vira "sem medição". */
  measured?: boolean;
  pick: (i: EngagementIndicators) => Metric;
  parts?: (i: EngagementIndicators, side: PeriodSide) => string | null;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const int = (n: number) => formatValue(n);

/** "12 de 40 cadastrados", com "(30%)" no fim quando `pct` vem. */
function share(
  num: Metric,
  den: Metric,
  side: PeriodSide,
  noun: [string, string],
  pct?: Metric,
): string | null {
  const a = num[side];
  const b = den[side];
  if (a === null || b === null) return null;
  const base = `${int(a)} de ${int(b)} ${plural(b, ...noun)}`;
  const p = pct?.[side] ?? null;
  return p === null ? base : `${base} (${formatValue(p, "pct")})`;
}

/** "85 vagas ÷ 30 ativos". */
function division(
  num: Metric,
  den: Metric,
  side: PeriodSide,
  numNoun: [string, string],
  denNoun: [string, string],
): string | null {
  const a = num[side];
  const b = den[side];
  if (a === null || b === null) return null;
  return `${int(a)} ${plural(a, ...numNoun)} ÷ ${int(b)} ${plural(b, ...denNoun)}`;
}

export const CONTRACTOR_INDICATORS: IndicatorDef[] = [
  {
    key: "contractors.signedUp",
    label: "Cadastrou",
    how: "Novos cadastros de contratante no período",
    source: "Cadastros de empresa/contratante, pela data de criação",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.contractors.signedUp,
  },
  {
    key: "contractors.firstVacancyPct",
    label: "Abriu a 1ª vaga",
    how: "% dos cadastrados no período que já abriram ao menos 1 vaga (até hoje)",
    source: "Cadastros do período × vagas abertas por eles (qualquer data)",
    kind: "pct",
    higherIsBetter: true,
    pick: (i) => i.contractors.firstVacancyPct,
    parts: (i, side) =>
      share(i.contractors.firstVacancyCount, i.contractors.signedUp, side, ["cadastrado", "cadastrados"]),
  },
  {
    key: "contractors.medianDaysToFirstVacancy",
    label: "Tempo até a 1ª vaga",
    how: "Mediana dos dias entre o cadastro e a 1ª vaga",
    source: "Data do cadastro e da 1ª vaga de quem já abriu",
    kind: "days",
    higherIsBetter: false,
    pick: (i) => i.contractors.medianDaysToFirstVacancy,
    parts: (i, side) => {
      const n = i.contractors.firstVacancyCount[side];
      return n === null ? null : `entre ${int(n)} ${plural(n, "que abriu", "que abriram")}`;
    },
  },
  {
    key: "contractors.accessed",
    label: "Acessou",
    how: "Quantos entraram no app ou no site no período",
    source: "Registro de acessos",
    kind: "int",
    higherIsBetter: true,
    measured: true,
    pick: (i) => i.contractors.accessed,
  },
  {
    key: "contractors.active",
    label: "Ativo",
    how: "Quantos abriram ao menos 1 vaga no período",
    source: "Vagas abertas no período (data de criação), por contratante",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.contractors.active,
  },
  {
    key: "contractors.vacanciesPerActive",
    label: "Vagas por contratante ativo",
    how: "Vagas abertas ÷ contratantes ativos",
    source: "Vagas abertas no período",
    kind: "ratio",
    higherIsBetter: true,
    pick: (i) => i.contractors.vacanciesPerActive,
    parts: (i, side) =>
      division(i.contractors.vacancies, i.contractors.active, side, ["vaga", "vagas"], ["ativo", "ativos"]),
  },
  {
    key: "contractors.filledPct",
    label: "Vagas preenchidas",
    how: "Das vagas abertas no período, quantas já foram concluídas",
    source: "Vagas abertas no período × serviços concluídos (qualquer data)",
    kind: "pct",
    higherIsBetter: true,
    pick: (i) => i.contractors.filledPct,
    parts: (i, side) => share(i.contractors.completedFromOpened, i.contractors.vacancies, side, ["vaga", "vagas"]),
  },
  {
    key: "contractors.returned",
    label: "Voltou",
    how: "Dos ativos no período anterior, quantos abriram vaga de novo",
    source: "Vagas abertas no período anterior e no atual",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.contractors.returned,
    // No anterior, a base é o período antes dele (a API compara anterior × anterior ao anterior).
    parts: (i, side) =>
      share(
        i.contractors.returned,
        i.contractors.returnedBase,
        side,
        side === "current"
          ? ["ativo do período anterior", "ativos do período anterior"]
          : ["ativo do período antes do anterior", "ativos do período antes do anterior"],
        i.contractors.returnedPct,
      ),
  },
  {
    key: "contractors.grossCents",
    label: "Faturamento",
    how: "Soma do que as empresas pagaram nas vagas concluídas no período",
    source: "Pagamentos confirmados das vagas concluídas no período",
    kind: "brl",
    higherIsBetter: true,
    pick: (i) => i.contractors.grossCents,
  },
  {
    key: "contractors.revenueCents",
    label: "Receita do Freela",
    how: "Soma da taxa que fica com o Freela nessas mesmas vagas (mesma conta da nota fiscal)",
    source: "Taxa de serviço de cada vaga concluída e paga no período",
    kind: "brl",
    higherIsBetter: true,
    pick: (i) => i.contractors.revenueCents,
  },
];

export const FREELANCER_INDICATORS: IndicatorDef[] = [
  {
    key: "freelancers.signedUp",
    label: "Cadastrou",
    how: "Novos cadastros de freelancer no período",
    source: "Cadastros de freelancer, pela data de criação",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.freelancers.signedUp,
  },
  {
    key: "freelancers.active",
    label: "Ativo",
    how: "Quantos se candidataram a ao menos 1 vaga no período",
    source: "Candidaturas feitas no período",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.freelancers.active,
  },
  {
    key: "freelancers.candidaciesPerActive",
    label: "Candidaturas por freela ativo",
    how: "Candidaturas ÷ freelas ativos",
    source: "Candidaturas feitas no período",
    kind: "ratio",
    higherIsBetter: true,
    pick: (i) => i.freelancers.candidaciesPerActive,
    parts: (i, side) =>
      division(
        i.freelancers.candidacies,
        i.freelancers.active,
        side,
        ["candidatura", "candidaturas"],
        ["ativo", "ativos"],
      ),
  },
  {
    key: "freelancers.servicesPerWorker",
    label: "Serviços por freela",
    how: "Serviços concluídos ÷ freelas que trabalharam",
    source: "Serviços concluídos no período",
    kind: "ratio",
    higherIsBetter: true,
    pick: (i) => i.freelancers.servicesPerWorker,
    parts: (i, side) =>
      division(
        i.freelancers.services,
        i.freelancers.worked,
        side,
        ["serviço", "serviços"],
        ["freela que trabalhou", "freelas que trabalharam"],
      ),
  },
  {
    key: "freelancers.appliedNotWorked",
    label: "Candidatou e não trabalhou",
    how: "Ativos que se candidataram e não concluíram nenhum serviço no período",
    source: "Candidaturas × serviços concluídos no período",
    kind: "int",
    higherIsBetter: false,
    pick: (i) => i.freelancers.appliedNotWorked,
    parts: (i, side) =>
      share(
        i.freelancers.appliedNotWorked,
        i.freelancers.active,
        side,
        ["ativo", "ativos"],
        i.freelancers.appliedNotWorkedPct,
      ),
  },
  {
    key: "freelancers.returned",
    label: "Voltou",
    how: "Dos que trabalharam no período anterior, quantos trabalharam de novo",
    source: "Serviços concluídos no período anterior e no atual",
    kind: "int",
    higherIsBetter: true,
    pick: (i) => i.freelancers.returned,
    parts: (i, side) =>
      share(
        i.freelancers.returned,
        i.freelancers.returnedBase,
        side,
        side === "current"
          ? ["que trabalhou antes", "que trabalharam antes"]
          : ["que trabalhou no período antes do anterior", "que trabalharam no período antes do anterior"],
        i.freelancers.returnedPct,
      ),
  },
];

export const INDICATOR_TABLES: { title: string; defs: IndicatorDef[] }[] = [
  { title: "Contratante", defs: CONTRACTOR_INDICATORS },
  { title: "Freelancer", defs: FREELANCER_INDICATORS },
];

/** Sem o bloco `indicators` (API antiga no ar): tela, PDF e Excel avisam com este texto. */
export const INDICATORS_PENDING = "Indicadores atualizando — publique a API";

/** Fonte completa: a de acessos diz desde quando há medição (antes disso, "—"). */
export function indicatorSource(def: IndicatorDef, measuredSince: string | null): string {
  if (!def.measured) return def.source;
  return measuredSince
    ? `${def.source} (medido desde ${dateBR(measuredSince)}; antes disso aparece "—")`
    : `${def.source} (ainda sem medição; aparece "—")`;
}

/** Parcelas de um lado; nos números de acesso, o null vira "sem medição neste período". */
export function indicatorParts(def: IndicatorDef, i: EngagementIndicators, side: PeriodSide): string | null {
  if (def.measured && def.pick(i)[side] === null) return "sem medição neste período";
  return def.parts?.(i, side) ?? null;
}

// ─── Série no tempo (§3.4) ──────────────────────────────────────────────────

export type SeriesKey = Exclude<keyof SeriesPoint, "bucket">;

export const SERIES_LINES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "vacanciesPublished", label: "Vagas publicadas", color: "#eca826" },
  { key: "vacanciesCompleted", label: "Vagas concluídas", color: "#16a34a" },
  { key: "candidacies", label: "Candidaturas", color: "#737373" },
  { key: "freelancersOpened", label: "Freelancers que abriram", color: "#1d1d1b" },
  { key: "contractorsOpened", label: "Empresas que abriram", color: "#dc2626" },
];

// ─── Números das fichas ─────────────────────────────────────────────────────

export interface DetailNumberDef<D> {
  key: string;
  label: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  icon: ElementType;
  pick: (d: D) => { current: number | null; previous: number | null };
}

export const FREELANCER_DETAIL_NUMBERS: DetailNumberDef<FreelancerDetail>[] = [
  { key: "candidacies", label: "Candidaturas", kind: "int", higherIsBetter: true, icon: Inbox, pick: (d) => d.numbers.candidacies },
  { key: "accepted", label: "Candidaturas aceitas", kind: "int", higherIsBetter: true, icon: CircleCheck, pick: (d) => d.numbers.accepted },
  { key: "completed", label: "Serviços concluídos", kind: "int", higherIsBetter: true, icon: Briefcase, pick: (d) => d.numbers.completed },
  { key: "activeDays", label: "Dias em que abriu o app ou site", kind: "int", higherIsBetter: true, icon: Smartphone, pick: (d) => d.numbers.activeDays },
];

export const CONTRACTOR_DETAIL_NUMBERS: DetailNumberDef<ContractorDetail>[] = [
  { key: "published", label: "Vagas publicadas", kind: "int", higherIsBetter: true, icon: Briefcase, pick: (d) => d.numbers.published },
  { key: "completed", label: "Vagas concluídas", kind: "int", higherIsBetter: true, icon: CircleCheck, pick: (d) => d.numbers.completed },
  { key: "cancelled", label: "Vagas canceladas", kind: "int", higherIsBetter: false, icon: CircleX, pick: (d) => d.numbers.cancelled },
  { key: "noCandidate", label: "Vagas sem candidato", kind: "int", higherIsBetter: false, icon: Hourglass, pick: (d) => d.numbers.noCandidate },
  { key: "candidaciesReceived", label: "Candidaturas recebidas", kind: "int", higherIsBetter: true, icon: Inbox, pick: (d) => d.numbers.candidaciesReceived },
  { key: "avgCandidaciesPerVacancy", label: "Candidaturas por vaga", kind: "decimal", higherIsBetter: true, icon: Activity, pick: (d) => d.numbers.avgCandidaciesPerVacancy },
  { key: "distinctHired", label: "Freelancers contratados", kind: "int", higherIsBetter: true, icon: Users, pick: (d) => d.numbers.distinctHired },
  { key: "contractedCents", label: "Valor contratado", kind: "brl", higherIsBetter: true, icon: Wallet, pick: (d) => d.numbers.contractedCents },
  { key: "activeDays", label: "Dias em que abriu o app ou site", kind: "int", higherIsBetter: true, icon: Smartphone, pick: (d) => d.numbers.activeDays },
];

/** Relatório para o cliente: os números da vaga, sem os dias de acesso (uso interno). */
export const CLIENT_REPORT_NUMBERS = CONTRACTOR_DETAIL_NUMBERS.filter((d) => d.key !== "activeDays");

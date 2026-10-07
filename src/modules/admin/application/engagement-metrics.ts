import type { ElementType } from "react";
import {
  Activity,
  Ban,
  Briefcase,
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  EyeOff,
  Hourglass,
  Inbox,
  Percent,
  Send,
  Smartphone,
  Store,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type {
  ContractorDetail,
  EngagementOverview,
  FreelancerDetail,
  Metric,
  SeriesPoint,
} from "../infrastructure/engagement-api";
import type { ValueKind } from "./engagement-format";

/**
 * Cada número do painel em um lugar só: rótulo, ajuda (spec §3), formato e
 * sentido bom. Cartões, Excel e PDF leem daqui.
 */
export interface MetricDef {
  key: string;
  label: string;
  help: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  /** Número de "abriram": "—" antes da medição; a ajuda ganha "Medido desde…". */
  opened?: boolean;
  icon: ElementType;
  pick: (o: EngagementOverview) => Metric;
}

// ─── Freelancers (§3.1) ─────────────────────────────────────────────────────

const F_BASE_TOTAL: MetricDef = {
  key: "freelancers.baseTotal",
  label: "Freelancers na base",
  help: "Cadastrados até o fim do período, contados uma vez mesmo atuando nos dois produtos. Inclui quem nunca ativou a conta (importados).",
  kind: "int",
  higherIsBetter: true,
  icon: Users,
  pick: (o) => o.freelancers.baseTotal,
};
const F_WITH_ACCESS: MetricDef = {
  key: "freelancers.baseWithAccess",
  label: "Com acesso à conta",
  help: "Da base, quantos já ativaram a conta (têm senha, login Google ou Apple). Os outros são contas importadas que nunca entraram.",
  kind: "int",
  higherIsBetter: true,
  icon: UserCheck,
  pick: (o) => o.freelancers.baseWithAccess,
};
const F_NEW: MetricDef = {
  key: "freelancers.baseNew",
  label: "Novos no período",
  help: "Freelancers que se cadastraram dentro do período.",
  kind: "int",
  higherIsBetter: true,
  icon: UserPlus,
  pick: (o) => o.freelancers.baseNew,
};
const F_OPENED: MetricDef = {
  key: "freelancers.opened",
  label: "Abriram o app ou site",
  help: "Freelancers que usaram o app ou o site pelo menos uma vez no período, no canal escolhido.",
  kind: "int",
  higherIsBetter: true,
  opened: true,
  icon: Smartphone,
  pick: (o) => o.freelancers.opened,
};
const F_OPENED_NO_APPLY: MetricDef = {
  key: "freelancers.openedNoApply",
  label: "Abriram e não se candidataram",
  help: "Abriram no período e não fizeram nenhuma candidatura nele. São os mais fáceis de reativar.",
  kind: "int",
  higherIsBetter: false,
  opened: true,
  icon: EyeOff,
  pick: (o) => o.freelancers.openedNoApply,
};
const F_APPLIED: MetricDef = {
  key: "freelancers.applied",
  label: "Se candidataram",
  help: "Freelancers com pelo menos uma candidatura feita no período, em qualquer produto.",
  kind: "int",
  higherIsBetter: true,
  icon: Send,
  pick: (o) => o.freelancers.applied,
};
const F_CANDIDACIES: MetricDef = {
  key: "freelancers.candidacies",
  label: "Candidaturas feitas",
  help: "Total de candidaturas criadas no período pelos freelancers.",
  kind: "int",
  higherIsBetter: true,
  icon: Inbox,
  pick: (o) => o.freelancers.candidacies,
};
const F_AVG: MetricDef = {
  key: "freelancers.avgCandidaciesPerApplicant",
  label: "Candidaturas por freelancer",
  help: "Média de candidaturas de quem se candidatou no período.",
  kind: "decimal",
  higherIsBetter: true,
  icon: Activity,
  pick: (o) => o.freelancers.avgCandidaciesPerApplicant,
};
const F_ACCEPTED: MetricDef = {
  key: "freelancers.accepted",
  label: "Foram aceitos",
  help: "Freelancers com pelo menos uma candidatura aceita no período.",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.freelancers.accepted,
};
const F_COMPLETED: MetricDef = {
  key: "freelancers.completed",
  label: "Concluíram um serviço",
  help: "Freelancers com pelo menos um serviço concluído no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.freelancers.completed,
};

// ─── Empresas (§3.2) ────────────────────────────────────────────────────────

const C_BASE_TOTAL: MetricDef = {
  key: "contractors.baseTotal",
  label: "Empresas na base",
  help: "Contratantes cadastrados até o fim do período, somando os dois produtos (cada um contado uma vez).",
  kind: "int",
  higherIsBetter: true,
  icon: Building2,
  pick: (o) => o.contractors.baseTotal,
};
const C_NEW: MetricDef = {
  key: "contractors.baseNew",
  label: "Novas no período",
  help: "Empresas e contratantes que se cadastraram dentro do período.",
  kind: "int",
  higherIsBetter: true,
  icon: UserPlus,
  pick: (o) => o.contractors.baseNew,
};
const C_OPENED: MetricDef = {
  key: "contractors.opened",
  label: "Abriram o app ou site",
  help: "Empresas que usaram o app ou o site pelo menos uma vez no período, no canal escolhido.",
  kind: "int",
  higherIsBetter: true,
  opened: true,
  icon: Smartphone,
  pick: (o) => o.contractors.opened,
};
const C_OPENED_NO_PUBLISH: MetricDef = {
  key: "contractors.openedNoPublish",
  label: "Abriram e não publicaram",
  help: "Empresas que abriram no período e não criaram nenhuma vaga nele.",
  kind: "int",
  higherIsBetter: false,
  opened: true,
  icon: EyeOff,
  pick: (o) => o.contractors.openedNoPublish,
};
const C_PUBLISHED: MetricDef = {
  key: "contractors.published",
  label: "Publicaram vaga",
  help: "Empresas com pelo menos uma vaga criada no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Store,
  pick: (o) => o.contractors.published,
};
const C_VACANCIES: MetricDef = {
  key: "contractors.vacancies",
  label: "Vagas criadas por elas",
  help: "Total de vagas que as empresas criaram no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.contractors.vacancies,
};
const C_COMPLETED: MetricDef = {
  key: "contractors.completed",
  label: "Concluíram contratação",
  help: "Empresas com pelo menos um serviço concluído no período.",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.contractors.completed,
};

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

export const FREELANCER_METRICS: MetricDef[] = [
  F_BASE_TOTAL,
  F_WITH_ACCESS,
  F_NEW,
  F_OPENED,
  F_OPENED_NO_APPLY,
  F_APPLIED,
  F_CANDIDACIES,
  F_AVG,
  F_ACCEPTED,
  F_COMPLETED,
];

export const CONTRACTOR_METRICS: MetricDef[] = [
  C_BASE_TOTAL,
  C_NEW,
  C_OPENED,
  C_OPENED_NO_PUBLISH,
  C_PUBLISHED,
  C_VACANCIES,
  C_COMPLETED,
];

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

/** Visão geral: os dois lados juntos, então o rótulo diz de quem é o número. */
export const OVERVIEW_HIGHLIGHTS: MetricDef[] = [
  { ...F_OPENED, label: "Freelancers que abriram" },
  F_OPENED_NO_APPLY,
  { ...F_APPLIED, label: "Freelancers que se candidataram" },
  { ...C_OPENED, label: "Empresas que abriram" },
  { ...C_PUBLISHED, label: "Empresas que publicaram vaga" },
  V_PUBLISHED,
  V_COMPLETED,
  V_AVG,
];

export const ALL_METRIC_GROUPS: { title: string; metrics: MetricDef[] }[] = [
  { title: "Freelancers", metrics: FREELANCER_METRICS },
  { title: "Empresas", metrics: CONTRACTOR_METRICS },
  { title: "Vagas", metrics: VACANCY_METRICS },
];

// ─── Série no tempo (§3.4) ──────────────────────────────────────────────────

export type SeriesKey = Exclude<keyof SeriesPoint, "bucket">;

export const SERIES_LINES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "vacanciesPublished", label: "Vagas publicadas", color: "#eca826" },
  { key: "vacanciesCompleted", label: "Vagas concluídas", color: "#16a34a" },
  { key: "candidacies", label: "Candidaturas", color: "#737373" },
  { key: "freelancersOpened", label: "Freelancers que abriram", color: "#1d1d1b" },
  { key: "contractorsOpened", label: "Empresas que abriram", color: "#dc2626" },
];

// ─── Funis ──────────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string;
  value: number | null;
}

export function freelancerFunnel(o: EngagementOverview): FunnelStep[] {
  return [
    { label: "Abriram o app ou site", value: o.freelancers.opened.current },
    { label: "Se candidataram", value: o.freelancers.applied.current },
    { label: "Foram aceitos", value: o.freelancers.accepted.current },
    { label: "Concluíram um serviço", value: o.freelancers.completed.current },
  ];
}

export function contractorFunnel(o: EngagementOverview): FunnelStep[] {
  return [
    { label: "Abriram o app ou site", value: o.contractors.opened.current },
    { label: "Publicaram vaga", value: o.contractors.published.current },
    { label: "Concluíram contratação", value: o.contractors.completed.current },
  ];
}

export interface FunnelBar extends FunnelStep {
  /** 0–100, sobre o maior valor conhecido. */
  width: number;
  /** % sobre o 1º passo; null se o 1º passo não tem número ou é 0. */
  share: number | null;
}

export function funnelBars(steps: FunnelStep[]): FunnelBar[] {
  const max = Math.max(0, ...steps.map((s) => s.value ?? 0));
  const first = steps[0]?.value ?? null;
  return steps.map((s) => ({
    ...s,
    width: s.value === null || max === 0 ? 0 : Math.round((s.value / max) * 100),
    share: s.value === null || first === null || first === 0 ? null : Math.round((s.value / first) * 100),
  }));
}

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

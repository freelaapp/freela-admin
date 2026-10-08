import type {
  ContractorDetail,
  ContractorListRow,
  EngagementIndicators,
  EngagementOverview,
  FreelancerDetail,
  FreelancerListRow,
  Metric,
  SeriesPoint,
} from "../infrastructure/engagement-api";

/**
 * Cenário fixo de setembro/2026 para os testes do engajamento. Os números
 * fecham entre si: 3 vagas (2 Empresa + 1 Casa), 2 com candidato, 2
 * candidaturas (média 0,67), 2 concluídas; a série soma o mesmo.
 * O nome não termina em `.test.ts` de propósito: o Vitest não o roda.
 */
const m = (current: number | null, previous: number | null): Metric => ({ current, previous });
const split = (current: number, previous: number, bars: number, casa: number): Metric => ({
  current,
  previous,
  byModule: { barsRestaurants: bars, homeServices: casa },
});

const SEPT_POINTS: SeriesPoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  return {
    bucket: `2026-09-${String(day).padStart(2, "0")}`,
    vacanciesPublished: day === 5 ? 2 : day === 12 ? 1 : 0,
    vacanciesCompleted: day === 6 || day === 13 ? 1 : 0,
    candidacies: day === 5 || day === 12 ? 1 : 0,
    freelancersOpened: day === 5 ? 3 : day === 12 ? 2 : 0,
    contractorsOpened: day === 5 ? 2 : day === 12 ? 1 : 0,
  };
});

/**
 * Indicadores da diretoria no mesmo mês. Cada %/razão é a divisão das parcelas
 * (como a API faz): 2 de 5 cadastrados = 40%; 3 vagas ÷ 2 ativos = 1,5;
 * 2 de 3 vagas = 66,7%; 3 serviços ÷ 2 freelas = 1,5; 1 de 2 ativos = 50%.
 * O anterior tem "voltou" com base 2 e nenhum retorno (0%), e "sem base" onde é 0.
 */
const SAMPLE_INDICATORS: EngagementIndicators = {
  contractors: {
    signedUp: m(5, 3),
    firstVacancyCount: m(2, 1),
    firstVacancyPct: m(40, 33.3),
    medianDaysToFirstVacancy: m(4.5, 2),
    accessed: m(3, 2),
    active: m(2, 1),
    vacancies: m(3, 1),
    vacanciesPerActive: m(1.5, 1),
    completedFromOpened: m(2, 1),
    filledPct: m(66.7, 100),
    returned: m(1, 0),
    returnedBase: m(1, 2),
    returnedPct: m(100, 0),
    grossCents: m(36000, 18000),
    revenueCents: m(7200, 3600),
  },
  freelancers: {
    signedUp: m(1250, 12),
    active: m(2, 1),
    candidacies: m(2, 1),
    candidaciesPerActive: m(1, 1),
    worked: m(2, 1),
    services: m(3, 1),
    servicesPerWorker: m(1.5, 1),
    appliedNotWorked: m(1, 0),
    appliedNotWorkedPct: m(50, 0),
    returned: m(1, 0),
    returnedBase: m(1, 0),
    returnedPct: m(100, null),
  },
};

export const SAMPLE_OVERVIEW: EngagementOverview = {
  period: {
    preset: "custom",
    start: "2026-09-01T03:00:00.000Z",
    end: "2026-10-01T03:00:00.000Z",
    previousStart: "2026-08-02T03:00:00.000Z",
    previousEnd: "2026-09-01T03:00:00.000Z",
    label: "01/09/2026 a 30/09/2026",
    previousLabel: "02/08/2026 a 31/08/2026",
  },
  measuredSince: "2026-07-20",
  openedAvailable: { current: true, previous: true },
  freelancers: {
    baseTotal: m(150210, 150190),
    baseWithAccess: m(412, 398),
    baseNew: m(20, 12),
    opened: m(4, 3),
    openedNoApply: m(2, 2),
    applied: m(2, 1),
    candidacies: m(2, 1),
    avgCandidaciesPerApplicant: m(1, 1),
    accepted: m(2, 1),
    completed: m(2, 1),
  },
  contractors: {
    baseTotal: m(820, 815),
    baseNew: m(5, 3),
    opened: m(3, 2),
    openedNoPublish: m(1, 1),
    published: m(2, 1),
    vacancies: m(3, 1),
    completed: m(2, 1),
  },
  vacancies: {
    published: split(3, 1, 2, 1),
    completed: split(2, 1, 2, 0),
    cancelledByContractor: split(1, 0, 1, 0),
    cancelledByAdmin: split(0, 0, 0, 0),
    cancelledBySystem: split(0, 1, 0, 0),
    noCandidate: split(1, 0, 0, 1),
    candidacies: split(2, 1, 2, 0),
    avgCandidaciesPerVacancy: m(0.67, 1),
    withCandidatePct: m(66.7, 100),
    medianHoursToFirstCandidacy: m(15, 4),
  },
  series: { unit: "day", points: SEPT_POINTS },
  byCity: [
    {
      city: "Juiz de Fora",
      uf: "MG",
      vacanciesPublished: 3,
      candidacies: 2,
      avgCandidaciesPerVacancy: 0.67,
      freelancersOpened: 4,
    },
  ],
  filterOptions: {
    cities: [
      { city: "Juiz de Fora", uf: "MG", label: "Juiz de Fora - MG" },
      { city: "Gramado", uf: "RS", label: "Gramado - RS" },
    ],
  },
  indicators: SAMPLE_INDICATORS,
};

/** API antiga no ar (sem o bloco `indicators`): a tela avisa em vez de quebrar. */
export const SAMPLE_OVERVIEW_WITHOUT_INDICATORS: EngagementOverview = {
  ...SAMPLE_OVERVIEW,
  indicators: undefined,
};

/** O mesmo mês visto com a medição começando só em 07/10/2026: "abriram" = null. */
export const SAMPLE_OVERVIEW_BEFORE_MEASUREMENT: EngagementOverview = {
  ...SAMPLE_OVERVIEW,
  measuredSince: "2026-10-07",
  openedAvailable: { current: false, previous: false },
  freelancers: { ...SAMPLE_OVERVIEW.freelancers, opened: m(null, null), openedNoApply: m(null, null) },
  contractors: { ...SAMPLE_OVERVIEW.contractors, opened: m(null, null), openedNoPublish: m(null, null) },
  series: {
    unit: "day",
    points: SEPT_POINTS.map((p) => ({ ...p, freelancersOpened: null, contractorsOpened: null })),
  },
  byCity: SAMPLE_OVERVIEW.byCity.map((c) => ({ ...c, freelancersOpened: null })),
  indicators: {
    ...SAMPLE_INDICATORS,
    contractors: { ...SAMPLE_INDICATORS.contractors, accessed: m(null, null) },
  },
};

export const SAMPLE_FREELANCER_ROW: FreelancerListRow = {
  userId: "u-f1",
  name: "Ana Souza",
  phone: "(32) 99876-5432",
  email: "ana@exemplo.com",
  city: "Juiz de Fora",
  uf: "MG",
  products: ["bars_restaurants"],
  hasAccess: true,
  createdAt: "2026-05-24T13:00:00.000Z",
  lastSeenAt: "2026-09-28T15:00:00.000Z",
  lastCandidacyAt: "2026-09-20T12:00:00.000Z",
  candidaciesInPeriod: 2,
  completedInPeriod: 1,
  openedInPeriod: true,
  status: "cooling",
};

export const SAMPLE_CONTRACTOR_ROW: ContractorListRow = {
  userId: "u-c1",
  name: "Bar do Zé",
  document: "12.345.678/0001-90",
  phone: "(32) 3215-0000",
  email: "contato@bardoze.com.br",
  city: "Juiz de Fora",
  uf: "MG",
  products: ["bars_restaurants"],
  hasAccess: true,
  createdAt: "2026-03-10T13:00:00.000Z",
  lastSeenAt: "2026-09-30T20:00:00.000Z",
  lastVacancyAt: "2026-09-12T14:00:00.000Z",
  vacanciesInPeriod: 3,
  completedInPeriod: 2,
  openedInPeriod: true,
  status: "cooling",
};

export const SAMPLE_FREELANCER_DETAIL: FreelancerDetail = {
  period: SAMPLE_OVERVIEW.period,
  summary: {
    userId: "u-f1",
    name: "Ana Souza",
    phone: "(32) 99876-5432",
    email: "ana@exemplo.com",
    city: "Juiz de Fora",
    uf: "MG",
    products: ["bars_restaurants"],
    hasAccess: true,
    createdAt: "2026-05-24T13:00:00.000Z",
    lastSeenAt: "2026-09-28T15:00:00.000Z",
    lastCandidacyAt: "2026-09-20T12:00:00.000Z",
    status: "cooling",
  },
  numbers: {
    candidacies: { current: 2, previous: 1 },
    accepted: { current: 1, previous: 0 },
    completed: { current: 1, previous: 0 },
    activeDays: { current: 5, previous: 2 },
  },
  activeDaysByChannel: { app: 4, web: 1, other: 0 },
  candidacies: [
    {
      candidacyId: "cd-1",
      vacancyId: "v-1",
      module: "bars_restaurants",
      companyName: "Bar do Zé",
      serviceType: "Garçom",
      title: "Garçom para sábado",
      vacancyDate: "2026-09-06T00:00:00.000Z",
      status: "ACCEPTED",
      createdAt: "2026-09-05T14:00:00.000Z",
      completed: true,
    },
    {
      candidacyId: "cd-2",
      vacancyId: "v-2",
      module: "bars_restaurants",
      companyName: "Bar do Zé",
      serviceType: "Garçom",
      title: null,
      vacancyDate: "2026-09-13T00:00:00.000Z",
      status: "NOT_SELECTED",
      createdAt: "2026-09-12T15:00:00.000Z",
      completed: false,
    },
  ],
};

export const SAMPLE_CONTRACTOR_DETAIL: ContractorDetail = {
  period: SAMPLE_OVERVIEW.period,
  summary: {
    userId: "u-c1",
    name: "Bar do Zé",
    document: "12.345.678/0001-90",
    phone: "(32) 3215-0000",
    email: "contato@bardoze.com.br",
    city: "Juiz de Fora",
    uf: "MG",
    products: ["bars_restaurants"],
    hasAccess: true,
    createdAt: "2026-03-10T13:00:00.000Z",
    lastSeenAt: "2026-09-30T20:00:00.000Z",
    lastVacancyAt: "2026-09-12T14:00:00.000Z",
    status: "cooling",
  },
  numbers: {
    published: { current: 3, previous: 1 },
    completed: { current: 2, previous: 1 },
    cancelled: { current: 1, previous: 0 },
    noCandidate: { current: 1, previous: 0 },
    candidaciesReceived: { current: 2, previous: 1 },
    distinctHired: { current: 2, previous: 1 },
    contractedCents: { current: 36000, previous: 18000 },
    activeDays: { current: 6, previous: 3 },
    avgCandidaciesPerVacancy: { current: 0.67, previous: 1 },
  },
  activeDaysByChannel: { app: 2, web: 4, other: 0 },
  vacancies: [
    {
      vacancyId: "v-1",
      module: "bars_restaurants",
      serviceType: "Garçom",
      title: "Garçom para sábado",
      vacancyDate: "2026-09-06T00:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-05T13:00:00.000Z",
      status: "CLOSED",
      jobStatus: "COMPLETED",
      candidates: 1,
      workerFirstNames: ["Ana"],
    },
    {
      vacancyId: "v-2",
      module: "bars_restaurants",
      serviceType: "Cozinheiro",
      title: null,
      vacancyDate: "2026-09-13T00:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-12T13:00:00.000Z",
      status: "CLOSED",
      jobStatus: "COMPLETED",
      candidates: 1,
      workerFirstNames: ["Bruno"],
    },
    {
      vacancyId: "v-3",
      module: "bars_restaurants",
      serviceType: "Barman",
      title: null,
      vacancyDate: "2026-09-20T00:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-12T14:00:00.000Z",
      status: "CANCELLED_BY_CONTRACTOR",
      jobStatus: null,
      candidates: 0,
      workerFirstNames: [],
    },
  ],
};

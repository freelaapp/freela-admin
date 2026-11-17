import { isAxiosError } from "axios";
import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AdminMetricsPeriodPreset } from "./admin-api";

/**
 * Dashboard novo (spec "Freela Admin — Especificação do novo Dashboard", 16/11/2026). Duas rotas
 * da API (`get-admin-dashboard.handler.ts` e `get-admin-vacancy-stages.handler.ts`):
 * - `GET /v1/bars-restaurants/admin/dashboard?period=&from=&to=`: totais desde o início,
 *   indicadores do período e Top 10;
 * - `GET /v1/bars-restaurants/admin/dashboard/vacancy-stages?scope=today|upcoming`: S1–S7.
 *
 * Toda conta (razão, média, variação, etapa da vaga) vem pronta da API; a tela só formata.
 * A resposta é validada com Zod na fronteira, bloco a bloco: um indicador ausente ou malformado
 * vira `undefined` (o card mostra "—") e não derruba o resto. API sem as rotas (404) vira
 * `DashboardUnavailableError`, para a tela avisar sem tentar de novo.
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

/** A API no ar ainda não tem as rotas do dashboard novo (janela de deploy). */
export class DashboardUnavailableError extends Error {
  constructor() {
    super("O dashboard novo ainda não está disponível nesta versão da API.");
    this.name = "DashboardUnavailableError";
  }
}

const count = z.number().finite();
const nullableNumber = z.number().finite().nullable();

const changeSchema = z
  .object({ absolute: count, percent: nullableNumber })
  .nullable();

const ratioSchema = z.object({
  /** numerador / denominador (fração, não percentual); `null` sem denominador. */
  value: nullableNumber,
  numerator: count,
  denominator: count,
});

const ratingSchema = z.object({
  average: nullableNumber,
  count: count,
  smallSample: z.boolean(),
});

const countIndicatorSchema = z.object({
  current: count,
  previous: count,
  change: changeSchema,
});

const shareIndicatorSchema = countIndicatorSchema.extend({
  shareOfCreated: z.object({ current: ratioSchema, previous: ratioSchema }),
});

const ratioIndicatorSchema = z.object({
  current: ratioSchema,
  previous: ratioSchema,
  change: changeSchema,
});

const ratingIndicatorSchema = z.object({
  current: ratingSchema,
  previous: ratingSchema,
  change: changeSchema,
});

/** Bloco opcional: ausente ou malformado vira `undefined` sem derrubar o resto. */
const optional = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);

const periodSchema = z.object({
  preset: z.string(),
  start: z.string(),
  end: z.string(),
  previousStart: z.string(),
  previousEnd: z.string(),
  label: z.string(),
  previousLabel: z.string(),
});

const topContractorSchema = z.object({
  position: count,
  contractorUserId: z.string(),
  name: z.string().nullable(),
  city: z.string().nullable(),
  uf: z.string().nullable().optional().transform((v) => v ?? null),
  vacanciesCreated: count,
  vacanciesCompleted: count,
  hiresCompleted: count,
  amountCents: count,
});

const dashboardSchema = z.object({
  generatedAt: z.string(),
  period: optional(periodSchema),
  exclusions: optional(z.object({ excludedAccounts: count, qaServiceType: z.string() })),
  totals: z
    .object({
      freelancers: optional(count),
      contractors: optional(count),
      platformRevenueCents: optional(count),
    })
    .catch({}),
  indicators: z
    .object({
      freelancerSignups: optional(countIndicatorSchema),
      contractorSignups: optional(countIndicatorSchema),
      vacanciesCreated: optional(countIndicatorSchema),
      vacanciesCompleted: optional(shareIndicatorSchema),
      vacanciesEndedWithoutProvider: optional(shareIndicatorSchema),
      hiresPerContractor: optional(ratioIndicatorSchema),
      contractorActivation: optional(ratioIndicatorSchema),
      freelancerActivation: optional(ratioIndicatorSchema),
      candidatesPerVacancy: optional(ratioIndicatorSchema),
      platformRating: optional(ratingIndicatorSchema),
      freelancerRating: optional(ratingIndicatorSchema),
      contractorRating: optional(ratingIndicatorSchema),
    })
    .catch({}),
  topContractors: optional(z.array(topContractorSchema)),
});

export type DashboardChange = z.infer<typeof changeSchema>;
export type DashboardRatio = z.infer<typeof ratioSchema>;
export type DashboardRating = z.infer<typeof ratingSchema>;
export type DashboardCountIndicator = z.infer<typeof countIndicatorSchema>;
export type DashboardShareIndicator = z.infer<typeof shareIndicatorSchema>;
export type DashboardRatioIndicator = z.infer<typeof ratioIndicatorSchema>;
export type DashboardRatingIndicator = z.infer<typeof ratingIndicatorSchema>;
export type DashboardPeriod = z.infer<typeof periodSchema>;
export type DashboardTopContractor = z.infer<typeof topContractorSchema>;
export type AdminDashboard = z.infer<typeof dashboardSchema>;
export type DashboardIndicators = AdminDashboard["indicators"];

export interface AdminDashboardParams {
  period?: AdminMetricsPeriodPreset;
  /** Só com `period=custom`: YYYY-MM-DD (Brasília), `to` inclusivo. */
  from?: string;
  to?: string;
}

function unavailableOr(error: unknown): never {
  if (isAxiosError(error) && error.response?.status === 404) throw new DashboardUnavailableError();
  throw error;
}

export async function getAdminDashboard(params: AdminDashboardParams = {}): Promise<AdminDashboard> {
  const custom = params.period === "custom";
  try {
    const res = await adminApi.get("/dashboard", {
      params: {
        ...(params.period ? { period: params.period } : {}),
        ...(custom && params.from ? { from: params.from } : {}),
        ...(custom && params.to ? { to: params.to } : {}),
      },
    });
    return dashboardSchema.parse(res.data?.data);
  } catch (error) {
    return unavailableOr(error);
  }
}

// ─── Status das vagas (S1–S7) ───────────────────────────────────────────────

export type VacancyStagesScope = "today" | "upcoming";
export const VACANCY_STAGE_KEYS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7"] as const;
export type VacancyStageKey = (typeof VACANCY_STAGE_KEYS)[number];

const stageVacancySchema = z.object({
  id: z.string(),
  module: z.string(),
  title: z.string(),
  serviceType: z.string(),
  contractorName: z.string().nullable(),
  city: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  stage: z.string(),
  alert: z.boolean(),
});

const stageSummarySchema = z.object({
  count: count,
  alerts: count,
  vacancies: z.array(stageVacancySchema).catch([]),
  truncated: z.boolean().catch(false),
});

const vacancyStagesSchema = z.object({
  generatedAt: z.string(),
  scope: z.string(),
  dayStart: z.string(),
  dayEnd: z.string().nullable(),
  stages: z.object({
    S1: optional(stageSummarySchema),
    S2: optional(stageSummarySchema),
    S3: optional(stageSummarySchema),
    S4: optional(stageSummarySchema),
    S5: optional(stageSummarySchema),
    S6: optional(stageSummarySchema),
    S7: optional(stageSummarySchema),
  }),
});

export type StageVacancy = z.infer<typeof stageVacancySchema>;
export type StageSummary = z.infer<typeof stageSummarySchema>;
export type VacancyStages = z.infer<typeof vacancyStagesSchema>;

export async function getVacancyStages(scope: VacancyStagesScope): Promise<VacancyStages> {
  try {
    const res = await adminApi.get("/dashboard/vacancy-stages", { params: { scope } });
    return vacancyStagesSchema.parse(res.data?.data);
  } catch (error) {
    return unavailableOr(error);
  }
}

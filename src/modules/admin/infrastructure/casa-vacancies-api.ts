import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AdminCancelVacancyResult, FeedbackItem, RefundType } from "./admin-api";

// Vagas do Freela em Casa vivem sob /v1/home-services/admin (base distinta da de
// bares-restaurantes usada por `adminApi`). Mesma env + mesmo esquema de token.
const casaAdminApi = createAuthedClient("/v1/home-services/admin");

export interface CasaVacancyItem {
  id: string;
  contractorId: string;
  title: string;
  description: string | null;
  serviceType: string;
  date: string;
  startTime: string;
  endTime: string;
  payment: number;
  address: string | null;
  cityId: string | null;
  status: string;
  createdAt: string;
  contractorName: string | null;
  contractorCompanyName: string | null;
  freelancerAmountInCents: number | null;
  platformFeeInCents: number | null;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
}

export async function getAdminCasaOpenVacancies(consultantId?: string): Promise<CasaVacancyItem[]> {
  const res = await casaAdminApi.get("/open-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminCasaClosedVacancies(
  consultantId?: string,
): Promise<CasaVacancyItem[]> {
  const res = await casaAdminApi.get("/closed-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminCasaCancelledVacancies(
  consultantId?: string,
): Promise<CasaVacancyItem[]> {
  const res = await casaAdminApi.get("/cancelled-vacancies", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

export async function getAdminCasaAllVacancies(consultantId?: string): Promise<CasaVacancyItem[]> {
  // Canceladas eram invisíveis (só open+closed); API antiga sem o endpoint
  // novo devolve 404 → degrada para [].
  const [open, closed, cancelled] = await Promise.all([
    getAdminCasaOpenVacancies(consultantId),
    getAdminCasaClosedVacancies(consultantId),
    getAdminCasaCancelledVacancies(consultantId).catch(() => []),
  ]);
  return [...open, ...closed, ...cancelled];
}

// ─── Feedbacks (Casa) ───────────────────────────────────────────────────────
// Mesmo shape do FeedbackItem do BR (campos author*/target* null-safe).

export async function getCasaAdminFeedbacks(): Promise<FeedbackItem[]> {
  const res = await casaAdminApi.get("/feedbacks");
  return res.data.data;
}

// ─── Cancelar vaga (Casa) ───────────────────────────────────────────────────
// Espelha `adminCancelVacancy` do BR, mas na base /v1/home-services/admin.

/**
 * Cancela uma vaga do Freela em Casa. Quando `refundType` é informado, força o
 * estorno escolhido (NONE = sem estorno); omitido, o backend aplica a regra
 * legada por tempo.
 */
export async function adminCancelCasaVacancy(
  vacancyId: string,
  reason: string,
  refundType?: RefundType,
): Promise<AdminCancelVacancyResult> {
  const res = await casaAdminApi.post(`/vacancies/${vacancyId}/cancel`, {
    reason,
    ...(refundType ? { refundType } : {}),
  });
  return res.data.data;
}

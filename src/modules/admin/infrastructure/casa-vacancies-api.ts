import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AdminCreateVacancyInput, AdminCreatedVacancy } from "./admin-vacancies-api";
import type {
  AdminCancelVacancyResult,
  AdminConfirmCandidacyResult,
  AdminReinstateCandidacyResult,
  AdminRemoveCandidacyResult,
  AdminRestartVacancyResult,
  FeedbackItem,
  RefundType,
  VacancyCandidacyItem,
  VacancyFeedbacksResponse,
} from "./admin-api";

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
  /** Taxa fixa. Soma com a percentual na NOSSA receita. Opcional na janela de
   *  deploy da API. */
  fixedFeeInCents?: number | null;
  /** Rótulo da faixa (vaga TIERED). Quando presente, endTime é placeholder —
   * exibir "Chegada: HH:MM" + faixa. Opcional durante deploy da API. */
  pricingTierLabel?: string | null;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
  /**
   * Campos de ETAPA do funil, iguais aos de Empresa. Opcionais porque a API
   * em produção pode ainda não tê-los durante a janela de deploy — sem eles a
   * vaga cai em "aberta", que é o comportamento antigo.
   */
  candidacyCount?: number;
  providerName?: string | null;
  job?: {
    id: string;
    status: string;
    hasContractorFeedback?: boolean;
    hasProviderFeedback?: boolean;
  } | null;
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

// ─── Paridade com Empresa ───────────────────────────────────────────────────
//
// As rotas abaixo JÁ EXISTIAM em `/v1/home-services/admin` desde antes desta
// tela — o painel do Casa simplesmente não as chamava. São as mesmas do BR, com
// o mesmo formato de resposta, então reusamos os tipos de `admin-api` em vez de
// declarar gêmeos que podem divergir.

/** Candidaturas da vaga, com dados do freelancer e estado da confirmação. */
export async function getCasaVacancyCandidacies(
  vacancyId: string,
): Promise<VacancyCandidacyItem[]> {
  const res = await casaAdminApi.get(`/vacancies/${vacancyId}/candidacies`);
  return res.data.data;
}

/** Avaliações cruzadas da vaga (contratante ↔ freelancer). */
export async function getCasaVacancyFeedbacks(
  vacancyId: string,
): Promise<VacancyFeedbacksResponse> {
  const res = await casaAdminApi.get(`/vacancies/${vacancyId}/feedbacks`);
  return res.data.data;
}

/** Confirma a presença pelo admin, quando o freelancer não confirmou no link. */
export async function adminConfirmCasaCandidacy(
  candidacyId: string,
): Promise<AdminConfirmCandidacyResult> {
  const res = await casaAdminApi.post(`/candidacies/${candidacyId}/confirm`);
  return res.data.data;
}

/** Reabre a vaga do zero (no-show): tira o aceito, reseta job/check-ins, mantém o valor. */
export async function adminRestartCasaVacancy(
  vacancyId: string,
  reason: string,
): Promise<AdminRestartVacancyResult> {
  const res = await casaAdminApi.post(`/vacancies/${vacancyId}/restart`, { reason });
  return res.data.data;
}

/** Desvincula o freelancer da vaga sem cancelá-la. */
export async function adminRemoveCasaCandidacy(
  vacancyId: string,
  candidacyId: string,
  reason?: string,
): Promise<AdminRemoveCandidacyResult> {
  const res = await casaAdminApi.post(
    `/vacancies/${vacancyId}/candidacies/${candidacyId}/remove`,
    reason ? { reason } : {},
  );
  return res.data.data;
}

/** Recoloca na vaga quem foi desalocado por não confirmar. Ver o gêmeo em `admin-api`. */
export async function adminReinstateCasaCandidacy(
  candidacyId: string,
): Promise<AdminReinstateCandidacyResult> {
  const res = await casaAdminApi.post(`/candidacies/${candidacyId}/reinstate`);
  return res.data.data;
}

/**
 * Abre uma vaga do Freela em Casa em nome de um contratante.
 *
 * MESMO payload de Empresa (`AdminCreateVacancyInput`) — os dois DTOs do backend
 * são espelhos, e um tipo gêmeo aqui só criaria chance de divergir. O que muda é
 * a base da rota e, na tela, o filtro de módulo do catálogo.
 */
export async function adminCreateCasaVacancy(
  input: AdminCreateVacancyInput,
): Promise<AdminCreatedVacancy> {
  const res = await casaAdminApi.post("/vacancies", input);
  return res.data.data;
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Relatos de problema com a vaga (F6) + encerrar mais cedo com pagamento parcial.
 *
 * O contratante abre o relato no app/web (`POST /v1/jobs/:id/issue-reports`); o
 * SUPORTE lê a fila aqui e decide: encerrar mais cedo com pagamento parcial
 * (endpoint próprio, na base de vagas), arquivar o relato, ou usar as ações que
 * já existiam (finalizar cheio / cancelar + estornar). Nada de dinheiro mora na
 * rota de relatos — só leitura e arquivamento; o parcial mora em
 * `/v1/admins/vacancies/:id/early-finalize-partial` e fica atrás da flag
 * `EARLY_FINALIZE_PARTIAL_ENABLED` no backend.
 *
 * Base `/v1/admins` (igual ao system-health-api). Envelope: o backend responde
 * `{ data }`, então lemos `res.data.data`.
 */
const adminsApi = createAuthedClient("/v1/admins");

export type JobIssueStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
export type JobIssueCategory = "NO_SHOW" | "LATE_ARRIVAL" | "POOR_QUALITY" | "OTHER";

export interface AdminJobIssueReport {
  id: string;
  jobId: string;
  vacancyId: string;
  module: "BARES_RESTAURANTES" | "FREELA_EM_CASA" | null;
  contractorUserId: string;
  contractorName: string | null;
  category: JobIssueCategory;
  /** Justificativa que o contratante escreveu. Pode ser longa — exibir inteira. */
  description: string;
  status: JobIssueStatus;
  jobStatus: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** Rótulos em pt-BR das categorias do relato (F6). */
export const JOB_ISSUE_CATEGORY_LABEL: Record<JobIssueCategory, string> = {
  NO_SHOW: "Não compareceu",
  LATE_ARRIVAL: "Chegou atrasado",
  POOR_QUALITY: "Qualidade ruim",
  OTHER: "Outro",
};

export async function getAdminIssueReports(
  status?: JobIssueStatus,
): Promise<AdminJobIssueReport[]> {
  const res = await adminsApi.get("/issue-reports", {
    params: status ? { status } : undefined,
  });
  return res.data.data;
}

/** Arquiva um relato sem ação financeira (OPEN/IN_REVIEW → DISMISSED). */
export async function dismissJobIssueReport(
  id: string,
  note?: string,
): Promise<AdminJobIssueReport> {
  const res = await adminsApi.post(`/issue-reports/${id}/dismiss`, note ? { note } : {});
  return res.data.data;
}

/** Plano do encerramento parcial. Tudo em centavos, exceto `proportion` (0..1). */
export interface EarlyFinalizePartialPlan {
  proportion: number;
  newTaxaServicoInCents: number;
  newFixedFeeInCents: number;
  newSeguroInCents: number;
  /** INSS informativo = round(novo repasse × 11%). NÃO sai do repasse. */
  newInssInCents: number;
  /** Bruto do freela (=== repasse líquido; INSS por fora). */
  newTotalFreelanceInCents: number;
  newRepasseLiquidoInCents: number;
  /** Novo charge/total = taxa + Pix + seguro + repasse (sem INSS). */
  newChargeInCents: number;
  /** Estorno para a carteira do contratante = pago − novo charge. */
  refundToContractorInCents: number;
}

export interface EarlyFinalizePartialInput {
  /** Instante ISO (UTC) do fim real do serviço — dirige a proporção. */
  actualEndAt: string;
  /** Override do líquido do freela em centavos (vagas sem check-in). */
  overrideRepasseLiquidoInCents?: number;
  /** Relato F6 que originou a ação (marcado RESOLVED ao final). */
  jobIssueReportId?: string;
  note?: string;
}

export interface EarlyFinalizePartialPreview {
  plan: EarlyFinalizePartialPlan;
  module: "bars-restaurants" | "home-services";
}

export interface EarlyFinalizePartialResult {
  plan: EarlyFinalizePartialPlan;
  module: "bars-restaurants" | "home-services";
  refundedToContractorInCents: number;
  /** Status do repasse disparado ("COMPLETED"/"FAILED"/null se não processou). */
  repasseStatus: string | null;
  repasseFailureReason: string | null;
  reportResolved: boolean;
}

/** Só calcula (não grava) — a tela mostra os números antes de confirmar. */
export async function previewEarlyFinalizePartial(
  vacancyId: string,
  input: EarlyFinalizePartialInput,
): Promise<EarlyFinalizePartialPreview> {
  const res = await adminsApi.post(
    `/vacancies/${vacancyId}/early-finalize-partial`,
    input,
    { params: { preview: "true" } },
  );
  return res.data.data;
}

/** Executa de verdade: prorrateia a vaga, estorna o resto e dispara o repasse. */
export async function earlyFinalizePartial(
  vacancyId: string,
  input: EarlyFinalizePartialInput,
): Promise<EarlyFinalizePartialResult> {
  const res = await adminsApi.post(`/vacancies/${vacancyId}/early-finalize-partial`, input);
  return res.data.data;
}

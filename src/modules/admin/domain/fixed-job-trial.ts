/**
 * Teste de vaga fixa (CLT) liberado pelo admin para uma empresa fora do plano
 * Vip — tipos e rótulos do painel de Assinaturas.
 *
 * Contrato da API: `/v1/admin/subscriptions/:storeId/fixed-job-trial`
 * (POST libera, PATCH altera total/data, DELETE encerra).
 */

export type FixedJobTrialStatus = "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";

/** O que a listagem traz por empresa (última concessão). */
export interface FixedJobTrialSummary {
  quota: number;
  used: number;
  remaining: number;
  expiresAt: string;
  status: FixedJobTrialStatus;
}

/** O que o detalhe da empresa traz — com quem liberou e quem encerrou. */
export interface FixedJobTrialAdmin extends FixedJobTrialSummary {
  id: string;
  note: string | null;
  grantedAt: string;
  grantedByEmail: string | null;
  revokedAt: string | null;
  revokedByEmail: string | null;
}

export const TRIAL_STATUS_LABEL: Record<FixedJobTrialStatus, string> = {
  ACTIVE: "Ativo",
  EXHAUSTED: "Esgotado",
  EXPIRED: "Vencido",
  REVOKED: "Encerrado",
};

export function trialUsageLabel(trial: Pick<FixedJobTrialSummary, "quota" | "used">): string {
  return trial.quota === 1
    ? `${trial.used} de 1 vaga usada`
    : `${trial.used} de ${trial.quota} vagas usadas`;
}

const SAO_PAULO_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * `YYYY-MM-DD` do dia de Brasília — valor do `<input type="date">`. A API grava
 * o fim do dia (23:59:59 BRT = 02:59:59Z do dia seguinte); cortar o ISO em UTC
 * mostraria um dia a mais.
 */
export function toSaoPauloDateInput(iso: string): string {
  return SAO_PAULO_YMD.format(new Date(iso));
}

export function saoPauloDayMonth(iso: string): string {
  const [, month, day] = toSaoPauloDateInput(iso).split("-");
  return `${day}/${month}`;
}

/** Selo da coluna "Teste vaga fixa": só quando o teste está valendo. */
export function trialListBadge(trial: FixedJobTrialSummary | null | undefined): string | null {
  if (!trial || trial.status !== "ACTIVE") return null;
  return `${trial.used}/${trial.quota} até ${saoPauloDayMonth(trial.expiresAt)}`;
}

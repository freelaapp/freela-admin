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

/** `YYYY-MM-DD` de hoje em Brasília (00:30 UTC ainda é o dia anterior lá). */
export function todaySaoPauloDateInput(now: Date = new Date()): string {
  return SAO_PAULO_YMD.format(now);
}

export function saoPauloDayMonth(iso: string): string {
  const [, month, day] = toSaoPauloDateInput(iso).split("-");
  return `${day}/${month}`;
}

const TRIAL_ENDED_BADGE: Record<Exclude<FixedJobTrialStatus, "ACTIVE">, string> = {
  EXHAUSTED: "Teste esgotado",
  EXPIRED: "Teste vencido",
  REVOKED: "Teste encerrado",
};

export interface TrialListBadge {
  label: string;
  /** `true` = teste valendo (destaque); `false` = já acabou (discreto). */
  active: boolean;
}

/**
 * Selo da coluna "Teste vaga fixa": o teste valendo mostra uso e prazo; o que
 * acabou mostra como acabou — sem isso parecia que a empresa nunca teve teste.
 */
export function trialListBadge(
  trial: FixedJobTrialSummary | null | undefined,
): TrialListBadge | null {
  if (!trial) return null;
  if (trial.status === "ACTIVE") {
    return {
      label: `${trial.used}/${trial.quota} até ${saoPauloDayMonth(trial.expiresAt)}`,
      active: true,
    };
  }
  return { label: TRIAL_ENDED_BADGE[trial.status], active: false };
}

export const EXPIRED_TRIAL_EDIT_HINT =
  "Teste vencido: para reativar, escolha em “Vale até” uma nova data, de hoje em diante. Só mudar o total não reativa.";

/**
 * Pode salvar a alteração do teste? Teste VENCIDO só volta a valer com data
 * nova de hoje em diante (`today`/`newDate` em `YYYY-MM-DD` de Brasília): salvar
 * só o total gravaria sem reativar nada — então trava e explica.
 */
export function trialEditCheck(input: {
  status: FixedJobTrialStatus;
  quotaChanged: boolean;
  dateChanged: boolean;
  newDate: string;
  today: string;
}): { canSave: boolean; hint: string | null } {
  if (input.status === "EXPIRED") {
    const reactivates = input.dateChanged && input.newDate >= input.today;
    return { canSave: reactivates, hint: reactivates ? null : EXPIRED_TRIAL_EDIT_HINT };
  }
  return { canSave: input.quotaChanged || input.dateChanged, hint: null };
}

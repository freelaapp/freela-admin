import type { VacancyBucket } from "./vacancy-bucket";

/** Status de lista (o que o banco diz, traduzido): aberta, preenchida, cancelada. */
export type VacancyListStatus = "open" | "filled" | "cancelled";

/**
 * O que o selo de status MOSTRA. `lost` ("Vencida") é só exibição: a vaga segue
 * OPEN no banco, mas o horário já passou — a mesma régua do bucket `lost` (e do
 * `isVacancyPastEnd` do web). Nada muda no banco nem na API (spec 2026-09-24 §C).
 */
export type VacancyDisplayStatus = VacancyListStatus | "lost";

export function displayVacancyStatus(status: VacancyListStatus, bucket: VacancyBucket): VacancyDisplayStatus {
  return status === "open" && bucket === "lost" ? "lost" : status;
}

/** Chip de status da tabela: "all" ou um status exibido ("Abertas" NÃO inclui as vencidas). */
export function matchesStatusFilter(status: VacancyDisplayStatus, filter: "all" | VacancyDisplayStatus): boolean {
  return filter === "all" || status === filter;
}

/**
 * "Não divulgada" (spec 2026-09-24 §A4): vaga aberta e no prazo (sem candidato ou
 * aguardando seleção) cujo anúncio nunca saiu em grupo de WhatsApp.
 *
 * - `groupBroadcastAt === undefined` = API anterior ao campo → não afirma nada.
 * - `outreachSentAt` (registro do Disparo, recarregado logo após o "Enviar") tira o
 *   selo na hora, sem esperar a lista de vagas recarregar.
 */
export function isVacancyNotBroadcast(input: {
  bucket: VacancyBucket;
  groupBroadcastAt?: string | null;
  outreachSentAt?: string | null;
}): boolean {
  if (input.bucket !== "open" && input.bucket !== "awaitingSelection") return false;
  if (input.groupBroadcastAt !== null) return false;
  return !input.outreachSentAt;
}

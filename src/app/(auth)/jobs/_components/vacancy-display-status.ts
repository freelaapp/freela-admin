import {
  GROUP_BROADCAST_STAGE,
  type OutreachRecord,
} from "@/modules/admin/infrastructure/vacancy-outreach-api";

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

/**
 * Registro do Disparo (anúncio no grupo) desta vaga, quando há.
 *
 * Definição única: Empresa e Casa importam esta função em vez de cada página
 * declarar o mesmo lookup por `${vacancyId}::${GROUP_BROADCAST_STAGE}` (achado
 * da revisão 2026-09-24 — as duas cópias eram idênticas byte a byte).
 */
export function findGroupBroadcastRecord(
  registrosDisparo: Map<string, OutreachRecord>,
  vacancyId: string,
): OutreachRecord | undefined {
  return registrosDisparo.get(`${vacancyId}::${GROUP_BROADCAST_STAGE}`);
}

/**
 * Selo "Não divulgada" para uma LINHA da tabela: mesma regra de
 * `isVacancyNotBroadcast`, já lendo o `outreachSentAt` pelo registro do
 * Disparo (via `findGroupBroadcastRecord`) em vez de cada página duplicar o
 * mesmo `naoDivulgada(row)` (achado da revisão 2026-09-24).
 */
export function isRowNotBroadcast(
  registrosDisparo: Map<string, OutreachRecord>,
  row: { id: string; bucket: VacancyBucket; raw: { groupBroadcastAt?: string | null } },
): boolean {
  return isVacancyNotBroadcast({
    bucket: row.bucket,
    groupBroadcastAt: row.raw.groupBroadcastAt,
    outreachSentAt: findGroupBroadcastRecord(registrosDisparo, row.id)?.lastSentAt,
  });
}

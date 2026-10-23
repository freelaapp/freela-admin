import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { BillingMode } from "./billing-mode-api";

/**
 * Burocracias da empresa (API #582, ADR-016): contrato assinado, RPA e
 * lembretes do INSS. Rotas do admin com permissão COMPANIES; toda mudança leva
 * motivo (>= 5 caracteres, 422 `REASON_REQUIRED`) e fica no histórico.
 *
 * Com `CONTRACTOR_PAPERWORK_PREFS_ENABLED` desligada, o GET devolve o padrão
 * (tudo ligado) com `readOnlyReason: "FEATURE_DISABLED"` e o PATCH responde 404
 * `FEATURE_DISABLED`.
 */
const contractorSettingsApi = createAuthedClient("/v1/admin");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PaperworkKey = "signedContractEnabled" | "rpaEnabled" | "inssRemindersEnabled";

export type PaperworkPrefs = Record<PaperworkKey, boolean>;

/** Textos de cada opção, servidos pela API para web, app e admin não divergirem. */
export interface PaperworkOption {
  key: PaperworkKey;
  title: string;
  summary: string;
  whatIs: string;
  whatFor: string;
  whenOn: string;
  whenOff: string;
  responsibility: string;
}

export type SettingsActorKind = "CONTRACTOR" | "ADMIN" | "SYSTEM";
export type SettingsChangeOrigin = "SIGNUP" | "PROFILE" | "ADMIN" | "SYSTEM";
export type SettingsChangeChannel = "WEB" | "APP" | "ADMIN";

export interface ContractorSettingsView extends PaperworkPrefs {
  /** Modo de cobrança efetivo (Fase 3); `PREPAID` com o faturamento desligado. */
  billingMode: BillingMode;
  editable: boolean;
  readOnlyReason: "FEATURE_DISABLED" | "OWNER_ONLY" | null;
  updatedAt: string | null;
  updatedBy: SettingsActorKind | null;
  options: PaperworkOption[];
  /**
   * Documentos da empresa que a API emite (plano 2026-10-22 §2.16, AD-D): Nota
   * de Débito e comprovante, cada um com a sua chave. Ausente (API de hoje) =
   * o texto de hoje.
   */
  companyDocuments?: { debitNote: boolean; paymentProof: boolean };
}

/** Uma linha da trilha: uma por campo alterado, do mais novo para o mais velho. */
export interface SettingsHistoryEntry {
  id: string;
  /** Coluna alterada: `signed_contract_enabled`, `rpa_enabled`, `inss_reminders_enabled`. */
  field: string;
  /** `null` na escolha do cadastro (não houve troca). */
  oldValue: string | null;
  newValue: string | null;
  actorKind: SettingsActorKind;
  actorId: string | null;
  /** Nome do admin ou do dono; `null` quando é o sistema ou o nome não existe mais. */
  actorName: string | null;
  origin: SettingsChangeOrigin;
  channel: SettingsChangeChannel | null;
  reason: string | null;
  createdAt: string;
}

export type UpdateContractorSettingsInput = Partial<PaperworkPrefs> & { reason: string };

// ─── Funções ────────────────────────────────────────────────────────────────

const settingsPath = (contractorUserId: string) =>
  `/contractors/${encodeURIComponent(contractorUserId)}/settings`;

export async function getContractorSettings(
  contractorUserId: string,
): Promise<ContractorSettingsView> {
  const res = await contractorSettingsApi.get(settingsPath(contractorUserId));
  return res.data.data;
}

export async function updateContractorSettings(
  contractorUserId: string,
  input: UpdateContractorSettingsInput,
): Promise<ContractorSettingsView> {
  const res = await contractorSettingsApi.patch(settingsPath(contractorUserId), input);
  return res.data.data;
}

export async function getContractorSettingsHistory(
  contractorUserId: string,
): Promise<SettingsHistoryEntry[]> {
  const res = await contractorSettingsApi.get(`${settingsPath(contractorUserId)}/history`);
  return res.data.data;
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { HealthTone } from "@/modules/admin/application/system-health-presentation";

const adminApi = createAuthedClient("/v1/admins");

// ─── Tipos ──────────────────────────────────────────────────────────────────
// Contrato: api-freela GET /v1/admins/whatsapp/chips + POST /v1/admins/whatsapp/test.

export type ChipKey = "transactional" | "campaign";

/**
 * Diagnóstico de UM chip de WhatsApp (número). NUNCA carrega o token — só o
 * `instanceIdMasked`. `connected: null` = não sei (erro/timeout na sonda), nunca
 * tratado como "desconectado".
 */
export interface WhatsAppChip {
  key: ChipKey;
  label: string;
  /** Tem INSTANCE_ID/TOKEN próprios? (campanha sem os `*_CAMPAIGN_*` → false). */
  configured: boolean;
  instanceIdMasked: string | null;
  /** Transporte efetivo: evolution | wafly | zapi. */
  provider: string;
  connected: boolean | null;
  phone: string | null;
  /** A campanha cai no número transacional (split não habilitado). */
  sameAsTransactional: boolean;
  error?: string;
}

export interface WhatsAppTestResult {
  ok: boolean;
  chip: ChipKey;
  to: string;
  error?: string;
}

export interface SendChipTestInput {
  chip: ChipKey;
  to: string;
  text?: string;
}

// ─── Chamadas ───────────────────────────────────────────────────────────────

export async function getWhatsAppChips(): Promise<WhatsAppChip[]> {
  const res = await adminApi.get("/whatsapp/chips");
  const chips = res.data?.data?.whatsappChips;
  return Array.isArray(chips) ? (chips as WhatsAppChip[]) : [];
}

/** Dispara 1 mensagem 1:1 de teste pelo chip informado. SUPER_ADMIN. */
export async function sendWhatsAppChipTest(input: SendChipTestInput): Promise<WhatsAppTestResult> {
  const body: SendChipTestInput = { chip: input.chip, to: input.to.trim() };
  const text = input.text?.trim();
  if (text) body.text = text;
  const res = await adminApi.post("/whatsapp/test", body);
  return res.data.data;
}

// ─── Apresentação (funções puras) ─────────────────────────────────────────────

export interface ChipStatusView {
  tone: HealthTone;
  /** Rótulo do badge: Conectado / Desconectado / não configurado / sem resposta. */
  label: string;
}

/**
 * Cor e rótulo do badge do card. Verde = conectado; vermelho = desconectado;
 * cinza = não configurado (quando `sameAsTransactional`, o número é o próprio
 * transacional); amarelo = configurado mas a sonda não respondeu (não sei).
 */
export function chipStatus(chip: WhatsAppChip): ChipStatusView {
  if (!chip.configured) {
    return chip.sameAsTransactional
      ? { tone: "idle", label: "usa o transacional" }
      : { tone: "idle", label: "não configurado" };
  }
  if (chip.connected === true) return { tone: "ok", label: "Conectado" };
  if (chip.connected === false) return { tone: "down", label: "Desconectado" };
  return { tone: "warn", label: "sem resposta" };
}

export interface ChipTestOutcome {
  tone: "success" | "error";
  message: string;
}

/** Frase para o toast do teste. Pura: não pinta de verde um `ok:false`. */
export function describeChipTest(
  result: WhatsAppTestResult | null | undefined,
  chipLabel: string,
): ChipTestOutcome {
  if (result?.ok) {
    return { tone: "success", message: `Teste enviado pelo número ${chipLabel} para ${result.to}.` };
  }
  return {
    tone: "error",
    message: result?.error ?? `O teste pelo número ${chipLabel} não saiu.`,
  };
}

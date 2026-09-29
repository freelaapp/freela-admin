import { nationalPhoneDigits, parseBrPhone } from "@/modules/consultant/application/phone-mask";

export type ContactPhoneResolution = { ok: true; value: string | undefined } | { ok: false; error: string };

/**
 * Contato do contratante no "Editar empresa": só vai para a API quando MUDOU — e
 * aí precisa passar na régua BR (celular ou fixo com DDD), em E.164. Sem mudança
 * (ou vazio) não vai: a API trata ausente como "não mexer", e uma empresa com
 * contato legado torto continua editável nos outros campos.
 */
export function resolveContactPhoneForSave(
  current: string,
  original: string | null | undefined,
): ContactPhoneResolution {
  const digits = nationalPhoneDigits(current);
  if (!digits) return { ok: true, value: undefined };
  if (digits === nationalPhoneDigits(original ?? "")) return { ok: true, value: undefined };
  const parsed = parseBrPhone(current, { allowLandline: true });
  return parsed.ok ? { ok: true, value: parsed.e164 } : { ok: false, error: parsed.message };
}

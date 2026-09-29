/**
 * Dígitos nacionais (DDD + número, até 11). Tira o 55 colado SÓ com 12–13 dígitos —
 * mesma regra do `nationalPhoneDigits` do web, que preserva o DDD 55 do RS.
 */
export function nationalPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

/** Máscara progressiva: "(DD) 9XXXX-XXXX" (celular) ou "(DD) XXXX-XXXX" (fixo). */
export function formatPhoneMask(value: string): string {
  const d = nationalPhoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Mesma régua da API: celular 9 + 8 dígitos ou fixo 2–5 + 7 dígitos, com DDD. */
export function isValidBrPhoneDigits(digits: string): boolean {
  return /^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/.test(digits);
}

/*
 * Régua de telefone BR — cópia fiel do `parseBrPhone` da API
 * (api-freela: src/shared/auth/domain/phone-normalization.ts), mesmos vetores de
 * teste: só dígitos; tira "00"; DDI duplicado (14–15 dígitos "5555…") perde um 55;
 * 13 dígitos "5555" sem o 9 na 5ª posição = DDI no lugar do DDD; 12–13 dígitos
 * com 55 → nacional (DDD 55 do RS continua valendo); válido = DDD [1-9]{2} +
 * 9 + 8 dígitos (fixo [2-5] + 7 com `allowLandline`).
 */

export type BrPhoneErrorCode = "PHONE_DDI_AS_DDD" | "PHONE_INVALID";

export interface BrPhoneOptions {
  allowLandline?: boolean;
}

export type BrPhoneParseResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; code: BrPhoneErrorCode; message: string };

export const BR_PHONE_MESSAGES = {
  DDI_AS_DDD:
    "O código do país (55) entrou no lugar do DDD e o número ficou incompleto. Digite só DDD + celular, ex.: (11) 98765-4321.",
  INVALID_MOBILE: "Celular inválido. Informe DDD + número com 9 dígitos, ex.: (11) 98765-4321.",
  INVALID_ANY: "Telefone inválido. Informe o telefone com DDD, ex.: (11) 98765-4321 ou (11) 3333-4444.",
} as const;

const BR_MOBILE_NATIONAL = /^[1-9]{2}9\d{8}$/;
const BR_LANDLINE_NATIONAL = /^[1-9]{2}[2-5]\d{7}$/;

export function parseBrPhone(
  raw: string | null | undefined,
  options: BrPhoneOptions = {},
): BrPhoneParseResult {
  const allowLandline = options.allowLandline === true;
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if ((digits.length === 14 || digits.length === 15) && digits.startsWith("5555")) {
    digits = digits.slice(2);
  }
  if (digits.length === 13 && digits.startsWith("5555") && digits[4] !== "9") {
    return { ok: false, code: "PHONE_DDI_AS_DDD", message: BR_PHONE_MESSAGES.DDI_AS_DDD };
  }
  const national =
    (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
  if (BR_MOBILE_NATIONAL.test(national) || (allowLandline && BR_LANDLINE_NATIONAL.test(national))) {
    return { ok: true, e164: `+55${national}`, national };
  }
  return {
    ok: false,
    code: "PHONE_INVALID",
    message: allowLandline ? BR_PHONE_MESSAGES.INVALID_ANY : BR_PHONE_MESSAGES.INVALID_MOBILE,
  };
}

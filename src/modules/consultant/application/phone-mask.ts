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

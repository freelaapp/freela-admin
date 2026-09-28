/**
 * WhatsApp de suporte digitado no admin. MESMA regra da API
 * (`api-freela/src/common/support-contact/support-contact.ts`): só celular, e
 * o DDI 55 só sai com 12–13 dígitos — "(55) 99876-5432" é o DDD do RS.
 */
function nationalDigits(value: string): string {
  let digits = (value ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function formatSupportWhatsappInput(value: string): string {
  const d = nationalDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function normalizeSupportWhatsapp(value: string): string | null {
  const d = nationalDigits(value);
  return /^[1-9]{2}9\d{8}$/.test(d) ? `55${d}` : null;
}

export function whatsappTestUrl(e164: string): string {
  return `https://wa.me/${e164}`;
}

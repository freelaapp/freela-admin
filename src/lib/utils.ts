import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Exibe telefone em formato nacional: aceita E.164 (+5511...), DDI sem "+"
 * (5511...) ou nacional (11 dígitos). Comprimentos fora do padrão BR voltam
 * crus — sinal de dado corrompido na origem, melhor visível que disfarçado.
 */
export function formatPhoneBr(raw: string | null | undefined): string {
  if (!raw) return "—";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 || digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`;
  }
  return raw;
}

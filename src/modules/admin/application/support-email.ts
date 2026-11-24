/**
 * E-mail de suporte digitado no admin. MESMA regra da API
 * (`SupportContactService`): trim, minúsculas, formato de e-mail, até 254.
 */
export const SUPPORT_EMAIL_ERROR = "Informe um e-mail válido, ex.: contato@freelaservicos.com.br.";

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function normalizeSupportEmail(value: string): string | null {
  const email = (value ?? "").trim().toLowerCase();
  if (!email || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}

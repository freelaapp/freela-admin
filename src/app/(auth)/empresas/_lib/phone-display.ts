import { formatPhoneBr } from "@/lib/utils";
import { nationalPhoneDigits } from "@/modules/consultant/application/phone-mask";

export interface CompanyPhones {
  /** Contato do responsável (o que o "Editar empresa" grava). */
  contactPhone?: string | null;
  /** Telefone da conta de login. Ausente em API anterior à mudança. */
  accountPhone?: string | null;
}

export interface CompanyPhoneLines {
  /** Linha principal; `label` só vem quando ela é o telefone da conta (contato vazio). */
  primary: { label?: "Conta"; text: string } | null;
  /** Linha secundária "Conta: ...", só quando a conta tem número diferente do contato. */
  secondary: { label: "Conta"; text: string } | null;
}

function hasPhone(value: string | null | undefined): value is string {
  return nationalPhoneDigits(value ?? "").length > 0;
}

/**
 * O que a lista de Empresas mostra na coluna de telefone. Contato e conta são
 * números separados (sem sincronizar): mostra o contato e, se a conta tiver
 * outro número, uma segunda linha identificada. Compara só os dígitos nacionais
 * (sem 55 e sem máscara).
 */
export function companyPhoneLines({ contactPhone, accountPhone }: CompanyPhones): CompanyPhoneLines {
  const contact = hasPhone(contactPhone) ? contactPhone : null;
  const account = hasPhone(accountPhone) ? accountPhone : null;

  if (contact && account) {
    const same = nationalPhoneDigits(contact) === nationalPhoneDigits(account);
    return {
      primary: { text: formatPhoneBr(contact) },
      secondary: same ? null : { label: "Conta", text: formatPhoneBr(account) },
    };
  }
  if (contact) return { primary: { text: formatPhoneBr(contact) }, secondary: null };
  if (account) return { primary: { label: "Conta", text: formatPhoneBr(account) }, secondary: null };
  return { primary: null, secondary: null };
}

/** Texto plano da coluna (cabeçalho do detalhe e busca): contato, ou conta rotulada, ou "N/A". */
export function companyPhoneSummary(phones: CompanyPhones): string {
  const { primary } = companyPhoneLines(phones);
  if (!primary) return "N/A";
  return primary.label ? `${primary.label}: ${primary.text}` : primary.text;
}

/** Texto para a busca: os dois números, formatados e só dígitos (aceita digitar com ou sem máscara). */
export function companyPhoneSearchText({ contactPhone, accountPhone }: CompanyPhones): string {
  return [contactPhone, accountPhone]
    .filter(hasPhone)
    .map((p) => `${formatPhoneBr(p)} ${nationalPhoneDigits(p)}`)
    .join(" ");
}

/** Valor de uma célula de detalhe/exportação: formatado, ou `empty` sem dado. */
export function formatCompanyPhone(value: string | null | undefined, empty = "—"): string {
  return hasPhone(value) ? formatPhoneBr(value) : empty;
}

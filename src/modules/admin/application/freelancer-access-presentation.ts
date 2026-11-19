import type { FreelancerAccessEvent } from "../infrastructure/admin-api";
import { shortDate } from "./suspensions-presentation";

/**
 * Banir com motivo (D5, fatia C3; D7: lista fixa, qualquer admin com a área Freelancers). As
 * chaves e os textos espelham `api-freela/src/shared/penalties/domain/freelancer-access-reasons.ts`.
 * O texto do motivo de banir é o que a pessoa lê no aviso W-OC3 ("bloqueada pelo suporte por …").
 */
export const BAN_REASON_OPTIONS = [
  { value: "NO_SHOWS", label: "Faltas sem aviso em serviços confirmados" },
  { value: "MISCONDUCT", label: "Comportamento inadequado durante um serviço" },
  { value: "COMPANY_COMPLAINTS", label: "Reclamações repetidas das empresas" },
  { value: "FRAUD", label: "Fraude ou uso de dados de outra pessoa" },
  { value: "FAKE_ACCOUNT", label: "Cadastro falso ou duplicado" },
] as const;

export const UNBAN_REASON_OPTIONS = [
  { value: "MISTAKE", label: "O bloqueio foi um engano" },
  { value: "REVIEW_ACCEPTED", label: "O pedido de revisão foi aceito" },
  { value: "OTHER", label: "Outro motivo (escreva na nota)" },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  [...BAN_REASON_OPTIONS, ...UNBAN_REASON_OPTIONS].map((o) => [o.value, o.label.toLowerCase()]),
);

export function accessReasonLabel(reason: string): string {
  if (reason === "UNSPECIFIED") return "sem motivo registrado (tela antiga)";
  return LABELS[reason] ?? reason;
}

/** "Banido por Ana em 18/11: faltas sem aviso em serviços confirmados." */
export function accessEventLine(e: FreelancerAccessEvent): string {
  const verb = e.action === "BAN" ? "Banido" : "Desbanido";
  const who = e.adminName ? ` por ${e.adminName}` : "";
  const note = e.note ? ` "${e.note}"` : "";
  return `${verb}${who} em ${shortDate(e.createdAt)}: ${accessReasonLabel(e.reason)}.${note}`;
}

/** O motivo é obrigatório; "Outro" no desbanir pede a nota. */
export function accessFormError(
  banning: boolean,
  reason: string,
  note: string,
): string | null {
  if (!reason) return banning ? "Escolha o motivo do bloqueio." : "Escolha o motivo para desbanir.";
  if (!banning && reason === "OTHER" && !note.trim()) return 'Com "Outro motivo", escreva a nota.';
  return null;
}

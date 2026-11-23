import { formatInstantDateTime } from "@/lib/date.utils";
import type { VacancyPrincipalChange } from "@/modules/admin/infrastructure/admin-api";

const BASIS_TEXT: Record<string, string> = {
  COMPANY_CALL: "Empresa chamou o suplente",
  COMPANY_APPROVED: "Empresa aprovou o suplente",
  AUTO_RULE: "Regra automática da empresa",
  SUPPORT: "Suporte",
  NONE: "Sem aprovação da empresa (escolhido pelo sistema)",
};

/**
 * "Quem aprovou" a troca de titular, na linha do histórico. Prefere o texto pronto da API
 * (`approvedByLabel`, com e-mail e hora); sem ele monta pelo `approvalBasis`. Sem nenhum campo de
 * aprovação (API antiga, chave `STAFFING_APPROVAL_TRAIL_ENABLED` desligada) ou na troca que só
 * liberou a vaga, devolve `null` e a linha não aparece. Base nula com o campo presente = troca
 * anterior ao controle.
 */
export function approvalLabel(
  change: Pick<
    VacancyPrincipalChange,
    "kind" | "approvalBasis" | "approvedByLabel" | "approvedAt"
  >,
): string | null {
  if (change.kind !== "SUBSTITUTED") return null;
  if (change.approvedByLabel) return change.approvedByLabel;
  if (change.approvalBasis === undefined) return null;
  const basis = change.approvalBasis;
  if (basis === null) return "Sem registro (troca anterior ao controle)";
  if (basis === "COMPANY_LIST") {
    return change.approvedAt
      ? `Lista da empresa (${formatInstantDateTime(change.approvedAt)})`
      : "Lista da empresa";
  }
  return BASIS_TEXT[basis] ?? basis;
}

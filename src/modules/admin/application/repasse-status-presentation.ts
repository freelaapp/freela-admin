/**
 * Situação do repasse ao freelancer (`shared.repasses.status`), em português, com
 * a cor do selo. Ponto único: toda tela do admin que mostra status de repasse lê
 * daqui. Status que a tela não conhece vira "Em processamento" (neutro), nunca o
 * código cru nem um "Pago" por engano.
 *
 * `AWAITING_INVOICE` (ADR-017): o freelancer de vaga faturada recebe quando a
 * empresa paga a fatura; até lá o repasse fica retido. `CREDIT_UNKNOWN`: a Woovi
 * não confirmou se o Pix saiu (conferir antes de pagar de novo).
 */
export interface RepasseStatusBadge {
  label: string;
  cls: string;
}

export const REPASSE_STATUS_BADGES: Record<string, RepasseStatusBadge> = {
  COMPLETED: { label: "Concluído", cls: "bg-green-50 text-green-700" },
  PENDING: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  PROCESSING: { label: "Processando", cls: "bg-amber-50 text-amber-700" },
  FAILED: { label: "Falhou", cls: "bg-red-50 text-red-700" },
  AWAITING_INVOICE: { label: "Aguardando a fatura", cls: "bg-sky-50 text-sky-800" },
  CREDIT_UNKNOWN: { label: "Em verificação", cls: "bg-orange-50 text-orange-800" },
};

const UNKNOWN: RepasseStatusBadge = { label: "Em processamento", cls: "bg-[#f7f7f7] text-[#525252]" };

/**
 * "Pago por fora" (23/11/2026): o dono pagou do próprio bolso. O status do
 * repasse segue `COMPLETED`; o selo vem do bloco `paidExternally` da linha.
 */
export const PAID_EXTERNALLY_BADGE: RepasseStatusBadge = {
  label: "Pago por fora",
  cls: "bg-violet-50 text-violet-800",
};

export function repasseStatusBadge(status: string | null | undefined): RepasseStatusBadge {
  return (status && REPASSE_STATUS_BADGES[status]) || UNKNOWN;
}

/** O selo de uma linha: "Pago por fora" quando a linha traz o bloco; senão, o do status. */
export function repasseRowBadge(row: {
  status: string | null | undefined;
  paidExternally?: unknown;
}): RepasseStatusBadge {
  return row.paidExternally ? PAID_EXTERNALLY_BADGE : repasseStatusBadge(row.status);
}

/**
 * Aviso depois de finalizar uma vaga pelo painel (finalizar, encerrar mais cedo)
 * quando o repasse NÃO saiu na hora por um dos estados novos. `null` para os
 * outros (cada tela já tem o texto de pago, falhou e "ainda não processado").
 */
export function repasseHeldOrReviewNotice(status: string | null | undefined): string | null {
  if (status === "AWAITING_INVOICE") {
    return "o pagamento do freelancer aguarda a fatura da empresa: sai quando ela pagar, ou no teto garantido pela Freela. Acompanhe em Financeiro > Pagamentos aos freelancers.";
  }
  if (status === "CREDIT_UNKNOWN") {
    return "o Pix do freelancer está em verificação: a Woovi não confirmou se ele saiu. Confira na Woovi antes de pagar de novo.";
  }
  return null;
}

import { formatCents } from "@/lib/money";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type { LotCandidate, LotChoiceResult } from "@/modules/admin/infrastructure/lot-choice-api";
import type { AdminLotChoice } from "@/modules/admin/infrastructure/lots-api";
import { hourLabel } from "./lot-lines-presentation";

/** "Escolher pelo lote" (A4): textos e regras puras. */

/** A API sem a escolha em massa (chave desligada): `404 VACANCY_LOT_CHOICE_DISABLED` ou rota inexistente. */
export function isChoiceDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  if (e.status !== 404) return false;
  return e.code === null || e.code === "VACANCY_LOT_CHOICE_DISABLED" || e.code === "VACANCY_LOTS_DISABLED";
}

/** A função mudou (valor novo, chave nova): a tela relê o lote e segue com a chave nova. */
export function isGroupGone(error: unknown): boolean {
  return apiErrorOf(error).code === "LOT_GROUP_NOT_FOUND";
}

export function choiceErrorMessage(error: unknown): string {
  const e = apiErrorOf(error);
  if (e.code === "LOT_GROUP_NOT_FOUND") return "Esta função mudou. Atualizamos o lote; escolha de novo.";
  if (e.code === "LOT_CHOICE_TOO_MANY") {
    const max = typeof e.extra.max === "number" ? e.extra.max : null;
    return max ? `Muitas pessoas de uma vez. O máximo por escolha é ${max}.` : "Muitas pessoas de uma vez.";
  }
  if (e.code === "LOT_NOT_FOUND") return "Não encontramos este lote.";
  if (e.status === 404) return "A escolha pelo lote ainda não está ligada.";
  if (e.message) return e.message;
  return "Não foi possível escolher agora. Nada foi alterado; tente de novo.";
}

/** Erro de rede ou 5xx: pode valer a pena tentar de novo (nada foi alterado na chamada inteira). */
export function isRetryable(error: unknown): boolean {
  const { status } = apiErrorOf(error);
  return status === null || status >= 500;
}

/** Marcar/desmarcar, na ordem dos cliques, só quem dá para escolher e até o teto. */
export function toggleSelection(
  selected: readonly string[],
  providerGlobalId: string,
  max: number,
): string[] {
  if (selected.includes(providerGlobalId)) return selected.filter((id) => id !== providerGlobalId);
  if (max > 0 && selected.length >= max) return [...selected];
  return [...selected, providerGlobalId];
}

/** Quem pode ser marcado (a API manda `choosable`) e tem `providerGlobalId`. */
export function canSelect(candidate: Pick<LotCandidate, "choosable" | "provider">): boolean {
  return candidate.choosable && !!candidate.provider.providerGlobalId;
}

/** Por que a pessoa não dá para marcar, em português. */
export function whyNotChoosable(
  candidate: Pick<LotCandidate, "choosable" | "busy" | "chosenInOtherFunction" | "provider">,
): string | null {
  if (canSelect(candidate)) return null;
  if (candidate.chosenInOtherFunction) return `Já escolhida como ${candidate.chosenInOtherFunction} neste dia.`;
  if (candidate.busy) return "Já escolhida em outro serviço nesse horário.";
  if (!candidate.provider.providerGlobalId) return "Cadastro antigo, sem identidade: escolha pela vaga.";
  return "Não dá para escolher esta pessoa agora.";
}

/** Texto fixo do diálogo (A4). */
export const CHOICE_NOTICE =
  "Você está escolhendo no lugar da empresa. Fica registrado no seu nome.";

export const CHOICE_NO_ASK_NOTICE =
  "Pelo admin não há botão de “Ainda pode vir?”: quem fala com a pessoa é o suporte. Se a pergunta automática estiver ligada na API, ela sai sozinha para empresa pré-paga e o resultado abaixo mostra.";

/** As linhas "Ao confirmar" do diálogo. */
export function confirmLines(input: {
  count: number;
  billing: string | null;
  askPlanned: boolean;
}): string[] {
  const n = input.count;
  const lines = [
    `Cada pessoa recebe o aviso de que foi escolhida (${n === 1 ? "1 aviso" : `${n} avisos`}), como no “Colocar na vaga”.`,
    "A empresa é avisada de que a equipe da Freela escolheu.",
  ];
  lines.push(
    input.billing === "INVOICED"
      ? "Empresa faturada: as vagas entram na fatura da empresa."
      : "Empresa pré-paga: a empresa é quem paga.",
  );
  lines.push("Fatura vencida ou suspensão não barram: passa e fica registrado que você seguiu.");
  if (input.askPlanned) {
    lines.push(`Depois da escolha, a API pergunta “Ainda pode vir?” sozinha ${n === 1 ? "à pessoa escolhida" : `às ${n} pessoas escolhidas`} (empresa pré-paga, ainda sem pagamento).`);
  }
  return lines;
}

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Escolhida",
  ALREADY_CHOSEN: "Já estava escolhida",
};

/** O rótulo curto do resultado de um item. */
export function itemStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? "Não entrou";
}

export function isItemOk(status: string): boolean {
  return status === "ACCEPTED" || status === "ALREADY_CHOSEN";
}

/** A frase de resumo do resultado, com a conta. */
export function resultSummaryText(summary: LotChoiceResult["summary"]): string {
  const parts = [
    `${summary.requested} pedidas = ${summary.accepted} escolhidas agora`,
    `${summary.alreadyChosen} já estavam escolhidas`,
    `${summary.failed} recusadas`,
  ];
  return parts.join(" + ");
}

export function resultPayLine(summary: LotChoiceResult["summary"]): string | null {
  if (summary.accepted === 0 && summary.dayUnpaidCount === 0) return null;
  const parts: string[] = [];
  if (summary.accepted > 0) {
    parts.push(`Valor das vagas escolhidas nesta chamada: ${formatCents(summary.chosenAmountInCents)} (soma do valor de cada vaga escolhida agora, fora as já pagas antes).`);
  }
  parts.push(
    summary.dayUnpaidCount === 0
      ? "Nada falta pagar neste dia."
      : `Falta pagar no dia: ${summary.dayUnpaidCount} ${summary.dayUnpaidCount === 1 ? "vaga" : "vagas"} = ${formatCents(summary.dayUnpaidInCents)}.`,
  );
  return parts.join(" ");
}

/** "A pergunta sai às 14h02" quando a API agendou a pergunta do item. */
export function itemAskText(ask: { state: string; askAt: string | null } | null): string | null {
  if (!ask) return null;
  if (ask.state === "SCHEDULED" && ask.askAt) return `A pergunta “Ainda pode vir?” sai às ${hourLabel(ask.askAt)}.`;
  return `Pergunta: ${ask.state}.`;
}

/** O que mostrar quando o corte do lote tem exits (D2), em texto corrido. */
const REASON: Record<string, string> = {
  WITHDRAWN: "saiu por conta própria",
  GRACE_WITHDRAWAL: "saiu na janela de arrependimento",
  CONTRACTOR_REMOVED: "foi retirada pela empresa",
  VACANCY_CANCELLED: "a vaga foi cancelada",
  NOT_CONFIRMED: "não confirmou presença",
  RELEASED: "foi liberada",
  SUBSTITUTED: "foi substituída",
  ADMIN_REMOVED: "foi retirada pelo suporte",
  RESTARTED: "a seleção recomeçou",
  UNPAID_EXPIRED: "o pagamento não saiu a tempo",
  LOT_ASK_DECLINED: "respondeu “Não posso mais”",
  LOT_ASK_NO_ANSWER: "não respondeu “Ainda pode vir?” e voltou à lista",
};

export function exitReasonText(reason: string): string {
  return REASON[reason] ?? "saiu da vaga";
}

/** A conta do "Falta pagar" do dia (de `data.choice`), com o que cada número é. */
export function unpaidLine(choice: Pick<AdminLotChoice, "unpaidCount" | "unpaidInCents">): string {
  if (choice.unpaidCount === 0) return "Nada falta pagar neste dia.";
  return `Falta pagar: ${choice.unpaidCount} ${choice.unpaidCount === 1 ? "vaga" : "vagas"} com escolhido e sem pagamento = ${formatCents(
    choice.unpaidInCents,
  )} (soma do valor de cada uma).`;
}

/** "Ainda pode vir?" do dia, em contagem. `null` = a pergunta não vale para esta empresa. */
export function asksLine(asks: AdminLotChoice["asks"]): string | null {
  if (!asks) return null;
  const parts = [
    `${asks.scheduled} a perguntar`,
    `${asks.asking} esperando resposta`,
    `${asks.confirmed} disseram que ainda podem vir`,
    `${asks.undelivered} sem entrega (continuam escolhidas)`,
  ];
  const next = asks.nextDeadlineAt ? ` Próximo prazo: ${hourLabel(asks.nextDeadlineAt)}.` : "";
  return `“Ainda pode vir?”: ${parts.join(" · ")}.${next}`;
}

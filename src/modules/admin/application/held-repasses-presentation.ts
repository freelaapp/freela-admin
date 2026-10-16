import { apiErrorOf } from "../infrastructure/api-error";
import type { AdvancedBreakdown, CountAndValue } from "../infrastructure/billing-api";
import type {
  HeldRepasseItem,
  HeldRepassesTotals,
  HeldSituationFilter,
  HeldTotals,
  ReleaseRepasseResult,
} from "../infrastructure/held-repasses-api";
import { repasseStatusBadge } from "./repasse-status-presentation";
import { dayLabel, formatBrl, formatInstantBrt, instantWithWeekday } from "./invoice-presentation";

/**
 * Textos da aba "Pagamentos aos freelancers" do Financeiro (ADR-017; UX
 * 2026-10-15 §6). Os números vêm prontos da API; aqui só a tela: rótulos, a
 * distância até o teto (dias de Brasília), a conta escrita de cada card e o
 * texto de cada erro do "Pagar agora". Funções puras, `now` injetável.
 */

export type Tone = "neutral" | "warning" | "danger" | "success";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-[#525252]",
  warning: "text-[#b45309]",
  danger: "text-[#b91c1c]",
  success: "text-[#15803d]",
};

const brtDayKey = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Dias corridos de `from` até `to` (dias `AAAA-MM-DD`). */
function daysBetween(from: string, to: string): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Ana" de "Ana Souza"; sem nome, "o freelancer". */
export function firstName(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "o freelancer";
}

// ─── Chips de situação ───────────────────────────────────────────────────────

export const HELD_SITUATION_CHIPS: ReadonlyArray<{
  filter: HeldSituationFilter;
  label: string;
  totalsKey: keyof Omit<HeldRepassesTotals, "calc" | "source">;
}> = [
  { filter: "all", label: "Todas", totalsKey: "all" },
  { filter: "awaiting_close", label: "Fatura ainda aberta", totalsKey: "awaitingClose" },
  { filter: "invoice_open", label: "A vencer", totalsKey: "invoiceOpen" },
  { filter: "invoice_overdue", label: "Vencida", totalsKey: "invoiceOverdue" },
  { filter: "deadline_48h", label: "Teto em até 2 dias", totalsKey: "deadline48h" },
];

/** "2 pagamentos = R$ 215,00": a contagem de um chip com o valor. */
export function chipCountLine(totals: HeldTotals): string {
  return `${plural(totals.count, "pagamento", "pagamentos")} = ${formatBrl(totals.totalInCents)}`;
}

/** O que é a contagem de cada chip e de onde vem (regra: todo número com a conta e a fonte). */
export function chipCountSource(label: string, totals: HeldTotals): string {
  return `${chipCountLine(totals)} (${label}). Fonte: lista de pagamentos retidos aguardando a fatura.`;
}

// ─── Linha da lista ──────────────────────────────────────────────────────────

/** Situação da fatura do pagamento retido, em português, com o tom. */
export function heldSituationText(
  item: Pick<HeldRepasseItem, "situation" | "invoice">,
  now: Date = new Date(),
): { label: string; tone: Tone } {
  switch (item.situation) {
    case "releasing":
      return { label: "Liberando: o Pix sai em até 10 min", tone: "success" };
    case "awaiting_close":
      return { label: "Fatura ainda aberta: o serviço entra no próximo fechamento", tone: "neutral" };
    case "invoice_open":
      return {
        label: item.invoice ? `A vencer: vence ${dayLabel(item.invoice.dueDate)}` : "A vencer",
        tone: "neutral",
      };
  }
  // invoice_overdue
  if (!item.invoice) return { label: "Vencida", tone: "danger" };
  const days = Math.max(1, daysBetween(item.invoice.dueDate, brtDayKey(now)));
  return {
    label: `Vencida há ${plural(days, "dia", "dias")} (venceu ${dayLabel(item.invoice.dueDate)})`,
    tone: "danger",
  };
}

/**
 * Quanto falta para o teto ("em 3 dias", "amanhã às 00:00"), contado em dias de
 * Brasília. Já passou: a Freela paga na próxima varredura.
 */
export function deadlineDistance(effectiveDeadlineAt: string, now: Date = new Date()): {
  label: string;
  tone: Tone;
} {
  const deadline = new Date(effectiveDeadlineAt);
  if (Number.isNaN(deadline.getTime())) return { label: "—", tone: "neutral" };
  if (deadline.getTime() <= now.getTime()) {
    return { label: "teto atingido: a Freela paga na próxima varredura", tone: "danger" };
  }
  const days = daysBetween(brtDayKey(now), brtDayKey(deadline));
  const time = formatInstantBrt(effectiveDeadlineAt).split(" ")[1];
  if (days <= 0) return { label: `hoje às ${time}`, tone: "danger" };
  if (days === 1) return { label: `amanhã às ${time}`, tone: "danger" };
  if (days === 2) return { label: "em 2 dias", tone: "warning" };
  return { label: `em ${days} dias`, tone: "neutral" };
}

/** O botão "Pagar agora" desta linha: disponível ou o porquê de não estar. */
export function releaseAvailability(
  item: Pick<HeldRepasseItem, "situation" | "releaseAuthorized" | "freelancer">,
): { enabled: true } | { enabled: false; reason: string } {
  if (item.releaseAuthorized || item.situation === "releasing") {
    return { enabled: false, reason: "Pagamento já autorizado: o Pix sai em até 10 min." };
  }
  // Só o `false` explícito esconde o botão. Com o "Pagar agora" sem chave, o Pix
  // falha e o pagamento deixa de aguardar a fatura (vira "Falhou"); sem o botão,
  // ele continua retido e sai quando a fatura for paga. Campo ausente (`null`):
  // o botão aparece e a API valida.
  if (item.freelancer.hasPixKey === false) {
    return {
      enabled: false,
      reason: `${firstName(item.freelancer.name)} não tem chave Pix cadastrada. Peça para cadastrar no app: o pagamento continua aguardando e sai quando a fatura for paga.`,
    };
  }
  return { enabled: true };
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export interface CardText {
  key: string;
  title: string;
  valueInCents: number;
  meta: string;
  help: string;
  calc: string;
  source: string;
}

/**
 * Fim da janela do card "em até 2 dias": agora + 48 h. É a definição do filtro
 * `deadline_48h` da API (`HOURS_48` em `admin-held-repasses.query.ts`).
 */
export function window48hLabel(now: Date): string {
  return instantWithWeekday(new Date(now.getTime() + 48 * 3_600_000).toISOString());
}

/**
 * Os dois cards dos retidos, das somas da própria lista (todos os retidos, não o
 * filtro). A regra do teto não é escrita aqui: vem da API (`apiHelp`, do card
 * `held` do resumo, e o `calc` de cada linha); sem ela, a ajuda só aponta a conta.
 */
export function heldCardsOf(totals: HeldRepassesTotals, now: Date, apiHelp?: string | null): CardText[] {
  const limit = window48hLabel(now);
  const due = totals.deadline48h;
  return [
    {
      key: "held",
      title: "Retido aguardando fatura",
      valueInCents: totals.all.totalInCents,
      meta: `${plural(totals.all.count, "pagamento retido", "pagamentos retidos")} · ${plural(
        totals.invoiceOverdue.count,
        "com fatura vencida",
        "com fatura vencida",
      )} (${formatBrl(totals.invoiceOverdue.totalInCents)})`,
      help:
        apiHelp ||
        "Pagamentos de serviços de empresas faturadas, já concluídos, que esperam a empresa pagar a fatura. Se ela não pagar, a Freela paga no teto de cada um (a data e a conta estão na lista, em \"Garantido até\").",
      calc: totals.calc,
      source: totals.source,
    },
    {
      key: "due48h",
      title: "A Freela paga em até 2 dias se as empresas não pagarem",
      valueInCents: due.totalInCents,
      meta: `${plural(due.count, "pagamento", "pagamentos")} · teto até ${limit}`,
      help: "Pagamentos que saem do caixa da Freela nas próximas 48 horas se a fatura não for paga antes. O saldo da Woovi precisa cobrir este valor.",
      calc: `soma dos pagamentos retidos com teto até ${limit} = ${formatBrl(due.totalInCents)} (${plural(
        due.count,
        "pagamento",
        "pagamentos",
      )})`,
      source: `${totals.source} O teto de cada pagamento, com a conta, está na lista, em "Garantido até".`.trim(),
    },
  ];
}

const part = (label: string, slice: CountAndValue) =>
  `${label} ${formatBrl(slice.valueInCents)} (${slice.count})`;

/**
 * Card "Pagos pela Freela antes da fatura" (do `advanced.breakdown`): o que
 * saiu do caixa da Freela antes de a empresa pagar, pelo teto, pelo "Pagar
 * agora" ou por fatura cancelada, e ainda não voltou. Foto de agora, não do
 * período (a API não separa por período).
 */
export function paidByFreelaCardOf(breakdown: AdvancedBreakdown, advancedSource: string): CardText {
  const { deadline, admin, invoiceCancelled } = breakdown;
  const total = deadline.valueInCents + admin.valueInCents + invoiceCancelled.valueInCents;
  const n = deadline.count + admin.count + invoiceCancelled.count;
  return {
    key: "paidByFreela",
    title: "Pagos pela Freela antes da fatura, ainda não recebidos",
    valueInCents: total,
    meta: `${plural(n, "pagamento", "pagamentos")} · no teto ${deadline.count} · Pagar agora ${admin.count}`,
    help: "Dinheiro que a Freela já pagou aos freelancers antes de a empresa pagar a fatura (no teto, pelo 'Pagar agora' ou com a fatura cancelada) e que ainda não voltou. É uma foto de agora: sai daqui quando a fatura é paga.",
    calc: `${part("no teto", deadline)} + ${part("Pagar agora", admin)} + ${part(
      "fatura cancelada",
      invoiceCancelled,
    )} = ${formatBrl(total)}`,
    source: `${advancedSource} Só a parte paga antes da fatura pelo teto, pelo "Pagar agora" ou por fatura cancelada; os pagos no encerramento (vagas de antes da regra) estão só no card "Adiantado aos freelancers" da aba Faturas.`.trim(),
  };
}

/** A composição do card "Adiantado aos freelancers": as quatro fatias somam o valor dele. */
export function advancedCompositionCalc(breakdown: AdvancedBreakdown): string {
  const { onCompletion, deadline, admin, invoiceCancelled } = breakdown;
  const total =
    onCompletion.valueInCents + deadline.valueInCents + admin.valueInCents + invoiceCancelled.valueInCents;
  return `${part("no encerramento (antes da regra)", onCompletion)} + ${part("no teto", deadline)} + ${part(
    "Pagar agora",
    admin,
  )} + ${part("fatura cancelada", invoiceCancelled)} = ${formatBrl(total)}`;
}

/** As fatias do "Adiantado", para o card mostrar logo abaixo do número. */
export function advancedSlices(breakdown: AdvancedBreakdown): { label: string; value: string }[] {
  return [
    { label: "no encerramento", value: formatBrl(breakdown.onCompletion.valueInCents) },
    { label: "no teto", value: formatBrl(breakdown.deadline.valueInCents) },
    { label: "Pagar agora", value: formatBrl(breakdown.admin.valueInCents) },
    { label: "fatura cancelada", value: formatBrl(breakdown.invoiceCancelled.valueInCents) },
  ];
}

// ─── "Pagar agora": erros e resultado ────────────────────────────────────────

export const RELEASE_REASON_MIN = 5;
export const RELEASE_REASON_HINT = "Escreva o motivo, com pelo menos 5 caracteres.";

/**
 * O texto de cada erro do "Pagar agora", dentro do diálogo. `refresh` = a lista
 * está velha (já pago, não retido, sumiu) ou não sabemos se o Pix saiu: a tela
 * recarrega a lista para ninguém pagar duas vezes.
 */
export function releaseErrorOf(err: unknown): { text: string; refresh: boolean } {
  const { status, code } = apiErrorOf(err);
  switch (code) {
    case "REASON_REQUIRED":
      return { text: RELEASE_REASON_HINT, refresh: false };
    case "REPASSE_ALREADY_RELEASED":
      return {
        text: "Este pagamento já saiu: a fatura foi paga, chegou o teto ou outra pessoa pagou agora. Nada foi enviado de novo. A lista foi atualizada.",
        refresh: true,
      };
    case "REPASSE_NOT_HELD":
      return {
        text: "Este pagamento não está mais aguardando a fatura. Nada foi enviado. A lista foi atualizada.",
        refresh: true,
      };
    case "REPASSE_NOT_FOUND":
      return { text: "Não achamos este pagamento. Nada foi enviado. A lista foi atualizada.", refresh: true };
  }
  if (status === 403) return { text: "Só quem tem acesso ao Financeiro pode pagar agora.", refresh: false };
  if (status === 404) {
    return {
      text: "O \"Pagar agora\" ainda não está disponível neste ambiente. Nada foi enviado.",
      refresh: false,
    };
  }
  if (status !== null && status >= 400 && status < 500) {
    return { text: "Não foi possível pagar agora. Nada foi enviado. Recarregue a lista e tente de novo.", refresh: true };
  }
  // Rede, tempo esgotado ou 5xx: o pedido pode ter chegado.
  return {
    text: "Não conseguimos confirmar se o Pix saiu. Recarregue a lista antes de tentar de novo, para não pagar duas vezes.",
    refresh: true,
  };
}

/** O aviso depois do 200: pago, enviando, ou autorizado mas o Pix não saiu. */
export function releaseOutcomeOf(
  result: ReleaseRepasseResult,
  target: { name: string | null; amountInCents: number },
): { kind: "success" | "warning"; text: string } {
  const value = formatBrl(target.amountInCents);
  const who = target.name ?? "o freelancer";
  switch (result.status) {
    case "COMPLETED":
      return { kind: "success", text: `${value} enviados para ${who}.` };
    case "PENDING":
    case "PROCESSING":
      return { kind: "success", text: `Pagamento autorizado: o Pix de ${value} para ${who} está sendo enviado.` };
    case "AWAITING_INVOICE":
      return { kind: "success", text: `Pagamento autorizado: o Pix de ${value} para ${who} sai em até 10 min.` };
    case "FAILED":
      return {
        kind: "warning",
        text: `O pagamento foi autorizado, mas o Pix para ${who} não saiu: ${
          result.failureReason ?? "motivo não informado"
        }. Ele deixou de aguardar a fatura e aparece como "Falhou" em "Todos os repasses".`,
      };
    case "CREDIT_UNKNOWN":
      return {
        kind: "warning",
        text: `Pagamento autorizado, mas a Woovi não confirmou se o Pix de ${value} para ${who} saiu (em verificação). Confira na Woovi antes de pagar de novo.`,
      };
    default:
      return {
        kind: "warning",
        text: `Pagamento autorizado. Situação do Pix: ${repasseStatusBadge(result.status).label}. Recarregue a lista para conferir.`,
      };
  }
}

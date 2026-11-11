import { formatCents } from "@/lib/money";
import type { AdminLotLine } from "@/modules/admin/infrastructure/lot-lines-api";

/**
 * Textos e estados das linhas do detalhe do lote (A3). Lógica pura: nada de `Date` local, tudo em
 * horário de Brasília. Valores desconhecidos da API caem num texto neutro, nunca derrubam a tela.
 */
const SP_TZ = "America/Sao_Paulo";

function parts(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${get.year}-${get.month}-${get.day}`, dd: get.day, mm: get.month, h: get.hour, m: get.minute };
}

/** "14h02" (Brasília). Minuto zero: "14h". Sem horário válido: "—". */
export function hourLabel(iso: string | null | undefined): string {
  const p = parts(iso);
  if (!p) return "—";
  return p.m === "00" ? `${Number(p.h)}h` : `${Number(p.h)}h${p.m}`;
}

/**
 * "14h02", ou "qui 12/11 14h02" quando o instante cai noutro dia de Brasília que o dia do serviço
 * (a pergunta costuma sair na véspera). `serviceDate` = `AAAA-MM-DD`.
 */
export function momentLabel(iso: string | null | undefined, serviceDate: string): string {
  const p = parts(iso);
  if (!p) return "—";
  if (p.day === serviceDate) return hourLabel(iso);
  return `${p.dd}/${p.mm} ${hourLabel(iso)}`;
}

export type Tone = "ok" | "wait" | "bad" | "neutral";

export interface LineText {
  /** A frase principal da célula. */
  text: string;
  tone: Tone;
  /** Frases a mais (uma por linha). */
  notes: string[];
}

const VIA: Record<string, string> = { WHATSAPP: "pelo WhatsApp", PAGE: "pelo link", SITE: "pelo site" };
const viaText = (via: string | null) => (via ? (VIA[via] ?? null) : null);

/** A pergunta "Ainda pode vir?" (fatia 4), uma pergunta por pessoa e função do lote. */
export function askText(
  ask: AdminLotLine["ask"],
  ctx: { serviceDate: string; vacancyId: string },
): LineText {
  if (!ask) return { text: "Sem pergunta.", tone: "neutral", notes: [] };
  const at = (iso: string | null) => momentLabel(iso, ctx.serviceDate);
  const asked = ask.askedAt ? `Perguntado às ${at(ask.askedAt)}` : "Perguntado";
  const via = viaText(ask.answeredVia);
  const notes: string[] = [];
  if (ask.deliveredAt) notes.push(`WhatsApp aceito pelo provedor às ${at(ask.deliveredAt)}.`);
  if (ask.askedForVacancyId && ask.askedForVacancyId !== ctx.vacancyId) {
    notes.push("A pergunta foi feita para outra vaga do mesmo grupo: a pessoa foi escolhida de novo e não recebe outra.");
  }

  switch (ask.state) {
    case "SCHEDULED":
      return {
        text: ask.scheduledFor ? `Vai perguntar às ${at(ask.scheduledFor)}.` : "Vai perguntar em instantes.",
        tone: "wait",
        notes,
      };
    case "ASKED":
      if (!ask.deliveredAt) {
        return {
          text: `${asked}, mas o WhatsApp ainda não foi aceito pelo provedor. Seguimos tentando${
            ask.deadlineAt ? ` até ${at(ask.deadlineAt)}` : ""
          }.`,
          tone: "wait",
          notes,
        };
      }
      return {
        text: `${asked}, aguardando resposta${ask.deadlineAt ? ` até ${at(ask.deadlineAt)}` : ""}.`,
        tone: "wait",
        notes,
      };
    case "YES":
      return {
        text: `${asked}, respondeu às ${at(ask.answeredAt)}${via ? ` ${via}` : ""}: ainda pode vir.`,
        tone: "ok",
        notes,
      };
    case "NO":
      return {
        text: `${asked}, respondeu às ${at(ask.answeredAt)}${via ? ` ${via}` : ""}: não pode mais. Saiu da vaga e não volta.`,
        tone: "bad",
        notes,
      };
    case "NO_ANSWER":
      return {
        text: `${asked}, não respondeu${ask.deadlineAt ? ` até ${at(ask.deadlineAt)}` : ""}. Saiu da vaga e voltou à lista.`,
        tone: "bad",
        notes,
      };
    case "UNDELIVERED":
      return {
        text: "Pergunta não entregue: o WhatsApp não foi aceito até o prazo. A pessoa continua escolhida.",
        tone: "bad",
        notes,
      };
    case "SUPERSEDED":
      return {
        text: `${asked}. A vaga foi paga antes da resposta: vale a confirmação de presença de sempre.`,
        tone: "neutral",
        notes,
      };
    case "CANCELLED":
      return { text: "Pergunta cancelada (a escolha foi desfeita ou a pessoa saiu).", tone: "neutral", notes };
    case "SKIPPED":
      return { text: "A pergunta não foi feita (fora do horário, sem tempo ou sem contato).", tone: "neutral", notes };
    default:
      return { text: `Pergunta: ${ask.state}.`, tone: "neutral", notes };
  }
}

const METHOD: Record<string, string> = { PIX: "Pix", WALLET: "saldo da carteira" };

/**
 * O pagamento da vaga. Quando a taxa do Pix foi dispensada (pagamento único), mostra a conta:
 * pago + dispensado = valor cheio da vaga.
 */
export function paymentText(
  payment: AdminLotLine["payment"],
  ctx: { serviceDate: string; hasChosen: boolean },
): LineText {
  if (!payment || !payment.paid) {
    return {
      text: ctx.hasChosen ? "Pendente: falta pagar." : "Sem pagamento (vaga livre).",
      tone: ctx.hasChosen ? "wait" : "neutral",
      notes: [],
    };
  }
  const notes: string[] = [];
  const method = payment.method ? (METHOD[payment.method] ?? payment.method) : null;
  const headline = ["Pago", method ? `com ${method}` : null, payment.at ? `às ${momentLabel(payment.at, ctx.serviceDate)}` : null]
    .filter(Boolean)
    .join(" ");
  if (payment.amountInCents !== null) {
    notes.push(`Valor pago nesta vaga: ${formatCents(payment.amountInCents)}.`);
  }
  if (payment.byBatch) {
    notes.push(`Pagamento único${payment.batchId ? ` (${payment.batchId})` : ""}: um Pix para várias vagas.`);
  }
  if (payment.pixFeeWaivedInCents > 0) {
    const waived = formatCents(payment.pixFeeWaivedInCents);
    const sum =
      payment.amountInCents !== null
        ? ` Conta: ${formatCents(payment.amountInCents)} pagos + ${waived} dispensados = ${formatCents(
            payment.amountInCents + payment.pixFeeWaivedInCents,
          )}, o valor cheio da vaga.`
        : "";
    notes.push(`Taxa do Pix dispensada nesta vaga: ${waived} (no pagamento único a taxa de receber o Pix é cobrada uma vez só).${sum}`);
  }
  return { text: `${headline}.`, tone: "ok", notes };
}

const ARRIVAL_STATE: Record<string, string> = {
  JOB_STARTED: "O serviço já começou.",
  REPLACED: "Trocado por suplente.",
  SHIFT_ENDED: "O horário terminou sem resposta.",
  CANCELLED: "Vaga cancelada.",
};

const OUTCOME: Record<string, string> = {
  CALLED: "O suplente foi chamado.",
  NO_RESERVE: "Não havia suplente.",
  STARTED: "O serviço começou depois.",
};

/** "Chegou?" da empresa sobre a pessoa. `aboutChosen: false` = a resposta é sobre quem saiu. */
export function arrivalText(arrival: AdminLotLine["arrival"], ctx: { serviceDate: string }): LineText {
  if (!arrival) {
    return { text: "A pergunta “chegou?” ainda não saiu (ou não há para esta pessoa).", tone: "neutral", notes: [] };
  }
  const via = viaText(arrival.answeredVia);
  const notes: string[] = [];
  const outcome = arrival.outcome ? OUTCOME[arrival.outcome] : null;
  if (outcome) notes.push(outcome);

  if (!arrival.aboutChosen) {
    return {
      text: `A resposta “chegou?” é sobre a pessoa anterior: o suplente entrou depois${
        arrival.answer === "NOT_ARRIVED" ? " do “não chegou”" : ""
      }.`,
      tone: "neutral",
      notes,
    };
  }
  if (arrival.state === "ANSWERED" || arrival.answer) {
    const when = arrival.answeredAtLabel ?? hourLabel(arrival.answeredAt);
    if (arrival.answer === "ARRIVED") {
      return { text: `Chegou ${when}${via ? `, respondido ${via}` : ""}.`, tone: "ok", notes };
    }
    if (arrival.answer === "NOT_ARRIVED") {
      return { text: `Não chegou (respondido às ${when}${via ? ` ${via}` : ""}).`, tone: "bad", notes };
    }
  }
  if (arrival.state === "PENDING") {
    return { text: `Perguntado às ${momentLabel(arrival.askedAt, ctx.serviceDate)}; sem resposta.`, tone: "wait", notes };
  }
  return { text: ARRIVAL_STATE[arrival.state] ?? `Chegada: ${arrival.state}.`, tone: "neutral", notes };
}

const ATTENDANCE_STATUS: Record<string, string> = {
  PENDING_CONTRACTOR_CONFIRMATION: "Esperando a empresa confirmar o “compareceu?”.",
  EVALUATED_AWAITING_END: "Presença confirmada; aguardando o encerramento.",
  REPASSE_RELEASED: "Presença confirmada; pagamento do freelancer liberado.",
};

const decision = (who: string, value: boolean | null) =>
  value === null ? null : `${who}: ${value ? "compareceu" : "não compareceu"}.`;

/** O "compareceu?" da vaga. `null` = ainda não abriu. */
export function attendanceText(attendance: AdminLotLine["attendance"]): LineText {
  if (!attendance) return { text: "Ainda não abriu.", tone: "neutral", notes: [] };
  const notes = [decision("Empresa", attendance.contractorDecision), decision("Freelancer", attendance.providerDecision)].filter(
    (n): n is string => n !== null,
  );
  if (attendance.blockedReason === "ARRIVAL_NOT_ARRIVED") {
    notes.push("A empresa marcou “não chegou” sobre a pessoa.");
  }
  const known = ATTENDANCE_STATUS[attendance.status];
  const tone: Tone = attendance.status === "PENDING_CONTRACTOR_CONFIRMATION" ? "wait" : known ? "ok" : "neutral";
  return { text: known ?? `Presença: ${attendance.status}.`, tone, notes };
}

/** Quem está escolhido, em texto. */
export function chosenText(line: Pick<AdminLotLine, "chosen">): string {
  if (!line.chosen) return "Vaga livre";
  return line.chosen.name ?? "Pessoa escolhida (sem nome)";
}

/** Resumo de cima da tabela, com a conta de cada número. */
export function linesSummary(lines: Pick<AdminLotLine, "chosen" | "payment">[]): string {
  const chosen = lines.filter((l) => l.chosen).length;
  const paid = lines.filter((l) => l.chosen && l.payment?.paid).length;
  return `${lines.length} ${lines.length === 1 ? "vaga" : "vagas"} no lote = ${chosen} com escolhido + ${
    lines.length - chosen
  } livres · dos ${chosen} escolhidos, ${paid} pagos e ${chosen - paid} pendentes`;
}

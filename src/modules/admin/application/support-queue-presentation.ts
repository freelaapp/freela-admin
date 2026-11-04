import { apiErrorOf } from "../infrastructure/api-error";
import type {
  SupportCaseDetail,
  SupportCaseItem,
  SupportCaseReason,
  SupportCaseRisk,
  SupportContactChannel,
  SupportContactResult,
  SupportCaseCloseOutcome,
} from "../infrastructure/support-cases-api";

/**
 * Textos da página "Fila do suporte" (fluxo v2, fatia C2; designer, lote 2 §5.3) e as mensagens
 * prontas A a E do Guia do suporte, com os colchetes preenchidos pelo caso. Puro (sem React).
 */

const SP_TZ = "America/Sao_Paulo";
const MINUTE = 60_000;

/** A chave da API está desligada: a rota respondeu 404 `FEATURE_DISABLED`. */
export function isSupportQueueDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "FEATURE_DISABLED";
}

const REASON_LABEL: Record<SupportCaseReason, string> = {
  NO_ONE_AVAILABLE: "Ninguém disponível",
  ALL_FAILED: "Ninguém aceitou o chamado",
  QUEUE_EMPTY: "Fila sem suplentes",
  DAILY_CUTOFF: "Corte diário",
  NO_SHOW: "Não chegou",
};

const RISK_LABEL: Record<SupportCaseRisk, string> = {
  NO_PRINCIPAL: "sem ninguém escolhido",
  PRINCIPAL_UNCONFIRMED: "sem confirmar",
  FIRST_ACCEPT_NO_RESERVE: "1º turno sem suplente",
  NO_RESERVE: "sem suplente",
};

/** "Ação sugerida no cartão" (designer §5.3). */
const ACTION_LABEL: Record<SupportCaseReason, string> = {
  NO_ONE_AVAILABLE: "Resgate de vaga",
  ALL_FAILED: "Resgate de vaga",
  QUEUE_EMPTY: "Convidar compatíveis",
  DAILY_CUTOFF: "Resolver antes do fim do expediente",
  NO_SHOW: "Ligar uma vez para o freelancer; sem resposta, resgate",
};

/** Selo do motivo: "Ninguém aceitou o chamado", "Corte das 16h30: sem confirmar". */
export function reasonLabel(
  item: Pick<SupportCaseItem, "reason" | "risk">,
  cutoffLabel: string,
): string {
  if (item.reason !== "DAILY_CUTOFF") return REASON_LABEL[item.reason];
  const base = cutoffLabel
    ? `Corte das ${cutoffLabel}`
    : REASON_LABEL.DAILY_CUTOFF;
  return item.risk ? `${base}: ${RISK_LABEL[item.risk]}` : base;
}

export function actionLabel(reason: SupportCaseReason): string {
  return ACTION_LABEL[reason];
}

/** Estado do caso no cartão: "Aberto", "Comigo", "Com Fulana", ou como terminou. */
export function statusLabel(
  item: SupportCaseItem,
  myAdminId: string | null | undefined,
): string {
  switch (item.status) {
    case "OPEN":
      return "Aberto";
    case "IN_PROGRESS":
      if (item.assignedTo && item.assignedTo.adminId === myAdminId)
        return "Comigo";
      return `Com ${firstName(item.assignedTo?.name) ?? "outra pessoa"}`;
    case "SAVED":
      return item.closeReason === "SYSTEM_RESOLVED"
        ? "O sistema resolveu"
        : "Vaga salva";
    case "NOT_SAVED":
      return "Não conseguimos";
    case "CANCELLED":
      if (item.closeReason === "VACANCY_CANCELLED") return "Vaga cancelada";
      if (item.closeReason === "VACANCY_STARTED") return "A vaga começou";
      return "A empresa cancelou";
    default:
      return item.status;
  }
}

export function isActive(item: Pick<SupportCaseItem, "status">): boolean {
  return item.status === "OPEN" || item.status === "IN_PROGRESS";
}

/** "14h30": a hora no formato das mensagens, em Brasília. */
export function hourLabel(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

function brasiliaDayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** "hoje 18h · em 4h" / "sáb 07/11, 18h · em 2 dias" / "hoje 18h · começou há 10 min". */
export function whenLabel(item: SupportCaseItem, now: Date): string {
  const start = new Date(item.startTime);
  const today = brasiliaDayKey(start) === brasiliaDayKey(now);
  const day = today
    ? `hoje ${item.vacancy.startLabel}`
    : `${item.vacancy.dayLabel}, ${item.vacancy.startLabel}`;
  const diff = Math.round((start.getTime() - now.getTime()) / MINUTE);
  return diff >= 0
    ? `${day} · em ${durationLabel(diff)}`
    : `${day} · começou há ${durationLabel(-diff)}`;
}

/**
 * O relógio da notícia (regra de ouro do Guia): "Dar notícia à empresa até 14h30 · faltam 12 min"
 * ou, vencido, "Notícia atrasada há 3 min". Null quando a empresa não foi avisada.
 */
export function newsClock(
  newsDueAt: string | null,
  now: Date,
): { text: string; late: boolean } | null {
  if (!newsDueAt) return null;
  const due = new Date(newsDueAt);
  const diff = Math.round((due.getTime() - now.getTime()) / MINUTE);
  if (diff >= 0) {
    return {
      text: `Dar notícia à empresa até ${hourLabel(due)} · faltam ${durationLabel(diff)}`,
      late: false,
    };
  }
  return { text: `Notícia atrasada há ${durationLabel(-diff)}`, late: true };
}

/** "Contatos: nenhum" / "Contatos: 1" / "Contatos: 4". */
export function contactsLabel(count: number): string {
  return count === 0 ? "Contatos: nenhum" : `Contatos: ${count}`;
}

export const CONTACT_CHANNEL_OPTIONS: Array<{
  value: SupportContactChannel;
  label: string;
}> = [
  { value: "CALL", label: "Ligação" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export const CONTACT_RESULT_OPTIONS: Array<{
  value: SupportContactResult;
  label: string;
}> = [
  { value: "WILL_GO", label: "Vai" },
  { value: "WONT_GO", label: "Não vai" },
  { value: "NO_ANSWER", label: "Não atendeu" },
  { value: "THINKING", label: "Vai pensar" },
  { value: "OTHER", label: "Outro" },
];

export const CLOSE_OUTCOME_OPTIONS: Array<{
  value: SupportCaseCloseOutcome;
  label: string;
}> = [
  { value: "SAVED", label: "Vaga salva: alguém confirmou" },
  { value: "NOT_SAVED", label: "Não conseguimos" },
  { value: "CONTRACTOR_CANCELLED", label: "A empresa cancelou" },
  { value: "SYSTEM_RESOLVED", label: "O sistema resolveu sozinho" },
];

export function contactResultLabel(result: SupportContactResult): string {
  return (
    CONTACT_RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result
  );
}

export function contactChannelLabel(channel: SupportContactChannel): string {
  return (
    CONTACT_CHANNEL_OPTIONS.find((o) => o.value === channel)?.label ?? channel
  );
}

function firstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || null;
}

export interface ReadyMessage {
  key: "A" | "B" | "C" | "D" | "E";
  title: string;
  text: string;
}

/**
 * Mensagens prontas A a E do Guia (designer §5.3, marcadas como sugestão), com os colchetes
 * preenchidos pelo caso. O que o caso não sabe fica entre colchetes para o suporte completar.
 *  - A: a hora prometida é a do relógio do caso (ou agora + a regra de ouro);
 *  - B: o número de profissionais sai dos contatos registrados (fora a empresa);
 *  - C: sem pronome ("A presença já está confirmada");
 *  - E: "candidate-se pelo app" (o freelancer se candidata, não aceita), com o link da vaga.
 */
export function readyMessages(input: {
  detail: SupportCaseDetail;
  myName: string | null | undefined;
  now: Date;
  firstNewsMinutes: number;
}): ReadyMessage[] {
  const { detail, now, firstNewsMinutes } = input;
  const contact = firstName(detail.contractor.contactName);
  const me = firstName(input.myName) ?? "[seu nome]";
  const funcao = detail.vacancy.title;
  const day = detail.vacancy.dayLabel;
  const start = detail.vacancy.startLabel;
  const end = detail.vacancy.endLabel;
  const due = detail.newsDueAt
    ? new Date(detail.newsDueAt)
    : new Date(now.getTime() + firstNewsMinutes * MINUTE);
  const reached = new Set(
    detail.contacts
      .filter((k) => k.kind !== "CONTRACTOR")
      .map((k) =>
        k.kind === "PROVIDER"
          ? `c:${k.candidacyId}`
          : `o:${(k.name ?? "").trim().toLowerCase()}`,
      ),
  ).size;
  const principal = detail.people.find((p) => p.role === "PRINCIPAL");
  const freelancer = firstName(principal?.name) ?? "[nome do freelancer]";
  const place =
    detail.vacancy.neighborhood ?? detail.vacancy.city ?? "[bairro/cidade]";
  const pay = detail.payLabel ?? "[valor]";

  return [
    {
      key: "A",
      title: "Ao assumir o caso (para a empresa)",
      text: `Olá${contact ? `, ${contact}` : ""}! Aqui é ${me}, do suporte do Freela. Já estou cuidando da sua vaga de ${funcao} para ${day} às ${start}. Te dou notícia até ${hourLabel(due)}.`,
    },
    {
      key: "B",
      title: "Enquanto procura (para a empresa)",
      text: `${contact ? `${contact}, seguimos` : "Seguimos"} procurando. Já falei com ${reached} ${reached === 1 ? "profissional" : "profissionais"} e estou aguardando retorno. Volto a te atualizar em ${firstNewsMinutes} minutos.`,
    },
    {
      key: "C",
      title: "Vaga salva (para a empresa)",
      text: `Resolvido! ${freelancer} vai cobrir sua vaga de ${day} às ${start}. A presença já está confirmada. Os dados estão no app.`,
    },
    {
      key: "D",
      title: "Não conseguimos (para a empresa)",
      text: `${contact ? `${contact}, infelizmente` : "Infelizmente"} não conseguimos um profissional para ${day} às ${start}. Estou te avisando agora para você ter tempo de se organizar. Peço desculpas. Sua vaga segue aberta no app e, se aparecer alguém, te aviso na hora.`,
    },
    {
      key: "E",
      title: "Vaga urgente (grupo de WhatsApp de freelancers)",
      text: `VAGA URGENTE – ${funcao} em ${place}, ${day} das ${start} às ${end}, R$ ${pay}. Quem puder, responda aqui ou candidate-se pelo app: ${detail.vacancyUrl}`,
    },
  ];
}

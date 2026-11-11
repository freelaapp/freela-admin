import { apiErrorOf } from "../infrastructure/api-error";
import type {
  OrientationCancelReason,
  OrientationEnrollmentStatus,
  OrientationEventRow,
  OrientationSessionAlert,
  OrientationStatus,
} from "../infrastructure/orientation-api";

/** Datas e horas do Onboarding: sempre Brasília (a API trata como UTC−3 fixo). */
const TZ = "America/Sao_Paulo";
const NO_DATE = "—";

interface Parts {
  weekday: string;
  day: string;
  month: string;
  year: string;
  hour: number;
  minute: number;
}

const partsFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(iso: string): Parts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const map: Record<string, string> = {};
  for (const p of partsFormat.formatToParts(date)) map[p.type] = p.value;
  return {
    weekday: map.weekday.replace(/-feira$/, ""),
    day: map.day,
    month: map.month,
    year: map.year,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function clock(p: Parts): string {
  return p.minute === 0 ? `${p.hour}h` : `${p.hour}h${String(p.minute).padStart(2, "0")}`;
}

/** "9h" / "9h30" (Brasília) */
export function formatSessionClock(iso: string): string {
  const p = partsOf(iso);
  return p ? clock(p) : NO_DATE;
}

/** "segunda, 16/11" */
export function formatSessionDay(iso: string): string {
  const p = partsOf(iso);
  return p ? `${p.weekday}, ${p.day}/${p.month}` : NO_DATE;
}

/** "9h às 10h" / "9h30 às 10h30" */
export function formatSessionTimeRange(startIso: string, endIso: string): string {
  const a = partsOf(startIso);
  const b = partsOf(endIso);
  return a && b ? `${clock(a)} às ${clock(b)}` : NO_DATE;
}

/** "seg 16/11, 9h" */
export function formatSessionShort(iso: string): string {
  const p = partsOf(iso);
  return p ? `${p.weekday.slice(0, 3)} ${p.day}/${p.month}, ${clock(p)}` : NO_DATE;
}

/** Dia de Brasília (YYYY-MM-DD) do instante. */
export function brasiliaDateKey(iso: string): string {
  const p = partsOf(iso);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

/** Data (YYYY-MM-DD) + hora (HH:mm) de Brasília → instante ISO em UTC. */
export function brasiliaDateTimeToIso(dateKey: string, time: string): string {
  return new Date(`${dateKey}T${time}:00-03:00`).toISOString();
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function orientationStatusLabel(s: OrientationStatus | null): string {
  if (s === "APPROVED") return "Aprovado";
  if (s === "REJECTED") return "Reprovado";
  return "Pendente";
}

const ENROLLMENT_LABELS: Record<OrientationEnrollmentStatus, string> = {
  BOOKED: "Inscrito",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  NO_SHOW: "Faltou",
  CANCELLED: "Cancelou",
  MOVED: "Trocou de turma",
};

export function enrollmentStatusLabel(
  status: OrientationEnrollmentStatus | string,
  cancelledReason?: OrientationCancelReason | null,
): string {
  if (status === "CANCELLED" && cancelledReason === "SESSION_CANCELLED") return "Turma cancelada";
  return ENROLLMENT_LABELS[status as OrientationEnrollmentStatus] ?? status;
}

export function approvedViaLabel(v: string | null | undefined): string {
  if (v === "CLASS") return "Fez a aula";
  if (v === "MANUAL") return "Aprovado sem aula";
  if (v === "HISTORY") return "Já tinha histórico de serviços";
  return v || NO_DATE;
}

const EVENT_LABELS: Record<string, string> = {
  booked: "Marcou a aula",
  moved: "Trocou de turma",
  cancelled: "Cancelou a aula",
  result_set: "Resultado da chamada",
  result_reverted: "Chamada reaberta",
  status_changed: "Situação alterada",
  changes_reset: "Trocas zeradas",
  no_show_reset: "Faltas zeradas",
  session_created: "Turma criada",
  session_updated: "Turma alterada",
  session_cancelled: "Turma cancelada",
  gate_mode_changed: "Modo da trava alterado",
};

export function orientationEventLabel(e: OrientationEventRow): string {
  return EVENT_LABELS[e.action] ?? e.action;
}

export function sessionAlertText(a: OrientationSessionAlert): string {
  switch (a) {
    case "LOW_BOOKINGS":
      return "Poucos inscritos para a aula.";
    case "NO_LINK_24H":
      return "Falta o link do Meet e a aula é em menos de 24 horas.";
    case "ATTENDANCE_OPEN":
      return "A aula já passou e a chamada ainda não foi encerrada.";
  }
}

/** Número do WhatsApp (Brasil): só dígitos, com 55 na frente; menos de 10 dígitos = null. */
export function whatsappUrlFromPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

const ERROR_TEXTS: Record<string, string> = {
  SESSION_FULL: "Esta turma lotou. Escolha outra.",
  ALREADY_BOOKED: 'Esta pessoa já tem uma aula marcada. Use "Trocar turma".',
  ALREADY_APPROVED: "Esta pessoa já está aprovada.",
  ORIENTATION_REJECTED: 'Esta pessoa está reprovada. Use "Permitir nova aula" antes.',
  BOOKING_CLOSED: "As inscrições desta turma já fecharam. Escolha outra.",
  NO_BOOKED_ENROLLMENT: "Esta pessoa não tem aula marcada.",
  HOST_NOT_ALLOWED: "Quem dá a aula precisa ser um admin ativo com acesso ao Onboarding.",
  ATTENDANCE_INCOMPLETE: "Marque todos os inscritos antes de encerrar.",
  ATTENDANCE_CHANGED:
    "A lista da turma mudou enquanto você marcava. Atualizamos a lista: confira e encerre de novo.",
  SESSION_NOT_STARTED: "A chamada só pode ser encerrada depois que a aula começar.",
  SESSION_NOT_FINISHED: "Esta chamada não está encerrada.",
  REOPEN_WINDOW_CLOSED: "O prazo para reabrir acabou. Corrija o resultado de cada pessoa.",
  WRONG_ORIENTATION_STATUS: "A situação desta pessoa mudou. Atualize a tela.",
  REASON_REQUIRED: "Escreva o motivo.",
  ORIENTATION_LINKS_NOT_CONFIGURED:
    'Os links de agendamento ainda não estão ligados no servidor. Use "Agendar por ele" e mande o link do Meet.',
  SUPER_ADMIN_REQUIRED: "Só super administradores podem fazer isso.",
  FORBIDDEN: "Você não tem permissão para isso.",
  MESSAGES_DISABLED:
    "Os envios da aula estão desligados no servidor. Peça para ligar antes de convocar (a prévia continua funcionando).",
  CONVOCATION_EMPTY: "Ninguém para convocar com esses filtros. Mude os filtros e confira a prévia.",
  NO_SEATS_FOR_AUDIENCE:
    "Não há lugar livre nas turmas dessas cidades. Crie turmas para elas antes de convocar.",
  CONVOCATION_COUNT_MISMATCH:
    "O número digitado não bate com o da prévia. A lista mudou: confira a prévia de novo e digite o número novo.",
  GATE_NOT_WIRED:
    "O bloqueio de vagas ainda não está ligado nesta versão; só dá para manter desligado.",
};

/** Texto do admin para um erro da API do Onboarding (tabela "Erros" do contrato). */
export function orientationErrorMessage(err: unknown, fallback: string): string {
  const { code, message, status } = apiErrorOf(err);
  if (status === 429) {
    return "Muitos pedidos em pouco tempo. Espere 1 minuto e tente de novo.";
  }
  if (code === "BAD_REQUEST") {
    return message ? `Algum campo está fora do formato: ${message}` : fallback;
  }
  if (code && ERROR_TEXTS[code]) return ERROR_TEXTS[code];
  return message || fallback;
}

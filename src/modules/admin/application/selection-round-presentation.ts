import { apiErrorOf } from "../infrastructure/api-error";
import type {
  AdminSelectionPerson,
  AdminSelectionRound,
  SelectionClosedReason,
  SelectionStage,
} from "../infrastructure/selection-round-api";

/**
 * Textos da seção "Rodada de seleção" do modal da vaga (fluxo v2, fatia E; designer, lote 2
 * §5.6). Puro (sem React). O admin continua dizendo "lista de espera"; "fila" é do freelancer
 * (§9 item 3), mas a "Situação" segue a tabela do designer: "Fila de espera nº X".
 */

const SP_TZ = "America/Sao_Paulo";
const WEEKDAYS: Record<string, string> = {
  Sun: "dom",
  Mon: "seg",
  Tue: "ter",
  Wed: "qua",
  Thu: "qui",
  Fri: "sex",
  Sat: "sáb",
};

/** A chave da API está desligada: a rota respondeu 404 `FEATURE_DISABLED`. */
export function isSelectionDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "FEATURE_DISABLED";
}

/** "sex 14h" / "sáb 17h45", em Brasília (o formato das mensagens). */
export function weekdayHour(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = get("minute");
  return `${WEEKDAYS[get("weekday")] ?? ""} ${minute === "00" ? `${hour}h` : `${hour}h${minute}`}`;
}

/** "Disponibilidade até sex 14h · Empresa até sex 16h · Outros nomes: 0 de 2" (designer §5.6). */
export function deadlinesLine(round: AdminSelectionRound): string {
  const parts = [`Disponibilidade até ${weekdayHour(round.availabilityDeadlineAt)}`];
  if (round.contractorDeadlineAt) parts.push(`Empresa até ${weekdayHour(round.contractorDeadlineAt)}`);
  parts.push(`Outros nomes: ${round.otherNamesUsed} de ${round.otherNamesMax}`);
  return parts.join(" · ");
}

const STAGE_LABEL: Record<SelectionStage, string> = {
  em_selecao: "Esperando as respostas",
  aguardando_contratante: "Opções enviadas à empresa",
  contratante_escolheu: "A empresa escolheu",
  sem_disponiveis: "Ninguém confirmou a tempo",
  encerrada: "Encerrada",
};

const CLOSED_LABEL: Record<SelectionClosedReason, string> = {
  ACCEPTED_IN_ROUND: "a empresa escolheu alguém da rodada",
  ACCEPTED_OUTSIDE: "a empresa escolheu alguém de fora da rodada",
  NO_ONE_AVAILABLE: "ninguém confirmou a tempo",
  VACANCY_CANCELLED: "a vaga foi cancelada",
  VACANCY_GONE: "o horário da vaga chegou",
};

const CLOSED_BY: Record<string, string> = {
  CONTRACTOR: "pela empresa",
  ADMIN: "pelo suporte",
  SYSTEM: "pelo sistema",
};

/** "A empresa escolheu" / "Encerrada: a vaga foi cancelada (pelo sistema)". */
export function stageLine(round: AdminSelectionRound): string {
  const stage = STAGE_LABEL[round.stage] ?? round.stage;
  if (round.phase !== "CLOSED" || !round.closedReason) return stage;
  const by = round.closedByKind ? ` (${CLOSED_BY[round.closedByKind] ?? round.closedByKind})` : "";
  return `${stage}: ${CLOSED_LABEL[round.closedReason] ?? round.closedReason}${by}`;
}

/** A coluna "Situação" (designer §5.6), com as saídas que a tabela dele não tem. */
export function situationLabel(person: AdminSelectionPerson): string {
  switch (person.situation) {
    case "ASKED":
      return "Perguntado";
    case "AVAILABLE":
      return "Disponível";
    case "NOT_AVAILABLE":
      return "Não pode";
    case "NO_RESPONSE":
      return "Sem resposta";
    case "SENT_TO_CONTRACTOR":
      return "Enviado à empresa";
    case "DECLINED_BY_CONTRACTOR":
      return "Trocado por outros nomes";
    case "WORKING":
      return "Vai trabalhar";
    case "RESERVE":
      return person.reservePosition ? `Suplente ${person.reservePosition}` : "Suplente";
    case "WAITLIST":
      return person.waitlistPosition
        ? `Fila de espera nº ${person.waitlistPosition}`
        : "Fila de espera";
    case "LEFT_WAITLIST":
      return "Saiu da fila";
    case "RELEASED":
      return "Liberado";
    case "CANDIDACY_GONE":
      return "Saiu da vaga";
    default:
      return person.situation;
  }
}

/** A coluna "Por que está aqui": o motivo da posição (fatia A), por escrito. */
export function reasonLabel(person: AdminSelectionPerson): string {
  const turns = person.workedHereCount === 1 ? "1 turno" : `${person.workedHereCount} turnos`;
  const base = (() => {
    switch (person.rankReason) {
      case "WORKED_HERE":
        return `Já trabalhou aqui: ${turns}`;
      case "DISTANCE_BAND":
        return "Mora mais perto";
      case "SCORE":
        return "Nota mais alta";
      case "APPLIED_FIRST":
        return "Candidatou-se antes";
      case "LOW_PRIORITY":
        return "Avaliação baixa (vai para o fim)";
      default:
        return "—";
    }
  })();
  return person.batch > 1 ? `${base} (outros nomes)` : base;
}

const VIA: Record<string, string> = { WHATSAPP: "WhatsApp", PAGE: "link", SITE: "site" };

/** "pelo WhatsApp" / "pelo link" / "pelo site". */
export function viaLabel(via: AdminSelectionPerson["answeredVia"]): string | null {
  return via ? `pelo ${VIA[via] ?? via}` : null;
}

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

/**
 * Sem a rodada na API: qualquer 404, com `FEATURE_DISABLED` (a chave desligada) ou não (a API de
 * antes, que nem tem a rota). Não tenta de novo e a seção não aparece (revisão de 04/11, E7).
 */
export function isSelectionDisabled(error: unknown): boolean {
  return apiErrorOf(error).status === 404;
}

/**
 * Outro erro (lote 3, item 14): a caixa com "Tentar de novo", só quando já se sabe que a rodada vale
 * para esta vaga — uma resposta anterior (com ou sem rodada) ou um erro do servidor (5xx: com a
 * chave desligada ou a empresa fora do piloto, a API responde 404 antes de ler). Falha de rede sem
 * resposta anterior: nada (não dá para saber; antes a seção sumia em qualquer erro).
 */
export function selectionLoadErrorVisible(input: { answeredBefore: boolean; error: unknown }): boolean {
  const { status } = apiErrorOf(input.error);
  if (status === 404) return false;
  if (input.answeredBefore) return true;
  return status !== null && status >= 500;
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

/** Quem escolheu, como sujeito da frase ("A empresa escolheu…", "O suporte escolheu…"). */
const CHOSE: Record<string, (what: string) => string> = {
  CONTRACTOR: (what) => `A empresa escolheu ${what}`,
  ADMIN: (what) => `O suporte escolheu ${what}`,
  // O cron fechou depois do aceite (o gancho do aceite não fechou na hora).
  SYSTEM: (what) => `Foi escolhido ${what}`,
};

/** Como a rodada acabou, numa frase só (lote 3: sem repetir a etapa nem o "pela empresa"). */
const CLOSED_SENTENCE: Record<SelectionClosedReason, (by: string | null) => string> = {
  ACCEPTED_IN_ROUND: (by) => (CHOSE[by ?? "CONTRACTOR"] ?? CHOSE.CONTRACTOR)("alguém da rodada"),
  ACCEPTED_OUTSIDE: (by) => (CHOSE[by ?? "CONTRACTOR"] ?? CHOSE.CONTRACTOR)("alguém de fora da rodada"),
  NO_ONE_AVAILABLE: () => "Ninguém confirmou a tempo",
  VACANCY_CANCELLED: () => "Encerrada: a vaga foi cancelada",
  VACANCY_GONE: () => "Encerrada: o horário da vaga chegou",
  SCHEDULE_CHANGED: () => "Encerrada: o horário da vaga mudou (quem confirmou foi liberado)",
  STOPPED: () => "Encerrada pelo suporte (piloto parado)",
};

/** "Opções enviadas à empresa" / "A empresa escolheu alguém da rodada" / "Encerrada: a vaga foi cancelada". */
export function stageLine(round: AdminSelectionRound): string {
  const stage = STAGE_LABEL[round.stage] ?? round.stage;
  if (round.phase !== "CLOSED" || !round.closedReason) return stage;
  const sentence = CLOSED_SENTENCE[round.closedReason];
  return sentence ? sentence(round.closedByKind) : `${stage}: ${round.closedReason}`;
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
      return "Saiu da fila de espera";
    case "RELEASED":
      return "Liberado";
    case "CANDIDACY_GONE":
      return "Saiu da vaga";
    case "LEFT_RESERVES":
      return "Saiu da fila de suplentes";
    case "RESERVE_ENDED":
      return "Não é mais suplente";
    case "NOT_ARRIVED":
      return "Não chegou";
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

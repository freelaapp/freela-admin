import { apiErrorOf } from "../infrastructure/api-error";
import type {
  AdminCompanyView,
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
 * Outro erro (lote 3, item 14; revisão D1): a linha com "Tentar de novo" só quando uma RODADA DE
 * VERDADE já foi carregada neste modal. 404 = nada; 5xx ou falha de rede sem rodada carregada antes
 * (um 502 durante o deploy) = nada: sem isso, todo modal de vaga abria com a caixa de erro.
 */
export function selectionLoadErrorVisible(input: { roundLoaded: boolean; error: unknown }): boolean {
  return input.roundLoaded && apiErrorOf(input.error).status !== 404;
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
  NO_CANDIDATES: () => "Encerrada: ninguém se candidatou até o fim da janela",
  LIST_RELEASED: () => "Encerrada: a lista foi liberada antes da rodada",
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

// ---------------------------------------------------------------------------------------------
// "A empresa vê" (pré-seleção curada; UX de 05/11 §5.1) e "Liberar a lista agora" (§5.3)
// ---------------------------------------------------------------------------------------------

/** "hoje às 14h" / "amanhã às 9h" / "sex 14h" (Brasília), para a hora prometida. */
export function clockLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: SP_TZ }).format(d);
  const at = weekdayHour(iso).split(" ")[1] ?? "";
  if (day(date) === day(now)) return `hoje às ${at}`;
  if (day(date) === day(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return `amanhã às ${at}`;
  return weekdayHour(iso);
}

const RELEASE_REASON: Partial<Record<NonNullable<AdminCompanyView["reason"]>, string>> = {
  NO_ONE_CONFIRMED: "ninguém confirmou a tempo",
  NONE_LEFT: "quem confirmou não pode mais",
  NO_CANDIDATES: "ninguém se candidatou",
  LATE: "as opções atrasaram",
  ROUND_DID_NOT_OPEN: "a rodada não abriu",
  FEWER_CONFIRMED: "menos de 3 confirmaram",
  OTHER_NAMES_DONE: "acabaram os outros nomes",
  ADMIN: "liberada pelo suporte",
};

const RELEASED_BY: Record<string, string> = {
  ADMIN: "pelo suporte",
  CONTRACTOR: "pela empresa",
  SYSTEM: "pelo sistema",
};

const OPEN_TRIGGER: Record<string, string> = {
  WINDOW_ENDED: "a janela terminou",
  CANDIDATES_REACHED: "chegaram candidatos suficientes",
  CONTRACTOR_HURRY: "a empresa pediu pressa",
  NO_CANDIDATES: "ninguém se candidatou",
  LIST_RELEASED: "o suporte liberou a lista",
};

export interface CompanyViewCard {
  /** A frase "A empresa vê …" (a linha de cima). */
  headline: string;
  /** Detalhes em pares rótulo/valor: hora prometida, liberação, motivo, quem, nota. */
  rows: { label: string; value: string }[];
}

/**
 * O cartão "A empresa vê" do modal da vaga (UX §5.1). `null` = sem a informação (sem a chave ou
 * API de antes): a linha não aparece. Vale também antes da rodada (`round: null`).
 */
export function companyViewCard(
  view: AdminCompanyView | null | undefined,
  now: Date = new Date(),
): CompanyViewCard | null {
  if (!view) return null;
  const rows: CompanyViewCard["rows"] = [];
  if (view.curated && view.optionsBy) {
    rows.push({ label: "Hora prometida", value: `opções até ${clockLabel(view.optionsBy, now)}` });
  }
  if (view.releasedAt) {
    rows.push({ label: "Lista liberada", value: clockLabel(view.releasedAt, now) });
  }
  if (view.curated && view.mode !== "HIDDEN" && view.reason && RELEASE_REASON[view.reason]) {
    rows.push({ label: "Motivo da liberação", value: RELEASE_REASON[view.reason] as string });
  }
  if (view.listReleasedByKind) {
    rows.push({
      label: "Quem liberou",
      value: RELEASED_BY[view.listReleasedByKind] ?? view.listReleasedByKind,
    });
  }
  if (view.listReleaseNote) {
    rows.push({ label: "Nota da liberação", value: view.listReleaseNote });
  }
  if (view.openTrigger) {
    rows.push({ label: "Como abriu", value: OPEN_TRIGGER[view.openTrigger] ?? view.openTrigger });
  }
  return { headline: companyViewHeadline(view, now), rows };
}

function companyViewHeadline(view: AdminCompanyView, now: Date): string {
  if (!view.curated) return "A empresa vê a lista de candidatos de sempre (vaga sem pré-seleção)";
  const until = clockLabel(view.optionsBy, now);
  switch (view.mode) {
    case "HIDDEN":
      return `A empresa vê "Estamos selecionando" · opções até ${until}`;
    case "OPTIONS_ONLY":
      return `A empresa vê só as ${view.options} opções (sem a lista de candidatos)`;
    case "OPTIONS_FIRST":
      return `A empresa vê as ${view.options} que confirmaram + a lista com os outros candidatos`;
    case "FULL":
    default:
      return view.reason === "NO_CANDIDATES"
        ? `A empresa vê "Ninguém se candidatou" · caso na fila do suporte`
        : "A empresa vê a lista toda de candidatos";
  }
}

/** O botão "Liberar a lista agora" só vale com a lista escondida (a API recusa o resto com 409). */
export function canReleaseList(view: AdminCompanyView | null | undefined): boolean {
  return Boolean(view && view.curated && (view.mode === "HIDDEN" || view.mode === "OPTIONS_ONLY"));
}

/** Texto da nota: obrigatória (sem espaços nas pontas), até 500. `null` = válida. */
export function releaseNoteProblem(note: string, max = 500): string | null {
  const trimmed = note.trim();
  if (!trimmed) return "Escreva o motivo da liberação.";
  if (trimmed.length > max) return `O motivo passa de ${max} caracteres.`;
  return null;
}

/** Os erros do "Liberar a lista agora" em português (400, 404, 409). */
export function releaseErrorMessage(error: unknown): string {
  const { status, code } = apiErrorOf(error);
  if (code === "RELEASE_NOTE_REQUIRED") return "Escreva o motivo da liberação.";
  if (code === "RELEASE_NOTE_TOO_LONG") return "O motivo passa de 500 caracteres.";
  if (code === "SELECTION_LIST_ALREADY_VISIBLE" || status === 409) {
    return "A empresa já vê a lista. Nada foi alterado.";
  }
  if (status === 404) return "Vaga não encontrada.";
  return "Não foi possível liberar a lista. Tente de novo.";
}

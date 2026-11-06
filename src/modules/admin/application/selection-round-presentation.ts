import { apiErrorOf } from "../infrastructure/api-error";
import type {
  AdminCompanyView,
  AdminHurryOption,
  AdminSelectionHurry,
  AdminSelectionPerson,
  AdminSelectionRound,
  ChooseBilling,
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
  // O texto completo (quem, hora e prazo) vem de `adminHurryTrigger`.
  ADMIN_HURRY: "o suporte adiantou",
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
  round?: AdminSelectionRound | null,
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
    const value =
      view.openTrigger === "ADMIN_HURRY"
        ? adminHurryTrigger(round)
        : (OPEN_TRIGGER[view.openTrigger] ?? view.openTrigger);
    rows.push({ label: "Como abriu", value });
    if (view.openTrigger === "ADMIN_HURRY" && round?.openNote) {
      rows.push({ label: "Nota", value: round.openNote });
    }
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

// ---------------------------------------------------------------------------------------------
// "Selecionar agora" e "Escolher titular e suplentes" (UX de 05/11 noite)
// ---------------------------------------------------------------------------------------------

/** "19h58" (Brasília), sem o dia da semana. */
export function hourLabel(iso: string | null | undefined): string {
  const label = weekdayHour(iso);
  return label === "—" ? label : (label.split(" ")[1] ?? "—");
}

/** "o suporte adiantou (Denner, 19h58, 20 min para responder)". */
export function adminHurryTrigger(round: AdminSelectionRound | null | undefined): string {
  const parts: string[] = [];
  const who = round?.openedBy?.name ?? round?.openedBy?.email;
  if (who) parts.push(who);
  // A janela fecha na hora em que o suporte aperta o botão.
  if (round?.windowClosedAt) parts.push(hourLabel(round.windowClosedAt));
  if (round?.availabilityMinutes) parts.push(`${round.availabilityMinutes} min`);
  return parts.length > 0 ? `o suporte adiantou (${parts.join(", ")})` : "o suporte adiantou";
}

/** O tempo que já vem marcado: 20 min, ou o maior que puder; `null` se nenhum puder. */
export function defaultHurryMinutes(options: AdminHurryOption[]): AdminHurryOption["minutes"] | null {
  const allowed = options.filter((o) => o.allowed);
  if (allowed.length === 0) return null;
  const twenty = allowed.find((o) => o.minutes === 20);
  if (twenty) return twenty.minutes;
  return allowed.reduce((best, o) => (o.minutes > best.minutes ? o : best)).minutes;
}

/** "1 h" / "30 min" / "1 h 30". */
export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

/** Por que um dos 3 tempos está desligado (o texto que fica no lugar da hora). */
export function hurryOptionDisabledText(option: AdminHurryOption, hurry: AdminSelectionHurry): string {
  switch (option.reason) {
    case "LATER_THAN_PROMISED":
      return `as opções chegariam às ${hourLabel(option.optionsBy)}, depois das ${hourLabel(hurry.currentOptionsBy)} prometidas`;
    case "NO_TIME_LEFT":
      return hurry.contractorMinutes
        ? `não sobra ${minutesLabel(hurry.contractorMinutes)} da empresa antes de ${weekdayHour(hurry.startTime)}`
        : `não dá tempo antes de ${weekdayHour(hurry.startTime)}`;
    case "QUIET_HOURS":
      return "entre 22h e 8h não perguntamos aos freelancers";
    case "WINDOW_GONE":
      return "a janela desta vaga já fechou há mais de 30 min";
    default:
      return "indisponível agora";
  }
}

const NETWORK_TEXT =
  "Não conseguimos falar com o servidor. Toque em Tentar de novo: se a pergunta já tiver saído, ela não se repete.";

/** Texto de reserva por código (UX §5.3), usado só quando a API não manda a `message`. */
const HURRY_FALLBACK: Record<string, string> = {
  SELECTION_ALREADY_STARTED: "A seleção desta vaga já tinha começado. Nada mudou.",
  SELECTION_ROUND_CLOSED: "A seleção desta vaga já terminou. Nada mudou.",
  VACANCY_SLOT_FILLED: "Alguém já foi aceito nesta vaga. Nada mudou.",
  SELECTION_HURRY_QUIET_HOURS:
    "Entre 22h e 8h não perguntamos aos freelancers. Nada mudou. Se a empresa precisa escolher agora, use Liberar a lista agora.",
  SELECTION_HURRY_NO_TIME:
    "Com esse tempo para responder, passaria do início da vaga. Nada mudou. Escolha um tempo menor ou use Escolher titular e suplentes.",
  SELECTION_HURRY_LATER_THAN_PROMISED:
    "Com esse tempo, as opções chegariam depois da hora já prometida à empresa. Nada mudou. Escolha um tempo menor.",
  SELECTION_HURRY_NO_CANDIDATES: "Ninguém se candidatou a esta vaga ainda. Nada mudou.",
  SELECTION_HURRY_NO_ONE_TO_ASK:
    "Nenhum candidato pôde ser perguntado (ocupados no horário, bloqueados pela empresa ou suspensos). Nada mudou.",
  SELECTION_HURRY_NOT_ELIGIBLE: "Esta vaga não entra na pré-seleção. Nada mudou.",
  SELECTION_HURRY_NOTE_TOO_LONG: "O motivo passa de 500 caracteres.",
  SELECTION_HURRY_MINUTES_INVALID: "Escolha 10, 20 ou 45 minutos.",
  FEATURE_DISABLED: "A pré-seleção está desligada para esta empresa agora. Nada mudou.",
  VACANCY_NOT_FOUND: "Vaga não encontrada.",
};

/** Erro do "Selecionar agora": a `message` da API (já pronta); senão o texto do código. */
export function hurryErrorMessage(error: unknown): string {
  const { status, code, message } = apiErrorOf(error);
  if (message) return message;
  if (code && HURRY_FALLBACK[code]) return HURRY_FALLBACK[code];
  if (status === 404) return "Vaga não encontrada.";
  return NETWORK_TEXT;
}

/** O erro foi de rede ou 5xx (o botão vira "Tentar de novo"). */
export function isTransientError(error: unknown): boolean {
  const { status } = apiErrorOf(error);
  return status === null || status >= 500;
}

const CHOOSE_FALLBACK: Record<string, string> = {
  CANDIDACY_NOT_PENDING:
    "Alguém que você marcou não está mais disponível para esta vaga (retirou a candidatura ou foi escolhido em outra). Nada foi aprovado. Marque outra pessoa.",
  VACANCY_SLOT_FILLED: "A vaga foi preenchida enquanto você escolhia. Nada foi alterado.",
  PROVIDER_SCHEDULE_CONFLICT:
    "Alguém que você marcou já está em outra vaga nesse horário. Nada foi aprovado. Marque outra pessoa.",
  VACANCY_NOT_OPEN: "Esta vaga não aceita mais escolha (fechada, cancelada ou já começou). Nada foi alterado.",
  RESERVES_TOO_MANY: "Dá para guardar até 2 suplentes. Nada foi aprovado.",
  RESERVES_NOT_AVAILABLE:
    "Passou do horário dos suplentes. Nada foi aprovado. Desmarque os suplentes e aprove só o titular.",
  SELECTION_RESERVES_DISABLED:
    "Os suplentes estão desligados agora. Nada foi aprovado. Use Colocar na vaga no cartão do titular.",
  SELECTION_CHOICE_LIST_CHANGED:
    "Nada foi aprovado, mas a lista de suplentes pode ter mudado. Confira a seção Suplentes antes de tentar de novo.",
  ADMIN_CHOICE_INVALID: "O titular não pode ser também suplente, nem repetir suplente. Nada foi aprovado.",
  ADMIN_CHOICE_NOT_A_CANDIDATE: "O titular marcado não é candidato desta vaga. Nada foi aprovado.",
  ADMIN_CHOICE_GROUP_RESERVES:
    "Esta vaga tem várias posições: aqui só dá para aprovar o titular. Desmarque os suplentes.",
  VACANCY_NOT_FOUND: "Vaga não encontrada.",
};

/** Erro do "Escolher": a `message` da API; senão o texto do código; rede: não sabemos se deu certo. */
export function chooseErrorMessage(error: unknown): string {
  const { status, code, message } = apiErrorOf(error);
  if (message) return message;
  if (code && CHOOSE_FALLBACK[code]) return CHOOSE_FALLBACK[code];
  if (status === 404) return "Vaga não encontrada.";
  return "Não sabemos se deu certo. Atualizamos a lista: confira se o titular aparece como Aceito antes de tentar de novo.";
}

// ---- A marcação do modo "Escolher titular e suplentes" ----------------------------------------

export interface ChoiceSelection {
  principal: string | null;
  reserves: [string | null, string | null];
}

export const EMPTY_CHOICE: ChoiceSelection = { principal: null, reserves: [null, null] };

export type ChoiceSlot = "principal" | 1 | 2;

/** Em que lugar a candidatura está marcada (`null` = em nenhum). */
export function choiceSlotOf(sel: ChoiceSelection, id: string): ChoiceSlot | null {
  if (sel.principal === id) return "principal";
  if (sel.reserves[0] === id) return 1;
  if (sel.reserves[1] === id) return 2;
  return null;
}

/**
 * Um toque num cartão. Marcado: desmarca e o lugar FICA VAZIO (ninguém sobe sozinho: promover
 * alguém em silêncio para "vai trabalhar" seria o pior erro possível). Não marcado: ocupa o
 * primeiro lugar vazio, na ordem titular, suplente 1, suplente 2. `canBeReserve = false` impede
 * esse cartão de ocupar lugar de suplente; `maxReserves` limita os lugares de suplente.
 */
export function toggleChoice(
  sel: ChoiceSelection,
  id: string,
  opts: { canBeReserve?: boolean; maxReserves?: number } = {},
): ChoiceSelection {
  const slot = choiceSlotOf(sel, id);
  if (slot === "principal") return { ...sel, principal: null };
  if (slot === 1) return { ...sel, reserves: [null, sel.reserves[1]] };
  if (slot === 2) return { ...sel, reserves: [sel.reserves[0], null] };
  if (sel.principal === null) return { ...sel, principal: id };
  const max = Math.min(2, opts.maxReserves ?? 2);
  if (opts.canBeReserve === false) return sel;
  if (sel.reserves[0] === null && max >= 1) return { ...sel, reserves: [id, sel.reserves[1]] };
  if (sel.reserves[1] === null && max >= 2) return { ...sel, reserves: [sel.reserves[0], id] };
  return sel;
}

/** Os suplentes na ordem de chamada, sem os lugares vazios (a ordem é a dos lugares 1 e 2). */
export function choiceReserveIds(sel: ChoiceSelection): string[] {
  return sel.reserves.filter((id): id is string => id !== null);
}

/** O lugar a ser preenchido pelo próximo toque, ou `null` se estiver tudo cheio. */
export function nextFreeSlot(sel: ChoiceSelection, maxReserves = 2): ChoiceSlot | null {
  if (sel.principal === null) return "principal";
  if (sel.reserves[0] === null && maxReserves >= 1) return 1;
  if (sel.reserves[1] === null && maxReserves >= 2) return 2;
  return null;
}

/** Tira da marcação quem não está mais na lista (retirou a candidatura, foi aceito em outra). */
export function pruneChoice(sel: ChoiceSelection, validIds: ReadonlySet<string>): ChoiceSelection {
  const keep = (id: string | null) => (id !== null && validIds.has(id) ? id : null);
  return { principal: keep(sel.principal), reserves: [keep(sel.reserves[0]), keep(sel.reserves[1])] };
}

/** Como a empresa paga, para os textos da confirmação. `undefined` = não sabemos. */
export type PayWay = "INVOICE" | "PIX" | "UNKNOWN";

export function payWayOf(billingMode: string | undefined | null): PayWay {
  if (!billingMode) return "UNKNOWN";
  return billingMode === "PREPAID" ? "PIX" : "INVOICE";
}

export function chooseConfirmLabel(way: PayWay): string {
  if (way === "INVOICE") return "Aprovar e lançar na fatura";
  if (way === "PIX") return "Aprovar e pedir o Pix";
  return "Aprovar";
}

/** A primeira linha das consequências, pelo jeito de pagar da empresa. */
export function chooseBillingLine(way: PayWay, company: string, value: string, principalName: string): string {
  if (way === "INVOICE") {
    return `A vaga fecha, e o valor da vaga (${value}) entra agora na fatura da ${company}.`;
  }
  if (way === "PIX") {
    return `A vaga fecha, e a ${company} recebe o pedido para pagar ${value} por Pix. ${principalName} fica garantido(a) quando a empresa pagar.`;
  }
  return `A vaga fecha, e a ${company} paga o valor da vaga (${value}) como sempre, por fatura ou Pix.`;
}

/** A frase de sucesso, pelo `billing` que a API devolveu. */
export function chooseSuccessText(input: {
  principalName: string;
  reserveNames: string[];
  billing: ChooseBilling;
  autoFill: boolean;
}): string {
  const { principalName, reserveNames, billing, autoFill } = input;
  const head =
    billing === "AWAITING_PAYMENT" ? `${principalName} aprovado(a).` : `${principalName} vai trabalhar.`;
  const reserves =
    reserveNames.length > 0
      ? ` Suplentes: ${reserveNames.map((n, i) => `${i + 1} ${n}`).join(", ")}.`
      : autoFill
        ? " Os suplentes, o sistema escolhe depois do pagamento."
        : "";
  const tail =
    billing === "INVOICE"
      ? " Valor lançado na fatura."
      : billing === "AWAITING_PAYMENT"
        ? " A empresa recebeu o pedido de pagamento."
        : "";
  return `${head}${reserves}${tail}`;
}

import { apiErrorOf } from "../infrastructure/api-error";
import type {
  SuspensionItem,
  SuspensionLiftReason,
  SuspensionReasonKey,
  SuspensionState,
} from "../infrastructure/suspensions-api";

/**
 * Textos da página "Suspensões" (fluxo v2, fatia G; designer, lote 2 §5.5). Puro (sem React).
 */

const SP_TZ = "America/Sao_Paulo";
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** A chave da API está desligada: a rota respondeu 404 `FEATURE_DISABLED`. */
export function isPenaltyLadderDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "FEATURE_DISABLED";
}

export const DISABLED_TEXT = "As consequências novas ainda não estão ligadas.";
export const EMPTY_TEXT = "Ninguém está sem poder se candidatar agora.";
export const EMPTY_ALL_TEXT = "Nenhuma suspensão registrada ainda.";
export const ERROR_TEXT =
  "Não conseguimos carregar as suspensões. Verifique a conexão e clique em Tentar de novo. Seus filtros continuam aqui.";

function parts(iso: string, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const weekday =
    WEEKDAYS[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))] ?? "";
  return { weekday, day: get("day"), month: get("month"), hour: get("hour"), minute: get("minute") };
}

/** "sáb 14/11" (instante, em Brasília). */
export function dayLabel(iso: string): string {
  const p = parts(iso, SP_TZ);
  return `${p.weekday} ${p.day}/${p.month}`;
}

/** "10/11" (instante, em Brasília). */
export function shortDate(iso: string): string {
  const p = parts(iso, SP_TZ);
  return `${p.day}/${p.month}`;
}

/** "ter 10/11 às 18h" (prazo, em Brasília). */
export function deadlineLabel(iso: string): string {
  const p = parts(iso, SP_TZ);
  const hour = p.minute === "00" ? `${Number(p.hour)}h` : `${Number(p.hour)}h${p.minute}`;
  return `${p.weekday} ${p.day}/${p.month} às ${hour}`;
}

const REASON_LABEL: Record<SuspensionReasonKey, string> = {
  LATE_WITHDRAWAL_REPEAT: "2ª desistência em cima da hora em 30 dias",
  LATE_WITHDRAWAL_FIRST_SHIFT: "Desistência em cima da hora no 1º turno",
  NO_SHOW: "Falta sem aviso",
  NO_SHOW_FIRST_SHIFT: "Falta sem aviso no 1º turno",
  NO_SHOW_REPEAT: "2ª falta sem aviso em 60 dias",
  MANUAL: "Suspensão pelo suporte",
};

export function reasonLabel(item: Pick<SuspensionItem, "reasonKey">): string {
  return REASON_LABEL[item.reasonKey];
}

/** "Volta em": a data, "Depois da conversa" ou os dois. */
export function returnLabel(
  item: Pick<SuspensionItem, "endsAt" | "requiresConversation">,
): string {
  if (!item.endsAt) return "Depois da conversa";
  return item.requiresConversation
    ? `${dayLabel(item.endsAt)}, depois da conversa`
    : dayLabel(item.endsAt);
}

/** "Conversa": Pendente · Feita em 10/11 · — (não exigida). */
export function conversationLabel(
  item: Pick<SuspensionItem, "requiresConversation" | "conversationAt">,
): string {
  if (!item.requiresConversation) return "—";
  return item.conversationAt ? `Feita em ${shortDate(item.conversationAt)}` : "Pendente";
}

/**
 * Etiqueta "Conversa atrasada" (revisão da G): a conversa que trava a volta passou da hora. A
 * regra mora na API (`conversationOverdue`); a página só mostra.
 */
export const CONVERSATION_OVERDUE_TEXT = "Conversa atrasada";
export function conversationOverdueLabel(
  item: Pick<SuspensionItem, "conversationOverdue">,
): string | null {
  return item.conversationOverdue ? CONVERSATION_OVERDUE_TEXT : null;
}

const STATE_LABEL: Record<SuspensionState, string> = {
  DATED: "Sem poder se candidatar",
  DATED_AND_CONVERSATION: "Sem poder se candidatar",
  CONVERSATION_ONLY: "Esperando a conversa",
  ENDED: "Cumprida",
  LIFTED: "Levantada",
};

export function stateLabel(item: Pick<SuspensionItem, "state">): string {
  return STATE_LABEL[item.state];
}

/** "Origem (ocorrência)": a vaga e a situação da contestação. */
export function originLabel(item: Pick<SuspensionItem, "vacancy" | "source" | "manualReason">): string {
  if (!item.source) return item.manualReason ? `Suporte: ${item.manualReason}` : "Suporte";
  const vacancy = item.vacancy?.title
    ? `${item.vacancy.title}${item.vacancy.startTime ? `, ${dayLabel(item.vacancy.startTime)}` : ""}`
    : "Vaga";
  if (item.source.status === "ANNULLED") return `${vacancy} · ocorrência anulada`;
  if (item.source.contest.status === "SENT") return `${vacancy} · contestada`;
  if (item.source.contest.status === "OPEN" && item.source.contest.until) {
    return `${vacancy} · pode contestar até ${deadlineLabel(item.source.contest.until)}`;
  }
  return vacancy;
}

const CONTEST_REASON_LABEL: Record<string, string> = {
  EMERGENCY: "Emergência",
  MESSAGE_NOT_RECEIVED: "A mensagem não chegou",
  OTHER: "Outro motivo",
};

export function contestReasonLabel(reason: string | null): string | null {
  return reason ? (CONTEST_REASON_LABEL[reason] ?? reason) : null;
}

/** Valendo agora (dá para levantar e registrar a conversa). */
export function isActive(item: Pick<SuspensionItem, "state">): boolean {
  return item.state === "DATED" || item.state === "DATED_AND_CONVERSATION" || item.state === "CONVERSATION_ONLY";
}

export function canRegisterConversation(
  item: Pick<SuspensionItem, "state" | "requiresConversation" | "conversationAt">,
): boolean {
  return isActive(item) && item.requiresConversation && !item.conversationAt;
}

/** Contestação aberta esperando o suporte: dá para manter a ocorrência (P-G4). */
export function canKeepOccurrence(item: Pick<SuspensionItem, "state" | "source">): boolean {
  return isActive(item) && item.source?.status === "CONTESTED";
}

/** "Suspender": dias de 1 a 90, sempre (revisão da G; a API recusa fora disso). */
export const MANUAL_SUSPENSION_DAYS = { min: 1, max: 90 } as const;

export const LIFT_REASON_OPTIONS: Array<{ value: SuspensionLiftReason; label: string }> = [
  { value: "CONTEST_ACCEPTED", label: "Contestação aceita" },
  { value: "SYSTEM_ERROR", label: "Erro do sistema" },
  { value: "OTHER", label: "Outro" },
];

/** O que cada motivo faz (texto do diálogo). */
export function liftReasonHint(reason: SuspensionLiftReason, hasSource: boolean): string {
  if (reason === "CONTEST_ACCEPTED" && hasSource) {
    return "A ocorrência é anulada: os pontos voltam e o freelancer recebe \"Sua contestação foi aceita\".";
  }
  if (reason === "OTHER") return "Escreva o motivo. O freelancer recebe \"Você já pode se candidatar de novo\".";
  return "Só a suspensão sai. O freelancer recebe \"Você já pode se candidatar de novo\".";
}

// ------------------------------------------------------------ filtros e detalhe (D5, fatia A1)

/**
 * Fatia A1 (desenho D5, 18/11): filtros, ordem, contador e detalhe da tela Suspensões, todos no
 * navegador, sobre as linhas que a API já manda. A A1 não muda o pedido: continua
 * `filter=active|all`, sem `limit` (a API corta em 100).
 */
export const LIST_LIMIT = 100;

/** "Situação" (troca as duas abas de antes). As três "Valendo…" pedem `active` à API. */
export type SuspensionSituation =
  | "active"
  | "active_pending"
  | "active_overdue"
  | "ended"
  | "lifted"
  | "all";

export const SITUATION_OPTIONS: Array<{ value: SuspensionSituation; label: string }> = [
  { value: "active", label: "Valendo agora" },
  { value: "active_pending", label: "Valendo, conversa pendente" },
  { value: "active_overdue", label: "Valendo, conversa atrasada" },
  { value: "ended", label: "Cumpridas" },
  { value: "lifted", label: "Levantadas" },
  { value: "all", label: "Todas" },
];

/** O que pedir à API para a situação escolhida: as "Valendo…" pedem `active`; o resto, `all`. */
export function apiFilterOf(situation: SuspensionSituation): "active" | "all" {
  return situation.startsWith("active") ? "active" : "all";
}

export type SuspensionOrder = "pending_first" | "newest";

/** D1 fica com o Denner: o padrão continua a ordem de hoje (conversa pendente primeiro). */
export const ORDER_OPTIONS: Array<{ value: SuspensionOrder; label: string }> = [
  { value: "pending_first", label: "Conversa pendente primeiro" },
  { value: "newest", label: "Mais recentes primeiro" },
];

export type SuspensionPeriod = "any" | "today" | "7d" | "30d";

export const PERIOD_OPTIONS: Array<{ value: SuspensionPeriod; label: string }> = [
  { value: "any", label: "Qualquer data" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

export type SuspensionReasonGroup = "all" | "no_show" | "late_withdrawal" | "manual";

export const REASON_GROUP_OPTIONS: Array<{ value: SuspensionReasonGroup; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "no_show", label: "Falta sem aviso" },
  { value: "late_withdrawal", label: "Desistência em cima da hora" },
  { value: "manual", label: "Feita pelo suporte" },
];

export interface SuspensionFilters {
  situation: SuspensionSituation;
  q: string;
  period: SuspensionPeriod;
  reason: SuspensionReasonGroup;
  order: SuspensionOrder;
  /** D5, fatia A2b: `userId` da empresa ("" = todas). */
  company: string;
  /** D5, fatia A2b: chave da cidade (`placeKey`; "" = todas). */
  city: string;
}

export const DEFAULT_FILTERS: SuspensionFilters = {
  situation: "active",
  q: "",
  period: "any",
  reason: "all",
  order: "pending_first",
  company: "",
  city: "",
};

/** Há filtro além da base ("Valendo agora" ou "Todas")? A ordem não conta como filtro. */
export function hasActiveFilters(f: SuspensionFilters): boolean {
  return (
    (f.situation !== "active" && f.situation !== "all") ||
    f.q.trim() !== "" ||
    f.period !== "any" ||
    f.reason !== "all" ||
    f.company !== "" ||
    f.city !== ""
  );
}

/**
 * "Limpar filtros": volta à base da situação escolhida (as "Valendo…" voltam a "Valendo agora";
 * "Cumpridas" e "Levantadas", a "Todas"), sem novo pedido à API, e mantém a ordem.
 */
export function clearFilters(f: SuspensionFilters): SuspensionFilters {
  return { ...DEFAULT_FILTERS, situation: apiFilterOf(f.situation), order: f.order };
}

export function matchesSituation(
  item: Pick<SuspensionItem, "state" | "requiresConversation" | "conversationAt" | "conversationOverdue">,
  situation: SuspensionSituation,
): boolean {
  switch (situation) {
    case "active":
      return isActive(item);
    case "active_pending":
      return isActive(item) && item.requiresConversation && !item.conversationAt;
    case "active_overdue":
      return isActive(item) && item.conversationOverdue === true;
    case "ended":
      return item.state === "ENDED";
    case "lifted":
      return item.state === "LIFTED";
    case "all":
      return true;
  }
}

export function matchesReason(
  item: Pick<SuspensionItem, "reasonKey">,
  reason: SuspensionReasonGroup,
): boolean {
  if (reason === "all") return true;
  if (reason === "manual") return item.reasonKey === "MANUAL";
  if (reason === "no_show") return item.reasonKey.startsWith("NO_SHOW");
  return item.reasonKey.startsWith("LATE_WITHDRAWAL");
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** "Buscar": nome, telefone ou e-mail (sem acento e sem diferença de maiúscula). */
export function matchesSearch(item: Pick<SuspensionItem, "person">, q: string): boolean {
  const term = normalize(q);
  if (!term) return true;
  const { name, email, phone } = item.person;
  if (name && normalize(name).includes(term)) return true;
  if (email && normalize(email).includes(term)) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 3 && !!phone && phone.replace(/\D/g, "").includes(digits);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Meia-noite de Brasília do dia de `now` (Brasília = UTC−3, sem horário de verão desde 2019). */
export function spDayStart(now: Date): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
}

/** "Começou em": hoje, últimos 7 ou 30 dias (contando hoje), sempre no dia de Brasília. */
export function matchesPeriod(
  item: Pick<SuspensionItem, "startsAt">,
  period: SuspensionPeriod,
  now: Date,
): boolean {
  if (period === "any") return true;
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const from = spDayStart(now).getTime() - (days - 1) * DAY_MS;
  return new Date(item.startsAt).getTime() >= from;
}

/**
 * Filtra e ordena as linhas carregadas. "Conversa pendente primeiro" mantém a ordem da API;
 * "Mais recentes primeiro" ordena pelo início, da mais nova para a mais antiga.
 */
export function applySuspensionFilters(
  items: SuspensionItem[],
  f: SuspensionFilters,
  now: Date,
): SuspensionItem[] {
  const out = items.filter(
    (item) =>
      matchesSituation(item, f.situation) &&
      matchesReason(item, f.reason) &&
      matchesPeriod(item, f.period, now) &&
      matchesSearch(item, f.q) &&
      matchesPlace(item, f.company, f.city),
  );
  if (f.order === "newest") {
    out.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }
  return out;
}

/** "Mostrando 12 de 40 suspensões carregadas." */
export function countText(shown: number, loaded: number): string {
  const noun = loaded === 1 ? "suspensão carregada" : "suspensões carregadas";
  return `Mostrando ${shown} de ${loaded} ${noun}.`;
}

export const LIMIT_LEGEND =
  "A lista carrega até 100 suspensões: primeiro as que esperam conversa, depois as mais recentes. Datas no horário de Brasília.";
export const LIMIT_REACHED_TEXT =
  "Chegou ao limite de 100: as suspensões mais antigas não aparecem aqui.";

/** Texto do vazio: sem nada carregado (pela base) ou com filtro que não achou nada. */
export function emptyText(situation: SuspensionSituation, loaded: number): string {
  if (loaded > 0) {
    return `Nenhuma suspensão com esses filtros entre as ${loaded} carregadas.`;
  }
  return apiFilterOf(situation) === "active" ? EMPTY_TEXT : EMPTY_ALL_TEXT;
}

/** O `?s=<id>` do detalhe (lido de `window.location`, como o `/jobs` faz). */
export function suspensionIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("s")?.trim();
  return id && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
}

/** "18h" ou "18h30" (Brasília). */
export function timeLabel(iso: string): string {
  const p = parts(iso, SP_TZ);
  return p.minute === "00" ? `${Number(p.hour)}h` : `${Number(p.hour)}h${p.minute}`;
}

/** Bloco "Por quê": quem criou a suspensão. */
export function createdByText(
  item: Pick<SuspensionItem, "createdByKind" | "manualReason" | "createdByAdminName">,
): string {
  if (item.createdByKind === "SYSTEM") return "Automática, pela regra de faltas e desistências";
  const who = item.createdByAdminName ? `Feita pelo suporte (${item.createdByAdminName})` : "Feita pelo suporte";
  return item.manualReason ? `${who}: “${item.manualReason}”` : who;
}

/** Bloco "A ocorrência": "Falta sem aviso, registrada em sáb 07/11 às 23h40". */
export function occurrenceText(item: Pick<SuspensionItem, "reasonKey" | "source">): string | null {
  if (!item.source) return null;
  const kind = item.reasonKey.startsWith("LATE_WITHDRAWAL")
    ? "Desistência em cima da hora"
    : "Falta sem aviso";
  return item.source.createdAt ? `${kind}, registrada em ${deadlineLabel(item.source.createdAt)}` : kind;
}

/** Bloco "Contestação". Nulo na suspensão sem ocorrência. */
export function contestText(item: Pick<SuspensionItem, "source">): string | null {
  const s = item.source;
  if (!s) return null;
  if (s.status === "ANNULLED") return "Ocorrência anulada: os pontos voltaram.";
  if (s.status === "CONTESTED") {
    const when = s.contestedAt ? ` em ${dayLabel(s.contestedAt)}` : "";
    const reason = contestReasonLabel(s.contestReason);
    const why = reason ? ` Motivo: ${reason}.` : "";
    const quote = s.justification ? ` “${s.justification}”` : "";
    return `Contestou${when}.${why}${quote}`;
  }
  if (s.status === "RESOLVED") {
    const when = s.resolvedAt ? ` em ${shortDate(s.resolvedAt)}` : "";
    return s.contestedAt ? `Contestação negada${when}` : `Ocorrência mantida pelo suporte${when}`;
  }
  if (s.contest.status === "OPEN") {
    return s.contest.until
      ? `Pode contestar até ${deadlineLabel(s.contest.until)}`
      : "Pode contestar (ocorrência sem prazo)";
  }
  return "Prazo encerrado sem contestação";
}

/** Bloco "Conversa". */
export function conversationDetail(
  item: Pick<
    SuspensionItem,
    | "requiresConversation"
    | "conversationAt"
    | "conversationNote"
    | "conversationOverdue"
    | "endsAt"
    | "conversationByName"
  >,
): string {
  if (!item.requiresConversation) return "Não exigida";
  if (item.conversationAt) {
    const by = item.conversationByName ? ` por ${item.conversationByName}` : "";
    const note = item.conversationNote ? `: “${item.conversationNote}”` : "";
    return `Feita em ${shortDate(item.conversationAt)}${by}${note}`;
  }
  if (item.conversationOverdue) {
    return item.endsAt
      ? "Atrasada: a data de volta passou e ninguém registrou a conversa"
      : "Atrasada: passaram 48 horas e ninguém registrou a conversa";
  }
  return "Pendente";
}

const LIFTED_REASON_LABEL: Record<string, string> = {
  CONTEST_ACCEPTED: "Contestação aceita",
  SYSTEM_ERROR: "Erro do sistema",
  OTHER: "Outro",
  INFRACTION_ANNULLED: "Ocorrência anulada",
};

/** Bloco "Levantada": "Levantada em 11/11. Motivo: Erro do sistema. “…”". Nulo se não foi. */
export function liftedText(
  item: Pick<SuspensionItem, "liftedAt" | "liftedReason" | "liftedNote" | "liftedByName">,
): string | null {
  if (!item.liftedAt) return null;
  const by = item.liftedByName ? ` por ${item.liftedByName}` : "";
  const reason = item.liftedReason
    ? ` Motivo: ${LIFTED_REASON_LABEL[item.liftedReason] ?? item.liftedReason}.`
    : "";
  const note = item.liftedNote ? ` “${item.liftedNote}”` : "";
  return `Levantada em ${shortDate(item.liftedAt)}${by}.${reason}${note}`;
}

/** Bloco "Vaga": "Garçom · sáb 07/11, 18h". Nulo sem vaga (suspensão feita pelo suporte). */
export function vacancyText(item: Pick<SuspensionItem, "vacancy">): string | null {
  const v = item.vacancy;
  if (!v) return null;
  const title = v.title ?? "Vaga";
  if (!v.startTime) return title;
  return `${title} · ${dayLabel(v.startTime)}, ${timeLabel(v.startTime)}`;
}

export const NO_VACANCY_TEXT = "Feita pelo suporte, sem vaga ligada.";

/** "Abrir a vaga em outra aba": o link pronto do `/jobs` (o mesmo da Fila do suporte). */
export function vacancyHref(vacancyId: string): string {
  return `/jobs?vaga=${encodeURIComponent(vacancyId)}`;
}

// ------------------------------------------------------------ empresa e cidade (D5, fatia A2b)

/**
 * A API já manda empresa, cidade e nomes (fatia A2a)? A presença de `liftedByName` (chave de topo,
 * sempre presente na API nova, mesmo nula) diz que sim. Com a API antiga, os filtros de empresa e
 * cidade ficam escondidos e o resto funciona.
 */
export function hasPlaceFields(items: SuspensionItem[]): boolean {
  return items.some((item) => "liftedByName" in item);
}

export const OLD_API_PLACE_TEXT =
  "Empresa e cidade ainda não chegam do servidor. Os outros filtros funcionam.";
export const PLACE_FILTER_NOTICE =
  "Com empresa ou cidade escolhida, as suspensões feitas pelo suporte sem vaga não aparecem.";

/** Chave da cidade: "Osasco|SP". Nula sem cidade. */
export function placeKey(item: Pick<SuspensionItem, "vacancy">): string | null {
  const city = item.vacancy?.city;
  return city ? `${city}|${item.vacancy?.uf ?? ""}` : null;
}

function cityName(key: string): string {
  const [city, uf] = key.split("|");
  return uf ? `${city}/${uf}` : city;
}

export function matchesPlace(
  item: Pick<SuspensionItem, "vacancy">,
  company: string,
  city: string,
): boolean {
  if (company && item.vacancy?.company?.userId !== company) return false;
  if (city && placeKey(item) !== city) return false;
  return true;
}

/** As empresas presentes nas linhas carregadas, em ordem alfabética. */
export function companyOptions(items: SuspensionItem[]): Array<{ value: string; label: string }> {
  const byId = new Map<string, string>();
  for (const item of items) {
    const c = item.vacancy?.company;
    if (c && !byId.has(c.userId)) byId.set(c.userId, c.name ?? "Empresa sem nome");
  }
  return [...byId.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** As cidades presentes nas linhas carregadas, em ordem alfabética ("Osasco/SP"). */
export function cityOptions(items: SuspensionItem[]): Array<{ value: string; label: string }> {
  const keys = new Set<string>();
  for (const item of items) {
    const key = placeKey(item);
    if (key) keys.add(key);
  }
  return [...keys]
    .map((value) => ({ value, label: cityName(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Coluna "Empresa · cidade": "Coco Bambu Osasco · Osasco/SP"; "—" sem nada. */
export function placeText(item: Pick<SuspensionItem, "vacancy">): string {
  const company = item.vacancy?.company?.name ?? null;
  const key = placeKey(item);
  const city = key ? cityName(key) : null;
  return [company, city].filter(Boolean).join(" · ") || "—";
}

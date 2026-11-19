import { apiErrorOf } from "../infrastructure/api-error";
import type {
  DecideOccurrenceBody,
  DecideOccurrenceResult,
  OccurrenceChoice,
  OccurrenceContactResult,
  OccurrenceContestAnswer,
  OccurrenceDecisionKind,
  OccurrenceDecisionRecord,
  OccurrenceDetail,
  OccurrenceItem,
  OccurrenceOptions,
  OccurrenceTab,
} from "../infrastructure/occurrences-api";
import { dayLabel, deadlineLabel, shortDate } from "./suspensions-presentation";

/**
 * Textos e regras de tela da fila de ocorrências (D5, fatia C2; desenho D5 §C.1 a §C.3). Puro (sem
 * React). Os textos usam o primeiro nome da pessoa no lugar de "ela" ou "ele" (sem supor gênero).
 * Datas sempre em Brasília.
 */

const SP_TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 3_600_000;

// ------------------------------------------------------------ estados da página

/** A chave da API está desligada: a rota respondeu 404 `FEATURE_DISABLED`. */
export function isOccurrencesDisabled(error: unknown): boolean {
  const e = apiErrorOf(error);
  return e.status === 404 && e.code === "FEATURE_DISABLED";
}

export const DISABLED_TEXT =
  "As ocorrências ainda não estão ligadas. As faltas continuam em Suspensões.";
export const NO_SINCE_TEXT =
  "A fila ainda não tem data de início, por isso está vazia. As faltas continuam em Suspensões.";
export const LIST_ERROR_TEXT =
  "Não conseguimos carregar as ocorrências. Verifique a conexão e clique em Tentar de novo.";
export const DETAIL_ERROR_TEXT =
  "Não conseguimos carregar o caso. Verifique a conexão e clique em Tentar de novo.";
export const NOT_FOUND_TEXT =
  "Este caso não está na fila (não é falta sem aviso desde o início da fila).";

export function headerDescription(since: string | null): string {
  const desde = since ? ` desde ${dayLabel(since)}` : "";
  return `Faltas sem aviso registradas${desde}. O sistema já tirou os pontos e aplicou a suspensão; aqui você confirma ou troca.`;
}

export function openCountHint(since: string | null): string {
  const desde = since ? ` desde ${shortDate(since)}` : "";
  return `Faltas sem aviso${desde} sem decisão, contando as contestações sem resposta.`;
}

export function tabLabel(tab: OccurrenceTab, openCount: number | null): string {
  if (tab === "open") return openCount === null ? "Para decidir" : `Para decidir (${openCount})`;
  return tab === "decided" ? "Decididas" : "Todas";
}

export function emptyText(tab: OccurrenceTab, filtered: boolean): string {
  if (filtered) return "Nenhuma ocorrência com esses filtros.";
  if (tab === "open") return "Nenhuma falta esperando decisão.";
  if (tab === "decided") return "Nenhuma decisão registrada ainda.";
  return "Nenhuma falta sem aviso na fila ainda.";
}

/** Busca no navegador: nome, telefone, e-mail, empresa ou cidade. */
export function matchesQuery(item: OccurrenceItem, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, "");
  const hay = [
    item.person.name,
    item.person.email,
    item.vacancy.company?.name,
    item.vacancy.city,
    item.vacancy.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (hay.includes(term)) return true;
  return digits.length >= 4 && (item.person.phone ?? "").replace(/\D/g, "").includes(digits);
}

// ------------------------------------------------------------ datas

/** "AAAA-MM-DD" do dia civil em Brasília. */
export function brasiliaDateKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Meia-noite de Brasília (UTC−3, sem horário de verão desde 2019) do dia `key` + `days`. */
function midnightAfter(key: string, days: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 3, 0, 0, 0));
}

/** Dias civis de Brasília entre dois instantes. */
function civilDaysBetween(fromIso: string, toIso: string): number {
  const a = midnightAfter(brasiliaDateKey(new Date(fromIso)), 0).getTime();
  const b = midnightAfter(brasiliaDateKey(new Date(toIso)), 0).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** "10h05" (Brasília). */
export function hourLabel(iso: string): string {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: SP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// ------------------------------------------------------------ o caso

export function firstName(item: Pick<OccurrenceItem, "person">): string {
  const first = (item.person.name ?? "").trim().split(/\s+/)[0];
  return first || "a pessoa";
}

/** "Garçom · sáb 07/11, 18h" */
export function vacancyLine(item: OccurrenceItem): string {
  const title = item.vacancy.title ?? "Vaga";
  // Como em Suspensões: `startTime` é o instante do início (dia e hora).
  if (item.vacancy.startTime) {
    return `${title} · ${dayLabel(item.vacancy.startTime)}, ${hourLabel(item.vacancy.startTime)}`;
  }
  // `date` é o dia civil gravado à meia-noite UTC: lido pelo meio do dia, para não voltar um dia.
  if (item.vacancy.date) return `${title} · ${dayLabel(`${item.vacancy.date.slice(0, 10)}T15:00:00.000Z`)}`;
  return title;
}

/** "Coco Bambu · Osasco" (vazio quando não se sabe). */
export function placeLine(item: OccurrenceItem): string {
  const parts = [item.vacancy.company?.name, item.vacancy.city].filter(Boolean);
  return parts.join(" · ");
}

/** "O que o sistema registrou", uma frase pela origem (C.2). */
export function systemRecordedText(item: OccurrenceItem): string {
  const n = firstName(item);
  switch (item.createdBy) {
    case "attendance_v2":
      return `A empresa respondeu "Não compareceu" e a falta ficou confirmada: ${n} disse que não foi, ou o suporte decidiu falta na Verificação de serviços.`;
    case "contractor_not_arrived":
      return `A empresa marcou "Não chegou". Se a empresa mantiver ${n} ou o serviço começar com ${n} na vaga, a falta sai sozinha.`;
    case "system":
      return "O sistema marcou falta: o serviço não teve início registrado.";
    default:
      return "Falta sem aviso registrada.";
  }
}

/** "−5 pontos (nota de 100 para 95)" */
export function pointsLine(item: OccurrenceItem): string {
  return `−${item.pointsLost} pontos (nota de ${item.reputationBefore} para ${item.reputationAfter})`;
}

/** Os dias da regra que a escada aplicou ("a regra publicada para este caso"). */
export function appliedDays(item: OccurrenceItem): number | null {
  const a = item.applied;
  if (!a?.endsAt) return null;
  return civilDaysBetween(a.startsAt, a.endsAt);
}

/** "O que o sistema aplicou": "7 dias + conversa · volta sáb 14/11". */
export function appliedLabel(item: OccurrenceItem): string {
  const a = item.applied;
  if (!a) return "Só os pontos";
  if (a.liftedAt) return `Levantada em ${shortDate(a.liftedAt)}`;
  const pending = a.requiresConversation && !a.conversationAt;
  const days = appliedDays(item);
  if (a.state === "ENDED") return a.endsAt ? `Cumprida em ${dayLabel(a.endsAt)}` : "Cumprida";
  const what = [days ? `${days} dias` : null, pending ? "conversa" : null]
    .filter(Boolean)
    .join(" + ");
  if (!a.endsAt) return `Até a conversa`;
  return `${what || "Suspensão"} · volta ${dayLabel(a.endsAt)}`;
}

/** "Contestação": prazo, a responder, negada, aceita ou "—". */
export function contestLabel(item: OccurrenceItem): string {
  const c = item.contest;
  switch (c.status) {
    case "OPEN":
      return c.until ? `Pode contestar até ${deadlineLabel(c.until)}` : "Pode contestar";
    case "SENT":
      return "Contestação a responder";
    case "DENIED":
      return "Contestação negada";
    case "ACCEPTED":
      return "Contestação aceita";
    default:
      return "—";
  }
}

const KIND_LABEL: Record<OccurrenceDecisionKind, string> = {
  KEEP: "Manter o que o sistema aplicou",
  RELEASE: "Liberar",
  WARNING: "Liberar com advertência",
  SUSPEND: "Suspender",
  ANNUL: "Anular a falta",
  BAN: "Banir",
};

export function decisionKindLabel(kind: OccurrenceDecisionKind, days: number | null): string {
  return kind === "SUSPEND" && days ? `Suspender ${days} dias` : KIND_LABEL[kind];
}

/** Coluna "Decisão" das Decididas: "Suspender 30 dias · Ana, 18/11". */
export function decisionShort(item: OccurrenceItem): string {
  const d = item.decision;
  if (!d) return "—";
  const who = d.decidedByName ?? "suporte";
  return `${decisionKindLabel(d.decision, d.suspensionDays)} · ${who}, ${shortDate(d.decidedAt)}`;
}

function decisionVerb(d: Pick<OccurrenceDecisionRecord, "decision" | "suspensionDays" | "suspensionEndsAt">) {
  switch (d.decision) {
    case "KEEP":
      return "manter o que o sistema aplicou";
    case "RELEASE":
      return "liberar";
    case "WARNING":
      return "liberar com advertência";
    case "SUSPEND":
      return `suspender por ${d.suspensionDays} dias${d.suspensionEndsAt ? ` (até ${dayLabel(d.suspensionEndsAt)})` : ""}`;
    case "ANNUL":
      return "anular a falta";
    default:
      return "banir";
  }
}

/** "Decidido por Ana em qua 18/11 às 10h05: suspender por 30 dias (até sex 18/12)." */
export function decisionLine(d: OccurrenceDecisionRecord): string {
  const who = d.decidedByName ?? "alguém do suporte";
  const contest =
    d.contestAnswer === "ACCEPTED"
      ? " Contestação aceita."
      : d.contestAnswer === "DENIED"
        ? " Contestação negada."
        : "";
  return `Decidido por ${who} em ${dayLabel(d.decidedAt)} às ${hourLabel(d.decidedAt)}: ${decisionVerb(d)}.${contest}`;
}

/** "Desfeito por Ana em 19/11: '…'" ou "Desfeito porque a falta foi anulada em 19/11." */
export function revokedLine(d: OccurrenceDecisionRecord): string | null {
  if (!d.revokedAt) return null;
  if (d.revokedKind === "INFRACTION_ANNULLED") {
    return `Desfeito porque a falta foi anulada em ${shortDate(d.revokedAt)}.`;
  }
  const who = d.revokedByName ?? "alguém do suporte";
  return `Desfeito por ${who} em ${shortDate(d.revokedAt)}: "${d.revokedReason ?? ""}".`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Últimos 90 dias, em Empresas: 2 faltas sem aviso · 1 desistência em cima da hora · 1 suspensão." */
export function historyLine(h: OccurrenceDetail["history"]): string {
  return `Últimos ${h.days} dias, em Empresas: ${plural(h.noShows, "falta sem aviso", "faltas sem aviso")} · ${plural(
    h.lateWithdrawals,
    "desistência em cima da hora",
    "desistências em cima da hora",
  )} · ${plural(h.suspensions, "suspensão", "suspensões")}.`;
}

/** A suspensão automática ainda tira acesso agora. */
export function appliedInForce(item: OccurrenceItem): boolean {
  const s = item.applied?.state;
  return s === "DATED" || s === "DATED_AND_CONVERSATION" || s === "CONVERSATION_ONLY";
}

// ------------------------------------------------------------ o formulário "Decidir o caso"

export type ReleaseMode = "NONE" | "WARNING";

export interface DecideFormState {
  whatHappened: string;
  contact: OccurrenceContactResult | "";
  providerSaid: string;
  contestAnswer: OccurrenceContestAnswer | "";
  choice: OccurrenceChoice | "";
  releaseMode: ReleaseMode;
  days: number | null;
}

export function initialFormState(detail: Pick<OccurrenceDetail, "releaseDefault">): DecideFormState {
  return {
    whatHappened: "",
    contact: "",
    providerSaid: "",
    contestAnswer: "",
    choice: "",
    releaseMode: detail.releaseDefault,
    days: null,
  };
}

export const CONTACT_OPTIONS: Array<{ value: OccurrenceContactResult; label: string }> = [
  { value: "CALL", label: "Liguei e falei" },
  { value: "WHATSAPP", label: "Falei pelo WhatsApp" },
  { value: "NO_ANSWER", label: "Tentei e não consegui" },
  { value: "NOT_TRIED", label: "Não tentei" },
];

export const CONTEST_OPTIONS: Array<{ value: OccurrenceContestAnswer; label: string }> = [
  { value: "ACCEPTED", label: "Aceitar: não foi falta" },
  { value: "DENIED", label: "Negar: a falta continua" },
];

export const RELEASE_MODE_OPTIONS: Array<{ value: ReleaseMode; label: string }> = [
  { value: "NONE", label: "Liberar sem nada" },
  { value: "WARNING", label: "Liberar com advertência" },
];

export function contestQuestion(item: OccurrenceItem): string {
  const n = firstName(item);
  const said = item.contest.justification ? `: "${item.contest.justification}"` : "";
  return `${n} contestou${said}. Você aceita?`;
}

export function contestDeniedHint(item: OccurrenceItem): string {
  return `${firstName(item)} recebe "Mantivemos a ocorrência".`;
}

const reached = (c: DecideFormState["contact"]) => c === "CALL" || c === "WHATSAPP";

/** A dica do "Manter": a volta real (C.3, passo 5). */
export function keepHint(item: OccurrenceItem, contact: DecideFormState["contact"], now: Date): string {
  const a = item.applied;
  const n = firstName(item);
  if (!a) return "";
  const pending = a.requiresConversation && !a.conversationAt;
  const future = a.endsAt !== null && new Date(a.endsAt).getTime() > now.getTime();
  const until = a.endsAt ? ` até ${dayLabel(a.endsAt)}` : "";
  if (!pending) {
    return future
      ? `Continua sem se candidatar${until}.`
      : `A suspensão terminou${a.endsAt ? ` em ${dayLabel(a.endsAt)}` : ""}; ${n} já pode se candidatar. Nada muda.`;
  }
  if (reached(contact)) {
    return future
      ? `A conversa fica registrada. ${n} volta em ${dayLabel(a.endsAt as string)}.`
      : `A conversa fica registrada e ${n} já pode se candidatar.`;
  }
  return `Continua sem se candidatar${future ? until : ""} e só volta depois que alguém registrar a conversa.`;
}

/** A janela da "2ª falta" vem da API (`repeatWindowDays`); API sem o campo = 60, o padrão da escada. */
export function releaseHint(item: OccurrenceItem, repeatWindowDays = 60): string {
  const n = firstName(item);
  return `${n} pode se candidatar já. A falta e os pontos continuam no histórico e contam se ${n} faltar de novo em ${repeatWindowDays} dias.`;
}

export function warningHint(item: OccurrenceItem, noticesEnabled: boolean): string {
  return noticesEnabled
    ? `${firstName(item)} recebe a advertência pelo WhatsApp.`
    : "A advertência fica registrada no histórico. O aviso pelo WhatsApp ainda não está ligado.";
}

/** Fim da suspensão pela ocorrência: conta do início da automática (D6), como a API. */
export function suspensionEndPreview(item: OccurrenceItem, days: number, now: Date): Date {
  const base = item.applied ? new Date(item.applied.startsAt) : now;
  return midnightAfter(brasiliaDateKey(base), days);
}

export function suspendServed(item: OccurrenceItem, days: number, now: Date): boolean {
  return suspensionEndPreview(item, days, now).getTime() <= now.getTime();
}

export function suspendHint(item: OccurrenceItem, days: number, now: Date): string {
  const n = firstName(item);
  if (suspendServed(item, days, now)) {
    return `Os ${days} dias contados do início da suspensão automática já passaram. Escolha Manter ou Liberar.`;
  }
  const end = suspensionEndPreview(item, days, now).toISOString();
  const from = item.applied ? ` Os dias contam do início da suspensão automática (${dayLabel(item.applied.startsAt)}).` : "";
  return `${n} fica sem se candidatar até ${dayLabel(end)}. Isso substitui a suspensão automática (não soma) e a volta não depende de conversa.${from}`;
}

export function annulHint(item: OccurrenceItem): string {
  const notice = appliedInForce(item)
    ? `${firstName(item)} recebe "Você já pode se candidatar de novo".`
    : `${firstName(item)} não recebe aviso.`;
  return `Os ${item.pointsLost} pontos voltam e a suspensão desta falta sai. Use quando a empresa errou ou o sistema falhou. ${notice}`;
}

export type DecideErrors = Partial<
  Record<"whatHappened" | "contact" | "contestAnswer" | "choice" | "days", string>
>;

/** A escolha final do formulário ("Aceitar a contestação" é anular). */
export function effectiveChoice(form: DecideFormState, options: OccurrenceOptions) {
  if (options.needsContestAnswer && form.contestAnswer === "ACCEPTED") return "ANNUL" as const;
  if (options.contestOnly && form.contestAnswer === "DENIED") return "CONTEST_ONLY" as const;
  return form.choice || null;
}

export function validateDecideForm(
  form: DecideFormState,
  options: OccurrenceOptions,
  item: OccurrenceItem,
  now: Date,
): DecideErrors {
  const errors: DecideErrors = {};
  if (form.whatHappened.trim().length < 10) errors.whatHappened = "Escreva pelo menos 10 letras.";
  if (!form.contact) errors.contact = `Diga se falou com ${firstName(item)}.`;
  if (options.needsContestAnswer && !form.contestAnswer) errors.contestAnswer = "Responda a contestação.";
  const choice = effectiveChoice(form, options);
  if (!choice) errors.choice = "Escolha o que fazer.";
  if (choice === "SUSPEND") {
    if (!form.days) errors.days = "Escolha por quantos dias.";
    else if (suspendServed(item, form.days, now)) errors.days = "Esses dias já foram cumpridos.";
  }
  return errors;
}

export function buildDecideBody(form: DecideFormState, options: OccurrenceOptions): DecideOccurrenceBody {
  const choice = effectiveChoice(form, options);
  const body: DecideOccurrenceBody = {
    whatHappened: form.whatHappened.trim(),
    contactResult: form.contact as OccurrenceContactResult,
  };
  if (form.providerSaid.trim()) body.providerSaid = form.providerSaid.trim();
  if (options.needsContestAnswer && form.contestAnswer) body.contestAnswer = form.contestAnswer;
  if (choice && choice !== "CONTEST_ONLY") body.decision = choice;
  if (choice === "RELEASE") body.warning = form.releaseMode === "WARNING";
  if (choice === "SUSPEND" && form.days) body.days = form.days;
  return body;
}

/** O verbo do botão (C.3, passo 6). */
export function submitLabel(
  form: DecideFormState,
  options: OccurrenceOptions,
  item: OccurrenceItem,
  now: Date,
): string {
  const choice = effectiveChoice(form, options);
  switch (choice) {
    case "CONTEST_ONLY":
      return "Negar a contestação";
    case "KEEP":
      return "Manter e registrar";
    case "RELEASE":
      return "Liberar agora";
    case "SUSPEND":
      return form.days && !suspendServed(item, form.days, now)
        ? `Suspender até ${dayLabel(suspensionEndPreview(item, form.days, now).toISOString())}`
        : "Suspender";
    case "ANNUL":
      return "Anular a falta";
    default:
      return "Escolha o que fazer";
  }
}

/** A confirmação antes de mandar: anular (sem volta) e suspender 30 dias ou mais. */
export function confirmationOf(
  form: DecideFormState,
  options: OccurrenceOptions,
  item: OccurrenceItem,
  now: Date,
): { title: string; body: string; action: string } | null {
  const n = firstName(item);
  const choice = effectiveChoice(form, options);
  if (choice === "ANNUL") {
    const after = Math.min(100, item.reputationAfter + item.pointsLost);
    const notice = appliedInForce(item)
      ? `${n} recebe "Você já pode se candidatar de novo".`
      : `${n} não recebe aviso.`;
    return {
      title: `Anular a falta de ${n}?`,
      body: `Os ${item.pointsLost} pontos voltam (nota de ${item.reputationAfter} para ${after}) e a suspensão desta falta sai agora. ${notice} Não tem volta: falta anulada não reabre.`,
      action: "Anular a falta",
    };
  }
  if (choice === "SUSPEND" && form.days && form.days >= 30) {
    const end = suspensionEndPreview(item, form.days, now).toISOString();
    const rule = appliedDays(item);
    const ruleText =
      rule && rule !== form.days ? ` A regra publicada para este caso é ${rule} dias.` : "";
    return {
      title: `Suspender ${n} por ${form.days} dias?`,
      body: `${n} fica sem se candidatar até ${dayLabel(end)}.${ruleText}`,
      action: `Suspender até ${shortDate(end)}`,
    };
  }
  return null;
}

/** A mensagem de sucesso (C.3, "Mensagens"). */
export function successText(result: DecideOccurrenceResult, item: OccurrenceItem): string {
  const n = firstName(item);
  if (result.outcome === "ANNULLED") return "Falta anulada. Os pontos voltaram.";
  const denied = result.contestAnswer === "DENIED" ? ' Mandamos "Mantivemos a ocorrência" pelo app.' : "";
  if (result.outcome === "CONTEST_DENIED") {
    return `Contestação negada. A decisão que já valia continua.${denied}`;
  }
  const kind = result.decision?.decision;
  if (kind === "SUSPEND" && result.effects.suspendedUntil) {
    return `${n} fica sem se candidatar até ${shortDate(result.effects.suspendedUntil)}. Mandamos o aviso pelo app.${denied}`;
  }
  if ((kind === "RELEASE" || kind === "WARNING") && result.effects.liftedAutomatic) {
    return result.effects.stillSuspended
      ? `Decisão registrada. ${n} continua sem se candidatar por outra suspensão.${denied}`
      : `${n} já pode se candidatar. Mandamos o aviso pelo app.${denied}`;
  }
  const conversa = result.effects.conversationRegistered ? " Conversa registrada." : "";
  return `Decisão registrada.${conversa}${denied}`;
}

export const NETWORK_ERROR_TEXT =
  "Não conseguimos registrar a decisão. Verifique a conexão e clique em Tentar de novo. O que você escreveu continua aqui.";

/** O texto do erro pelo CÓDIGO (não pela mensagem da API) e o botão que o acompanha. */
export function decideErrorOf(
  err: unknown,
  item: OccurrenceItem,
): { text: string; action: "reload" | "retry" | null } {
  const e = apiErrorOf(err);
  const n = firstName(item);
  switch (e.code) {
    case "OCCURRENCE_ALREADY_DECIDED": {
      const d = e.extra.details as
        | {
            decision?: OccurrenceDecisionKind;
            suspensionDays?: number | null;
            decidedAt?: string;
            decidedByName?: string | null;
            decidedByMe?: boolean;
          }
        | undefined;
      if (d?.decidedByMe) {
        return { text: "Você já tinha registrado uma decisão para este caso. Nada mudou.", action: "reload" };
      }
      const what =
        d?.decision && d.decidedAt
          ? ` (${d.decidedByName ?? "suporte"}, ${hourLabel(d.decidedAt)}: ${decisionKindLabel(d.decision, d.suspensionDays ?? null).toLowerCase()})`
          : "";
      return {
        text: `Outra pessoa já decidiu este caso${what}. Sua escolha não foi aplicada. O que você escreveu continua aqui.`,
        action: "reload",
      };
    }
    case "OCCURRENCE_ANNULLED":
      return {
        text: `Esta falta foi anulada enquanto você decidia (a empresa manteve ${n} na vaga ou a contestação foi aceita). Não há mais o que decidir e nada foi aplicado.`,
        action: "reload",
      };
    case "OCCURRENCE_CONTESTED":
      return {
        text: `${n} contestou enquanto você decidia. Recarregue o caso para responder a contestação. O que você escreveu continua aqui.`,
        action: "reload",
      };
    case "OCCURRENCE_CONTEST_ALREADY_ANSWERED":
      return {
        text: "Outra pessoa já respondeu a contestação. Recarregue o caso. O que você escreveu continua aqui.",
        action: "reload",
      };
    default:
      if (e.status !== null && e.status >= 400 && e.status < 500 && e.message) {
        return { text: e.message, action: null };
      }
      return { text: NETWORK_ERROR_TEXT, action: "retry" };
  }
}

/** "Desfazer a decisão": o que acontece, por decisão (C.3). */
export function revokeHint(d: OccurrenceDecisionRecord, item: OccurrenceItem): string {
  const n = firstName(item);
  const back = " O caso volta para Para decidir. O aviso já mandado não é apagado.";
  switch (d.decision) {
    case "SUSPEND": {
      const until = d.suspensionEndsAt ? ` até ${shortDate(d.suspensionEndsAt)}` : "";
      return `A suspensão${until} sai agora e ${n} recebe "Você já pode se candidatar de novo" (se não tiver outra). A automática não volta.${back}`;
    }
    case "RELEASE":
    case "WARNING":
      return `A suspensão automática não volta. Se quiser suspender, escolha Suspender no caso.${back}`;
    case "KEEP":
      return `A conversa registrada continua.${back}`;
    default:
      return back.trim();
  }
}

export const REVOKE_SUCCESS_TEXT = "Decisão desfeita. O caso voltou para Para decidir.";

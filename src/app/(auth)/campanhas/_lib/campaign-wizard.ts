/**
 * Lógica pura da "Nova campanha em 4 passos" (spec 2026-10-01 campanhas parte 1 §8.2),
 * para a avulsa e a automática: estado, padrões, o que impede de seguir em cada passo e
 * os corpos que vão para a API. Nada aqui toca DOM, rede ou React.
 */
import {
  rowsToContacts,
  toApiContacts,
  type ColumnMapping,
} from "@/modules/admin/application/spreadsheet-contacts";
import {
  EXTERNAL_LIST_AUDIENCE,
  readAlreadyRegistered,
  type AudienceFilters,
  type BaseAudience,
  type Campaign,
  type CreateCampaignPayload,
  type ExternalContact,
  type ExternalListPreview,
  type UpdateCampaignPayload,
} from "@/modules/admin/infrastructure/referrals-api";
import type {
  CampaignChannel,
  CampaignTemplate,
  CampaignTemplateAudience,
  UpsertCampaignTemplatePayload,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import type { MarketingTemplateStatus } from "@/modules/admin/infrastructure/marketing-templates-api";
import { codePointLength, statusInSentence } from "./marketing-template-rules";

const SP_TZ = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

export type WizardKind = "avulsa" | "automatica";
export type WizardAudience = BaseAudience | typeof EXTERNAL_LIST_AUDIENCE;
export type WizardStep = 1 | 2 | 3 | 4;
export type AccountModule = "bars-restaurants" | "home-services";

export const WIZARD_STEPS: readonly WizardStep[] = [1, 2, 3, 4];
export const STEP_LABELS: Record<WizardStep, string> = {
  1: "Público",
  2: "Mensagem",
  3: "Quando",
  4: "Revisar",
};

export const AUDIENCE_LABELS: Record<WizardAudience, string> = {
  CONTRACTORS_ALL: "Todos os contratantes",
  CONTRACTORS_NEVER_PUBLISHED: "Contratantes que nunca publicaram vaga",
  CONTRACTORS_DORMANT_90D: "Contratantes sem publicar há mais de 90 dias",
  CONTRACTORS_ACTIVE: "Contratantes ativos (já usam a plataforma)",
  PROVIDERS_NEVER_APPLIED: "Freelancers que nunca se candidataram",
  PROVIDERS_DORMANT_90D: "Freelancers sem se candidatar há mais de 90 dias",
  EXTERNAL_LIST: "Planilha (pessoas que aceitaram receber)",
};

const BASE_AUDIENCES: readonly BaseAudience[] = [
  "CONTRACTORS_ALL",
  "CONTRACTORS_NEVER_PUBLISHED",
  "CONTRACTORS_DORMANT_90D",
  "CONTRACTORS_ACTIVE",
  "PROVIDERS_NEVER_APPLIED",
  "PROVIDERS_DORMANT_90D",
];

/** A planilha só existe na avulsa: a automática roda a base de novo a cada execução. */
export function audienceOptionsFor(kind: WizardKind): WizardAudience[] {
  return kind === "avulsa"
    ? [...BASE_AUDIENCES, EXTERNAL_LIST_AUDIENCE]
    : [...BASE_AUDIENCES];
}

export function audienceLabel(audience: string): string {
  return (AUDIENCE_LABELS as Record<string, string>)[audience] ?? audience;
}

/** Tipo de conta (Empresa/Casa) só separa contratante; freelancer está nos dois. */
export function isContractorAudience(audience: string): boolean {
  return audience.startsWith("CONTRACTORS_");
}

export const MODULE_LABELS: Record<AccountModule, string> = {
  "bars-restaurants": "Empresa (bares e restaurantes)",
  "home-services": "Em casa (serviços domésticos)",
};

/** Ritmo padrão com modelo (spec §5.3). */
export const PACING_DEFAULTS = {
  base: { messagesPerHour: 60, dailyCap: 200 },
  externalList: { messagesPerHour: 20, dailyCap: 100 },
  windowStartHour: 9,
  windowEndHour: 18,
  weekdaysOnly: true,
} as const;

/**
 * Preço padrão da mensagem de marketing (`MARKETING_PRICE_BRL` da API). Só a automática
 * usa: a avulsa mostra o preço que vem no resumo da API.
 */
export const DEFAULT_MARKETING_PRICE_BRL = 0.35;
export const SCHEDULE_MAX_DAYS = 60;
export const REPLY_TEXT_MAX = 500;
export const NAME_MIN = 3;
export const NAME_MAX = 120;
export const RADIUS_KM_MAX = 2000;
/** Teto da API por campanha de planilha. */
export const MAX_EXTERNAL_CONTACTS = 5000;

export interface Pacing {
  messagesPerHour: number;
  dailyCap: number;
  windowStartHour: number;
  windowEndHour: number;
  weekdaysOnly: boolean;
}

export interface AudienceCount {
  total: number;
  whatsapp: number;
  email: number;
  excludedByOptOut: number;
  semCoordenada: number;
}

export interface ParsedSheet {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: unknown[][];
}

/** Planilha no passo 1: arquivo lido, colunas escolhidas e a conferência da API. */
export interface ExternalPickerState {
  sheet: ParsedSheet | null;
  mapping: ColumnMapping;
  preview: ExternalListPreview | null;
  /** Marcado por padrão: mandar "vem conhecer" para quem já tem conta gera denúncia. */
  skipRegistered: boolean;
}

export const EMPTY_PICKER: ExternalPickerState = {
  sheet: null,
  mapping: { name: null, phone: null, email: null },
  preview: null,
  skipRegistered: true,
};

export interface ExternalSelection {
  contacts: ExternalContact[];
  listFileName: string;
  skipRegistered: boolean;
  willSend: number;
  whatsapp: number;
  email: number;
  excludedByOptOut: number;
}

export interface WizardState {
  name: string;
  // Passo 1 — público
  audience: WizardAudience;
  modules: AccountModule[];
  ufs: string[];
  cities: string[];
  radiusCity: string;
  radiusKm: number;
  count: AudienceCount | null;
  picker: ExternalPickerState;
  optInConfirmed: boolean;
  // Passo 2 — mensagem
  channels: CampaignChannel[];
  marketingTemplateId: string | null;
  /** Aviso para a tela quando o modelo gravado foi arquivado ou não existe mais. */
  modelNotice: string | null;
  replyText: string;
  replyAlertEmail: string;
  pushTitle: string;
  pushBody: string;
  imageKey: string;
  deepLink: string;
  // Passo 3 — avulsa
  when: "now" | "schedule";
  /** "YYYY-MM-DDTHH:mm" no relógio de Brasília (valor do `<input type="datetime-local">`). */
  scheduleAt: string;
  messagesPerHour: number;
  dailyCap: number;
  windowStartHour: number;
  windowEndHour: number;
  weekdaysOnly: boolean;
  // Passo 3 — automática
  scheduleKind: "WEEKLY" | "DATED";
  weekdays: number[];
  sendHour: number;
  targetMonth: number | null;
  targetDay: number | null;
  repeatsAnnually: boolean;
  targetYear: number | null;
  leadDays: number;
  maxPerRun: number | null;
}

export function pacingFor(audience: WizardAudience): Pacing {
  const base =
    audience === EXTERNAL_LIST_AUDIENCE
      ? PACING_DEFAULTS.externalList
      : PACING_DEFAULTS.base;
  return {
    messagesPerHour: base.messagesPerHour,
    dailyCap: base.dailyCap,
    windowStartHour: PACING_DEFAULTS.windowStartHour,
    windowEndHour: PACING_DEFAULTS.windowEndHour,
    weekdaysOnly: PACING_DEFAULTS.weekdaysOnly,
  };
}

// ── Horário de Brasília ──────────────────────────────────────────────────────

/** "YYYY-MM-DDTHH:mm" do relógio de Brasília (o que o `datetime-local` mostra). */
export function brasiliaLocalInput(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: SP_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Sugestão do agendamento: amanhã às 10h (Brasília). */
export function defaultScheduleAt(now: Date): string {
  // Conta no calendário (dia seguinte ao dia de Brasília), sem somar horas.
  const [year, month, day] = brasiliaLocalInput(now)
    .slice(0, 10)
    .split("-")
    .map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  return `${tomorrow}T10:00`;
}

/**
 * Hora de Brasília digitada → ISO com fuso para a API. O Brasil não tem horário de
 * verão: o fuso de Brasília é sempre -03:00 (rótulo do fuso, não conta de horas).
 */
export function scheduleIsoFromLocal(local: string): string {
  return `${local}:00-03:00`;
}

/** Corpo de `PATCH …/schedule`: `startAt` sempre com o fuso explícito (a API recusa sem). */
export function buildScheduleBody(state: Pick<WizardState, "scheduleAt">): {
  startAt: string;
} {
  return { startAt: scheduleIsoFromLocal(state.scheduleAt) };
}

/** Recusa 31/02, 25h etc. (o `Date` empurraria para o mês seguinte em vez de falhar). */
function isRealLocalDateTime(local: string): boolean {
  const [year, month, day, hour, minute] = local.split(/[-T:]/).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute
  );
}

export function validateSchedule(local: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    return "Escolha a data e a hora do disparo.";
  if (!isRealLocalDateTime(local)) return "Escolha a data e a hora do disparo.";
  const at = new Date(scheduleIsoFromLocal(local));
  if (at.getTime() <= now.getTime()) return "Escolha um horário no futuro.";
  if (at.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS) {
    return "Dá para agendar até 60 dias à frente.";
  }
  return null;
}

/** "sex 02/10 às 10h" / "qui 01/10 às 23h30". */
export function scheduleLabel(local: string): string {
  const at = new Date(scheduleIsoFromLocal(local));
  if (Number.isNaN(at.getTime())) return local;
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    weekday: "short",
  })
    .format(at)
    .replace(".", "");
  const [, month, day] = local.slice(0, 10).split("-");
  const [hour, minute] = local.slice(11, 16).split(":");
  return `${weekday} ${day}/${month} às ${Number(hour)}h${minute === "00" ? "" : minute}`;
}

// ── Estado ───────────────────────────────────────────────────────────────────

export function initialWizardState(
  kind: WizardKind,
  opts: {
    adminEmail?: string;
    audience?: WizardAudience;
    marketingTemplateId?: string | null;
    now?: Date;
  } = {},
): WizardState {
  const audience =
    opts.audience && audienceOptionsFor(kind).includes(opts.audience)
      ? opts.audience
      : "CONTRACTORS_ALL";
  const marketingTemplateId = opts.marketingTemplateId ?? null;
  return {
    name: "",
    audience,
    modules: [],
    ufs: [],
    cities: [],
    radiusCity: "",
    radiusKm: 50,
    count: null,
    picker: EMPTY_PICKER,
    optInConfirmed: false,
    // Avulsa é sempre WhatsApp (+ e-mail para quem não tem telefone); a automática escolhe.
    channels: kind === "avulsa" || marketingTemplateId ? ["WHATSAPP"] : [],
    marketingTemplateId,
    modelNotice: null,
    replyText: "",
    replyAlertEmail: opts.adminEmail ?? "",
    pushTitle: "",
    pushBody: "",
    imageKey: "",
    deepLink: "",
    when: "now",
    scheduleAt: defaultScheduleAt(opts.now ?? new Date()),
    ...pacingFor(audience),
    scheduleKind: "WEEKLY",
    weekdays: [],
    sendHour: 9,
    targetMonth: null,
    targetDay: null,
    repeatsAnnually: true,
    targetYear: null,
    leadDays: 0,
    maxPerRun: null,
  };
}

/** Trocar o público invalida filtros, contagem, planilha e aceite; o ritmo segue o público. */
export function changeAudience(
  state: WizardState,
  audience: WizardAudience,
): WizardState {
  return {
    ...state,
    audience,
    cities: [],
    ufs: [],
    radiusCity: "",
    count: null,
    picker: EMPTY_PICKER,
    optInConfirmed: false,
    modules: isContractorAudience(audience) ? state.modules : [],
    ...pacingFor(audience),
  };
}

const MODEL_ARCHIVED_NOTICE =
  "O modelo escolhido antes foi arquivado e não pode mais ser usado. Escolha outro modelo aprovado.";
const MODEL_MISSING_NOTICE =
  "O modelo escolhido antes não foi encontrado. Escolha outro modelo aprovado.";

/**
 * Modelo gravado que não dá mais para usar: arquivado, ou a API devolveu a relação vazia.
 * `undefined` (a API não mandou a relação) não prova nada: mantém a escolha.
 */
function modelChoice(
  id: string | null | undefined,
  ref: { status: string } | null | undefined,
): { id: string | null; notice: string | null } {
  if (!id) return { id: null, notice: null };
  if (ref === null) return { id: null, notice: MODEL_MISSING_NOTICE };
  if (ref && ref.status === "ARCHIVED")
    return { id: null, notice: MODEL_ARCHIVED_NOTICE };
  return { id, notice: null };
}

/** Avulsa em rascunho → formulário (o público fica travado: foi congelado na criação). */
export function stateFromCampaign(
  campaign: Campaign,
  adminEmail: string,
  now: Date = new Date(),
): WizardState {
  const model = modelChoice(
    campaign.marketingTemplateId,
    campaign.marketingTemplate,
  );
  return {
    ...initialWizardState("avulsa", {
      adminEmail,
      marketingTemplateId: model.id,
      now,
    }),
    modelNotice: model.notice,
    audience: campaign.audience as WizardAudience,
    name: campaign.name,
    replyText: campaign.replyText ?? "",
    replyAlertEmail: campaign.replyAlertEmail ?? adminEmail,
    optInConfirmed: Boolean(campaign.optInConfirmed),
    messagesPerHour: campaign.messagesPerHour,
    dailyCap: campaign.dailyCap,
    windowStartHour: campaign.windowStartHour,
    windowEndHour: campaign.windowEndHour,
    weekdaysOnly: campaign.weekdaysOnly,
  };
}

/** Automática salva → formulário de edição. */
export function stateFromAutomatic(
  template: CampaignTemplate,
  adminEmail: string,
  now: Date = new Date(),
): WizardState {
  const filters = template.audienceFilters;
  const model = modelChoice(
    template.marketingTemplateId,
    template.marketingTemplate,
  );
  return {
    ...initialWizardState("automatica", {
      adminEmail,
      audience: template.audience,
      marketingTemplateId: model.id,
      now,
    }),
    modelNotice: model.notice,
    name: template.name,
    modules: filters?.modules ?? [],
    ufs: filters?.ufs ?? [],
    cities: filters?.cities ?? [],
    channels: template.channels,
    replyText: template.replyText ?? "",
    replyAlertEmail: template.replyAlertEmail ?? adminEmail,
    pushTitle: template.pushTitle ?? "",
    pushBody: template.pushBody ?? "",
    imageKey: template.imageKey ?? "",
    deepLink: template.deepLink ?? "",
    scheduleKind: template.scheduleKind,
    weekdays: template.weekdays ?? [],
    sendHour: template.sendHour ?? 9,
    targetMonth: template.targetMonth ?? null,
    targetDay: template.targetDay ?? null,
    // Sem ano gravado = repete todo ano (mesma convenção de hoje).
    repeatsAnnually: !template.targetYear,
    targetYear: template.targetYear ?? null,
    leadDays: template.leadDays ?? 0,
    maxPerRun: template.maxPerRun ?? null,
  };
}

/** Planilha conferida → o que vai para a API (ou `null` enquanto não dá para criar). */
export function selectionFromPicker(
  picker: ExternalPickerState,
): ExternalSelection | null {
  if (!picker.sheet || !picker.preview) return null;
  const { contacts } = rowsToContacts(picker.sheet.rows, picker.mapping);
  if (contacts.length === 0 || contacts.length > MAX_EXTERNAL_CONTACTS)
    return null;
  const registered = readAlreadyRegistered(picker.preview);
  // Só dá para pular quem já tem conta se a API disser QUAIS linhas são.
  const canSkip = registered.rows !== null && registered.count > 0;
  const skipping = picker.skipRegistered && canSkip;
  return {
    contacts: toApiContacts(contacts),
    listFileName: picker.sheet.fileName,
    skipRegistered: skipping,
    willSend: Math.max(
      0,
      picker.preview.valid - (skipping ? registered.count : 0),
    ),
    whatsapp: picker.preview.byChannel.whatsapp,
    email: picker.preview.byChannel.email,
    excludedByOptOut: picker.preview.excludedByOptOut ?? 0,
  };
}

// ── Corpos da API ────────────────────────────────────────────────────────────

/**
 * Recorte do público. `undefined` quando não há nenhum (lista vazia gravaria "filtrado
 * por nada"). Raio só existe na avulsa e substitui UF e cidades.
 */
export function buildAudienceFilters(
  state: WizardState,
  kind: WizardKind,
): AudienceFilters | undefined {
  const radius =
    kind === "avulsa" && state.radiusCity.trim() && state.radiusKm > 0
      ? { city: state.radiusCity.trim(), km: state.radiusKm }
      : undefined;
  const cities = radius ? [] : state.cities;
  const ufs = radius ? [] : state.ufs;
  const modules = isContractorAudience(state.audience) ? state.modules : [];
  if (!cities.length && !ufs.length && !modules.length && !radius)
    return undefined;
  return {
    ...(cities.length ? { cities } : {}),
    ...(ufs.length ? { ufs } : {}),
    ...(modules.length ? { modules } : {}),
    ...(radius ? { radius } : {}),
  };
}

function pacingPayload(state: WizardState): Pacing {
  return {
    messagesPerHour: state.messagesPerHour,
    dailyCap: state.dailyCap,
    windowStartHour: state.windowStartHour,
    windowEndHour: state.windowEndHour,
    weekdaysOnly: state.weekdaysOnly,
  };
}

/** Avulsa nova (nasce DRAFT; o público é congelado aqui); o WhatsApp vai só pelo modelo. */
export function buildCreatePayload(state: WizardState): CreateCampaignPayload {
  const common = {
    name: state.name.trim(),
    marketingTemplateId: state.marketingTemplateId ?? "",
    replyText: state.replyText.trim() || null,
    replyAlertEmail: state.replyAlertEmail.trim() || null,
    ...pacingPayload(state),
  };
  if (state.audience === EXTERNAL_LIST_AUDIENCE) {
    const selection = selectionFromPicker(state.picker);
    return {
      ...common,
      audience: EXTERNAL_LIST_AUDIENCE,
      contacts: selection?.contacts ?? [],
      ...(selection
        ? {
            listFileName: selection.listFileName,
            skipRegistered: selection.skipRegistered,
          }
        : {}),
      optInConfirmed: state.optInConfirmed,
    };
  }
  const audienceFilters = buildAudienceFilters(state, "avulsa");
  return {
    ...common,
    audience: state.audience,
    ...(audienceFilters ? { audienceFilters } : {}),
  };
}

/** Rascunho já criado: só o que a API deixa trocar (o público ficou congelado). */
export function buildUpdatePayload(state: WizardState): UpdateCampaignPayload {
  return {
    name: state.name.trim(),
    marketingTemplateId: state.marketingTemplateId ?? undefined,
    replyText: state.replyText.trim() || null,
    replyAlertEmail: state.replyAlertEmail.trim() || null,
    ...pacingPayload(state),
  };
}

/** Automática: o WhatsApp vai pelo modelo; push com título/corpo/imagem/deep-link. */
export function buildAutomaticPayload(
  state: WizardState,
): UpsertCampaignTemplatePayload {
  const audienceFilters = buildAudienceFilters(state, "automatica");
  const schedule: Partial<UpsertCampaignTemplatePayload> =
    state.scheduleKind === "WEEKLY"
      ? { weekdays: state.weekdays, sendHour: state.sendHour }
      : {
          targetMonth: state.targetMonth ?? undefined,
          targetDay: state.targetDay ?? undefined,
          targetYear: state.repeatsAnnually
            ? undefined
            : (state.targetYear ?? undefined),
          leadDays: state.leadDays,
        };
  const whatsapp = state.channels.includes("WHATSAPP");
  const push = state.channels.includes("PUSH");
  return {
    name: state.name.trim(),
    scheduleKind: state.scheduleKind,
    ...schedule,
    audience: state.audience as CampaignTemplateAudience,
    ...(audienceFilters ? { audienceFilters } : {}),
    channels: state.channels,
    ...(whatsapp
      ? {
          marketingTemplateId: state.marketingTemplateId ?? "",
          replyText: state.replyText.trim() || null,
          replyAlertEmail: state.replyAlertEmail.trim() || null,
        }
      : {}),
    ...(push
      ? {
          pushTitle: state.pushTitle.trim(),
          pushBody: state.pushBody.trim(),
          ...(state.imageKey ? { imageKey: state.imageKey } : {}),
          ...(state.deepLink.trim() ? { deepLink: state.deepLink.trim() } : {}),
        }
      : {}),
    ...(state.maxPerRun ? { maxPerRun: state.maxPerRun } : {}),
  };
}

// ── Travas ───────────────────────────────────────────────────────────────────

export function isValidEmail(value: string): boolean {
  // Como a API (`@IsEmail`): domínio com ponto e final (TLD) de 2+ letras; "a@b.c" não vale.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(value);
}

const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

function pacingErrors(state: WizardState): string[] {
  const out: string[] = [];
  if (!inRange(state.messagesPerHour, 1, 60))
    out.push("Mensagens por hora: de 1 a 60.");
  if (!inRange(state.dailyCap, 1, 1000)) out.push("Teto por dia: de 1 a 1000.");
  if (
    !inRange(state.windowStartHour, 0, 23) ||
    !inRange(state.windowEndHour, 1, 24)
  ) {
    out.push("A janela vai das 0h às 24h.");
  } else if (state.windowStartHour >= state.windowEndHour) {
    out.push("A janela precisa começar antes de terminar.");
  }
  return out;
}

/** O que impede o "Continuar" do passo. Vazio = pode seguir. */
export function stepBlockers(
  state: WizardState,
  step: WizardStep,
  kind: WizardKind,
  now: Date = new Date(),
): string[] {
  const out: string[] = [];
  if (step === 1) {
    const nameLength = codePointLength(state.name.trim());
    if (nameLength === 0) out.push("Dê um nome à campanha.");
    else if (nameLength < NAME_MIN || nameLength > NAME_MAX) {
      out.push(`O nome precisa ter de ${NAME_MIN} a ${NAME_MAX} caracteres.`);
    }
    if (state.audience === EXTERNAL_LIST_AUDIENCE) {
      const selection = selectionFromPicker(state.picker);
      if (!selection) out.push("Suba a planilha e confira a lista.");
      else if (selection.willSend === 0)
        out.push("Nenhum contato da planilha vai entrar na campanha.");
      if (!state.optInConfirmed) {
        out.push(
          "Confirme que essas pessoas aceitaram receber mensagens da Freela.",
        );
      }
    } else if (
      kind === "avulsa" &&
      state.radiusCity.trim() &&
      !inRange(state.radiusKm, 1, RADIUS_KM_MAX)
    ) {
      out.push("O raio vai de 1 a 2000 km.");
    }
  }
  if (step === 2) {
    const whatsapp = kind === "avulsa" || state.channels.includes("WHATSAPP");
    if (kind === "automatica" && state.channels.length === 0)
      out.push("Escolha pelo menos um canal.");
    if (whatsapp) {
      if (!state.marketingTemplateId) {
        out.push("Escolha um modelo aprovado ou escreva uma mensagem nova.");
      }
      if (codePointLength(state.replyText.trim()) > REPLY_TEXT_MAX) {
        out.push("A resposta automática pode ter até 500 caracteres.");
      }
      const email = state.replyAlertEmail.trim();
      if (email && !isValidEmail(email))
        out.push("O e-mail que recebe as respostas está inválido.");
    }
    if (kind === "automatica" && state.channels.includes("PUSH")) {
      if (!state.pushTitle.trim()) out.push("Informe o título do push.");
      if (!state.pushBody.trim()) out.push("Informe o corpo do push.");
    }
  }
  if (step === 3) {
    if (kind === "avulsa") {
      if (state.when === "schedule") {
        const error = validateSchedule(state.scheduleAt, now);
        if (error) out.push(error);
      }
      out.push(...pacingErrors(state));
    } else {
      if (state.scheduleKind === "WEEKLY") {
        if (state.weekdays.length === 0)
          out.push("Escolha pelo menos um dia da semana.");
        if (!inRange(state.sendHour, 0, 23)) out.push("A hora vai de 0 a 23.");
      } else {
        if (!state.targetMonth || !inRange(state.targetMonth, 1, 12))
          out.push("Informe o mês.");
        if (!state.targetDay || !inRange(state.targetDay, 1, 31))
          out.push("Informe o dia.");
        if (!state.repeatsAnnually && !state.targetYear) {
          out.push('Informe o ano (ou marque "repetir todo ano").');
        }
        if (!inRange(state.leadDays, 0, 60))
          out.push("Os dias antes vão de 0 a 60.");
      }
      if (state.maxPerRun !== null && state.maxPerRun < 1) {
        out.push("O máximo por execução precisa ser pelo menos 1.");
      }
    }
  }
  return out;
}

/**
 * Disparar/agendar (avulsa) e ligar (automática com WhatsApp) só com modelo APPROVED
 * (spec §5.1; a API responde 409 `MARKETING_TEMPLATE_NOT_APPROVED`). `null` = liberado.
 */
export function dispatchBlocker(
  kind: WizardKind,
  channels: CampaignChannel[],
  templateStatus: MarketingTemplateStatus | null,
): string | null {
  const needsTemplate = kind === "avulsa" || channels.includes("WHATSAPP");
  if (!needsTemplate || templateStatus === "APPROVED") return null;
  const situacao = templateStatus
    ? statusInSentence(templateStatus)
    : "não encontrado";
  return kind === "avulsa"
    ? `O modelo ainda não foi aprovado pela Meta (situação: ${situacao}). A campanha fica salva como rascunho; volte aqui para disparar depois da aprovação.`
    : `O modelo ainda não foi aprovado pela Meta (situação: ${situacao}). Salve desligada e ligue depois da aprovação.`;
}

// ── Resumo ───────────────────────────────────────────────────────────────────

/** "Todos os contratantes · Empresas + Casa · todas as cidades" (mockup do passo 4). */
export function audienceSummary(state: WizardState): string {
  if (state.audience === EXTERNAL_LIST_AUDIENCE) {
    return state.picker.sheet
      ? `Planilha · ${state.picker.sheet.fileName}`
      : "Planilha";
  }
  const parts = [audienceLabel(state.audience)];
  if (isContractorAudience(state.audience)) {
    parts.push(
      state.modules.length
        ? state.modules.map((m) => MODULE_LABELS[m]).join(" + ")
        : "Empresas + Casa",
    );
  }
  if (state.radiusCity.trim()) {
    parts.push(`${state.radiusCity.trim()} e ${state.radiusKm} km em volta`);
  } else {
    if (state.ufs.length) parts.push(state.ufs.join(", "));
    parts.push(
      state.cities.length ? state.cities.join(", ") : "todas as cidades",
    );
  }
  return parts.join(" · ");
}

/** Dias úteis para mandar `people` mensagens no ritmo (mesma conta do resumo da API). */
export function estimateRunDays(people: number, pacing: Pacing): number {
  if (people <= 0) return 0;
  const windowHours = Math.max(
    0,
    pacing.windowEndHour - pacing.windowStartHour,
  );
  const perDay = Math.max(
    1,
    Math.min(pacing.dailyCap, pacing.messagesPerHour * windowHours),
  );
  return Math.ceil(people / perDay);
}

/** "R$ 146" (custo estimado, sem centavos). */
export function formatBrl(value: number): string {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

/** "R$ 0,35" (preço por mensagem). */
export function formatPrice(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "dias úteis" só quando a campanha roda só em dias úteis; senão "dias". */
export function daysLabel(days: number, weekdaysOnly: boolean): string {
  const unit = weekdaysOnly
    ? days === 1
      ? "dia útil"
      : "dias úteis"
    : days === 1
      ? "dia"
      : "dias";
  return `~${days} ${unit}`;
}

export interface AutomaticSummary {
  /** Mensagens de WhatsApp de cada execução: (WhatsApp − quem saiu) com o teto por execução. */
  whatsappToSend: number;
  excludedByOptOut: number;
  /** Custo por execução. */
  costBrl: number;
  days: number;
}

/**
 * Resumo da automática (passo 4), na mesma conta da estimativa da avulsa:
 * (WhatsApp − excluídos por opt-out) × preço. `null` sem contagem do público.
 */
export function automaticSummary(
  state: WizardState,
  priceBrl: number = DEFAULT_MARKETING_PRICE_BRL,
): AutomaticSummary | null {
  const count = state.count;
  if (!count) return null;
  const whatsapp = state.channels.includes("WHATSAPP");
  const cap = state.maxPerRun ?? Infinity;
  const whatsappToSend = whatsapp
    ? Math.min(cap, Math.max(0, count.whatsapp - count.excludedByOptOut))
    : 0;
  return {
    whatsappToSend,
    excludedByOptOut: whatsapp ? count.excludedByOptOut : 0,
    costBrl: Math.round(whatsappToSend * priceBrl * 100) / 100,
    days: estimateRunDays(whatsappToSend, pacingPayload(state)),
  };
}

export function pacingLabel(pacing: Pacing): string {
  return `ritmo ${pacing.messagesPerHour}/hora · até ${pacing.dailyCap}/dia · das ${pacing.windowStartHour}h às ${pacing.windowEndHour}h · ${pacing.weekdaysOnly ? "dias úteis" : "todos os dias"}`;
}

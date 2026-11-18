import { Inbox, Sparkles, Repeat, TrendingUp, Crown, type LucideIcon } from "lucide-react";
import type {
  PipelineCard,
  PipelineMessageKey,
  PipelineMessageStatus,
  PipelineSettings,
  PipelineStage,
} from "@/modules/admin/infrastructure/crm-api";

/** Ícone por coluna do funil — os títulos vêm prontos da API. */
export const FUNNEL_STAGE_ICONS: Record<PipelineStage, LucideIcon> = {
  CADASTRO_NOVO: Inbox,
  PRIMEIRA_CONTRATACAO: Sparkles,
  SEGUNDA_CONTRATACAO: Repeat,
  TERCEIRA_CONTRATACAO: TrendingUp,
  CLIENTE_FIDELIZADO: Crown,
};

export const MODULE_LABEL: Record<string, string> = {
  "bars-restaurants": "Bares",
  "home-services": "Casa",
};

/** Busca local do funil: nome, cidade, estado, ramo ou telefone. */
export function filterPipelineCards(cards: PipelineCard[], term: string): PipelineCard[] {
  const q = term.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((c) =>
    [c.name, c.city, c.state, c.segment, c.whatsappPhone].some((f) =>
      f?.toLowerCase().includes(q),
    ),
  );
}

/** Link de conversa no WhatsApp — só dígitos, com DDI 55 quando faltar. */
export function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

/**
 * "hoje às 14:32", "ontem às 09:10" ou "em 03/08" — o que a equipe precisa saber
 * é se a mensagem saiu HOJE, não o carimbo completo. Data cheia só quando já
 * passou tempo suficiente para o dia importar mais que a hora.
 */
export function formatSentAt(iso: string, now: Date = new Date()): string {
  const sent = new Date(iso);
  if (Number.isNaN(sent.getTime())) return "antes";

  const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((diaDe(now) - diaDe(sent)) / 86_400_000);
  const hora = sent.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  return `em ${sent.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

// ─── Período (filtro de data de cadastro) ───────────────────────────────────

export type FunnelRange = { from: string; to: string };

/** Formata um Date nos limites locais como YYYY-MM-DD (mesmo helper do financeiro). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Atalhos do funil. `now` injetável para teste; editar as datas na mão vira o
 * modo "Personalizado" (nenhum atalho ativo).
 */
export const FUNNEL_PRESETS: { label: string; compute: (now?: Date) => FunnelRange }[] = [
  {
    label: "Hoje",
    compute: (now = new Date()) => ({ from: ymd(now), to: ymd(now) }),
  },
  {
    label: "Ontem",
    compute: (now = new Date()) => {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { from: ymd(d), to: ymd(d) };
    },
  },
  {
    label: "7 dias",
    compute: (now = new Date()) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: ymd(from), to: ymd(now) };
    },
  },
  {
    label: "30 dias",
    compute: (now = new Date()) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: ymd(from), to: ymd(now) };
    },
  },
];

/** Atalho que corresponde ao range atual — undefined = "Personalizado". */
export function activeFunnelPreset(range: FunnelRange, now?: Date): string | undefined {
  return FUNNEL_PRESETS.find((p) => {
    const r = p.compute(now);
    return r.from === range.from && r.to === range.to;
  })?.label;
}

// ─── Situação da mensagem (funil e cadastros antigos) ───────────────────────

/**
 * Situação da última mensagem. A API anterior a 16/11/2026 não manda o campo:
 * nela, "tem data de envio" é tudo o que se sabe.
 */
export function messageStatusOf(card: PipelineCard): PipelineMessageStatus {
  return card.messageStatus ?? (card.lastMessageSentAt ? "SENT" : "NONE");
}

export const MESSAGE_STATUS_LABEL: Record<PipelineMessageStatus, string> = {
  NONE: "Sem mensagem",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  REPLIED: "Respondeu",
  FAILED: "Não chegou",
  UNCERTAIN: "Pode ter sido enviada",
};

/** A mensagem saiu (o card amarelo). Falha e dúvida NÃO contam como contato feito. */
export function isContacted(card: PipelineCard): boolean {
  const status = messageStatusOf(card);
  return status === "SENT" || status === "DELIVERED" || status === "READ" || status === "REPLIED";
}

/**
 * O que o contratante já recebeu de nós, para o filtro dos cadastros antigos:
 * - `NEVER`: nada — nem Pipeline, nem campanha, nem outra conta com o mesmo telefone;
 * - `OTHER`: não recebeu a mensagem do Pipeline, mas recebeu campanha ou o
 *   telefone dele já recebeu por outra conta;
 * - `CONTACTED`: a mensagem do Pipeline saiu;
 * - `PROBLEM`: a última tentativa não chegou, ou ficou em dúvida.
 */
export type ContactState = "NEVER" | "OTHER" | "CONTACTED" | "PROBLEM";

export function contactStateOf(card: PipelineCard): ContactState {
  const status = messageStatusOf(card);
  if (status === "FAILED" || status === "UNCERTAIN") return "PROBLEM";
  if (status !== "NONE") return "CONTACTED";
  return card.lastCampaign || card.samePhoneSentAt ? "OTHER" : "NEVER";
}

/** Uma linha dizendo o que houve com a última mensagem, ou `null` se não houve nenhuma. */
export function messageStatusLine(card: PipelineCard, now: Date = new Date()): string | null {
  const status = messageStatusOf(card);
  const vezes = card.messagesSentCount > 1 ? ` · ${card.messagesSentCount}x` : "";
  switch (status) {
    case "NONE":
      return null;
    case "FAILED":
      return `Não chegou: ${card.messageFailureReason ?? "a Meta não entregou."}`;
    case "UNCERTAIN":
      // Sem resposta da Meta não há o que acompanhar depois: só o contratante sabe se chegou.
      return "A Meta não respondeu: a mensagem pode ter sido enviada. Confirme com o contratante antes de mandar de novo.";
    case "REPLIED":
      return `Respondeu ${card.messageRepliedAt ? formatSentAt(card.messageRepliedAt, now) : ""}`.trim() + vezes;
    case "READ":
      return `Lida ${card.messageReadAt ? formatSentAt(card.messageReadAt, now) : ""}`.trim() + vezes;
    case "DELIVERED":
      return (
        `Entregue ${card.messageDeliveredAt ? formatSentAt(card.messageDeliveredAt, now) : ""}`.trim() +
        vezes
      );
    default:
      return (
        `Enviada ${card.lastMessageSentAt ? formatSentAt(card.lastMessageSentAt, now) : ""}`.trim() + vezes
      );
  }
}

/**
 * Pergunta de confirmação antes de enviar. Muda conforme o que a pessoa já
 * recebeu: mandar de novo para quem já recebeu é o erro que o amarelo existe
 * para evitar, e insistir queima o número.
 */
export function sendConfirmQuestion(
  card: PipelineCard,
  opts: { templateName?: string | null; now?: Date; messageNote?: string | null } = {},
): string {
  const now = opts.now ?? new Date();
  const status = messageStatusOf(card);
  // Com mensagem por etapa configurada, a frase da etapa (`stageSendCheck`) diz o que sai.
  const canal = opts.messageNote
    ? ` ${opts.messageNote}`
    : opts.templateName
      ? ` Sai pelo WhatsApp oficial, com o modelo "${opts.templateName}".`
      : "";

  if (status === "UNCERTAIN") {
    return (
      `A última tentativa para ${card.name} ficou sem resposta da Meta, e a mensagem PODE ter chegado ` +
      `(o painel não tem como saber). Enviar de novo mesmo assim?${canal}`
    );
  }
  if (isContacted(card) && card.lastMessageSentAt) {
    const envios = card.messagesSentCount > 1 ? ` (${card.messagesSentCount} envios)` : "";
    return `${card.name} já recebeu a mensagem ${formatSentAt(card.lastMessageSentAt, now)}${envios}. Enviar de novo?${canal}`;
  }
  if (card.samePhoneSentAt) {
    return (
      `Outro cadastro com o MESMO telefone de ${card.name} já recebeu esta mensagem ` +
      `${formatSentAt(card.samePhoneSentAt, now)}. Enviar mesmo assim?${canal}`
    );
  }
  if (card.lastCampaign) {
    return (
      `${card.name} recebeu a campanha "${card.lastCampaign.name}" ` +
      `${formatSentAt(card.lastCampaign.sentAt, now)}. Enviar a mensagem do Pipeline também?${canal}`
    );
  }
  return `Enviar a mensagem automática de WhatsApp para ${card.name}?${canal}`;
}

// ─── Mensagem por etapa ─────────────────────────────────────────────────────

/**
 * O que sai para um card, conforme a mensagem da etapa (espelho da regra da API):
 * - nenhuma etapa configurada (ou API antiga): `null` — a confirmação fica como sempre foi;
 * - etapa com modelo: o modelo dela;
 * - etapa só com texto livre: bloqueado — fora da janela de 24 h a Meta só aceita modelo, e o
 *   painel ainda não envia o texto livre (a API recusaria);
 * - etapa sem nada: a mensagem geral.
 */
export function stageSendCheck(
  settings: PipelineSettings | undefined,
  key: PipelineMessageKey,
): { note: string; blocked: boolean } | null {
  const stages = settings?.stageMessages;
  if (!stages || !stages.some((s) => s.templateId || s.freeText)) return null;
  const stage = stages.find((s) => s.key === key);
  const label = stage?.label ?? key;
  if (stage?.templateId) {
    const nome = stage.template?.name ?? "da etapa";
    return {
      note: `Sai o modelo "${nome}" da etapa ${label}, pelo WhatsApp oficial.`,
      blocked: false,
    };
  }
  if (stage?.freeText) {
    return {
      note:
        `A etapa ${label} só tem texto livre, e fora da janela de 24 h a Meta só aceita modelo ` +
        `aprovado. Escolha um modelo para essa etapa em "Configurar mensagem".`,
      blocked: true,
    };
  }
  return {
    note: settings?.template
      ? `A etapa ${label} não tem mensagem própria: sai a mensagem geral, o modelo "${settings.template.name}".`
      : `A etapa ${label} não tem mensagem própria: sai o texto fixo pelo chip de campanha.`,
    blocked: false,
  };
}

// ─── Cadastros antigos: filtros ─────────────────────────────────────────────

export type ContactFilter = "ALL" | ContactState | "REPLIED";

export const CONTACT_FILTERS: { value: ContactFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "NEVER", label: "Nunca recebeu nada" },
  { value: "OTHER", label: "Só campanha" },
  { value: "CONTACTED", label: "Mensagem enviada" },
  { value: "REPLIED", label: "Respondeu" },
  { value: "PROBLEM", label: "Não chegou" },
];

export interface OldSignupFilters {
  q: string;
  /** UF, ou "" para todas. */
  state: string;
  /** Cidade, ou "" para todas. */
  city: string;
  contact: ContactFilter;
}

function matchesContact(card: PipelineCard, filter: ContactFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "REPLIED") return messageStatusOf(card) === "REPLIED";
  return contactStateOf(card) === filter;
}

/** Aplica busca, estado, cidade e situação. `ignore` deixa um filtro de fora (para as contagens). */
export function filterOldSignups(
  cards: PipelineCard[],
  filters: OldSignupFilters,
  ignore?: "contact",
): PipelineCard[] {
  return filterPipelineCards(cards, filters.q).filter(
    (card) =>
      (!filters.state || card.state === filters.state) &&
      (!filters.city || card.city === filters.city) &&
      (ignore === "contact" || matchesContact(card, filters.contact)),
  );
}

/** Quantos cards cada opção de situação traria, com os OUTROS filtros aplicados. */
export function countByContactFilter(
  cards: PipelineCard[],
  filters: OldSignupFilters,
): Record<ContactFilter, number> {
  const base = filterOldSignups(cards, filters, "contact");
  const counts = { ALL: base.length, NEVER: 0, OTHER: 0, CONTACTED: 0, REPLIED: 0, PROBLEM: 0 };
  for (const card of base) {
    counts[contactStateOf(card)] += 1;
    if (messageStatusOf(card) === "REPLIED") counts.REPLIED += 1;
  }
  return counts;
}

/** Estados e cidades que existem na lista, em ordem alfabética. Cidade depende do estado escolhido. */
export function locationOptions(
  cards: PipelineCard[],
  state: string,
): { states: string[]; cities: string[] } {
  const states = new Set<string>();
  const cities = new Set<string>();
  for (const card of cards) {
    if (card.state) states.add(card.state);
    if (card.city && (!state || card.state === state)) cities.add(card.city);
  }
  const sort = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { states: sort(states), cities: sort(cities) };
}

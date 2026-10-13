import type {
  AdminInvoiceListItem,
  AdminInvoiceSituationCode,
  ChannelResults,
} from "../infrastructure/billing-api";

/**
 * Rótulos da aba Faturas do Financeiro (UX 7.3–7.7). Os textos de situação,
 * conta e fonte já vêm prontos da API; aqui só o que é da tela: a cor e o
 * ícone de cada situação (sempre com texto), a tradução dos canais e as datas.
 */

export type SituationTone = "neutral" | "warning" | "danger" | "success" | "muted";
export type SituationIcon = "calendar" | "clock" | "alert" | "lock" | "unlock" | "check" | "ban";

const SITUATION_STYLE: Record<AdminInvoiceSituationCode, { tone: SituationTone; icon: SituationIcon }> = {
  A_VENCER: { tone: "neutral", icon: "calendar" },
  VENCE_HOJE: { tone: "warning", icon: "clock" },
  VENCIDA: { tone: "danger", icon: "alert" },
  BLOQUEADA: { tone: "danger", icon: "lock" },
  LIBERADA: { tone: "warning", icon: "unlock" },
  PAGA: { tone: "success", icon: "check" },
  PAGA_MANUAL: { tone: "success", icon: "check" },
  QUITADA: { tone: "success", icon: "check" },
  CANCELADA: { tone: "muted", icon: "ban" },
};

export function situationStyle(code: AdminInvoiceSituationCode) {
  return SITUATION_STYLE[code] ?? { tone: "neutral" as const, icon: "calendar" as const };
}

/**
 * Chips de situação (UX 7.4). "Vencidas" inclui as bloqueadas e as liberadas;
 * "Pagas" inclui a baixa manual (a API filtra assim).
 */
export const SITUATION_CHIPS: ReadonlyArray<{
  code: AdminInvoiceSituationCode | null;
  label: string;
}> = [
  { code: null, label: "Todas" },
  { code: "A_VENCER", label: "A vencer" },
  { code: "VENCE_HOJE", label: "Vence hoje" },
  { code: "VENCIDA", label: "Vencidas" },
  { code: "BLOQUEADA", label: "Bloqueadas" },
  { code: "PAGA", label: "Pagas" },
  { code: "QUITADA", label: "Quitadas com crédito" },
  { code: "CANCELADA", label: "Canceladas" },
];

/** "Faturas, filtradas por: Vencidas" (caption da tabela, UX 7.8). */
export function tableCaption(code: AdminInvoiceSituationCode | null): string {
  if (!code) return "Faturas, todas as situações";
  const chip = SITUATION_CHIPS.find((c) => c.code === code);
  return `Faturas, filtradas por: ${chip?.label ?? code}`;
}

// ─── Canais da régua (`billing_dunning_events.channels`) ──────────────────────

const SKIP_TEXT: Record<string, string> = {
  "skipped:not_enabled": "não enviado (WhatsApp ainda não ligado)",
  "skipped:meta_off": "não enviado (conta oficial fora do ar)",
  "skipped:no_email": "não enviado (sem e-mail)",
  "skipped:no_recipients": "não enviado (ninguém com o app)",
  // O admin não marcou o canal no reenvio: como ausente (UX 7.5).
  "skipped:not_selected": "—",
};

/** `sent` → "enviado"; `failed:*` → "falhou"; `skipped:*` → "não enviado (…)"; ausente → "—". */
export function channelText(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "sent") return "enviado";
  if (value === "failed" || value.startsWith("failed:")) return "falhou";
  if (value in SKIP_TEXT) return SKIP_TEXT[value];
  if (value.startsWith("skipped")) return "não enviado";
  return value;
}

const CHANNEL_NAMES: Array<[string, string]> = [
  ["push", "push"],
  ["email", "e-mail"],
  ["whatsapp", "WhatsApp"],
];

/** "push enviado · e-mail falhou · WhatsApp não enviado (…)". */
export function channelsLine(channels: ChannelResults | null | undefined): string {
  if (!channels) return "sem envio";
  return CHANNEL_NAMES.filter(([key]) => key in channels)
    .map(([key, name]) => `${name} ${channelText(channels[key])}`)
    .join(" · ");
}

// ─── Datas e dinheiro ─────────────────────────────────────────────────────────

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function keyParts(key: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? "");
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** "19/10" de um dia `AAAA-MM-DD`. */
export function ddmm(key: string): string {
  const parts = keyParts(key);
  return parts ? `${String(parts[2]).padStart(2, "0")}/${String(parts[1]).padStart(2, "0")}` : key;
}

/** "seg 19/10". O dia da semana sai do calendário em UTC (sem voltar um dia no fuso local). */
export function dayLabel(key: string): string {
  const parts = keyParts(key);
  if (!parts) return key;
  const weekday = WEEKDAYS[new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay()];
  return `${weekday} ${ddmm(key)}`;
}

/** "23/10/2026" de um dia `AAAA-MM-DD` (competência da nota fiscal). */
export function ddmmyyyy(key: string): string {
  const parts = keyParts(key);
  return parts ? `${ddmm(key)}/${parts[0]}` : key;
}

/** "09/10 a 15/10". */
export function periodLabel(start: string, end: string): string {
  return `${ddmm(start)} a ${ddmm(end)}`;
}

const brtFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "16/10 08:00" em Brasília. */
export function formatInstantBrt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = brtFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

/** "26/10, 11:20" em Brasília (próxima tentativa automática da nota fiscal). */
export function retryAtLabel(iso: string | null | undefined): string {
  const text = formatInstantBrt(iso);
  return text === "—" ? text : text.replace(" ", ", ");
}

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 1.248,60" (sempre com espaço comum, para o texto ser previsível). */
export function formatBrl(cents: number): string {
  return brlFormatter.format(cents / 100).replace(/ /g, " ");
}

// ─── Última mensagem (coluna da lista) ────────────────────────────────────────

const ACTOR_LABEL: Record<string, string> = {
  SYSTEM: "Sistema",
  ADMIN: "Equipe Freela",
  CONTRACTOR: "Empresa",
};

export function lastMessageLines(last: AdminInvoiceListItem["lastMessage"]): {
  head: string;
  channels: string | null;
} {
  if (!last) return { head: "Nenhuma mensagem ainda", channels: null };
  return {
    head: `${last.label} · ${formatInstantBrt(last.at)} · ${ACTOR_LABEL[last.by] ?? last.by}`,
    channels: last.channels ? channelsLine(last.channels) : null,
  };
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────

const brtDayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** "sex 23/10 às 00:00" em Brasília (início do bloqueio, envio de mensagens). */
export function instantWithWeekday(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const time = formatInstantBrt(iso).split(" ")[1];
  return `${dayLabel(brtDayKey(date))} às ${time}`;
}

const CHARGE_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Pendente",
  COMPLETED: "Paga",
  PAID: "Paga",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  FAILED: "Falhou",
};

/** Situação de uma tentativa de cobrança Pix (`billing_invoice_charges.status`). */
export function chargeStatusLabel(status: string): string {
  return CHARGE_STATUS[status] ?? status;
}

/**
 * Valor digitado pelo admin ("1.248,60", "1248,60", "R$ 52") → centavos.
 * Vazio ou ilegível → `null` (a tela diz o que digitar).
 */
export function parseBrlToCents(raw: string): number | null {
  const text = raw.replace(/R\$/g, "").replace(/\s/g, "");
  if (!text) return null;
  let normalized: string;
  if (text.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(text)) return null;
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else {
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    normalized = text;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** "1.248,60" (sem o "R$"), para preencher o campo de valor. */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

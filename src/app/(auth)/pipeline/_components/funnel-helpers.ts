import { Inbox, Sparkles, Repeat, TrendingUp, Crown, type LucideIcon } from "lucide-react";
import type { PipelineCard, PipelineStage } from "@/modules/admin/infrastructure/crm-api";

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

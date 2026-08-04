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

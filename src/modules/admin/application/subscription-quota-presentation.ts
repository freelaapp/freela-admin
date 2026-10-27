import type { QuotaUsage } from "../infrastructure/subscriptions-api";

/**
 * Textos da cota do mês na tela de Assinaturas (catálogo de 26–27/10/2026: só o
 * Grandes Redes tem cota, 30 vagas; acima disso é com o comercial, que libera pelo
 * "Ajustar a cota do mês"). Grátis e Vip não têm limite: a API manda `limit` e
 * `remaining` nulos, que antes viravam "null de null" no detalhe.
 */

/** Detalhe da loja: "12 de 30 usadas · restam 18" ou "Sem limite · 4 no mês". */
export function quotaSummary(quota: QuotaUsage | null | undefined): string {
  if (!quota) return "—";
  if (quota.limit === null) return `Sem limite · ${quota.used} no mês`;
  return `${quota.used} de ${quota.limit} usadas · restam ${quota.remaining ?? 0}`;
}

export type QuotaCell = {
  text: string;
  /** Selo ao lado do número: só quando a loja chegou ou está a 3 vagas do limite. */
  flag: { label: string; variant: "destructive" | "warning" } | null;
};

/** Coluna "Vagas no mês" da lista. */
export function quotaCell(quota: QuotaUsage | null | undefined): QuotaCell {
  if (!quota) return { text: "—", flag: null };
  if (quota.limit === null) return { text: String(quota.used), flag: null };
  const remaining = quota.remaining ?? 0;
  const flag =
    remaining === 0
      ? { label: "no limite", variant: "destructive" as const }
      : remaining <= 3
        ? { label: `faltam ${remaining}`, variant: "warning" as const }
        : null;
  return { text: `${quota.used} de ${quota.limit}`, flag };
}

/** "Ajustar a cota do mês" só faz sentido em plano com limite (hoje, o Grandes Redes). */
export function canAdjustQuota(quota: QuotaUsage | null | undefined): boolean {
  return quota != null && quota.limit !== null;
}

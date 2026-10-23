import type { PlanCode } from "../infrastructure/subscriptions-api";

/**
 * Rótulo de cada plano. O Básico continua aqui: a linha segue no banco, inativa
 * desde o catálogo de 22/10/2026, e a lista e a trilha mostram quem já esteve
 * nele.
 */
export const PLAN_LABEL: Record<PlanCode, string> = {
  FREE: "Grátis",
  BASIC: "Básico",
  VIP: "Vip",
  ENTERPRISE: "Grandes Redes",
};

const CATALOG_ORDER = Object.keys(PLAN_LABEL) as PlanCode[];

/**
 * Opções dos seletores de plano (trocar de plano e cortesia): só os planos que o
 * `/v1/plans` devolve, que são os ativos. Sem a lista (carregando ou erro), todos,
 * como antes: a API recusa plano inativo com "Plano indisponível.".
 */
export function assignablePlanOptions(
  activeCodes: readonly string[] | null | undefined,
): { value: PlanCode; label: string }[] {
  const codes = activeCodes
    ? CATALOG_ORDER.filter((code) => activeCodes.includes(code))
    : CATALOG_ORDER;
  return codes.map((code) => ({ value: code, label: PLAN_LABEL[code] }));
}

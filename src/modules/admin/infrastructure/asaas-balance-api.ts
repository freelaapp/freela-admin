import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Saldo da conta Asaas (taxa das NFS-e) e recarga automática Woovi → Asaas
 * (ADR-018, API #690). Rotas do papel Financeiro (`FINANCE`):
 * - `GET  /v1/admin/asaas-balance`: saldo agora, configuração, quanto saiu no
 *   dia e no mês e as últimas 20 tentativas;
 * - `POST /v1/admin/asaas-balance/topups/:id/resolve { outcome, reason }`:
 *   resolve uma recarga sem desfecho (UNKNOWN) depois de conferir na Woovi e
 *   na Asaas.
 *
 * Formato lido de `asaas-balance-overview.query.ts` da API. A resposta é
 * validada com Zod na fronteira; campo de enum desconhecido não derruba a
 * tela (vira texto cru).
 */
const adminApi = createAuthedClient("/v1/admin");

const nullableText = z.string().nullable().optional().transform((v) => v ?? null);
const nullableCents = z.number().nullable().optional().transform((v) => v ?? null);

const historyEntrySchema = z.object({
  at: z.string(),
  from: nullableText,
  to: z.string(),
  by: z.string(),
  note: z.string().optional(),
});

const topupSchema = z.object({
  id: z.string(),
  brasiliaDay: z.string(),
  trigger: z.string(),
  status: z.string(),
  skipReason: nullableText,
  amountInCents: z.number(),
  calculation: z.string().optional().default(""),
  asaasBalanceBeforeInCents: nullableCents,
  asaasBalanceAfterInCents: nullableCents,
  wooviFreeBalanceInCents: nullableCents,
  destinationMasked: nullableText,
  error: nullableText,
  creditedAt: nullableText,
  sentAt: nullableText,
  settledAt: nullableText,
  history: z.array(historyEntrySchema).optional().default([]),
  createdAt: z.string(),
});

const configSchema = z.discriminatedUnion("valid", [
  z.object({
    valid: z.literal(true),
    minBalanceInCents: z.number(),
    amountInCents: z.number(),
    maxPerDayInCents: z.number(),
    maxPerMonthInCents: z.number(),
    pixKeyMasked: nullableText,
  }),
  z.object({ valid: z.literal(false), error: z.string() }),
]);

const overviewSchema = z.object({
  asaasBalanceInCents: z.number(),
  asaasBalanceSource: z.string().optional(),
  autoTopupEnabled: z.boolean(),
  config: configSchema,
  asaasActivePixKeys: z
    .array(z.object({ type: z.string(), masked: z.string() }))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  usage: z.object({
    brasiliaDay: z.string(),
    todayInCents: z.number(),
    monthInCents: z.number(),
    countedStatuses: z.string().optional(),
  }),
  lastTopups: z.array(topupSchema),
});

export type AsaasTopup = z.infer<typeof topupSchema>;
export type AsaasBalanceOverview = z.infer<typeof overviewSchema>;

export async function getAsaasBalance(): Promise<AsaasBalanceOverview> {
  const res = await adminApi.get("/asaas-balance");
  return overviewSchema.parse(res.data?.data);
}

export type ResolveOutcome = "COMPLETED" | "FAILED";

const resolveSchema = z.object({ id: z.string(), status: z.string() });
export type ResolveTopupResult = z.infer<typeof resolveSchema>;

export async function resolveAsaasTopup(
  topupId: string,
  input: { outcome: ResolveOutcome; reason: string },
): Promise<ResolveTopupResult> {
  const res = await adminApi.post(`/asaas-balance/topups/${encodeURIComponent(topupId)}/resolve`, {
    outcome: input.outcome,
    reason: input.reason.trim(),
  });
  return resolveSchema.parse(res.data?.data);
}

import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * "Escolher pelo lote" (A4; fatia 3 em diante; permissão `JOBS`). Só as rotas que a API oferece ao
 * admin:
 * - `GET  /v1/bars-restaurants/admin/lots/:id/groups/:groupKey/candidates`: os candidatos de uma
 *   função, como a empresa os vê;
 * - `POST /v1/bars-restaurants/admin/lots/:id/choices`: escolhe, no lugar da empresa (o admin
 *   logado fica como autor; a API registra).
 *
 * Não há, para o admin, rota de desfazer nem de "menos vagas": isso é da empresa. Resposta validada
 * com Zod; enums como texto. Corpo com `{ message, code, max }` (422 `LOT_CHOICE_TOO_MANY`) é lido
 * por `apiErrorOf`.
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

const text = z.string().nullable().optional().transform((v) => v ?? null);
const count = z.number().optional().default(0);

const askViewSchema = z.object({
  state: z.string(),
  askAt: text,
  askedAt: text,
  deadlineAt: text,
  answeredAt: text,
  deliveredAt: text,
});

const chosenSchema = z.object({
  candidacyId: z.string(),
  vacancyId: z.string(),
  providerGlobalId: text,
  name: z.string().optional().default(""),
  paid: z.boolean().optional().default(false),
  confirmedAt: text,
  ask: askViewSchema.nullable().optional().transform((v) => v ?? null),
});

const candidateSchema = z.object({
  id: z.string(),
  vacancyId: z.string().optional(),
  status: text,
  appliedAt: text,
  workedHereCount: count,
  hasWarningBadge: z.boolean().optional().default(false),
  busy: z.boolean().optional().default(false),
  chosenInOtherFunction: text,
  otherFunctionsThatDay: z.array(z.string()).optional().default([]),
  choosable: z.boolean().optional().default(false),
  lastAskOutcome: text,
  provider: z.object({
    providerGlobalId: text,
    name: z.string().optional().default(""),
    averageRating: z.number().nullable().optional().transform((v) => v ?? null),
    completedServices: count,
  }),
});

export const candidatesViewSchema = z.object({
  lotId: z.string(),
  groupKey: z.string(),
  serviceDate: z.string().optional().default(""),
  title: z.string().optional().default(""),
  startTime: text,
  endTime: text,
  billing: text,
  vacancies: count,
  free: count,
  choiceMax: count,
  askPlan: z
    .object({
      askAt: z.string(),
      answerMinutes: count,
      delaySeconds: count,
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  chosen: z.array(chosenSchema).optional().default([]),
  candidates: z.array(candidateSchema).optional().default([]),
  total: count,
});

export type LotCandidatesView = z.infer<typeof candidatesViewSchema>;
export type LotCandidate = z.infer<typeof candidateSchema>;

const itemSchema = z.object({
  providerGlobalId: z.string(),
  status: z.string(),
  vacancyId: text,
  candidacyId: text,
  vacancyPaid: z.boolean().optional().default(false),
  message: z.string().optional().default(""),
  ask: askViewSchema.pick({ state: true, askAt: true }).nullable().optional().transform((v) => v ?? null),
});

const choiceResultSchema = z.object({
  summary: z.object({
    requested: count,
    accepted: count,
    alreadyChosen: count,
    failed: count,
    billing: text,
    chosenAmountInCents: count,
    dayUnpaidCount: count,
    dayUnpaidInCents: count,
    asksScheduled: z.number().optional(),
  }),
  items: z.array(itemSchema),
});

export type LotChoiceResult = z.infer<typeof choiceResultSchema>;
export type LotChoiceItem = z.infer<typeof itemSchema>;

export async function getAdminLotCandidates(
  lotId: string,
  groupKey: string,
): Promise<LotCandidatesView> {
  const res = await adminApi.get(
    `/lots/${encodeURIComponent(lotId)}/groups/${encodeURIComponent(groupKey)}/candidates`,
  );
  return candidatesViewSchema.parse(res.data?.data);
}

/** `providerGlobalIds` na ordem em que devem ser atendidos (1 a 50). O autor é o admin logado. */
export async function chooseAdminLot(
  lotId: string,
  body: { groupKey: string; providerGlobalIds: string[] },
): Promise<LotChoiceResult> {
  const res = await adminApi.post(`/lots/${encodeURIComponent(lotId)}/choices`, body);
  return choiceResultSchema.parse(res.data?.data);
}

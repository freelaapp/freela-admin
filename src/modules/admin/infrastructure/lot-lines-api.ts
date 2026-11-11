import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Vagas em lote, fatias 4 a 6 (admin, só leitura; permissão `JOBS`): as linhas do detalhe do lote,
 * `GET /v1/bars-restaurants/admin/lots/:id/lines` (A3). Contrato em `api-contracts.md`, fim de
 * "Vagas em lote, fatia 6". Uma linha por vaga: quem está escolhido, a pergunta "Ainda pode vir?",
 * o pagamento, a chegada e a presença.
 *
 * Validado com Zod na fronteira. Os enums chegam como texto (valor novo da API não derruba a
 * tela) e os blocos opcionais são tolerantes a campo ausente. Qualquer 404 (`VACANCY_LOTS_DISABLED`,
 * API sem a rota) é tratado por quem chama como "recurso desligado".
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

const text = z.string().nullable().optional().transform((v) => v ?? null);

const askSchema = z.object({
  state: z.string(),
  askedForVacancyId: text,
  scheduledFor: text,
  askedAt: text,
  deadlineAt: text,
  answeredAt: text,
  answeredVia: text,
  deliveredAt: text,
  closedAt: text,
});

const paymentSchema = z.object({
  paid: z.boolean().optional().default(false),
  paymentId: text,
  method: text,
  at: text,
  amountInCents: z.number().nullable().optional().transform((v) => v ?? null),
  byBatch: z.boolean().optional().default(false),
  batchId: text,
  pixFeeWaivedInCents: z.number().optional().default(0),
});

const jobSchema = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: text,
  endedAt: text,
});

const arrivalSchema = z.object({
  state: z.string(),
  askedAt: text,
  answer: text,
  answeredAt: text,
  answeredAtLabel: text,
  answeredVia: text,
  outcome: text,
  aboutChosen: z.boolean().optional().default(true),
});

const attendanceSchema = z.object({
  status: z.string(),
  contractorDecision: z.boolean().nullable().optional().transform((v) => v ?? null),
  providerDecision: z.boolean().nullable().optional().transform((v) => v ?? null),
  blockedReason: text,
  openedAt: text,
  contractorRespondedAt: text,
});

const nullable = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullable().optional().transform((v) => (v ?? null) as z.infer<T> | null);

const lineSchema = z.object({
  vacancyId: z.string(),
  groupKey: text,
  title: z.string().optional().default(""),
  startTime: text,
  endTime: text,
  status: text,
  chosen: nullable(
    z.object({
      candidacyId: z.string(),
      providerGlobalId: text,
      name: text,
    }),
  ),
  ask: nullable(askSchema),
  payment: paymentSchema.nullable().optional().transform((v) => v ?? null),
  job: nullable(jobSchema),
  arrival: nullable(arrivalSchema),
  attendance: nullable(attendanceSchema),
});

const linesSchema = z.object({
  lotId: z.string(),
  serviceDate: z.string(),
  lines: z.array(lineSchema),
});

export type AdminLotLine = z.infer<typeof lineSchema>;
export type AdminLotLines = z.infer<typeof linesSchema>;

export async function getAdminLotLines(id: string): Promise<AdminLotLines> {
  const res = await adminApi.get(`/lots/${encodeURIComponent(id)}/lines`);
  return linesSchema.parse(res.data?.data);
}

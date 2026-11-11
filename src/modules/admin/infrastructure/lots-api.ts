import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Vagas em lote, fatia 1 (admin, só leitura; permissão `JOBS`). Contrato em `api-contracts.md`,
 * "Vagas em lote, fatia 1":
 * - `GET /v1/bars-restaurants/admin/lots?from&to`: lotes do período (A2);
 * - `GET /v1/bars-restaurants/admin/lots/:id`: um lote (A3);
 * - `GET /v1/bars-restaurants/admin/lots/by-vacancy/:vacancyId`: o lote da vaga e o lote do
 *   mesmo dia quando ela está fora dele (A1).
 *
 * A resposta é validada com Zod na fronteira. Os enums chegam como texto: um valor novo da API não
 * derruba a tela. Nenhum valor em reais é lido nesta fatia (o que a API mandar a mais é ignorado).
 * Qualquer 404 (API antiga sem a rota, `VACANCY_LOTS_DISABLED`) é tratado por quem chama como
 * "ainda não ligado".
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

const nullableText = z.string().nullable().optional().transform((v) => v ?? null);
const count = z.number().optional().default(0);

const totalsSchema = z.object({
  vacancies: count,
  functions: count,
  chosen: count,
  paid: count,
  free: count,
  candidatesToChoose: count,
  chosenUnpaid: count,
  cancelled: count,
});

const groupSchema = z.object({
  groupKey: z.string(),
  title: z.string(),
  serviceType: nullableText,
  startTime: z.string(),
  endTime: z.string(),
  address: nullableText,
  vacancies: count,
  chosen: count,
  paid: count,
  free: count,
  candidatesToChoose: count,
  representativeVacancyId: nullableText,
  vacancyIds: z.array(z.string()).optional().default([]),
});

const inSelectionSchema = z.object({
  vacancyId: z.string(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

/**
 * `data.choice` de `GET admin/lots/:id` (fatia 3 em diante): só o que a tela do dia lê. Ausente =
 * escolha desligada (a tela fica como na fatia 1). Um `choice` que não casa com o formato vira
 * "ausente", nunca derruba o detalhe do lote.
 */
const choiceSchema = z
  .object({
    max: z.number().optional().default(0),
    billing: nullableText,
    unpaidCount: count,
    unpaidInCents: count,
    groups: z
      .array(
        z.object({
          groupKey: z.string(),
          chargePerVacancyInCents: count,
          unpaidCount: count,
          unpaidInCents: count,
          removable: count,
        }),
      )
      .optional()
      .default([]),
    exits: z
      .array(
        z.object({
          candidacyId: z.string(),
          vacancyId: z.string(),
          groupKey: nullableText,
          title: z.string().optional().default(""),
          name: nullableText,
          byKind: z.string().optional().default(""),
          reason: z.string().optional().default(""),
          at: nullableText,
          vacancyPaid: z.boolean().optional().default(false),
          vacancyRefilled: z.boolean().optional().default(false),
        }),
      )
      .optional()
      .default([]),
    asks: z
      .object({
        scheduled: count,
        asking: count,
        confirmed: count,
        undelivered: count,
        nextDeadlineAt: nullableText,
      })
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .nullable()
  .optional()
  .catch(null)
  .transform((v) => v ?? null);

export type AdminLotChoice = NonNullable<z.infer<typeof choiceSchema>>;

export const lotSchema = z.object({
  id: z.string(),
  /** Dia civil de Brasília, `AAAA-MM-DD`. Nunca passa por `Date`. */
  serviceDate: z.string(),
  trigger: nullableText,
  createdAt: nullableText,
  past: z.boolean().optional().default(false),
  nextStep: nullableText,
  promiseCorrectedAt: nullableText,
  totals: totalsSchema,
  groups: z.array(groupSchema).optional().default([]),
  inSelection: z.array(inSelectionSchema).optional().default([]),
  contractorId: nullableText,
  companyName: nullableText,
  firstStartTime: nullableText,
  attention: z.array(z.string()).optional().default([]),
  /** Fatia 3: o que a tela do dia precisa para escolher. `null` = escolha desligada. */
  choice: choiceSchema,
});

export type AdminLot = z.infer<typeof lotSchema>;
export type AdminLotGroup = z.infer<typeof groupSchema>;

const lotByVacancySchema = z.object({
  lot: lotSchema.nullable().optional().transform((v) => v ?? null),
  besideLot: lotSchema.nullable().optional().transform((v) => v ?? null),
});

export type AdminLotByVacancy = z.infer<typeof lotByVacancySchema>;

/** Sem datas, a API usa hoje (Brasília) até hoje + 7 dias. */
export async function getAdminLots(params?: { from?: string; to?: string }): Promise<AdminLot[]> {
  const res = await adminApi.get("/lots", { params });
  return z.array(lotSchema).parse(res.data?.data);
}

export async function getAdminLot(id: string): Promise<AdminLot> {
  const res = await adminApi.get(`/lots/${encodeURIComponent(id)}`);
  return lotSchema.parse(res.data?.data);
}

export async function getAdminLotByVacancy(vacancyId: string): Promise<AdminLotByVacancy> {
  const res = await adminApi.get(`/lots/by-vacancy/${encodeURIComponent(vacancyId)}`);
  return lotByVacancySchema.parse(res.data?.data);
}

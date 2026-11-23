import { z } from "zod";

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Parâmetros das regras (números que o suporte ajusta sem versão nova). Qualquer admin lê; só
 * super-admin grava. Erros do PUT (lidos com `apiErrorOf`): 403 `SUPER_ADMIN_REQUIRED`, 404
 * `PARAMETER_NOT_FOUND`, 422 `PARAMETER_INVALID` (`fields.value`), 422 `PARAMETER_REASON_REQUIRED`
 * (`fields.reason`), 409 `PARAMETER_CHANGED_MEANWHILE`. Resposta validada com Zod, tolerante.
 */
const adminsApi = createAuthedClient("/v1/admins");

/** Tamanho do motivo aceito pela API. */
export const PARAMETER_REASON_MIN = 5;
export const PARAMETER_REASON_MAX = 500;

/**
 * A API manda `updatedBy` como TEXTO (o nome do admin). Por segurança tolera também um objeto
 * `{ name }` e normaliza sempre para texto (ou null).
 */
const adminName = z
  .union([z.string(), z.object({ name: z.string().nullable().optional() }).passthrough()])
  .nullable()
  .optional()
  .transform((v) => (typeof v === "string" ? v : (v?.name ?? null)) || null);

const parameterSchema = z
  .object({
    key: z.string(),
    label: z.string().optional(),
    help: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
    value: z.number(),
    defaultValue: z.number(),
    min: z.number(),
    max: z.number(),
    isDefault: z.boolean().optional().default(false),
    inEffect: z.boolean().optional().default(false),
    /** 0 = ainda sem linha no banco (ninguém alterou). */
    version: z.number().optional().default(0),
    updatedAt: z.string().nullable().optional().transform((v) => v ?? null),
    updatedBy: adminName,
  })
  .transform((p) => ({
    ...p,
    label: p.label || p.key,
    help: p.help ?? "",
    unit: p.unit ?? "",
  }));

export type PlatformParameter = z.output<typeof parameterSchema>;

const changeSchema = z.object({
  oldValue: z.number().nullable().optional().transform((v) => v ?? null),
  newValue: z.number(),
  defaultValue: z.number().nullable().optional().transform((v) => v ?? null),
  reason: z.string().optional().default(""),
  admin: z.string().nullable().optional().transform((v) => v ?? null),
  createdAt: z.string(),
});

export type PlatformParameterChange = z.output<typeof changeSchema>;

export async function getPlatformParameters(): Promise<PlatformParameter[]> {
  const res = await adminsApi.get("/platform-parameters");
  const items = res.data?.data?.items;
  return parseItemByItem(Array.isArray(items) ? items : []);
}

/** Item malformado é descartado (com aviso) sem derrubar o cartão inteiro. */
function parseItemByItem(items: unknown[]): PlatformParameter[] {
  const out: PlatformParameter[] = [];
  for (const raw of items) {
    const parsed = parameterSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
    else console.warn("[platform-parameters] item inválido descartado", parsed.error.issues);
  }
  return out;
}

export async function updatePlatformParameter(
  key: string,
  body: { value: number; reason: string; expectedVersion: number },
): Promise<PlatformParameter> {
  const res = await adminsApi.put(`/platform-parameters/${key}`, body);
  return parameterSchema.parse(res.data.data);
}

export async function getParameterChanges(key: string): Promise<PlatformParameterChange[]> {
  const res = await adminsApi.get(`/platform-parameters/${key}/changes`, { params: { limit: 50 } });
  const items = res.data?.data?.items;
  return z.array(changeSchema).parse(Array.isArray(items) ? items : []);
}

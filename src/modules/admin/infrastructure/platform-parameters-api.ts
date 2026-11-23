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

const adminRef = z
  .object({ id: z.string().nullable().optional(), name: z.string().nullable().optional() })
  .nullable()
  .optional()
  .transform((v) => (v ? { id: v.id ?? "", name: v.name ?? null } : null));

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
    version: z.number().optional().default(1),
    updatedAt: z.string().nullable().optional().transform((v) => v ?? null),
    updatedBy: adminRef,
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
  return z.array(parameterSchema).parse(Array.isArray(items) ? items : []);
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

import axios from "axios";

/**
 * Erro de uma rota da API, já lido do corpo. O handler lança o corpo plano
 * `{ code, message, ...campos }` e o filtro global da API o embrulha em
 * `{ error: { code, message, ...campos } }`. Lemos os dois formatos para a tela
 * nunca depender de qual chegou. `extra` traz os campos a mais (ex.: `missing`
 * do 422 BILLING_REQUIRES_COMPANY_DATA).
 */
export interface ApiError {
  status: number | null;
  code: string | null;
  message: string | null;
  extra: Record<string, unknown>;
}

const RESERVED = new Set(["code", "message", "statusCode", "error"]);

export function apiErrorOf(err: unknown): ApiError {
  if (!axios.isAxiosError(err)) return { status: null, code: null, message: null, extra: {} };
  const status = err.response?.status ?? null;
  const data = err.response?.data as Record<string, unknown> | undefined;
  const nested = data && typeof data.error === "object" && data.error !== null;
  const body = (nested ? data.error : data) as Record<string, unknown> | undefined;
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (!RESERVED.has(key) && value !== undefined) extra[key] = value;
  }
  return {
    status,
    code: typeof body?.code === "string" ? body.code : null,
    message: typeof body?.message === "string" ? body.message : null,
    extra,
  };
}

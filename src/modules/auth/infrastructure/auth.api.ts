import { publicApi } from "@/modules/shared/infrastructure/http-client";
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import { LoginPayload, LoginResponse } from "@/modules/auth/domain/types";

export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await publicApi.post<LoginResponse>("/v1/admins/login", payload);
  return data;
}

/**
 * Troca de senha do admin logado (rota nova da API, em `admins-auth.controller.ts`,
 * ao lado de `/v1/admins/login` e `/v1/admins/me`):
 * `POST /v1/admins/me/change-password` com `{ currentPassword, newPassword }`.
 * Enquanto a API no ar não tiver a rota, a resposta é 404 e a tela de troca
 * deixa entrar sem quebrar o login — por isso o caminho é travado em teste:
 * um caminho errado também dá 404 e anularia a barreira em silêncio.
 */
export const ADMIN_ME_API_PREFIX = "/v1/admins/me";
const adminMeApi = createAuthedClient(ADMIN_ME_API_PREFIX);

export async function changeAdminPasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  await adminMeApi.post("/change-password", { currentPassword, newPassword });
}

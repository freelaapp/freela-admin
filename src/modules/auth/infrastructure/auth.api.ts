import { publicApi } from "@/modules/shared/infrastructure/http-client";
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import { LoginPayload, LoginResponse } from "@/modules/auth/domain/types";

export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await publicApi.post<LoginResponse>("/v1/admins/login", payload);
  return data;
}

/**
 * Troca de senha do admin logado (rota nova da API, outro PR):
 * `POST /v1/admin/me/change-password` com `{ currentPassword, newPassword }`.
 * Enquanto a API no ar não tiver a rota, a resposta é 404 e a tela de troca
 * deixa entrar sem quebrar o login.
 */
const adminMeApi = createAuthedClient("/v1/admin/me");

export async function changeAdminPasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  await adminMeApi.post("/change-password", { currentPassword, newPassword });
}

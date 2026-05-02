import { publicApi } from "@/modules/shared/infrastructure/http-client";
import { LoginPayload, LoginResponse } from "@/modules/auth/domain/types";

export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await publicApi.post<LoginResponse>("/v1/admins/login", payload);
  return data;
}

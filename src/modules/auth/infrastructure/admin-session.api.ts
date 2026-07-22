import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";
import type { AdminSession } from "@/modules/auth/domain/permissions";

/**
 * Sessão do admin logado. Papel e permissões vêm do banco (não do JWT) para que
 * conceder/revogar acesso valha na hora, sem esperar o admin relogar.
 */
const adminsRootApi = createAuthedClient("/v1/admins");

export async function getAdminMe(): Promise<AdminSession> {
  const res = await adminsRootApi.get("/me");
  return res.data.data;
}

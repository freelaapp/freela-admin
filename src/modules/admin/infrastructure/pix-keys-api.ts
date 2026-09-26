import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Chave Pix pelo lado do suporte vive sob /v1/admins (shared kernel), não sob a
// base de bares-restaurantes do `adminApi`.
const adminsRootApi = createAuthedClient("/v1/admins");

export type PixKeyKind = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export interface ReplacePixKeyResult {
  providerGlobalId: string;
  keyType: string;
  keyValue: string;
  /** Módulos em que a chave foi gravada (o freelancer existe em 1 ou 2). */
  updatedModules: string[];
  /** `true` quando a Woovi aceitou a chave e a subconta ficou de pé. */
  subaccountReady: boolean;
  /** Motivo da recusa da Woovi (chave não existe no Pix etc.), para mostrar ao suporte. */
  subaccountError: string | null;
}

/**
 * Troca a chave Pix PADRÃO do freelancer nos dois módulos e recria a subconta
 * na Woovi. A chave é gravada mesmo se a Woovi recusar — o resultado diz se ela
 * aceitou, e é isso que o suporte precisa ver antes do repasse.
 */
export async function replaceProviderPixKey(
  providerGlobalId: string,
  keyType: PixKeyKind,
  keyValue: string,
): Promise<ReplacePixKeyResult> {
  const res = await adminsRootApi.patch(`/pix-keys/providers/${providerGlobalId}`, {
    keyType,
    keyValue,
  });
  return res.data.data;
}

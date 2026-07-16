import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const blockedApi = createAuthedClient("/v1/admins/blocked-providers");

/**
 * Gestão (admin) dos freelancers bloqueados por um contratante — bloqueio
 * SILENCIOSO: o freelancer segue se candidatando e não é avisado; as
 * candidaturas dele não aparecem para aquele contratante (a API filtra).
 * Candidatura já ACEITA nunca é escondida.
 */
export interface BlockedProviderItem {
  providerGlobalId: string;
  name: string | null;
  avatarUrl: string | null;
  blockedAt: string | null;
}

export async function getContractorBlockedProviders(
  contractorUserId: string,
): Promise<BlockedProviderItem[]> {
  const res = await blockedApi.get("", { params: { contractorUserId } });
  return res.data.data ?? [];
}

export async function adminBlockProvider(payload: {
  contractorUserId: string;
  providerGlobalId: string;
}): Promise<void> {
  await blockedApi.post("", payload);
}

export async function adminUnblockProvider(
  contractorUserId: string,
  providerGlobalId: string,
): Promise<void> {
  await blockedApi.delete(`/${contractorUserId}/${providerGlobalId}`);
}

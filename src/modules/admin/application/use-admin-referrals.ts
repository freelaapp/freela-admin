"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveReward,
  cancelReward,
  createCampaign,
  getCampaign,
  getCampaignRecipients,
  getCampaigns,
  getReferralRewards,
  getReferralSummary,
  getReferrals,
  payReward,
  previewCampaignMessages,
  previewExternalList,
  setCampaignState,
  setRecipientContact,
  type CreateCampaignPayload,
  type ExternalContact,
  type RecipientListParams,
  type ReferralListFilter,
  getAudienceOptions,
  previewCampaignAudience,
  type AudienceFilters,
  type CampaignAudience,
} from "../infrastructure/referrals-api";

const REFERRALS_KEY = ["admin", "referrals"] as const;
const CAMPAIGNS_KEY = ["admin", "activation-campaigns"] as const;

export function useReferralSummary() {
  return useQuery({
    queryKey: [...REFERRALS_KEY, "summary"],
    queryFn: getReferralSummary,
    staleTime: 30_000,
  });
}

export function useReferrals(filter: ReferralListFilter) {
  return useQuery({
    queryKey: [...REFERRALS_KEY, "list", filter],
    queryFn: () => getReferrals(filter),
    staleTime: 30_000,
  });
}

export function useReferralRewards(filter: ReferralListFilter) {
  return useQuery({
    queryKey: [...REFERRALS_KEY, "rewards", filter],
    queryFn: () => getReferralRewards(filter),
    staleTime: 30_000,
  });
}

/**
 * Aprovar/pagar/cancelar invalidam TUDO de indicações: a ação muda a linha, o
 * total do passivo no topo e a contagem por status. Invalidar só a lista
 * deixaria o KPI mentindo até o próximo refetch.
 */
function useRewardMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: REFERRALS_KEY }),
  });
}

export function useApproveReward() {
  return useRewardMutation((id: string) => approveReward(id));
}

export function usePayReward() {
  return useRewardMutation(({ id, ...payload }: { id: string; paymentProof: string; pixKey?: string }) =>
    payReward(id, payload),
  );
}

export function useCancelReward() {
  return useRewardMutation(({ id, reason }: { id: string; reason: string }) =>
    cancelReward(id, reason),
  );
}

export function useCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: getCampaigns,
    // Campanha RUNNING muda sozinha: sem refetch a tela envelhece na mão do
    // operador que está justamente olhando o disparo acontecer.
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, id],
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(id),
    // Só enquanto dispara: campanha parada não muda sozinha, e o refetch
    // desnecessário embaça a tabela a cada minuto na frente do operador.
    refetchInterval: (query) =>
      query.state.data?.campaign.status === "RUNNING" ? 60_000 : false,
  });
}

export function useCampaignRecipients(
  id: string | null,
  params: RecipientListParams,
  options: { autoRefresh?: boolean } = {},
) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, id, "recipients", params],
    queryFn: () => getCampaignRecipients(id as string, params),
    enabled: Boolean(id),
    placeholderData: (previous) => previous,
    refetchInterval: options.autoRefresh ? 60_000 : false,
  });
}

/** Confere a planilha na API antes de criar (válidos, inválidos, já cadastrados). */
export function usePreviewExternalList() {
  return useMutation({
    mutationFn: (contacts: ExternalContact[]) => previewExternalList(contacts),
  });
}

/**
 * Marcar contato invalida o detalhe inteiro da campanha (cards + lista): o
 * card "contato" e a linha mudam juntos.
 */
export function useSetRecipientContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      campaignId,
      recipientId,
      ...payload
    }: {
      campaignId: string;
      recipientId: string;
      contacted: boolean;
      note?: string;
    }) => setRecipientContact(campaignId, recipientId, payload),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [...CAMPAIGNS_KEY, vars.campaignId] }),
  });
}

export function useCampaignPreview(name: string, city: string) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "preview", name, city],
    queryFn: () => previewCampaignMessages({ name, city }),
    staleTime: Infinity,
  });
}

/**
 * Cidades da audiência escolhida. Só busca quando o formulário está aberto —
 * a chamada monta a audiência inteira no backend, então não vale disparar em
 * toda visita à página.
 */
export function useAudienceOptions(audience: CampaignAudience | null) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "audience-options", audience],
    queryFn: () => getAudienceOptions(audience as CampaignAudience),
    enabled: !!audience,
    staleTime: 5 * 60 * 1000,
  });
}

/** Conta a audiência com o recorte, antes de criar. */
export function usePreviewAudience() {
  return useMutation({
    mutationFn: (payload: { audience: CampaignAudience; filters?: AudienceFilters }) =>
      previewCampaignAudience(payload),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCampaignPayload) => createCampaign(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useSetCampaignState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "start" | "pause" | "cancel" }) =>
      setCampaignState(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

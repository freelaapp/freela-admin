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
  setCampaignState,
  type CreateCampaignPayload,
  type RecipientStatus,
  type ReferralListFilter,
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
    refetchInterval: 60_000,
  });
}

export function useCampaignRecipients(
  id: string | null,
  params: { status?: RecipientStatus; page?: number; pageSize?: number },
) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, id, "recipients", params],
    queryFn: () => getCampaignRecipients(id as string, params),
    enabled: Boolean(id),
  });
}

export function useCampaignPreview(name: string, city: string) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, "preview", name, city],
    queryFn: () => previewCampaignMessages({ name, city }),
    staleTime: Infinity,
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

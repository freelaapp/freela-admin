"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  vipAddResultMessage,
  vipEnsureResultMessage,
  vipRemoveResultMessage,
  vipSyncResultMessage,
} from "./vip-groups-presentation";
import {
  addVipGroupMember,
  ensureVipGroup,
  getVipGroupDetail,
  getVipGroups,
  markVipMemberRemovedOnWhatsapp,
  removeVipGroupMember,
  searchVipGroupProviders,
  syncVipGroup,
} from "../infrastructure/vip-groups-api";

export const VIP_GROUP_KEYS = {
  all: ["admin", "vip-groups"] as const,
  list: (search: string) => ["admin", "vip-groups", "list", search] as const,
  detail: (contractorUserId: string) => ["admin", "vip-groups", "detail", contractorUserId] as const,
  providers: (search: string) => ["admin", "vip-groups", "providers", search] as const,
};

const fail = (fallback: string) => (e: unknown) => toast.error(getAxiosErrorMessage(e, fallback));

export function useVipGroups(search: string) {
  return useQuery({ queryKey: VIP_GROUP_KEYS.list(search), queryFn: () => getVipGroups(search), staleTime: 30_000 });
}

export function useVipGroupDetail(contractorUserId: string) {
  return useQuery({
    queryKey: VIP_GROUP_KEYS.detail(contractorUserId),
    queryFn: () => getVipGroupDetail(contractorUserId),
    enabled: !!contractorUserId,
  });
}

/** Busca de freelas (só `VIP_ADMIN`). Só dispara com 2+ caracteres. */
export function useVipProviderSearch(search: string, enabled: boolean) {
  const term = search.trim();
  return useQuery({
    queryKey: VIP_GROUP_KEYS.providers(term),
    queryFn: () => searchVipGroupProviders(term),
    enabled: enabled && term.length >= 2,
    staleTime: 30_000,
  });
}

/**
 * "Criar grupo VIP" da tela Grupos WhatsApp (spec 2026-09-24 §E): a loja é escolhida
 * no modal, por isso o id vem na chamada (e não no hook, como em `useVipGroupMutations`).
 * Os toasts ficam com o diálogo.
 */
export function useEnsureVipGroupFor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractorUserId: string) => ensureVipGroup(contractorUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: VIP_GROUP_KEYS.all }),
  });
}

export function useVipGroupMutations(contractorUserId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: VIP_GROUP_KEYS.all });

  const ensure = useMutation({
    mutationFn: () => ensureVipGroup(contractorUserId),
    onSuccess: (group) => {
      invalidate();
      const msg = vipEnsureResultMessage(group);
      if (msg.ok) toast.success(msg.text);
      else toast.error(msg.text);
    },
    onError: fail("Não foi possível criar o grupo."),
  });
  const add = useMutation({
    mutationFn: (providerGlobalId: string) => addVipGroupMember(contractorUserId, providerGlobalId),
    onSuccess: (member) => {
      invalidate();
      toast.success(vipAddResultMessage(member));
    },
    onError: fail("Não foi possível adicionar o VIP."),
  });
  const remove = useMutation({
    mutationFn: (providerGlobalId: string) => removeVipGroupMember(contractorUserId, providerGlobalId),
    onSuccess: (member) => {
      invalidate();
      toast.success(vipRemoveResultMessage(member));
    },
    onError: fail("Não foi possível tirar da lista."),
  });
  const markRemoved = useMutation({
    mutationFn: (providerGlobalId: string) => markVipMemberRemovedOnWhatsapp(contractorUserId, providerGlobalId),
    onSuccess: () => {
      invalidate();
      toast.success("Pendência resolvida.");
    },
    onError: fail("Não foi possível marcar como feito."),
  });
  const sync = useMutation({
    mutationFn: () => syncVipGroup(contractorUserId),
    onSuccess: (result) => {
      invalidate();
      toast.success(vipSyncResultMessage(result));
    },
    onError: fail("Não foi possível adicionar os pendentes."),
  });

  return { ensure, add, remove, markRemoved, sync };
}

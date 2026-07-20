"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";

import {
  adjustAdminWallet,
  getAdminWalletLedger,
  getAdminWallets,
  type AdjustWalletPayload,
  type WalletListParams,
} from "../infrastructure/wallets-api";

export function useAdminWallets(params: WalletListParams) {
  return useQuery({
    queryKey: ["admin", "wallets", params],
    queryFn: () => getAdminWallets(params),
    staleTime: 15000,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
  });
}

export function useAdminWalletLedger(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "wallets", userId, "ledger"],
    queryFn: () => getAdminWalletLedger(userId!),
    enabled: !!userId,
    staleTime: 15000,
  });
}

export function useAdjustWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdjustWalletPayload }) =>
      adjustAdminWallet(userId, payload),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "wallets"] });
      qc.invalidateQueries({ queryKey: ["admin", "wallets", userId, "ledger"] });
    },
  });
}

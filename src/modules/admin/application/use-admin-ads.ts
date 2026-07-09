"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  createAd,
  deleteAd,
  getAds,
  updateAd,
  type CreateAdPayload,
  type UpdateAdPayload,
} from "../infrastructure/ads-api";

const KEY = ["admin", "ads"] as const;

export function useAdminAds() {
  return useQuery({ queryKey: KEY, queryFn: getAds, staleTime: 30000 });
}

export function useAdminAdMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (payload: CreateAdPayload) => createAd(payload),
    onSuccess: () => {
      invalidate();
      toast.success("Anúncio criado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao criar anúncio.")),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAdPayload }) =>
      updateAd(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Anúncio atualizado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao atualizar anúncio.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAd(id),
    onSuccess: () => {
      invalidate();
      toast.success("Anúncio excluído.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao excluir anúncio.")),
  });

  return { create, update, remove };
}

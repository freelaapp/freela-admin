"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  createCoupon,
  deactivateCoupon,
  getCoupons,
  type CreateCouponInput,
} from "../infrastructure/coupons-api";

const KEY = ["admin", "coupons"] as const;

export function useCoupons() {
  return useQuery({ queryKey: KEY, queryFn: getCoupons, staleTime: 30000 });
}

export function useCouponMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (dto: CreateCouponInput) => createCoupon(dto),
    onSuccess: () => {
      invalidate();
      toast.success("Cupom criado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao criar cupom.")),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateCoupon(id),
    onSuccess: () => {
      invalidate();
      toast.success("Cupom desativado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao desativar cupom.")),
  });

  return { create, deactivate };
}

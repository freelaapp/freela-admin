"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminLot,
  getAdminLotByVacancy,
  getAdminLots,
} from "../infrastructure/lots-api";
import { isLotsUnavailable } from "./lots-presentation";

const KEY = ["admin", "lots"] as const;

const retryUnlessUnavailable = (count: number, error: unknown) =>
  !isLotsUnavailable(error) && count < 2;

/** A2: os lotes dos próximos dias. 404 não tenta de novo nem recarrega. */
export function useAdminLots(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: () => getAdminLots(),
    enabled,
    retry: retryUnlessUnavailable,
    refetchInterval: (query) => (isLotsUnavailable(query.state.error) ? false : 60_000),
  });
}

/** A3: um lote. */
export function useAdminLot(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => getAdminLot(id),
    enabled,
    retry: retryUnlessUnavailable,
  });
}

/** A1: o lote da vaga aberta no modal. Sem lote na API (qualquer 404), a linha não aparece. */
export function useAdminLotByVacancy(vacancyId: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "by-vacancy", vacancyId],
    queryFn: () => getAdminLotByVacancy(vacancyId as string),
    enabled: !!vacancyId,
    retry: retryUnlessUnavailable,
    staleTime: 30_000,
  });
}

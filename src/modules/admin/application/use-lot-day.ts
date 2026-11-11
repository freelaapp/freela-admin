"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminLotLines } from "../infrastructure/lot-lines-api";
import { chooseAdminLot, getAdminLotCandidates } from "../infrastructure/lot-choice-api";
import { isChoiceDisabled, isGroupGone } from "./lot-choice-presentation";
import { isLotsUnavailable } from "./lots-presentation";

const KEY = ["admin", "lots"] as const;

const retryUnlessOff = (count: number, error: unknown) => !isLotsUnavailable(error) && count < 2;

/** A3: as linhas por vaga (pergunta, pagamento, chegada, presença). 404 = recurso desligado. */
export function useAdminLotLines(lotId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "lines", lotId],
    queryFn: () => getAdminLotLines(lotId),
    enabled,
    retry: retryUnlessOff,
    refetchInterval: (query) => (isLotsUnavailable(query.state.error) ? false : 60_000),
  });
}

/** A4: os candidatos de uma função. Só roda com o diálogo aberto (`groupKey` não nulo). */
export function useAdminLotCandidates(lotId: string, groupKey: string | null) {
  return useQuery({
    queryKey: [...KEY, "candidates", lotId, groupKey],
    queryFn: () => getAdminLotCandidates(lotId, groupKey as string),
    enabled: !!groupKey,
    retry: (count, error) => !isChoiceDisabled(error) && !isGroupGone(error) && count < 2,
    staleTime: 0,
  });
}

/** A4: escolhe pelo lote. Depois de qualquer resposta relê o lote, as linhas e os candidatos. */
export function useAdminLotChoose(lotId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { groupKey: string; providerGlobalIds: string[] }) => chooseAdminLot(lotId, body),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: [...KEY, "detail", lotId] });
      void client.invalidateQueries({ queryKey: [...KEY, "lines", lotId] });
      void client.invalidateQueries({ queryKey: [...KEY, "candidates", lotId] });
    },
  });
}

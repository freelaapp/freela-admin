"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWhatsAppChips,
  sendWhatsAppChipTest,
  type SendChipTestInput,
} from "../infrastructure/whatsapp-chips-api";

const CHIPS_KEY = ["admin", "whatsapp-chips"] as const;

/**
 * Diagnóstico dos dois chips de WhatsApp (transacional × campanha). Auto-refresh
 * a cada 60 s como o resto do painel — a tela fica aberta num monitor.
 */
export function useWhatsAppChips() {
  return useQuery({
    queryKey: CHIPS_KEY,
    queryFn: getWhatsAppChips,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

/** Dispara a mensagem de teste por chip (SUPER_ADMIN). */
export function useSendWhatsAppChipTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendChipTestInput) => sendWhatsAppChipTest(input),
    onSuccess: () => {
      // O teste pode revelar mudança de conexão; recarrega os chips.
      queryClient.invalidateQueries({ queryKey: CHIPS_KEY });
    },
  });
}

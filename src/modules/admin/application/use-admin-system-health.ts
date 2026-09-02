"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAttendanceFlows,
  getSystemHealth,
  resolveAttendanceFlow,
  sendAdminAlertTest,
  type ResolveAttendanceInput,
} from "../infrastructure/system-health-api";

const HEALTH_KEY = ["admin", "system-health"] as const;
const ATTENDANCE_KEY = ["admin", "attendance"] as const;

/**
 * Estado dos canais, provedores e schedulers. Auto-refresh a cada 60 s: é a
 * tela que fica aberta num monitor — sem isso ela mostra um "verde" velho.
 */
export function useSystemHealth() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: getSystemHealth,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

export function useAttendanceFlows() {
  return useQuery({
    queryKey: ATTENDANCE_KEY,
    queryFn: getAttendanceFlows,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useResolveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResolveAttendanceInput) => resolveAttendanceFlow(input),
    onSuccess: () => {
      // A decisão muda os dois: some da lista e mexe nas contagens do painel.
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY });
      queryClient.invalidateQueries({ queryKey: HEALTH_KEY });
    },
  });
}

/** Dispara a mensagem de teste do canal de avisos internos (SUPER_ADMIN). */
export function useSendAdminAlertTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendAdminAlertTest,
    onSuccess: () => {
      // O teste resolve o grupo de novo: o card pode mudar de cor.
      queryClient.invalidateQueries({ queryKey: HEALTH_KEY });
    },
  });
}

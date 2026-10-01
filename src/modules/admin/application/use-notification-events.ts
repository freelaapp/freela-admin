"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotificationEvents,
  setLegacyCut,
  setNotificationEvent,
  type NotificationEventsPayload,
} from "../infrastructure/notification-events-api";

export const NOTIFICATION_EVENTS_KEY = ["admin", "notification-events"] as const;
const KEY = NOTIFICATION_EVENTS_KEY;

// Uma só query (GET pesado) alimenta a lista e o corte do WhatsApp antigo; cada consumidor usa seu select.
export function useNotificationEvents() {
  return useQuery({ queryKey: KEY, queryFn: fetchNotificationEvents, staleTime: 30_000, select: (p) => p.events });
}

export function useLegacyCut() {
  return useQuery({ queryKey: KEY, queryFn: fetchNotificationEvents, staleTime: 30_000, select: (p) => p.legacyCut });
}

export function useSetLegacyCut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setLegacyCut(enabled),
    // O PUT devolve o estado novo: atualiza a mesma query, sem repetir o GET pesado.
    onSuccess: (view) => qc.setQueryData<NotificationEventsPayload>(KEY, (p) => (p ? { ...p, legacyCut: view } : p)),
  });
}

export function useSetNotificationEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventKey, enabled }: { eventKey: string; enabled: boolean }) => setNotificationEvent(eventKey, enabled),
    onMutate: async ({ eventKey, enabled }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<NotificationEventsPayload>(KEY);
      qc.setQueryData<NotificationEventsPayload>(KEY, (p) =>
        p ? { ...p, events: p.events.map((r) => (r.eventKey === eventKey ? { ...r, metaEnabled: enabled } : r)) } : p,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotificationEvents,
  setNotificationEvent,
  type NotificationEventView,
} from "../infrastructure/notification-events-api";

const KEY = ["admin", "notification-events"] as const;

export function useNotificationEvents() {
  return useQuery({ queryKey: KEY, queryFn: listNotificationEvents, staleTime: 30_000 });
}

export function useSetNotificationEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventKey, enabled }: { eventKey: string; enabled: boolean }) => setNotificationEvent(eventKey, enabled),
    onMutate: async ({ eventKey, enabled }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<NotificationEventView[]>(KEY);
      qc.setQueryData<NotificationEventView[]>(KEY, (rows) => rows?.map((r) => (r.eventKey === eventKey ? { ...r, metaEnabled: enabled } : r)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

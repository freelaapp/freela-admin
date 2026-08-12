"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createServiceAdjacency,
  deleteServiceAdjacency,
  getServiceAdjacencies,
  updateServiceAdjacency,
} from "../infrastructure/service-adjacency-api";

const KEY = ["admin", "service-adjacency"] as const;

export function useServiceAdjacencies() {
  return useQuery({ queryKey: KEY, queryFn: getServiceAdjacencies, staleTime: 30_000 });
}

function useInvalidating<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateServiceAdjacency() {
  return useInvalidating(createServiceAdjacency);
}

export function useUpdateServiceAdjacency() {
  return useInvalidating(({ id, ...payload }: { id: string; active?: boolean; note?: string }) =>
    updateServiceAdjacency(id, payload),
  );
}

export function useDeleteServiceAdjacency() {
  return useInvalidating(deleteServiceAdjacency);
}

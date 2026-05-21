"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVacancyGroupRoute,
  CreateRoutePayload,
  deleteVacancyGroupRoute,
  getVacancyGroupRoutes,
  getWhatsAppGroups,
  updateVacancyGroupRoute,
  UpdateRoutePayload,
} from "../infrastructure/whatsapp-groups-api";

const ROUTES_KEY = ["admin", "vacancy-group-routes"];

export function useVacancyGroupRoutes() {
  return useQuery({
    queryKey: ROUTES_KEY,
    queryFn: getVacancyGroupRoutes,
    staleTime: 30000,
  });
}

export function useWhatsAppGroups() {
  return useQuery({
    queryKey: ["admin", "whatsapp-groups"],
    queryFn: getWhatsAppGroups,
    staleTime: 60000,
  });
}

export function useCreateVacancyGroupRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoutePayload) => createVacancyGroupRoute(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTES_KEY }),
  });
}

export function useUpdateVacancyGroupRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRoutePayload }) =>
      updateVacancyGroupRoute(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTES_KEY }),
  });
}

export function useDeleteVacancyGroupRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVacancyGroupRoute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROUTES_KEY }),
  });
}

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
  createVacancyGroupStateRoute,
  CreateStateRoutePayload,
  deleteVacancyGroupStateRoute,
  getVacancyGroupStateRoutes,
  updateVacancyGroupStateRoute,
  UpdateStateRoutePayload,
} from "../infrastructure/whatsapp-groups-api";

const ROUTES_KEY = ["admin", "vacancy-group-routes"];
const STATE_ROUTES_KEY = ["admin", "vacancy-group-state-routes"];

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

// ─── State (UF) routes ──────────────────────────────────────────────────────

export function useVacancyGroupStateRoutes() {
  return useQuery({
    queryKey: STATE_ROUTES_KEY,
    queryFn: getVacancyGroupStateRoutes,
    staleTime: 30000,
  });
}

export function useCreateVacancyGroupStateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStateRoutePayload) => createVacancyGroupStateRoute(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_ROUTES_KEY }),
  });
}

export function useUpdateVacancyGroupStateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStateRoutePayload }) =>
      updateVacancyGroupStateRoute(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_ROUTES_KEY }),
  });
}

export function useDeleteVacancyGroupStateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVacancyGroupStateRoute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_ROUTES_KEY }),
  });
}

"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRegistrationApi,
  listRegistrationsApi,
} from "@/modules/consultant/infrastructure/consultant-api";
import type {
  CreateRegistrationPayload,
  RegistrationFilters,
} from "@/modules/consultant/domain/types";
import { CONSULTANT_PROFILE_QUERY_KEY } from "./use-consultant-profile";

export function useConsultantRegistrations(filters: RegistrationFilters) {
  return useQuery({
    queryKey: ["consultant", "registrations", filters],
    queryFn: () => listRegistrationsApi(filters),
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRegistrationPayload) => createRegistrationApi(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultant", "registrations"] });
      // Os totais do topo de "Meus cadastros" vêm do perfil.
      qc.invalidateQueries({ queryKey: CONSULTANT_PROFILE_QUERY_KEY });
    },
  });
}

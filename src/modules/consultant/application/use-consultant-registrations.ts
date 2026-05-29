"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRegistrationApi,
  listRegistrationsApi,
} from "@/modules/consultant/infrastructure/consultant-api";
import type { CreateRegistrationPayload } from "@/modules/consultant/domain/types";

export function useConsultantRegistrations() {
  return useQuery({
    queryKey: ["consultant", "registrations"],
    queryFn: listRegistrationsApi,
    staleTime: 15000,
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRegistrationPayload) => createRegistrationApi(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultant", "registrations"] });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWhatsappGroup,
  getGroupDiagnostics,
} from "../infrastructure/whatsapp-groups-api";

export function useGroupDiagnostics() {
  return useQuery({
    queryKey: ["admin", "whatsapp-group-diagnostics"],
    queryFn: getGroupDiagnostics,
    staleTime: 30000,
  });
}

export function useCreateWhatsappGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWhatsappGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "whatsapp-group-diagnostics"] });
    },
  });
}

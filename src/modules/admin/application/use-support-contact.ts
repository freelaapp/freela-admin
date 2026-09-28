"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupportContact, updateSupportContact } from "../infrastructure/support-contact-api";

const KEY = ["admin", "support-contact"] as const;

export function useSupportContact() {
  return useQuery({ queryKey: KEY, queryFn: getSupportContact, staleTime: 30_000 });
}

export function useUpdateSupportContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (whatsapp: string) => updateSupportContact(whatsapp),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminPayments } from "../infrastructure/admin-api";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: getAdminPayments,
    staleTime: 30000,
    // O painel não recarrega ao voltar para a aba do navegador
    // (`refetchOnWindowFocus: false` no cliente): recarrega sozinho a cada minuto.
    refetchInterval: 60000,
  });
}

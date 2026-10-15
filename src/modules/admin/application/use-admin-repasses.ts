"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminRepasses } from "../infrastructure/admin-api";

export function useAdminRepasses() {
  return useQuery({
    queryKey: ["admin", "repasses"],
    queryFn: getAdminRepasses,
    staleTime: 30000,
    // O painel não recarrega ao voltar para a aba do navegador
    // (`refetchOnWindowFocus: false` no cliente): recarrega sozinho a cada minuto.
    refetchInterval: 60000,
  });
}

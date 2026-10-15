"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminPayments } from "../infrastructure/admin-api";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: getAdminPayments,
    staleTime: 30000,
    // Lê a tabela inteira (sem paginação): sem recarga periódica. Recarrega ao
    // abrir a aba e no botão "Atualizar" (o painel não recarrega ao voltar para
    // a aba do navegador, `refetchOnWindowFocus: false`).
    refetchOnMount: "always",
  });
}

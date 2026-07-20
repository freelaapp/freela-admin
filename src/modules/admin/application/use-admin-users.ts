"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getAdminUsers, type AdminUsersQuery } from "../infrastructure/admin-api";

export function useAdminUsers(params: AdminUsersQuery = {}) {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => getAdminUsers(params),
    staleTime: 30000,
    // Mantém a página anterior visível enquanto a próxima carrega (paginação/busca
    // não voltam ao spinner de tela cheia — só o overlay do DataTable).
    placeholderData: keepPreviousData,
  });
}

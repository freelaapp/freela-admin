"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminPayments } from "../infrastructure/admin-api";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: getAdminPayments,
    staleTime: 30000,
  });
}

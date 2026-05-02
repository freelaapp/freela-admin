"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminContractors } from "../infrastructure/admin-api";

export function useAdminContractors() {
  return useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: getAdminContractors,
    staleTime: 30000,
  });
}

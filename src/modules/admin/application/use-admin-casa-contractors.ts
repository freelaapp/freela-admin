"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCasaContractors } from "../infrastructure/casa-contractors-api";

export function useAdminCasaContractors() {
  return useQuery({
    queryKey: ["admin", "casa-contractors"],
    queryFn: getAdminCasaContractors,
    staleTime: 30000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminProviders } from "../infrastructure/admin-api";

export function useAdminProviders() {
  return useQuery({
    queryKey: ["admin", "providers"],
    queryFn: getAdminProviders,
    staleTime: 30000,
  });
}

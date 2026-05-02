"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminRepasses } from "../infrastructure/admin-api";

export function useAdminRepasses() {
  return useQuery({
    queryKey: ["admin", "repasses"],
    queryFn: getAdminRepasses,
    staleTime: 30000,
  });
}

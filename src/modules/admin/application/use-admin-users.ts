"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminUsers } from "../infrastructure/admin-api";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: getAdminUsers,
    staleTime: 30000,
  });
}

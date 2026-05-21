"use client";

import { useQuery } from "@tanstack/react-query";
import { getGroupDiagnostics } from "../infrastructure/whatsapp-groups-api";

export function useGroupDiagnostics() {
  return useQuery({
    queryKey: ["admin", "whatsapp-group-diagnostics"],
    queryFn: getGroupDiagnostics,
    staleTime: 30000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getCasaAdminFeedbacks } from "../infrastructure/casa-vacancies-api";

/** Feedbacks do módulo Freela em Casa — só busca quando o módulo está selecionado na aba. */
export function useCasaAdminFeedbacks(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "feedbacks", "casa"],
    queryFn: getCasaAdminFeedbacks,
    staleTime: 30000,
    enabled,
  });
}

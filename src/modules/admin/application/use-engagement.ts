"use client";

import { isAxiosError } from "axios";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  engagementListQuery,
  engagementPeriodQuery,
  engagementQuery,
  getContractorEngagement,
  getEngagementOverview,
  getFreelancerEngagement,
  listEngagementContractors,
  listEngagementFreelancers,
  type ContractorListRow,
  type EngagementFilters,
  type EngagementListParams,
  type FreelancerListRow,
  type ListPage,
} from "../infrastructure/engagement-api";
import { isFilterReady } from "./engagement-filters";
import type { EngagementSide } from "./engagement-format";

/**
 * Hooks do engajamento, no padrão de use-admin-metrics: personalizado
 * incompleto não consulta (a API cairia no padrão e a tela mostraria o mês com
 * o rótulo do intervalo), e os números anteriores ficam na tela enquanto o
 * filtro novo carrega.
 */
const STALE_MS = 30_000;

export type PeopleRow = FreelancerListRow | ContractorListRow;

export function useEngagementOverview(f: EngagementFilters) {
  return useQuery({
    retry: retryUnlessClientError,
    queryKey: ["admin", "engagement", "overview", engagementQuery(f)],
    queryFn: () => getEngagementOverview(f),
    enabled: isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** Lista de um lado. `enabled=false` quando o admin não tem a área (a API daria 403). */
export function useEngagementPeople(
  side: EngagementSide,
  f: EngagementFilters,
  params: EngagementListParams,
  enabled = true,
) {
  return useQuery<ListPage<PeopleRow>>({
    queryKey: ["admin", "engagement", side, engagementListQuery(f, params)],
    queryFn: () =>
      side === "freelancer" ? listEngagementFreelancers(f, params) : listEngagementContractors(f, params),
    enabled: enabled && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** Fichas: a chave usa só o período, porque é o único filtro que a API aplica nelas. */
export function useFreelancerEngagement(userId: string, f: EngagementFilters) {
  return useQuery({
    retry: retryUnlessClientError,
    queryKey: ["admin", "engagement", "freelancer-detail", userId, engagementPeriodQuery(f)],
    queryFn: () => getFreelancerEngagement(userId, f),
    enabled: Boolean(userId) && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

export function useContractorEngagement(userId: string, f: EngagementFilters) {
  return useQuery({
    retry: retryUnlessClientError,
    queryKey: ["admin", "engagement", "contractor-detail", userId, engagementPeriodQuery(f)],
    queryFn: () => getContractorEngagement(userId, f),
    enabled: Boolean(userId) && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/**
 * 4xx (ficha inexistente, sem permissão, filtro recusado) não melhora com nova
 * tentativa: mostra o erro na hora. Rede/5xx tenta mais 2 vezes.
 */
export function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 500;
    if (status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

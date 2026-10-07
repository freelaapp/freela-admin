"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  withQuery,
} from "@/modules/admin/application/engagement-filters";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

/**
 * Fichas: os filtros chegam na URL (vindos da lista ou da busca). Só o período
 * muda a consulta, mas a URL e o link de volta levam tudo, inclusive a aba.
 */
export function useDetailFilters(tab: "freelancers" | "empresas") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<EngagementFilters>(() => filtersFromSearchParams(searchParams));
  const changeFilters = (f: EngagementFilters) => {
    setFilters(f);
    router.replace(withQuery(pathname, filtersToSearchParams(f, { aba: tab })), { scroll: false });
  };
  const backHref = withQuery("/engajamento", filtersToSearchParams(filters, { aba: tab }));
  return { filters, changeFilters, backHref };
}

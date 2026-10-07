"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  backToListHref,
  filtersFromSearchParams,
  listStateExtras,
  listStateFromSearchParams,
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
  // O estado da lista (segmento, busca, página) só passa pela ficha: volta igual.
  const [list] = useState(() => listStateFromSearchParams(searchParams));
  const changeFilters = (f: EngagementFilters) => {
    setFilters(f);
    router.replace(withQuery(pathname, filtersToSearchParams(f, { aba: tab, ...listStateExtras(list) })), {
      scroll: false,
    });
  };
  const backHref = backToListHref(filters, tab, list);
  return { filters, changeFilters, backHref };
}

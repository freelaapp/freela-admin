"use client";

import { useQuery } from "@tanstack/react-query";
import { getCitiesCatalog } from "../infrastructure/cities-catalog-api";

/**
 * Catálogo IBGE completo (~5570 municípios), buscado uma vez e cacheado —
 * é a fonte que trava a cidade em uma autocomplete/select em vez de texto
 * livre (a causa original de cidade digitada com erro de digitação).
 */
export function useCitiesCatalog() {
  return useQuery({
    queryKey: ["cities", "catalog"],
    queryFn: getCitiesCatalog,
    // Catálogo IBGE não muda em produção — 24h de cache evita rebuscar a
    // cada abertura de tela.
    staleTime: 24 * 60 * 60 * 1000,
  });
}

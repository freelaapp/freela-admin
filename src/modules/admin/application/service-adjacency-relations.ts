import type { ServiceAdjacency } from "@/modules/admin/infrastructure/service-adjacency-api";

export interface RelacoesDoCargo {
  /** Vizinhanças de SAÍDA: quem tem este cargo passa a ver vagas de… */
  ve: ServiceAdjacency[];
  /** Vizinhanças de ENTRADA: quem tem estes cargos passa a ver vagas deste. */
  vistoPor: ServiceAdjacency[];
}

/**
 * As duas direções de um cargo no mapa de vizinhanças. O mapa agrupado da tela
 * só mostra a saída ("quem é X vê…"); para saber quem ENXERGA as vagas de X é
 * preciso varrer todos os grupos — é isso que o filtro por cargo resolve.
 * Inativas ficam (a tela as mostra tracejadas); ordem alfabética pelo outro lado.
 */
export function relacoesDoCargo(itens: ServiceAdjacency[], slug: string): RelacoesDoCargo {
  const porSlug = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  return {
    ve: itens
      .filter((i) => i.roleSlug === slug)
      .sort((a, b) => porSlug(a.neighborSlug, b.neighborSlug)),
    vistoPor: itens
      .filter((i) => i.neighborSlug === slug)
      .sort((a, b) => porSlug(a.roleSlug, b.roleSlug)),
  };
}

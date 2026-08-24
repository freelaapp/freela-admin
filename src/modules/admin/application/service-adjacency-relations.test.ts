import { describe, expect, it } from "vitest";
import type { ServiceAdjacency } from "@/modules/admin/infrastructure/service-adjacency-api";
import { relacoesDoCargo } from "./service-adjacency-relations";

const rel = (roleSlug: string, neighborSlug: string, active = true): ServiceAdjacency => ({
  id: `${roleSlug}->${neighborSlug}`,
  roleSlug,
  neighborSlug,
  active,
  note: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
});

// Filtro por cargo na tela de cargos semelhantes: as duas direções de uma
// vizinhança. `ve` = o que quem tem o cargo passa a enxergar; `vistoPor` = quem
// passa a enxergar as vagas desse cargo.
describe("relacoesDoCargo", () => {
  const itens = [
    rel("garcom", "cumim"),
    rel("cumim", "lavador-pratos"),
    rel("cozinheiro", "cumim", false),
    rel("cumim", "garcom"),
  ];

  it("separa o que o cargo vê do que é visto por outros", () => {
    const r = relacoesDoCargo(itens, "cumim");
    expect(r.ve.map((i) => i.neighborSlug)).toEqual(["garcom", "lavador-pratos"]);
    expect(r.vistoPor.map((i) => i.roleSlug)).toEqual(["cozinheiro", "garcom"]);
  });

  it("mantém as inativas (a tela mostra tracejado)", () => {
    const r = relacoesDoCargo(itens, "cumim");
    expect(r.vistoPor.find((i) => i.roleSlug === "cozinheiro")?.active).toBe(false);
  });

  it("cargo sem relação alguma devolve listas vazias", () => {
    expect(relacoesDoCargo(itens, "montador")).toEqual({ ve: [], vistoPor: [] });
  });
});

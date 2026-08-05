import { describe, expect, it } from "vitest";

import { filterPipelineCards, waLink } from "./funnel-helpers";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";

function card(over: Partial<PipelineCard>): PipelineCard {
  return {
    userId: "u1",
    name: "Bar do Zé",
    modules: ["bars-restaurants"],
    state: "SP",
    city: "Jundiaí",
    segment: "Bar",
    whatsappPhone: "5511999990000",
    hiringsCount: 0,
    registeredAt: "2026-07-01T12:00:00.000Z",
    ...over,
  };
}

describe("filterPipelineCards", () => {
  const cards = [
    card({ userId: "u1", name: "Bar do Zé", city: "Jundiaí", segment: "Bar" }),
    card({ userId: "u2", name: "Padaria Trigo", city: "Campinas", segment: "Padaria" }),
  ];

  it("sem termo devolve tudo", () => {
    expect(filterPipelineCards(cards, "  ")).toHaveLength(2);
  });

  it("busca por nome, cidade, ramo e telefone, sem case", () => {
    expect(filterPipelineCards(cards, "PADARIA")).toEqual([cards[1]]);
    expect(filterPipelineCards(cards, "jundiaí")).toEqual([cards[0]]);
    expect(filterPipelineCards(cards, "5511")).toEqual([cards[0], cards[1]]);
  });

  it("ignora campos nulos sem quebrar", () => {
    const semDados = [card({ city: null, state: null, segment: null, whatsappPhone: null })];
    expect(filterPipelineCards(semDados, "campinas")).toHaveLength(0);
  });
});

describe("waLink", () => {
  it("mantém número já com DDI 55", () => {
    expect(waLink("5511999990000")).toBe("https://wa.me/5511999990000");
  });

  it("adiciona DDI 55 em número local e remove máscara", () => {
    expect(waLink("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
  });
});

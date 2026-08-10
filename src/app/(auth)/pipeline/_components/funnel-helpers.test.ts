import { describe, expect, it } from "vitest";

import {
  FUNNEL_PRESETS,
  activeFunnelPreset,
  filterPipelineCards,
  formatSentAt,
  waLink,
} from "./funnel-helpers";
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
    lastMessageSentAt: null,
    messagesSentCount: 0,
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

describe("FUNNEL_PRESETS", () => {
  // Meio-dia local para não esbarrar em borda de fuso do construtor de Date.
  const NOW = new Date(2026, 7, 5, 12, 0, 0); // 05/08/2026

  function range(label: string) {
    return FUNNEL_PRESETS.find((p) => p.label === label)!.compute(NOW);
  }

  it("Hoje e Ontem cobrem um dia só", () => {
    expect(range("Hoje")).toEqual({ from: "2026-08-05", to: "2026-08-05" });
    expect(range("Ontem")).toEqual({ from: "2026-08-04", to: "2026-08-04" });
  });

  it("7 e 30 dias contam o dia atual como último dia", () => {
    expect(range("7 dias")).toEqual({ from: "2026-07-30", to: "2026-08-05" });
    expect(range("30 dias")).toEqual({ from: "2026-07-07", to: "2026-08-05" });
  });

  it("activeFunnelPreset reconhece o atalho e cai em Personalizado fora deles", () => {
    expect(activeFunnelPreset({ from: "2026-08-05", to: "2026-08-05" }, NOW)).toBe("Hoje");
    expect(activeFunnelPreset({ from: "2026-01-01", to: "2026-08-05" }, NOW)).toBeUndefined();
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

describe("formatSentAt", () => {
  const agora = new Date("2026-08-10T18:00:00");

  // O que a equipe precisa saber é se a mensagem saiu HOJE — não o carimbo
  // completo. Data cheia só quando o dia passa a importar mais que a hora.
  it("mostra a hora quando foi hoje", () => {
    expect(formatSentAt("2026-08-10T14:32:00", agora)).toBe("hoje às 14:32");
  });

  it("diz ontem em vez da data", () => {
    expect(formatSentAt("2026-08-09T09:10:00", agora)).toBe("ontem às 09:10");
  });

  it("cai para a data a partir de dois dias", () => {
    expect(formatSentAt("2026-08-03T09:10:00", agora)).toBe("em 03/08");
  });

  // Data inválida não pode quebrar o card inteiro do funil.
  it("não quebra com data inválida", () => {
    expect(formatSentAt("nao-e-data", agora)).toBe("antes");
  });
});

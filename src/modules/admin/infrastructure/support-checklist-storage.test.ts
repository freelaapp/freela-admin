import { describe, expect, it } from "vitest";

import {
  checklistKey,
  parseChecklistKey,
  podar,
  type ChecklistState,
} from "./support-checklist-storage";

const AGORA = Date.parse("2026-08-03T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

describe("chave do checklist", () => {
  it("vai e volta", () => {
    const key = checklistKey("vaga-1", "cobrar_pagamento");
    expect(parseChecklistKey(key)).toEqual({ vacancyId: "vaga-1", actionId: "cobrar_pagamento" });
  });

  // Uuid não tem "::", mas id de ação nunca deve ganhar um — a quebra é no
  // PRIMEIRO separador para o id da vaga nunca ser cortado ao meio.
  it("quebra no primeiro separador", () => {
    expect(parseChecklistKey("vaga::a::b")).toEqual({ vacancyId: "vaga", actionId: "a::b" });
  });

  it("rejeita chave sem separador ou sem vaga", () => {
    expect(parseChecklistKey("sem-separador")).toBeNull();
    expect(parseChecklistKey("::acao")).toBeNull();
  });
});

describe("podar", () => {
  const state: ChecklistState = {
    "nova::saudacao": { at: new Date(AGORA - 2 * DIA).toISOString(), by: "Ana" },
    "antiga::saudacao": { at: new Date(AGORA - 60 * DIA).toISOString(), by: "Ana" },
    "ilegivel::saudacao": { at: "nao-e-data", by: null },
  };

  it("descarta o tique vencido e mantém o recente", () => {
    const podado = podar(state, AGORA);
    expect(Object.keys(podado)).toContain("nova::saudacao");
    expect(Object.keys(podado)).not.toContain("antiga::saudacao");
  });

  // Descartar por não saber ler a data apagaria trabalho já feito — pior do que
  // guardar um registro estranho.
  it("mantém o tique com data ilegível", () => {
    expect(podar(state, AGORA)["ilegivel::saudacao"]).toBeDefined();
  });
});

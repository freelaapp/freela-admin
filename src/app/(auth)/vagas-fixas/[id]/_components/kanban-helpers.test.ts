import { describe, expect, it } from "vitest";

import { KANBAN_STAGES, otherStages, scoreBand, stageTitle } from "./kanban-helpers";
import type { FixedJobKanbanBoard } from "@/modules/admin/infrastructure/fixed-jobs-api";

function board(columns: Array<{ stage: FixedJobKanbanBoard["columns"][number]["stage"]; title: string }>): FixedJobKanbanBoard {
  return {
    post: {
      id: "post-1",
      title: "Garçom",
      role: "Garçom",
      category: null,
      companyName: "Bar do Zé",
      location: "São Paulo",
      status: "OPEN",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
    columns: columns.map((c) => ({ ...c, count: 0, cards: [] })),
    totalApplications: 0,
    rejectedCount: 0,
    needsManualReviewCount: 0,
  };
}

describe("otherStages", () => {
  it("retorna as outras 5 etapas na ordem do funil, sem a atual", () => {
    expect(otherStages("CANDIDATE")).toEqual([
      "PRE_SELECTED",
      "SELECTED",
      "INTERVIEW",
      "TEST",
      "FINAL_SELECTED",
    ]);
  });

  it("funciona para uma etapa no meio do funil", () => {
    expect(otherStages("INTERVIEW")).toEqual([
      "CANDIDATE",
      "PRE_SELECTED",
      "SELECTED",
      "TEST",
      "FINAL_SELECTED",
    ]);
  });

  it("cobre as 6 etapas menos 1 para qualquer etapa de entrada", () => {
    for (const stage of KANBAN_STAGES) {
      expect(otherStages(stage)).toHaveLength(5);
      expect(otherStages(stage)).not.toContain(stage);
    }
  });
});

describe("stageTitle", () => {
  it("usa o título vindo do board (não hardcoded)", () => {
    const b = board([{ stage: "CANDIDATE", title: "Candidatos" }]);
    expect(stageTitle(b, "CANDIDATE")).toBe("Candidatos");
  });

  it("cai para a chave da etapa quando o board não tem a coluna", () => {
    const b = board([{ stage: "CANDIDATE", title: "Candidatos" }]);
    expect(stageTitle(b, "SELECTED")).toBe("SELECTED");
  });

  it("cai para a chave da etapa quando o board ainda não carregou", () => {
    expect(stageTitle(undefined, "PRE_SELECTED")).toBe("PRE_SELECTED");
  });
});

describe("scoreBand", () => {
  it("é 'high' a partir de 70", () => {
    expect(scoreBand(70)).toBe("high");
    expect(scoreBand(100)).toBe("high");
  });

  it("é 'medium' entre 40 e 69", () => {
    expect(scoreBand(40)).toBe("medium");
    expect(scoreBand(69)).toBe("medium");
  });

  it("é 'low' abaixo de 40", () => {
    expect(scoreBand(39)).toBe("low");
    expect(scoreBand(0)).toBe("low");
  });
});

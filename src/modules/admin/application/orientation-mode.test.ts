import { describe, expect, it } from "vitest";
import type { OrientationSummary } from "../infrastructure/orientation-api";
import { modeCards, modeChangeDialog } from "./orientation-mode";

const summary = (over: Partial<OrientationSummary> = {}): OrientationSummary => ({
  generatedAt: "2026-11-11T15:30:00.000Z",
  gateMode: "OFF",
  cutoff: "2026-11-11T15:30:00.000Z",
  cutoffStamped: false,
  freelancers: { active: 1000, approved: 40, rejected: 5, withoutGlobal: 10, pending: 955, pendingSinceCutoff: 7 },
  blockedByMode: { OFF: 5, NEW_ONLY: 12, ALL: 960 },
  booked: 0,
  queue: 955,
  nextSession: null,
  ...over,
});
const hoje = new Date("2026-11-11T15:00:00.000Z");

describe("modeCards", () => {
  it("calcula quem vê vagas em cada modo e marca só o atual", () => {
    const cards = modeCards(summary(), "OFF");
    expect(cards.map((c) => c.mode)).toEqual(["OFF", "NEW_ONLY", "ALL"]);
    expect(cards.map((c) => c.seeing)).toEqual([995, 988, 40]);
    expect(cards.map((c) => c.blocked)).toEqual([5, 12, 960]);
    expect(cards.map((c) => c.isCurrent)).toEqual([true, false, false]);
  });
  it("mostra o texto e a conta de cada modo", () => {
    const [off, nw, all] = modeCards(summary(), "ALL");
    expect(off.effect).toBe("Todos veem vagas, menos os reprovados.");
    expect(off.calc).toBe("1.000 ativos − 5 reprovados");
    expect(nw.effect).toBe("Quem virar freelancer a partir de 11/11/2026 precisa da aula.");
    expect(nw.calc).toBe("1.000 ativos − 5 reprovados − 7 cadastros novos sem aprovação");
    expect(all.effect).toBe("Só os aprovados veem vagas.");
    expect(all.calc).toBe("40 aprovados de 1.000 ativos");
    expect(all.isCurrent).toBe(true);
  });
});

describe("modeChangeDialog", () => {
  it("OFF → ALL: pede TODOS, mostra a consequência e a data de corte", () => {
    const d = modeChangeDialog("OFF", "ALL", summary(), hoje);
    if ("blocked" in d) throw new Error("bloqueou");
    expect(d.requiresTyping).toBe("TODOS");
    expect(d.confirmLabel).toBe("Esconder vagas de 955 pessoas");
    expect(d.losing).toBe(955);
    expect(d.lines).toContain("A data de corte será hoje, 11/11/2026, e não muda depois.");
    expect(d.lines).toContain(
      "Antes de ligar, confira: o app mínimo já é 1.0.50 e há aprovados nas cidades com vaga aberta.",
    );
  });
  it("OFF → NEW_ONLY: sem digitação; a data de corte some se já foi carimbada", () => {
    const d = modeChangeDialog("OFF", "NEW_ONLY", summary(), hoje);
    if ("blocked" in d) throw new Error("bloqueou");
    expect(d.requiresTyping).toBeNull();
    expect(d.losing).toBe(7);
    expect(d.lines).toContain("A data de corte será hoje, 11/11/2026, e não muda depois.");
    const s = modeChangeDialog("OFF", "NEW_ONLY", summary({ cutoffStamped: true }), hoje);
    if ("blocked" in s) throw new Error("bloqueou");
    expect(s.lines.some((l) => l.includes("data de corte será hoje"))).toBe(false);
  });
  it("ALL → OFF: sempre permitido, com ou sem números", () => {
    const d = modeChangeDialog("ALL", "OFF", summary({ gateMode: "ALL" }), hoje);
    if ("blocked" in d) throw new Error("bloqueou");
    expect(d.confirmLabel).toBe("Desligar o bloqueio");
    expect(d.requiresTyping).toBeNull();
    expect(d.lines).toContain("Voltam a ver vagas em até 1 minuto: 955 pessoas.");
    const n = modeChangeDialog("ALL", "OFF", null, hoje);
    if ("blocked" in n) throw new Error("bloqueou");
    expect(n.lines).toContain("Voltam a ver vagas em até 1 minuto.");
  });
  it("sem números não dá para ligar NEW_ONLY nem ALL", () => {
    const msg = "Não consegui contar quem perde as vagas agora. Tente de novo.";
    expect(modeChangeDialog("OFF", "ALL", null, hoje)).toEqual({ blocked: msg });
    expect(modeChangeDialog("OFF", "NEW_ONLY", null, hoje)).toEqual({ blocked: msg });
  });
  it("ALL sem ninguém para perder: continua pedindo TODOS, com rótulo próprio", () => {
    const zero = summary({ blockedByMode: { OFF: 5, NEW_ONLY: 12, ALL: 5 } });
    const d = modeChangeDialog("OFF", "ALL", zero, hoje);
    if ("blocked" in d) throw new Error("bloqueou");
    expect(d.requiresTyping).toBe("TODOS");
    expect(d.losing).toBe(0);
    expect(d.confirmLabel).toBe("Ligar para Todos — ninguém perde vagas agora");
  });
});

import { describe, expect, it } from "vitest";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";
import { brasiliaWeek, groupByBrasiliaDay } from "./week";

function session(id: string, startsAt: string): OrientationSessionView {
  return {
    id,
    startsAt,
    endsAt: startsAt,
    capacity: 10,
    bookedCount: 0,
    status: "OPEN",
    hostAdminId: "h1",
    hostName: "Rebeca",
    meetUrl: null,
    meetSource: null,
    googleSyncStatus: "NOT_CONNECTED",
    googleSyncError: null,
    audience: { ufs: [], cities: [] },
    seriesId: null,
    notes: null,
    alerts: [],
  };
}

describe("brasiliaWeek", () => {
  it("segunda 00:00 a segunda seguinte 00:00 de Brasília", () => {
    expect(brasiliaWeek(new Date("2026-11-11T15:00:00Z"), 0)).toEqual({
      fromIso: "2026-11-09T03:00:00.000Z",
      toIso: "2026-11-16T03:00:00.000Z",
      label: "9/11 a 15/11",
    });
  });

  it("domingo 22h30 em Brasília ainda é a mesma semana", () => {
    const w = brasiliaWeek(new Date("2026-11-16T01:30:00Z"), 0);
    expect(w.fromIso).toBe("2026-11-09T03:00:00.000Z");
    expect(w.toIso).toBe("2026-11-16T03:00:00.000Z");
  });

  it("anda de semana em semana", () => {
    expect(brasiliaWeek(new Date("2026-11-11T15:00:00Z"), 1).label).toBe("16/11 a 22/11");
    expect(brasiliaWeek(new Date("2026-11-11T15:00:00Z"), -1).label).toBe("2/11 a 8/11");
  });

  it("vira o mês no rótulo", () => {
    expect(brasiliaWeek(new Date("2026-11-11T15:00:00Z"), 3).label).toBe("30/11 a 6/12");
  });
});

describe("groupByBrasiliaDay", () => {
  it("turma de domingo 22h cai no domingo, não na segunda", () => {
    const groups = groupByBrasiliaDay([session("a", "2026-11-16T01:00:00.000Z")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe("2026-11-15");
    expect(groups[0].label).toBe("domingo, 15/11");
  });

  it("agrupa por dia e ordena por horário", () => {
    const groups = groupByBrasiliaDay([
      session("c", "2026-11-17T12:00:00.000Z"),
      session("b", "2026-11-16T15:00:00.000Z"),
      session("a", "2026-11-16T12:00:00.000Z"),
    ]);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-11-16", "2026-11-17"]);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

import { describe, expect, it } from "vitest";
import { toAttendanceList } from "./system-health-api";

// GET /v1/admins/attendance devolve `{ total, items }` (verificado 25/08 no teste
// de UI); o painel quebrava com ".map is not a function" ao tratar como array.
describe("toAttendanceList", () => {
  const item = { jobId: "j1", vacancyId: "v1", vacancyTitle: "Garçom", contractorName: "Bar", providerName: "Ana", status: "PENDING_CONTRACTOR_CONFIRMATION", contractorReason: null, openedAt: "2026-08-25T00:00:00.000Z" };

  it("aceita o envelope { total, items }", () => {
    expect(toAttendanceList({ total: 1, items: [item] })).toEqual([item]);
  });

  it("aceita um array puro (forma antiga do contrato)", () => {
    expect(toAttendanceList([item])).toEqual([item]);
  });

  it("qualquer outra coisa vira lista vazia", () => {
    expect(toAttendanceList(undefined)).toEqual([]);
    expect(toAttendanceList({ total: 0 })).toEqual([]);
  });
});

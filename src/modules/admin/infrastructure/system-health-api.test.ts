import { describe, expect, it } from "vitest";
import { describeAlertTest, toAttendanceList } from "./system-health-api";

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

// POST /v1/admins/alerts/test devolve o status do canal + `delivery` em três
// formas (grupo, telefones, pulado). O toast não pode pintar de verde um `skipped`.
describe("describeAlertTest", () => {
  const grupo = { mode: "group" as const, group: { name: "Equipe Freela", id: "123@g.us", resolved: true }, phones: 0 };

  it("grupo entregue: sucesso com o nome do grupo", () => {
    const r = describeAlertTest({ ...grupo, delivery: { target: "group", groupId: "123@g.us", ok: true } });
    expect(r).toEqual({ tone: "success", message: 'Teste enviado ao grupo "Equipe Freela".' });
  });

  it("grupo que não recebeu: erro com o detalhe", () => {
    const r = describeAlertTest({
      ...grupo,
      group: { ...grupo.group, resolved: false, error: "bridge fora do ar" },
      delivery: { target: "group", ok: false },
    });
    expect(r.tone).toBe("error");
    expect(r.message).toContain("Equipe Freela");
    expect(r.message).toContain("bridge fora do ar");
  });

  it("telefones: sucesso, parcial e falha total", () => {
    const base = { mode: "phones" as const, group: null, phones: 2 };
    expect(describeAlertTest({ ...base, delivery: { target: "phones", sent: 2, failed: 0 } })).toEqual({
      tone: "success",
      message: "Teste enviado a 2 telefones.",
    });
    expect(describeAlertTest({ ...base, delivery: { target: "phones", sent: 1, failed: 1 } }).tone).toBe("warning");
    expect(describeAlertTest({ ...base, delivery: { target: "phones", sent: 0, failed: 2 } }).tone).toBe("error");
  });

  it("pulado sem destinatário: erro amigável apontando as envs", () => {
    const r = describeAlertTest({ mode: "phones", group: null, phones: 0, delivery: { target: "skipped", reason: "no_recipients" } });
    expect(r.tone).toBe("error");
    expect(r.message).toContain("ADMIN_ALERT_GROUP");
  });

  it("sem provedor de WhatsApp: erro dizendo que nada saiu", () => {
    const r = describeAlertTest({ mode: "phones", group: null, phones: 1, delivery: { target: "skipped", reason: "no_provider" } });
    expect(r.tone).toBe("error");
    expect(r.message).toMatch(/WhatsApp não está configurado/);
  });

  it("resposta sem delivery (API antiga) não vira sucesso", () => {
    expect(describeAlertTest(undefined).tone).toBe("error");
  });
});

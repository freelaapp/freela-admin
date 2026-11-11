import { describe, expect, it } from "vitest";
import type {
  ConvocationPreview,
  QueueCounters,
  QueueRow,
} from "../infrastructure/orientation-api";
import {
  convocationSummary,
  queueCounterLines,
  queueCsv,
} from "./orientation-queue-presentation";

const c: QueueCounters = {
  pending: { value: 210461, active: 210873, approved: 412, rejected: 0, booked: 0 },
  pendingActive30: { value: 11032, measuredSince: "2026-10-07" },
  freeSeats4w: { value: 1200, sessions: 40 },
  weeksToServe: { value: 37, perWeek: 300 },
  approved: { value: 412 },
};

const p: ConvocationPreview = {
  people: 1200,
  matching: 1200,
  withoutGlobal: 0,
  places: [],
  freeSeats14d: 60,
  plan: { days: 3, perSeat: 20, blocked: null, overbooked: true, requiresTypedCount: true },
  pendingInQueue: 0,
  dailyCap: 500,
  channels: { messagesEnabled: true, whatsapp: true, push: true },
};

const row: QueueRow = {
  providerGlobalId: "pg",
  userId: "u",
  name: "Ana",
  phone: "11999999999",
  city: "Campinas",
  uf: "SP",
  roles: ["garcom", "cozinheiro"],
  signedUpAt: "2026-10-01T02:00:00.000Z",
  totalCompletedServices: 3,
  lastActiveDay: "2026-11-10",
  noShows: 1,
  lastConvokedAt: null,
  notifyRequestedAt: null,
  status: "PENDING",
};

describe("queueCounterLines", () => {
  it("explica pendentes com a conta e a fonte", () => {
    expect(queueCounterLines(c)[0]).toEqual({
      label: "Pendentes",
      value: "210.461",
      explanation:
        "Freelancers ativos sem aula marcada e ainda não aprovados nem reprovados: 210.873 ativos − 412 aprovados − 0 reprovados − 0 com aula marcada. Fonte: cadastro de freelancers + aulas.",
    });
  });
  it("pendentes ativos citam a medida", () => {
    expect(queueCounterLines(c)[1].explanation).toBe(
      "Dos pendentes, quem abriu o app ou o site nos últimos 30 dias. Fonte: registro de acessos (desde 07/10/2026).",
    );
  });
  it("sem medida de acesso", () => {
    expect(
      queueCounterLines({ ...c, pendingActive30: { value: 0, measuredSince: null } })[1].value,
    ).toBe("sem medida");
  });
  it("semanas para atender mostra a divisão", () => {
    expect(queueCounterLines(c)[3].explanation).toBe(
      "11.032 ÷ 300 por semana = 37 semanas (arredondado para cima). 300 = 1.200 lugares livres nas próximas 4 semanas ÷ 4.",
    );
  });
  it("sem medida de acesso: semanas também ficam sem medida", () => {
    const l = queueCounterLines({
      ...c,
      pendingActive30: { value: 0, measuredSince: null },
      weeksToServe: { value: 0, perWeek: 300 },
    })[3];
    expect(l.value).toBe("sem medida");
    expect(l.explanation).toContain("registro de acessos");
  });
  it("sem lugar não há conta", () => {
    const l = queueCounterLines({ ...c, weeksToServe: { value: null, perWeek: 0 } })[3];
    expect(l.value).toBe("sem conta");
  });
});

describe("convocationSummary", () => {
  it("resume a prévia", () => {
    expect(convocationSummary(p, "Campinas/SP")).toEqual([
      "Vai mandar para 1.200 pessoas de Campinas/SP.",
      "Lugares livres para elas nas próximas 2 semanas: 60.",
      "Envio em cerca de 3 dias; teto de 500 por dia (1.200 ÷ 500, arredondado para cima).",
      "São 20 convocados por lugar (1.200 pessoas ÷ 60 lugares livres em 14 dias), acima de 3.",
    ]);
  });
  it("com fila de envio: mostra a soma", () => {
    const lines = convocationSummary({ ...p, people: 100, matching: 100, pendingInQueue: 950, plan: { ...p.plan, days: 3 } }, "SP");
    expect(lines[2]).toBe(
      "Envio em cerca de 3 dias, somando 950 que já estão na fila de envio; teto de 500 por dia (1.050 ÷ 500, arredondado para cima).",
    );
  });
  it("selecionadas: explica quem fica de fora", () => {
    const lines = convocationSummary({ ...p, people: 12, matching: 12 }, "SP", { kind: "picked", picked: 50, minDays: 7 });
    expect(lines[0]).toBe(
      "50 selecionadas; 38 ficam de fora (convocadas há menos de 7 dias, já na fila de envio ou no limite de faltas); vai mandar para 12 pessoas de SP.",
    );
  });
  it("selecionadas: singular e sem sobra", () => {
    expect(convocationSummary({ ...p, people: 1, matching: 1 }, "SP", { kind: "picked", picked: 2, minDays: 1 })[0]).toBe(
      "2 selecionadas; 1 fica de fora (convocadas há menos de 1 dia, já na fila de envio ou no limite de faltas); vai mandar para 1 pessoa de SP.",
    );
    const all = convocationSummary({ ...p, people: 3, matching: 3 }, "SP", { kind: "picked", picked: 3, minDays: 7 })[0];
    expect(all).toBe("3 selecionadas; vai mandar para 3 pessoas de SP.");
    expect(all).not.toContain("de fora");
  });
  it("selecionadas sem os dias carregados: não inventa número", () => {
    expect(convocationSummary({ ...p, people: 1, matching: 1 }, "SP", { kind: "picked", picked: 3 })[0]).toContain(
      "convocadas há pouco tempo",
    );
  });
  it("filtro: lista, convocáveis e limite", () => {
    expect(
      convocationSummary({ ...p, people: 10000, matching: 45000 }, "SP", { kind: "filtered", listTotal: 50000 })[0],
    ).toBe("50.000 na lista; 45.000 podem ser convocadas agora; vai mandar para 10.000 pessoas de SP (limite de 10.000 por convocação).");
    expect(
      convocationSummary({ ...p, people: 50, matching: 400 }, "SP", { kind: "filtered", listTotal: 500, limit: 50 })[0],
    ).toBe("500 na lista; 400 podem ser convocadas agora; vai mandar para 50 pessoas de SP (limite digitado).");
    expect(
      convocationSummary({ ...p, people: 400, matching: 400 }, "SP", { kind: "filtered", listTotal: 500 })[0],
    ).toBe("500 na lista; 400 podem ser convocadas agora; vai mandar para 400 pessoas de SP.");
  });
  it("sem lugar livre avisa e não calcula por lugar", () => {
    const lines = convocationSummary(
      { ...p, freeSeats14d: 0, plan: { ...p.plan, perSeat: null, blocked: "NO_SEATS" } },
      "SP",
    );
    expect(lines[1]).toContain("Não há lugar livre");
    expect(lines.some((l) => l.includes("por lugar"))).toBe(false);
  });
});

describe("queueCsv", () => {
  it("cabeçalho exato", () => {
    expect(queueCsv([row]).header).toEqual([
      "Nome",
      "Telefone",
      "Cidade",
      "UF",
      "Funções",
      "Cadastro",
      "Serviços concluídos",
      "Último acesso",
      "Faltas",
      "Convocado em",
      "Pediu aviso em",
      "Situação",
    ]);
  });
  it("linha com datas de Brasília", () => {
    expect(queueCsv([row]).rows[0]).toEqual([
      "Ana", "11999999999", "Campinas", "SP", "garcom, cozinheiro", "30/09/2026", 3, "10/11/2026", 1, "", "", "Pendente",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { describeSchedule, type ScheduleDescribable } from "./describe-schedule";

describe("describeSchedule — WEEKLY", () => {
  it("um dia só: 'Todo <Dia> às HH:00'", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "WEEKLY",
      weekdays: [6],
      sendHour: 9,
    };
    expect(describeSchedule(template)).toBe("Todo Sáb às 09:00");
  });

  it("vários dias: lista separada por vírgula, sem o prefixo 'Todo'", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "WEEKLY",
      weekdays: [6, 0],
      sendHour: 9,
    };
    expect(describeSchedule(template)).toBe("Sáb, Dom às 09:00");
  });

  it("hora com zero à esquerda (sendHour = 5)", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "WEEKLY",
      weekdays: [1],
      sendHour: 5,
    };
    expect(describeSchedule(template)).toBe("Todo Seg às 05:00");
  });

  it("sendHour = 0 também pad — não vira '0:00' nem some", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "WEEKLY",
      weekdays: [1],
      sendHour: 0,
    };
    expect(describeSchedule(template)).toBe("Todo Seg às 00:00");
  });

  it("sem dias marcados: mensagem de fallback em vez de string vazia/quebrada", () => {
    const template: ScheduleDescribable = { scheduleKind: "WEEKLY", weekdays: [], sendHour: 9 };
    expect(describeSchedule(template)).toBe("Sem dia definido");
  });
});

describe("describeSchedule — DATED", () => {
  it("sem targetYear: '<dd>/<mm> − N dias antes · todo ano'", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 5,
      leadDays: 3,
      targetYear: undefined,
    };
    expect(describeSchedule(template)).toBe("05/05 − 3 dias antes · todo ano");
  });

  it("com targetYear: '<dd>/<mm>/<aaaa> − N dias antes', sem 'todo ano'", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 5,
      leadDays: 3,
      targetYear: 2026,
    };
    expect(describeSchedule(template)).toBe("05/05/2026 − 3 dias antes");
  });

  it("mês e dia com zero à esquerda (dia 1, mês 1)", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: 1,
      targetDay: 1,
      leadDays: 0,
      targetYear: undefined,
    };
    expect(describeSchedule(template)).toBe("01/01 · todo ano");
  });

  it("leadDays = 0 não aparece ('− 0 dias antes' seria ruído)", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: 12,
      targetDay: 25,
      leadDays: 0,
      targetYear: 2026,
    };
    expect(describeSchedule(template)).toBe("25/12/2026");
  });

  it("leadDays = 1 usa singular ('1 dia antes', não '1 dias antes')", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 10,
      leadDays: 1,
      targetYear: undefined,
    };
    expect(describeSchedule(template)).toBe("10/05 − 1 dia antes · todo ano");
  });

  it("sem mês/dia definidos: mensagem de fallback", () => {
    const template: ScheduleDescribable = {
      scheduleKind: "DATED",
      targetMonth: undefined,
      targetDay: undefined,
    };
    expect(describeSchedule(template)).toBe("Sem data definida");
  });
});

import { describe, expect, it } from "vitest";

import { closeNowBlockedToday, closeNowPeriod, closeNowPeriodText, nextDayKey } from "./close-now-period";

const inv = (number: string, periodEnd: string, status: "ISSUED" | "PAID" | "CANCELLED" = "PAID") => ({
  number,
  periodEnd,
  status,
});

describe("closeNowPeriod — o período do 'Fechar agora' (mesma regra da API)", () => {
  it("começa no dia seguinte ao fim da última fatura que vale e vai até hoje", () => {
    const p = closeNowPeriod([inv("FAT-2026-000010", "2026-10-25"), inv("FAT-2026-000004", "2026-10-18")], "2026-11-03");
    expect(p).toMatchObject({
      start: "2026-10-26",
      end: "2026-11-03",
      lastInvoice: { number: "FAT-2026-000010", periodEnd: "2026-10-25" },
      cancelledAfter: [],
      alreadyUpToToday: false,
    });
    expect(closeNowPeriodText(p)).toEqual([
      "Período: seg 26/10 até hoje, ter 03/11. Começa no dia seguinte ao fim da FAT-2026-000010 (dom 25/10), a última fatura que vale.",
    ]);
  });

  it("a fatura cancelada não conta: o período volta para depois da anterior e os serviços dela entram", () => {
    const p = closeNowPeriod(
      [inv("FAT-2026-000020", "2026-11-01", "CANCELLED"), inv("FAT-2026-000010", "2026-10-25")],
      "2026-11-03",
    );
    expect(p.start).toBe("2026-10-26");
    expect(p.cancelledAfter).toEqual(["FAT-2026-000020"]);
    expect(closeNowPeriodText(p)[1]).toBe(
      "A fatura FAT-2026-000020 foi cancelada e não conta: os serviços dela voltam e entram nesta.",
    );
  });

  it("só canceladas: do 1º serviço sem fatura até hoje", () => {
    const p = closeNowPeriod([inv("FAT-2026-000020", "2026-11-01", "CANCELLED")], "2026-11-03");
    expect(p.start).toBeNull();
    expect(closeNowPeriodText(p)[0]).toBe(
      "Período: do 1º serviço ainda sem fatura até hoje, ter 03/11 (a empresa não tem fatura anterior que valha).",
    );
  });

  it("a última fatura já vai até hoje: avisa que hoje não sai outra", () => {
    const p = closeNowPeriod([inv("FAT-2026-000030", "2026-11-03", "ISSUED")], "2026-11-03");
    expect(p.alreadyUpToToday).toBe(true);
    expect(closeNowPeriodText(p)).toEqual([
      "A fatura FAT-2026-000030 já vai até ter 03/11: hoje não sai outra. Os serviços novos entram no próximo fechamento.",
    ]);
  });

  it("cancelada que terminava hoje: avisa que só dá amanhã (a trava do banco conta a cancelada)", () => {
    const p = closeNowPeriod(
      [inv("FAT-2026-000140", "2026-11-03", "CANCELLED"), inv("FAT-2026-000130", "2026-10-27")],
      "2026-11-03",
    );
    expect(p.cancelledEndingToday).toEqual(["FAT-2026-000140"]);
    expect(closeNowBlockedToday(p)).toBe(true);
    expect(closeNowPeriodText(p)).toEqual([
      "A fatura cancelada FAT-2026-000140 terminava hoje, ter 03/11. O sistema guarda uma fatura só por empresa com o mesmo último dia (a cancelada conta), então a fatura de agora não sai hoje: feche amanhã — os serviços dela entram nessa.",
    ]);
    // Cancelada de outro dia não trava.
    expect(closeNowBlockedToday(closeNowPeriod([inv("FAT-2026-000140", "2026-11-01", "CANCELLED")], "2026-11-03"))).toBe(false);
  });

  it("nextDayKey vira mês e ano", () => {
    expect(nextDayKey("2026-10-31")).toBe("2026-11-01");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });
});

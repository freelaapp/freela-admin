import { describe, expect, it } from "vitest";
import {
  brasiliaDayOf,
  bucketLabel,
  candidacyStatusLabel,
  changeInfo,
  dateBR,
  dateTimeBR,
  deltaInfo,
  fileSlug,
  formatValue,
  lastDayBR,
  pctChange,
  productsLabel,
  signedPct,
  statusLabel,
  vacancySituation,
  waLink,
  measurementNotice,
  vacancyDayBR,
} from "./engagement-format";
import type { EngagementPeriod } from "../infrastructure/engagement-api";

// O Intl separa "R$" do número com espaço inquebrável (U+00A0).
const plain = (s: string) => s.replace(/ /g, " ");

describe("formatValue", () => {
  it("sem dado vira travessão, nunca 0", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue(undefined, "pct")).toBe("—");
    expect(formatValue(Number.NaN, "decimal")).toBe("—");
  });

  it("formatos pt-BR", () => {
    expect(formatValue(150210)).toBe("150.210");
    expect(formatValue(0)).toBe("0");
    expect(formatValue(0.67, "decimal")).toBe("0,67");
    expect(formatValue(66.7, "pct")).toBe("66,7%");
    expect(formatValue(15, "hours")).toBe("15 h");
    expect(formatValue(0.5, "hours")).toBe("30 min");
    expect(plain(formatValue(12345678, "brl"))).toBe("R$ 123.456,78");
  });

  it("razão com 2 casas fixas e dias com 1 casa", () => {
    expect(formatValue(2.35, "ratio")).toBe("2,35");
    expect(formatValue(1.5, "ratio")).toBe("1,50");
    expect(formatValue(1, "ratio")).toBe("1,00");
    expect(formatValue(1234.5, "ratio")).toBe("1.234,50");
    expect(formatValue(4.5, "days")).toBe("4,5 dias");
    expect(formatValue(1, "days")).toBe("1 dia");
    expect(formatValue(0, "days")).toBe("0 dias");
    expect(formatValue(null, "days")).toBe("—");
  });
});

describe("variação", () => {
  it("pctChange e signedPct", () => {
    expect(pctChange(3, 1)).toBe(200);
    expect(pctChange(0.67, 1)).toBe(-33);
    expect(pctChange(4, 0)).toBeNull();
    expect(pctChange(null, 1)).toBeNull();
    expect(signedPct(200)).toBe("+200%");
    expect(signedPct(-33)).toBe("-33%");
    expect(signedPct(0)).toBe("0%");
    expect(signedPct(null)).toBe("—");
  });

  it("antes da medição (um dos lados null) → sem comparação, cinza", () => {
    expect(deltaInfo({ current: 4, previous: null }, "int")).toEqual({
      text: "sem comparação",
      color: "text-[#737373]",
    });
    expect(deltaInfo({ current: null, previous: null }, "int")).toEqual({
      text: "sem comparação",
      color: "text-[#737373]",
    });
  });

  it("anterior 0 → sem base / sem movimento", () => {
    expect(deltaInfo({ current: 4, previous: 0 }, "int").text).toBe("anterior: 0 · sem base");
    expect(deltaInfo({ current: 0, previous: 0 }, "int").text).toBe("anterior: 0 · sem movimento");
  });

  it("a cor segue o que é bom para o indicador", () => {
    expect(deltaInfo({ current: 4, previous: 3 }, "int")).toEqual({
      text: "anterior: 3 · +33%",
      color: "text-green-500",
    });
    expect(deltaInfo({ current: 15, previous: 4 }, "hours", false)).toEqual({
      text: "anterior: 4 h · +275%",
      color: "text-red-500",
    });
    expect(deltaInfo({ current: 0.67, previous: 1 }, "decimal")).toEqual({
      text: "anterior: 1 · -33%",
      color: "text-red-500",
    });
    expect(deltaInfo({ current: 2, previous: 2 }, "int")).toEqual({
      text: "anterior: 2 · 0%",
      color: "text-[#737373]",
    });
  });
});

describe("changeInfo (coluna Anterior das tabelas)", () => {
  it("só a variação, com a direção da seta e a cor do sentido bom", () => {
    expect(changeInfo({ current: 4, previous: 3 })).toEqual({
      text: "+33%",
      color: "text-green-500",
      direction: "up",
    });
    // Menor é melhor (ex.: tempo até a 1ª vaga): subir fica vermelho, mas a seta sobe.
    expect(changeInfo({ current: 6, previous: 4 }, false)).toEqual({
      text: "+50%",
      color: "text-red-500",
      direction: "up",
    });
    expect(changeInfo({ current: 2, previous: 4 }, false)).toEqual({
      text: "-50%",
      color: "text-green-500",
      direction: "down",
    });
    expect(changeInfo({ current: 2, previous: 2 })).toEqual({ text: "0%", color: "text-[#737373]", direction: "flat" });
  });

  it("sem um dos lados ou com anterior 0: sem % e sem seta", () => {
    expect(changeInfo({ current: null, previous: 3 })).toEqual({
      text: "sem comparação",
      color: "text-[#737373]",
      direction: null,
    });
    expect(changeInfo({ current: 4, previous: 0 }).text).toBe("sem base");
    expect(changeInfo({ current: 0, previous: 0 }).text).toBe("sem movimento");
    expect(changeInfo({ current: 4, previous: 0 }).direction).toBeNull();
  });
});

describe("rótulos", () => {
  it("status muda com o lado (gênero e 'nunca')", () => {
    expect(statusLabel("active", "freelancer")).toBe("Ativo");
    expect(statusLabel("active", "contractor")).toBe("Ativa");
    expect(statusLabel("stopped", "contractor")).toBe("Parada");
    expect(statusLabel("never", "freelancer")).toBe("Nunca se candidatou");
    expect(statusLabel("never", "contractor")).toBe("Nunca publicou");
  });

  it("produtos, candidatura e situação da vaga", () => {
    expect(productsLabel(["bars_restaurants", "home_services"])).toBe("Empresa + Casa");
    expect(productsLabel([])).toBe("—");
    expect(candidacyStatusLabel("NOT_SELECTED")).toBe("Não selecionado");
    expect(candidacyStatusLabel("XYZ")).toBe("XYZ");
    expect(vacancySituation("CLOSED", "COMPLETED")).toBe("Concluída");
    expect(vacancySituation("CANCELLED_BY_CONTRACTOR", null)).toBe("Cancelada pela empresa");
    expect(vacancySituation("OPEN", null)).toBe("Aberta");
  });
});

describe("datas em Brasília", () => {
  it("instante ISO usa UTC−3; dia puro só é reformatado", () => {
    expect(dateBR("2026-10-01T02:59:00.000Z")).toBe("30/09/2026");
    expect(dateBR("2026-10-07")).toBe("07/10/2026");
    expect(dateBR(null)).toBe("—");
    expect(dateBR("ontem")).toBe("—");
    expect(dateTimeBR(new Date("2026-10-07T15:04:00.000Z"))).toBe("07/10/2026 12:04");
    expect(lastDayBR("2026-10-01T03:00:00.000Z")).toBe("30/09/2026");
    expect(brasiliaDayOf("2026-09-01T03:00:00.000Z")).toBe("2026-09-01");
  });

  it("rótulo dos baldes da série", () => {
    expect(bucketLabel("2026-09-05", "day")).toBe("05/09");
    expect(bucketLabel("2026-07-06", "week")).toBe("sem. 06/07");
    expect(bucketLabel("2026-09-01", "month")).toBe("set/26");
  });
});

describe("WhatsApp e nome de arquivo", () => {
  it("põe o 55 só quando falta; menos de 10 dígitos não vira link", () => {
    expect(waLink("(32) 99876-5432")).toBe("https://wa.me/5532998765432");
    expect(waLink("+55 54 99999-0000")).toBe("https://wa.me/5554999990000");
    expect(waLink("3215-0000")).toBeNull();
    expect(waLink(null)).toBeNull();
  });

  it("fileSlug", () => {
    expect(fileSlug("Bar do Zé")).toBe("bar-do-ze");
    expect(fileSlug("01/09/2026 a 30/09/2026")).toBe("01-09-2026-a-30-09-2026");
    expect(fileSlug("!!!")).toBe("engajamento");
  });
});

describe("data da vaga (gravada à meia-noite UTC)", () => {
  it("mostra o próprio dia, sem voltar um dia no fuso de Brasília", () => {
    expect(vacancyDayBR("2026-09-12T00:00:00.000Z")).toBe("12/09/2026");
    expect(vacancyDayBR("2026-09-12")).toBe("12/09/2026");
    expect(vacancyDayBR(null)).toBe("—");
    expect(vacancyDayBR("lixo")).toBe("—");
  });
});

describe("measurementNotice (regra única: tela, PDF e Excel)", () => {
  const P: EngagementPeriod = {
    preset: "this_month",
    start: "2026-11-01T03:00:00.000Z",
    end: "2026-12-01T03:00:00.000Z",
    previousStart: "2026-10-01T03:00:00.000Z",
    previousEnd: "2026-11-01T03:00:00.000Z",
    label: "novembro/2026",
    previousLabel: "outubro/2026",
  };
  it("avisa quando a janela anterior começa antes da medição", () => {
    expect(measurementNotice("2026-10-07", P)).toContain("Acessos medidos desde 07/10/2026");
  });
  it("sem aviso quando as duas janelas estão medidas", () => {
    expect(measurementNotice("2026-09-01", P)).toBeNull();
  });
});

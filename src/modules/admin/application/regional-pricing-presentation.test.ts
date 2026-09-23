import { describe, expect, it } from "vitest";
import {
  FAIXA_PRESETS,
  bpsToIndexText,
  brl,
  indexTextToBps,
  regionalizeHourly,
} from "./regional-pricing-presentation";

describe("regional-pricing-presentation", () => {
  it("bps ↔ texto do índice em pt-BR", () => {
    expect(bpsToIndexText(15494)).toBe("1,5494");
    expect(bpsToIndexText(10000)).toBe("1,0000");
    expect(indexTextToBps("1,5494")).toBe(15494);
    expect(indexTextToBps("1.25")).toBe(12500);
    expect(indexTextToBps("1")).toBe(10000);
  });
  it("texto inválido ou abaixo de 1 vira null", () => {
    expect(indexTextToBps("")).toBeNull();
    expect(indexTextToBps("abc")).toBeNull();
    expect(indexTextToBps("0,9")).toBeNull();
  });
  it("faixas do PDF (A/B/C/D)", () => {
    expect(FAIXA_PRESETS.map((f) => [f.label, f.bps])).toEqual([
      ["A", 10000],
      ["B", 11500],
      ["C", 12500],
      ["D", 15500],
    ]);
  });
  it("formata centavos", () => {
    expect(brl(3850)).toBe("R$ 38,50");
  });
  it("prévia = base × índice a R$ 0,50, nunca abaixo da base (espelha o backend)", () => {
    expect(regionalizeHourly(2000, 15494)).toBe(3100);
    expect(regionalizeHourly(2500, 15494)).toBe(3850);
    expect(regionalizeHourly(2100, 10000)).toBe(2100);
    expect(regionalizeHourly(2100, 8000)).toBe(2100);
  });
});

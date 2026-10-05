import { describe, expect, it } from "vitest";
import { buildRulePayload, ruleToForm } from "./rule-form";

const base = {
  mode: "PERCENT_OF_FEE" as const,
  percent: "10,5",
  amount: "",
  durationMonths: "12",
  includeEmpresa: true,
  includeCasa: false,
};

describe("buildRulePayload", () => {
  it("% com vírgula vira número; prazo vira inteiro", () => {
    expect(buildRulePayload(base)).toEqual({
      ok: true,
      payload: {
        mode: "PERCENT_OF_FEE",
        percent: 10.5,
        amountInCents: null,
        durationMonths: 12,
        includeEmpresa: true,
        includeCasa: false,
      },
    });
  });

  it("aceita ponto ou vírgula como casa decimal", () => {
    expect(buildRulePayload({ ...base, percent: "10.5" })).toMatchObject({ ok: true, payload: { percent: 10.5 } });
    expect(
      buildRulePayload({ ...base, mode: "FIXED_PER_HIRE", percent: "", amount: "1.234,50" }),
    ).toMatchObject({ ok: true, payload: { amountInCents: 123450 } });
  });

  it("ponto seguido de 3 dígitos sem vírgula é milhar (1.000 = mil reais)", () => {
    expect(
      buildRulePayload({ ...base, mode: "FIXED_PER_HIRE", percent: "", amount: "1.000" }),
    ).toMatchObject({ ok: true, payload: { amountInCents: 100000 } });
    expect(
      buildRulePayload({ ...base, mode: "FIXED_PER_HIRE", percent: "", amount: "5.50" }),
    ).toMatchObject({ ok: true, payload: { amountInCents: 550 } });
  });

  it("valor fixo em reais vira centavos", () => {
    expect(buildRulePayload({ ...base, mode: "FIXED_PER_HIRE", percent: "", amount: "5,50" })).toMatchObject({
      ok: true,
      payload: { amountInCents: 550, percent: null },
    });
  });

  it("prazo vazio = sem prazo", () => {
    expect(buildRulePayload({ ...base, durationMonths: " " })).toMatchObject({
      ok: true,
      payload: { durationMonths: null },
    });
  });

  it("erros em português", () => {
    expect(buildRulePayload({ ...base, percent: "abc" })).toEqual({
      ok: false,
      error: "Informe a porcentagem entre 0,01 e 100.",
    });
    expect(buildRulePayload({ ...base, mode: "FIXED_PER_CLIENT", amount: "0" })).toEqual({
      ok: false,
      error: "Informe um valor fixo maior que zero.",
    });
    expect(buildRulePayload({ ...base, includeEmpresa: false })).toEqual({
      ok: false,
      error: "Escolha pelo menos um produto: Empresa ou Em Casa.",
    });
    expect(buildRulePayload({ ...base, durationMonths: "0" })).toEqual({
      ok: false,
      error: "O prazo deve ser de 1 a 120 meses, ou vazio para sem prazo.",
    });
  });

  it("desligar não pede nada", () => {
    expect(buildRulePayload({ ...base, mode: "OFF", percent: "" })).toEqual({
      ok: true,
      payload: {
        mode: "OFF",
        percent: null,
        amountInCents: null,
        durationMonths: null,
        includeEmpresa: false,
        includeCasa: false,
      },
    });
  });
});

describe("ruleToForm", () => {
  it("sem regra = desligada, Empresa marcada por padrão", () => {
    expect(ruleToForm(null)).toEqual({
      mode: "OFF",
      percent: "",
      amount: "",
      durationMonths: "",
      includeEmpresa: true,
      includeCasa: false,
    });
  });
});

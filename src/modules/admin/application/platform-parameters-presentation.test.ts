import { describe, expect, it } from "vitest";

import {
  capSeatsLabel,
  changeLine,
  formatParameterValue,
  lastChangeLabel,
  stateLabel,
  validateParameterInput,
} from "./platform-parameters-presentation";
import type { PlatformParameter } from "../infrastructure/platform-parameters-api";

const param = (over: Partial<PlatformParameter> = {}): PlatformParameter => ({
  key: "ranking.worked_here_cap_pct",
  label: "Já trabalhou aqui: teto",
  help: "",
  unit: "%",
  value: 50,
  defaultValue: 50,
  min: 0,
  max: 100,
  isDefault: true,
  inEffect: true,
  version: 1,
  updatedAt: null,
  updatedBy: null,
  ...over,
});

describe("platform-parameters-presentation", () => {
  it("estado: em vigor ou guardado com a regra desligada", () => {
    expect(stateLabel(param({ inEffect: true }))).toBe("Em vigor");
    expect(stateLabel(param({ inEffect: false }))).toBe("Guardado; regra desligada");
  });

  it("valor com a unidade", () => {
    expect(formatParameterValue(50, "%")).toBe("50%");
    expect(formatParameterValue(2, "turnos")).toBe("2 turnos");
    expect(formatParameterValue(7, "")).toBe("7");
  });

  it("teto: quantos da lista de 10 (arredonda para baixo, como a regra)", () => {
    expect(capSeatsLabel(50)).toBe("5 da lista de 10");
    expect(capSeatsLabel(30)).toBe("3 da lista de 10");
    expect(capSeatsLabel(35)).toBe("3 da lista de 10");
    expect(capSeatsLabel(0)).toBe("0 da lista de 10");
    expect(capSeatsLabel(100)).toBe("10 da lista de 10");
  });

  it("última mudança: autor e data, ou valor inicial", () => {
    expect(lastChangeLabel(param())).toBe("Valor inicial (ninguém alterou)");
    expect(
      lastChangeLabel(
        param({
          isDefault: false,
          updatedAt: "2026-11-23T17:05:00.000Z",
          updatedBy: { id: "a", name: "Ana Lima" },
        }),
      ),
    ).toBe("Alterado por Ana Lima em 23/11/2026, 14:05");
    expect(
      lastChangeLabel(param({ isDefault: false, updatedAt: "2026-11-23T17:05:00.000Z" })),
    ).toBe("Alterado por um admin em 23/11/2026, 14:05");
  });

  it("validação: faixa, igual ao de hoje, motivo de 5 a 500", () => {
    const p = param();
    expect(validateParameterInput(p, "", "Motivo bom")).toEqual({
      value: "Use um número entre 0 e 100.",
      reason: null,
    });
    expect(validateParameterInput(p, "101", "Motivo bom").value).toBe("Use um número entre 0 e 100.");
    expect(validateParameterInput(p, "3.5", "Motivo bom").value).toBe("Use um número entre 0 e 100.");
    expect(validateParameterInput(p, "50", "Motivo bom").value).toBe("É o valor de hoje.");
    expect(validateParameterInput(p, "30", "abc").reason).toBe("Conte o motivo em pelo menos 5 letras.");
    expect(validateParameterInput(p, "30", "   abcd  ").reason).toBe("Conte o motivo em pelo menos 5 letras.");
    expect(validateParameterInput(p, "30", "x".repeat(501)).reason).toBe("O motivo pode ter até 500 letras.");
    expect(validateParameterInput(p, "30", "Pedido do Diego")).toEqual({ value: null, reason: null });
  });

  it("linha do histórico: data, quem, de -> para, motivo", () => {
    expect(
      changeLine(
        {
          oldValue: 50,
          newValue: 30,
          defaultValue: 50,
          reason: "Pedido do Diego",
          admin: "Ana Lima",
          createdAt: "2026-11-23T17:05:00.000Z",
        },
        "%",
      ),
    ).toBe('23/11/2026, 14:05 · Ana Lima · 50% → 30% · "Pedido do Diego"');
    expect(
      changeLine(
        { oldValue: null, newValue: 30, defaultValue: 50, reason: "Primeiro ajuste", admin: null, createdAt: "2026-11-23T17:05:00.000Z" },
        "%",
      ),
    ).toBe('23/11/2026, 14:05 · um admin · 50% → 30% · "Primeiro ajuste"');
  });
});

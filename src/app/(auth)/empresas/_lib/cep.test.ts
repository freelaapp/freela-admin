import { describe, expect, it } from "vitest";
import { cepError, formatCepMask } from "./cep";

describe("cep", () => {
  it("máscara 00000-000 com só os números, até 8", () => {
    expect(formatCepMask("36000000")).toBe("36000-000");
    expect(formatCepMask("36.000-000")).toBe("36000-000");
    expect(formatCepMask("3600")).toBe("3600");
    expect(formatCepMask("360001")).toBe("36000-1");
    expect(formatCepMask("360000001234")).toBe("36000-000");
    expect(formatCepMask("")).toBe("");
  });

  it("vazio não é erro (não mexe); com números, precisa de 8", () => {
    expect(cepError("")).toBeNull();
    expect(cepError("  ")).toBeNull();
    expect(cepError("36000-000")).toBeNull();
    expect(cepError("36000-0")).toBe("O CEP tem 8 números, por exemplo 36000-000.");
  });
});

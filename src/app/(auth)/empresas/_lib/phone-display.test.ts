import { describe, expect, it } from "vitest";
import {
  companyPhoneLines,
  companyPhoneSearchText,
  companyPhoneSummary,
  formatCompanyPhone,
} from "./phone-display";

describe("companyPhoneLines", () => {
  it("iguais (mesmo número, formatos diferentes): uma linha só", () => {
    const r = companyPhoneLines({ contactPhone: "(11) 98765-4321", accountPhone: "+5511987654321" });
    expect(r.primary).toEqual({ text: "(11) 98765-4321" });
    expect(r.secondary).toBeNull();
  });

  it("diferentes: contato em cima, 'Conta' embaixo", () => {
    const r = companyPhoneLines({ contactPhone: "+5511911112222", accountPhone: "+5511987654321" });
    expect(r.primary).toEqual({ text: "(11) 91111-2222" });
    expect(r.secondary).toEqual({ label: "Conta", text: "(11) 98765-4321" });
  });

  it("contato vazio com conta preenchida: mostra a conta rotulada", () => {
    for (const contactPhone of ["", "  ", null, undefined]) {
      const r = companyPhoneLines({ contactPhone, accountPhone: "+5511987654321" });
      expect(r.primary).toEqual({ label: "Conta", text: "(11) 98765-4321" });
      expect(r.secondary).toBeNull();
    }
  });

  it("conta nula ou campo ausente: só o contato", () => {
    expect(companyPhoneLines({ contactPhone: "11987654321", accountPhone: null }).secondary).toBeNull();
    const ausente = companyPhoneLines({ contactPhone: "11987654321" });
    expect(ausente.primary).toEqual({ text: "(11) 98765-4321" });
    expect(ausente.secondary).toBeNull();
  });

  it("sem nenhum dos dois: nada", () => {
    expect(companyPhoneLines({ contactPhone: "", accountPhone: null })).toEqual({ primary: null, secondary: null });
  });

  it("DDD 55 (RS) não é confundido com o código do país", () => {
    const r = companyPhoneLines({ contactPhone: "55987654321", accountPhone: "+5555987654321" });
    expect(r.secondary).toBeNull();
  });
});

describe("companyPhoneSummary", () => {
  it("contato, conta rotulada ou N/A", () => {
    expect(companyPhoneSummary({ contactPhone: "11987654321", accountPhone: "11911112222" })).toBe("(11) 98765-4321");
    expect(companyPhoneSummary({ contactPhone: "", accountPhone: "11911112222" })).toBe("Conta: (11) 91111-2222");
    expect(companyPhoneSummary({ contactPhone: "" })).toBe("N/A");
  });
});

describe("companyPhoneSearchText", () => {
  it("inclui o telefone da conta, formatado e só dígitos", () => {
    const t = companyPhoneSearchText({ contactPhone: "11911112222", accountPhone: "+5521987654321" });
    expect(t).toContain("(21) 98765-4321");
    expect(t).toContain("21987654321");
    expect(t).toContain("11911112222");
  });

  it("vazio quando não há números", () => {
    expect(companyPhoneSearchText({ contactPhone: "", accountPhone: null })).toBe("");
  });
});

describe("formatCompanyPhone", () => {
  it("formata ou devolve o vazio pedido", () => {
    expect(formatCompanyPhone("+5511987654321")).toBe("(11) 98765-4321");
    expect(formatCompanyPhone(null)).toBe("—");
    expect(formatCompanyPhone("", "")).toBe("");
    expect(formatCompanyPhone(undefined)).toBe("—");
  });
});

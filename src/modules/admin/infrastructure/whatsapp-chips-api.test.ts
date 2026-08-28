import { describe, expect, it } from "vitest";

import { chipStatus, describeChipTest, type WhatsAppChip } from "./whatsapp-chips-api";

const chip = (over: Partial<WhatsAppChip>): WhatsAppChip => ({
  key: "transactional",
  label: "Automáticas (transacional)",
  configured: true,
  instanceIdMasked: "inst*****67",
  provider: "zapi",
  connected: null,
  phone: null,
  sameAsTransactional: false,
  ...over,
});

describe("chipStatus", () => {
  it("conectado → verde 'Conectado'", () => {
    expect(chipStatus(chip({ connected: true }))).toEqual({ tone: "ok", label: "Conectado" });
  });

  it("desconectado → vermelho 'Desconectado'", () => {
    expect(chipStatus(chip({ connected: false }))).toEqual({ tone: "down", label: "Desconectado" });
  });

  it("configurado mas sem resposta da sonda → amarelo", () => {
    expect(chipStatus(chip({ connected: null }))).toEqual({ tone: "warn", label: "sem resposta" });
  });

  it("campanha não configurada → cinza 'usa o transacional'", () => {
    expect(chipStatus(chip({ configured: false, sameAsTransactional: true }))).toEqual({
      tone: "idle",
      label: "usa o transacional",
    });
  });

  it("transacional não configurado (local) → cinza 'não configurado'", () => {
    expect(chipStatus(chip({ configured: false, sameAsTransactional: false }))).toEqual({
      tone: "idle",
      label: "não configurado",
    });
  });
});

describe("describeChipTest", () => {
  it("ok:true → sucesso citando o número do card", () => {
    const out = describeChipTest(
      { ok: true, chip: "transactional", to: "11999998888" },
      "Automáticas (transacional)",
    );
    expect(out.tone).toBe("success");
    expect(out.message).toContain("Automáticas (transacional)");
    expect(out.message).toContain("11999998888");
  });

  it("ok:false → erro com o motivo da API", () => {
    const out = describeChipTest(
      { ok: false, chip: "campaign", to: "11999998888", error: "Número não configurado." },
      "Campanhas (tráfego pago)",
    );
    expect(out).toEqual({ tone: "error", message: "Número não configurado." });
  });

  it("sem resultado → erro genérico citando o chip", () => {
    const out = describeChipTest(null, "Campanhas (tráfego pago)");
    expect(out.tone).toBe("error");
    expect(out.message).toContain("Campanhas (tráfego pago)");
  });
});

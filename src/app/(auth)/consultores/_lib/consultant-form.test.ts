import { describe, expect, it } from "vitest";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import {
  EMPTY_CONSULTANT_FORM,
  buildCreateConsultantPayload,
  buildUpdateConsultantPayload,
  consultantToFormValues,
  type ConsultantFormValues,
} from "./consultant-form";

const filled: ConsultantFormValues = {
  name: "  André Consultor ",
  code: " andre2k ",
  city: " Fortaleza ",
  uf: "ce",
  phone: " (85) 99999-9999 ",
  email: " Andre@X.com ",
  commissionRate: "12,5",
  notes: " parceiro ",
};

describe("buildCreateConsultantPayload", () => {
  it("apara os campos e converte a comissão com vírgula", () => {
    expect(buildCreateConsultantPayload(filled)).toEqual({
      ok: true,
      payload: {
        name: "André Consultor",
        code: "ANDRE2K",
        city: "Fortaleza",
        uf: "CE",
        phone: "(85) 99999-9999",
        email: "Andre@X.com",
        commissionRate: 12.5,
        notes: "parceiro",
      },
    });
  });

  it("omite os opcionais vazios (o código é gerado pela API)", () => {
    expect(
      buildCreateConsultantPayload({ ...EMPTY_CONSULTANT_FORM, name: "Ana", email: "ana@x.com" }),
    ).toEqual({ ok: true, payload: { name: "Ana", email: "ana@x.com" } });
  });

  it("exige nome e e-mail", () => {
    expect(buildCreateConsultantPayload({ ...filled, name: "  " })).toMatchObject({ ok: false });
    expect(buildCreateConsultantPayload({ ...filled, email: "" })).toMatchObject({ ok: false });
  });

  it("recusa comissão fora de 0–100 ou não numérica", () => {
    expect(buildCreateConsultantPayload({ ...filled, commissionRate: "101" })).toMatchObject({
      ok: false,
    });
    expect(buildCreateConsultantPayload({ ...filled, commissionRate: "abc" })).toMatchObject({
      ok: false,
    });
  });

  it("recusa UF que não tem 2 letras", () => {
    expect(buildCreateConsultantPayload({ ...filled, uf: "C" })).toMatchObject({ ok: false });
  });
});

describe("buildUpdateConsultantPayload", () => {
  it("nunca manda o código (só leitura na edição) nem o status", () => {
    const result = buildUpdateConsultantPayload(filled);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).not.toHaveProperty("code");
    expect(result.payload).not.toHaveProperty("isActive");
    expect(result.payload).toMatchObject({ name: "André Consultor", email: "Andre@X.com" });
  });

  it("opcional apagado vira null (limpa o valor salvo)", () => {
    const result = buildUpdateConsultantPayload({
      ...EMPTY_CONSULTANT_FORM,
      name: "Ana",
      email: "ana@x.com",
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        name: "Ana",
        email: "ana@x.com",
        city: null,
        uf: null,
        phone: null,
        commissionRate: null,
        notes: null,
      },
    });
  });

  it("e-mail continua obrigatório (é o login)", () => {
    expect(buildUpdateConsultantPayload({ ...filled, email: " " })).toMatchObject({ ok: false });
  });
});

describe("consultantToFormValues", () => {
  it("preenche o formulário com os dados atuais (nulos viram vazio)", () => {
    const consultant: ConsultantItem = {
      id: "c1",
      name: "André",
      code: "ANDRE2K",
      city: null,
      uf: "CE",
      phone: null,
      email: "andre@x.com",
      commissionRate: 10,
      notes: null,
      isActive: true,
      referralsCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(consultantToFormValues(consultant)).toEqual({
      name: "André",
      code: "ANDRE2K",
      city: "",
      uf: "CE",
      phone: "",
      email: "andre@x.com",
      commissionRate: "10",
      notes: "",
    });
  });
});

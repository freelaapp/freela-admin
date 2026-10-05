import { describe, expect, it } from "vitest";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import {
  EMPTY_CONSULTANT_FORM,
  buildCreateConsultantPayload,
  buildUpdateConsultantPayload,
  consultantToFormValues,
  type ConsultantFormValues,
} from "./consultant-form";
import { BR_PHONE_MESSAGES, formatPhoneMask } from "@/modules/consultant/application/phone-mask";

const filled: ConsultantFormValues = {
  name: "  André Consultor ",
  code: " andre2k ",
  city: " Fortaleza ",
  uf: "ce",
  phone: " (85) 99999-9999 ",
  email: " Andre@X.com ",
  notes: " parceiro ",
};

describe("buildCreateConsultantPayload", () => {
  it("apara os campos", () => {
    expect(buildCreateConsultantPayload(filled)).toEqual({
      ok: true,
      payload: {
        name: "André Consultor",
        code: "ANDRE2K",
        city: "Fortaleza",
        uf: "CE",
        phone: "+5585999999999",
        email: "Andre@X.com",
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
      notes: "",
    });
  });
});

describe("telefone do consultor", () => {
  const base = { ...EMPTY_CONSULTANT_FORM, name: "A", email: "a@x.com" };

  it("create: telefone mascarado vai em E.164 (fixo aceito)", () => {
    const r = buildCreateConsultantPayload({ ...base, phone: "(85) 3333-4444" });
    expect(r.ok && r.payload.phone).toBe("+558533334444");
  });

  it("create/update: telefone inválido barra com a mensagem da régua", () => {
    const v = { ...base, phone: "(85) 3333-444" };
    expect(buildCreateConsultantPayload(v)).toEqual({ ok: false, error: BR_PHONE_MESSAGES.INVALID_ANY });
    expect(buildUpdateConsultantPayload(v)).toEqual({ ok: false, error: BR_PHONE_MESSAGES.INVALID_ANY });
  });

  it("update: telefone vazio vai como null", () => {
    const r = buildUpdateConsultantPayload(base);
    expect(r.ok && r.payload.phone).toBeNull();
  });

  it("update: telefone legado inválido e NÃO alterado não barra a edição de outro campo (e não vai)", () => {
    const legacy = "+5555119876543";
    const loaded = { ...base, phone: formatPhoneMask(legacy) };
    const r = buildUpdateConsultantPayload({ ...loaded, notes: "novo" }, legacy);
    expect(r.ok).toBe(true);
    expect(r.ok && r.payload.notes).toBe("novo");
    expect(r.ok && "phone" in r.payload).toBe(false);
  });

  it("update: telefone ALTERADO continua passando pela régua", () => {
    const legacy = "+5555119876543";
    expect(buildUpdateConsultantPayload({ ...base, phone: "(85) 3333-444" }, legacy)).toEqual({
      ok: false,
      error: BR_PHONE_MESSAGES.INVALID_ANY,
    });
    const r = buildUpdateConsultantPayload({ ...base, phone: "(85) 3333-4444" }, legacy);
    expect(r.ok && r.payload.phone).toBe("+558533334444");
  });

  it("edição: telefone salvo em E.164 aparece mascarado", () => {
    const consultant = {
      id: "c1",
      name: "A",
      code: "A1",
      city: null,
      uf: null,
      phone: "+5585999998888",
      email: "a@x.com",
      commissionRate: null,
      notes: null,
      isActive: true,
      referralsCount: 0,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    } as unknown as ConsultantItem;
    expect(consultantToFormValues(consultant).phone).toBe("(85) 99999-8888");
  });
});

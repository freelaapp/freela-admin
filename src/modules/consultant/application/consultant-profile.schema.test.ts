import { describe, expect, it } from "vitest";
import { consultantProfileSchema, toUpdateProfilePayload } from "./consultant-profile.schema";

const PHONE_MESSAGE = "Informe o telefone com DDD, ex.: (11) 98888-7777.";

describe("consultantProfileSchema", () => {
  it("apara o nome e aceita celular mascarado", () => {
    expect(consultantProfileSchema.parse({ name: "  Ana Souza ", phone: "(11) 98888-7777" })).toEqual({
      name: "Ana Souza",
      phone: "(11) 98888-7777",
    });
  });

  it("aceita fixo e telefone vazio", () => {
    expect(consultantProfileSchema.safeParse({ name: "Ana", phone: "(11) 3333-4444" }).success).toBe(true);
    expect(consultantProfileSchema.safeParse({ name: "Ana", phone: "" }).success).toBe(true);
  });

  it("recusa nome só com espaços", () => {
    const result = consultantProfileSchema.safeParse({ name: "   ", phone: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Informe seu nome (mínimo 3 letras).");
  });

  it.each(["98888-7777", "(11) 8888-7777"])("recusa telefone %s", (phone) => {
    const result = consultantProfileSchema.safeParse({ name: "Ana", phone });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PHONE_MESSAGE);
  });
});

describe("toUpdateProfilePayload", () => {
  it("manda o telefone em E.164", () => {
    expect(toUpdateProfilePayload({ name: "Ana", phone: "(11) 98888-7777" })).toEqual({
      name: "Ana",
      phone: "+5511988887777",
    });
  });

  it("telefone vazio fica de fora (não apaga o que está gravado)", () => {
    expect(toUpdateProfilePayload({ name: "Ana", phone: "" })).toEqual({ name: "Ana" });
  });
});

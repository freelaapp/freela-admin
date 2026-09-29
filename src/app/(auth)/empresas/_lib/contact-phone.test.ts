import { describe, expect, it } from "vitest";
import { BR_PHONE_MESSAGES } from "@/modules/consultant/application/phone-mask";
import { resolveContactPhoneForSave } from "./contact-phone";

describe("resolveContactPhoneForSave", () => {
  it("sem mudança não manda (empresa com contato legado torto continua editável)", () => {
    expect(resolveContactPhoneForSave("(55) 11987-6543", "+5555119876543")).toEqual({ ok: true, value: undefined });
    expect(resolveContactPhoneForSave("(11) 98765-4321", "11987654321")).toEqual({ ok: true, value: undefined });
  });

  it("vazio não manda", () => {
    expect(resolveContactPhoneForSave("", "+5511987654321")).toEqual({ ok: true, value: undefined });
  });

  it("mudou e é válido (fixo ou celular) → E.164", () => {
    expect(resolveContactPhoneForSave("(11) 3333-4444", "+5511987654321")).toEqual({
      ok: true,
      value: "+551133334444",
    });
  });

  it("mudou e é inválido → erro com a mensagem da régua", () => {
    expect(resolveContactPhoneForSave("(11) 3333-444", null)).toEqual({
      ok: false,
      error: BR_PHONE_MESSAGES.INVALID_ANY,
    });
  });
});

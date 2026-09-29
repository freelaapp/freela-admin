import { describe, expect, it } from "vitest";
import {
  BR_PHONE_MESSAGES,
  formatPhoneMask,
  isValidBrPhoneDigits,
  nationalPhoneDigits,
  parseBrPhone,
} from "./phone-mask";

describe("nationalPhoneDigits", () => {
  it.each([
    ["+55 (11) 98888-7777", "11988887777"],
    ["5511988887777", "11988887777"],
    ["551133334444", "1133334444"],
    ["(55) 99876-5432", "55998765432"],
    ["11988887777999", "11988887777"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(nationalPhoneDigits(input)).toBe(expected);
  });
});

describe("formatPhoneMask", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1198888", "(11) 9888-8"],
    ["1133334444", "(11) 3333-4444"],
    ["11988887777", "(11) 98888-7777"],
    ["+55 11 98888-7777", "(11) 98888-7777"],
    ["(55) 99876-5432", "(55) 99876-5432"],
  ])("%s → %s", (input, expected) => {
    expect(formatPhoneMask(input)).toBe(expected);
  });
});

describe("isValidBrPhoneDigits", () => {
  it.each([
    ["11988887777", true],
    ["1133334444", true],
    ["55998765432", true],
    ["1188887777", false],
    ["0198888777", false],
    ["119888877", false],
  ])("%s → %s", (digits, expected) => {
    expect(isValidBrPhoneDigits(digits)).toBe(expected);
  });
});

/* Mesmos vetores da API (api-freela: shared/auth/__tests__/parse-br-phone.spec.ts). */
describe("parseBrPhone", () => {
  it.each([
    ["+5511987654321", "+5511987654321"],
    ["11987654321", "+5511987654321"],
    ["(11) 98765-4321", "+5511987654321"],
    ["+55 (11) 98765-4321", "+5511987654321"],
    ["005511987654321", "+5511987654321"],
    ["555511987654321", "+5511987654321"],
    ["+5555987654321", "+5555987654321"],
    ["55987654321", "+5555987654321"],
  ])("celular %s → %s", (raw, e164) => {
    expect(parseBrPhone(raw)).toEqual({ ok: true, e164, national: e164.slice(3) });
  });

  it.each(["+5555119876543", "5555219876543"])("%s → PHONE_DDI_AS_DDD", (raw) => {
    expect(parseBrPhone(raw)).toEqual({
      ok: false,
      code: "PHONE_DDI_AS_DDD",
      message: BR_PHONE_MESSAGES.DDI_AS_DDD,
    });
  });

  it.each(["551187654321", "1187654321", "+987654321", "5510987654321", "+5511887654321", ""])(
    "%s → PHONE_INVALID (celular)",
    (raw) => {
      expect(parseBrPhone(raw)).toEqual({
        ok: false,
        code: "PHONE_INVALID",
        message: BR_PHONE_MESSAGES.INVALID_MOBILE,
      });
    },
  );

  it.each([
    ["1133334444", "+551133334444"],
    ["+55 (11) 3333-4444", "+551133334444"],
    ["55551133334444", "+551133334444"],
  ])("fixo com allowLandline %s → %s", (raw, e164) => {
    expect(parseBrPhone(raw, { allowLandline: true })).toEqual({ ok: true, e164, national: e164.slice(3) });
  });

  it.each(["1163334444", "113333444"])("%s → PHONE_INVALID (mensagem com fixo)", (raw) => {
    expect(parseBrPhone(raw, { allowLandline: true })).toEqual({
      ok: false,
      code: "PHONE_INVALID",
      message: BR_PHONE_MESSAGES.INVALID_ANY,
    });
  });
});

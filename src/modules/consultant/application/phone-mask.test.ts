import { describe, expect, it } from "vitest";
import { formatPhoneMask, isValidBrPhoneDigits, nationalPhoneDigits } from "./phone-mask";

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

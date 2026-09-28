import { describe, expect, it } from "vitest";
import {
  registrationPlace,
  registrationSourceLabel,
  registrationTypeLabel,
  totalPages,
} from "./registration-view";
import type { RegistrationItem, RegistrationSource } from "@/modules/consultant/domain/types";

const TYPE_CASES: Array<[Pick<RegistrationItem, "persona" | "module">, string]> = [
  [{ persona: "provider", module: null }, "Freelancer"],
  [{ persona: "contractor", module: "bars-restaurants" }, "Empresa"],
  [{ persona: "contractor", module: "home-services" }, "Casa"],
  [{ persona: "contractor", module: "freela-em-casa" }, "Casa"],
  [{ persona: "contractor", module: null }, "Contratante"],
  [{ persona: null, module: null }, "—"],
];

const SOURCE_CASES: Array<[RegistrationSource | null, string]> = [
  ["LINK", "Pelo link"],
  ["ON_BEHALF", "Cadastrado por mim"],
  [null, "—"],
];

describe("registrationTypeLabel", () => {
  it.each(TYPE_CASES)("%o → %s", (item, label) => {
    expect(registrationTypeLabel(item)).toBe(label);
  });
});

describe("registrationSourceLabel", () => {
  it.each(SOURCE_CASES)("%s → %s", (source, label) => {
    expect(registrationSourceLabel(source)).toBe(label);
  });
});

describe("registrationPlace", () => {
  it("cidade/UF, só cidade, nada", () => {
    expect(registrationPlace({ city: "Fortaleza", uf: "CE" })).toBe("Fortaleza/CE");
    expect(registrationPlace({ city: "Fortaleza", uf: null })).toBe("Fortaleza");
    expect(registrationPlace({ city: null, uf: null })).toBe("—");
  });
});

describe("totalPages", () => {
  it.each([
    [0, 50, 1],
    [50, 50, 1],
    [51, 50, 2],
    [120, 50, 3],
  ])("%i itens / %i por página → %i", (total, pageSize, expected) => {
    expect(totalPages(total, pageSize)).toBe(expected);
  });
});

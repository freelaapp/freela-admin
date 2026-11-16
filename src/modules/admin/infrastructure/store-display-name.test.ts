import { describe, expect, it } from "vitest";

import { storeDisplayName } from "./subscriptions-api";

describe("storeDisplayName", () => {
  it("nome fantasia na frente; o nome da loja embaixo quando é outro", () => {
    expect(
      storeDisplayName({
        name: "MCA2 RESTAURANTE FAST FOOD LTDA.",
        tradeName: "Spoleto Shopping Center Norte",
      }),
    ).toEqual({
      primary: "Spoleto Shopping Center Norte",
      secondary: "MCA2 RESTAURANTE FAST FOOD LTDA.",
    });
  });

  it("os dois iguais (maiúsculas e acentos à parte): uma linha só", () => {
    expect(storeDisplayName({ name: "BAR DO ZE", tradeName: "Bar do Zé" })).toEqual({
      primary: "Bar do Zé",
      secondary: null,
    });
  });

  it("sem nome fantasia (ou API antiga): vale o nome da loja", () => {
    expect(storeDisplayName({ name: "Loja Centro", tradeName: null })).toEqual({
      primary: "Loja Centro",
      secondary: null,
    });
    expect(storeDisplayName({ name: "Loja Centro" }).primary).toBe("Loja Centro");
    expect(storeDisplayName({ name: " ", tradeName: " " }).primary).toBe("Sem nome");
  });
});

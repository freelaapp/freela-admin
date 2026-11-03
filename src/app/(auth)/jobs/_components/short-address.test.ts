import { describe, expect, it } from "vitest";

import { shortAddress } from "./short-address";

describe("shortAddress — endereço curto da lista de vagas", () => {
  it("bairro · cidade/UF na 1ª linha, rua e número na 2ª", () => {
    expect(shortAddress("Rua Prates, 480, Bom Retiro, São Paulo/SP, 01121000")).toEqual({
      place: "Bom Retiro · São Paulo/SP",
      street: "Rua Prates, 480",
    });
  });

  it("sem bairro (o número vem antes da cidade): só a cidade, e a rua embaixo", () => {
    expect(shortAddress("Av. Paulista, 1000, São Paulo/SP")).toEqual({
      place: "São Paulo/SP",
      street: "Av. Paulista, 1000",
    });
  });

  it("sem cidade/UF no texto: as duas primeiras partes, sem 2ª linha", () => {
    expect(shortAddress("Rua A, 10, Centro")).toEqual({ place: "Rua A, 10", street: null });
    expect(shortAddress("N/A")).toEqual({ place: "N/A", street: null });
  });
});

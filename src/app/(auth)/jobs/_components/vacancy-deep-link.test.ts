import { describe, expect, it } from "vitest";
import { vacancyIdFromSearch } from "./vacancy-deep-link";

describe("link /jobs?vaga=<id> (Abrir a vaga da fila do suporte)", () => {
  it("lê o id da vaga", () => {
    expect(
      vacancyIdFromSearch("?vaga=4e638fd3-2eff-466c-a10f-41068aa24c2f"),
    ).toBe("4e638fd3-2eff-466c-a10f-41068aa24c2f");
    expect(vacancyIdFromSearch("?x=1&vaga=abc-123")).toBe("abc-123");
  });

  it("sem o parâmetro ou com algo que não é id: null", () => {
    expect(vacancyIdFromSearch("")).toBeNull();
    expect(vacancyIdFromSearch("?vaga=")).toBeNull();
    expect(vacancyIdFromSearch("?vaga=<script>")).toBeNull();
  });
});

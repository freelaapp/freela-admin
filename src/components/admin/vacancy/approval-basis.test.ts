import { describe, expect, it } from "vitest";

import { approvalLabel } from "./approval-basis";

const change = (over: Record<string, unknown> = {}) =>
  ({
    id: "pc-1",
    kind: "SUBSTITUTED",
    fromCandidacyId: "c1",
    toCandidacyId: "c2",
    reason: "PRINCIPAL_WITHDREW",
    note: null,
    actorKind: "CONTRACTOR",
    occurredAt: "2026-11-23T17:05:00.000Z",
    ...over,
  }) as never;

describe("approvalLabel", () => {
  it("API antiga (nenhum campo de aprovação): sem linha", () => {
    expect(approvalLabel(change())).toBeNull();
  });

  it("troca que só liberou a vaga: sem linha", () => {
    expect(approvalLabel(change({ kind: "RELEASED", approvalBasis: "NONE" }))).toBeNull();
  });

  it("prefere o texto pronto da API", () => {
    expect(
      approvalLabel(
        change({
          approvalBasis: "COMPANY_LIST",
          approvedByLabel: "Lista da empresa (fulano@x.com, 23/11/2026 14:05)",
        }),
      ),
    ).toBe("Lista da empresa (fulano@x.com, 23/11/2026 14:05)");
  });

  it.each([
    ["COMPANY_CALL", "Empresa chamou o suplente"],
    ["COMPANY_APPROVED", "Empresa aprovou o suplente"],
    ["AUTO_RULE", "Regra automática da empresa"],
    ["SUPPORT", "Suporte"],
    ["NONE", "Sem aprovação da empresa (escolhido pelo sistema)"],
  ])("sem o texto da API, %s vira %s", (basis, text) => {
    expect(approvalLabel(change({ approvalBasis: basis }))).toBe(text);
  });

  it("lista da empresa sem texto da API: com a data, quando houver", () => {
    expect(approvalLabel(change({ approvalBasis: "COMPANY_LIST" }))).toBe("Lista da empresa");
    expect(
      approvalLabel(change({ approvalBasis: "COMPANY_LIST", approvedAt: "2026-11-23T17:05:00.000Z" })),
    ).toBe("Lista da empresa (23/11/2026, 14:05)");
  });

  it("base nula com o campo presente: troca anterior ao controle", () => {
    expect(approvalLabel(change({ approvalBasis: null }))).toBe(
      "Sem registro (troca anterior ao controle)",
    );
  });

  it("base desconhecida (API mais nova): mostra o código em vez de esconder", () => {
    expect(approvalLabel(change({ approvalBasis: "ALGO_NOVO" }))).toBe("ALGO_NOVO");
  });
});

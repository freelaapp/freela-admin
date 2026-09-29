import { describe, expect, it } from "vitest";
import { consultantDeleteCopy, isConsultantDeleted } from "./consultant-delete";

describe("consultantDeleteCopy", () => {
  it("sem indicações: apaga de verdade", () => {
    const copy = consultantDeleteCopy({ name: "André", code: "ANDRE2K", referralsCount: 0 });

    expect(copy.mode).toBe("HARD");
    expect(copy.title).toBe("Excluir consultor definitivamente");
    expect(copy.bullets.join(" ")).toMatch(/cadastro do consultor é apagado/);
    expect(copy.bullets.join(" ")).toMatch(/ANDRE2K/);
    expect(copy.confirmLabel).toBe("Excluir definitivamente");
  });

  it("com indicações: exclusão lógica, indicações e origem continuam", () => {
    const copy = consultantDeleteCopy({ name: "André", code: "ANDRE2K", referralsCount: 7 });
    const text = copy.bullets.join(" ");

    expect(copy.mode).toBe("SOFT");
    expect(copy.title).toBe("Excluir consultor (exclusão lógica)");
    expect(text).toMatch(/7 cadastros indicados continuam/);
    expect(text).toMatch(/Consultor: André/);
    expect(text).toMatch(/ANDRE2K.*para de atribuir/);
    expect(text).toMatch(/acesso ao painel do consultor é cortado/);
    expect(copy.confirmLabel).toBe("Excluir (manter histórico)");
  });

  it("singular com 1 indicação", () => {
    const copy = consultantDeleteCopy({ name: "Bia", code: "BIA1", referralsCount: 1 });
    expect(copy.bullets.join(" ")).toMatch(/1 cadastro indicado continua/);
  });
});

describe("isConsultantDeleted", () => {
  it("usa deletedAt (API antiga sem o campo = não excluído)", () => {
    expect(isConsultantDeleted({ deletedAt: "2026-09-29T12:00:00Z" })).toBe(true);
    expect(isConsultantDeleted({ deletedAt: null })).toBe(false);
    expect(isConsultantDeleted({})).toBe(false);
  });
});

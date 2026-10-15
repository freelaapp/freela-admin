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

  it("sem indicações mas com comissão a pagar: exclusão lógica e avisa o saldo, com a conta e a fonte", () => {
    const copy = consultantDeleteCopy({
      name: "André",
      code: "ANDRE2K",
      referralsCount: 0,
      openBalanceInCents: 31500,
    });
    const text = copy.bullets.join(" ");

    // A API só apaga de vez sem indicações, lançamentos e pagamentos.
    expect(copy.mode).toBe("SOFT");
    expect(copy.confirmLabel).toBe("Excluir (manter histórico)");
    expect(text).toMatch(/R\$ 315,00 de comissão a pagar/);
    expect(text).toMatch(/soma dos lançamentos ainda sem pagamento, desde o início/);
    expect(text).toMatch(/registre o pagamento em "Extrato e pagamentos"/);
    expect(text).not.toMatch(/cadastros? indicados?/);
  });

  it("com indicações e saldo: os dois avisos", () => {
    const copy = consultantDeleteCopy({
      name: "André",
      code: "ANDRE2K",
      referralsCount: 3,
      openBalanceInCents: 1250,
    });
    const text = copy.bullets.join(" ");

    expect(copy.mode).toBe("SOFT");
    expect(text).toMatch(/3 cadastros indicados continuam/);
    expect(text).toMatch(/R\$ 12,50 de comissão a pagar/);
  });

  it("saldo não conferido (extrato falhou), sem indicações: nada de 'definitivamente'", () => {
    const copy = consultantDeleteCopy(
      { name: "André", code: "ANDRE2K", referralsCount: 0 },
      { balanceUnavailable: true },
    );
    const text = copy.bullets.join(" ");

    expect(copy.mode).toBe("UNCERTAIN");
    expect(copy.title).toBe("Excluir consultor");
    expect(copy.confirmLabel).toBe("Excluir");
    expect(text).toMatch(/Não foi possível conferir o saldo de comissão dele agora/);
    expect(`${copy.title} ${copy.confirmLabel} ${text}`).not.toMatch(/definitiv/i);
  });

  it("saldo não conferido, com indicações: exclusão lógica e o aviso de conferir o saldo", () => {
    const copy = consultantDeleteCopy(
      { name: "André", code: "ANDRE2K", referralsCount: 2 },
      { balanceUnavailable: true },
    );
    expect(copy.mode).toBe("SOFT");
    expect(copy.bullets[0]).toMatch(/Não foi possível conferir o saldo de comissão/);
    expect(copy.bullets.join(" ")).toMatch(/2 cadastros indicados continuam/);
  });

  it("sem indicações e sem saldo: avisa que histórico de comissão já pago ainda vira exclusão lógica", () => {
    const copy = consultantDeleteCopy({
      name: "André",
      code: "ANDRE2K",
      referralsCount: 0,
      openBalanceInCents: 0,
    });
    expect(copy.mode).toBe("HARD");
    expect(copy.bullets.join(" ")).toMatch(/já teve comissão lançada ou paga, a exclusão vira lógica/);
  });
});

describe("isConsultantDeleted", () => {
  it("usa deletedAt (API antiga sem o campo = não excluído)", () => {
    expect(isConsultantDeleted({ deletedAt: "2026-09-29T12:00:00Z" })).toBe(true);
    expect(isConsultantDeleted({ deletedAt: null })).toBe(false);
    expect(isConsultantDeleted({})).toBe(false);
  });
});

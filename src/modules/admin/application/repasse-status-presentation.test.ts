import { describe, expect, it } from "vitest";
import { repasseHeldOrReviewNotice, repasseStatusBadge } from "./repasse-status-presentation";

describe("status do repasse", () => {
  it("os novos: 'Aguardando a fatura' e 'Em verificação', cada um com a sua cor", () => {
    expect(repasseStatusBadge("AWAITING_INVOICE").label).toBe("Aguardando a fatura");
    expect(repasseStatusBadge("CREDIT_UNKNOWN").label).toBe("Em verificação");
    expect(repasseStatusBadge("AWAITING_INVOICE").cls).not.toBe(repasseStatusBadge("PENDING").cls);
    expect(repasseStatusBadge("CREDIT_UNKNOWN").cls).not.toBe(repasseStatusBadge("COMPLETED").cls);
  });

  it("os de sempre continuam; desconhecido ou vazio → 'Em processamento', nunca o código cru", () => {
    expect(repasseStatusBadge("COMPLETED").label).toBe("Concluído");
    expect(repasseStatusBadge("FAILED").label).toBe("Falhou");
    expect(repasseStatusBadge("MOVEMENT_CONFIRMED").label).toBe("Em processamento");
    expect(repasseStatusBadge(null).label).toBe("Em processamento");
  });

  it("aviso da finalização só para os estados novos", () => {
    expect(repasseHeldOrReviewNotice("AWAITING_INVOICE")).toContain("aguarda a fatura da empresa");
    expect(repasseHeldOrReviewNotice("CREDIT_UNKNOWN")).toContain("em verificação");
    expect(repasseHeldOrReviewNotice("COMPLETED")).toBeNull();
    expect(repasseHeldOrReviewNotice(null)).toBeNull();
  });
});

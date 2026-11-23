import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  paidExternallyDifferenceText,
  paidExternallyErrorOf,
  paidExternallyMinDateKey,
  paidExternallyOutcomeOf,
  todayBrtKey,
} from "./held-repasses-presentation";
import { repasseRowBadge } from "./repasse-status-presentation";

function apiError(status: number, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: code ? { error: { code, message: code } } : {},
  });
}

const TARGET = { name: "Ana Souza", amountInCents: 12000 };

describe("pago por fora: diferença de valor (só avisa, sempre com a conta)", () => {
  it("igual → sem aviso", () => {
    expect(paidExternallyDifferenceText(12000, 12000)).toBeNull();
  });
  it("menor e maior → a conta e o que acontece com a diferença", () => {
    expect(paidExternallyDifferenceText(10000, 12000)).toBe(
      "Você pagou R$ 100,00; o pagamento é de R$ 120,00 (R$ 120,00 − R$ 100,00 = R$ 20,00 a menos). A Freela não paga a diferença depois. Explique no motivo.",
    );
    expect(paidExternallyDifferenceText(15000, 12000)).toBe(
      "Você pagou R$ 150,00; o pagamento é de R$ 120,00 (R$ 150,00 − R$ 120,00 = R$ 30,00 a mais). A Freela não cobra a diferença de ninguém. Explique no motivo.",
    );
  });
});

describe("pago por fora: datas de Brasília", () => {
  it("hoje e o mínimo (60 dias antes), no dia de Brasília", () => {
    const now = new Date("2026-11-24T01:30:00.000Z"); // 23/11 22h30 em Brasília
    expect(todayBrtKey(now)).toBe("2026-11-23");
    expect(paidExternallyMinDateKey(now)).toBe("2026-09-24");
  });
});

describe("pago por fora: erros", () => {
  it.each([
    ["REASON_REQUIRED", 422, false, "reason"],
    ["INVALID_AMOUNT", 422, false, "amount"],
    ["INVALID_PAID_AT", 422, false, "paidAt"],
    ["REPASSE_ALREADY_RELEASED", 409, true, null],
    ["REPASSE_ALREADY_PAID", 409, true, null],
    ["REPASSE_IN_PROGRESS", 409, true, null],
    ["REPASSE_NOT_MARKABLE", 409, true, null],
  ])("%s → refresh %s, campo %s", (code, status, refresh, field) => {
    const out = paidExternallyErrorOf(apiError(status as number, code as string), TARGET);
    expect(out.refresh).toBe(refresh);
    expect(out.field).toBe(field);
    expect(out.text.length).toBeGreaterThan(10);
  });

  it("liberado antes: diz que o Pix saiu e o que fazer se também pagou por fora", () => {
    expect(paidExternallyErrorOf(apiError(409, "REPASSE_ALREADY_RELEASED"), TARGET).text).toBe(
      'A Freela liberou este pagamento antes (fatura paga, teto ou "Pagar agora"). O Pix de R$ 120,00 para Ana está saindo ou já saiu. Nada foi marcado. Se você também pagou por fora, Ana recebeu duas vezes: combine a devolução.',
    );
  });

  it("403, 404 e rede", () => {
    expect(paidExternallyErrorOf(apiError(403), TARGET).text).toMatch(/acesso ao Financeiro/);
    expect(paidExternallyErrorOf(apiError(404), TARGET).text).toMatch(/ainda não está disponível/);
    const network = paidExternallyErrorOf(new Error("Network Error"), TARGET);
    expect(network.refresh).toBe(true);
    expect(network.text).toMatch(/Não conseguimos confirmar se ficou marcado/);
  });
});

describe("pago por fora: aviso depois do 200", () => {
  const result = (over: Record<string, unknown> = {}) => ({
    repasseId: "rep-1",
    vacancyId: "vac-1",
    amountInCents: 12000,
    paidExternally: {
      at: "2026-11-23T15:00:00.000Z",
      amountPaidInCents: 12000,
      reason: "x",
      proof: null,
      adminId: "adm",
    },
    differenceInCents: 0,
    pendingBonusInCents: 0,
    alreadyMarked: false,
    ...over,
  });

  it("marcado: valor, dia e que a Freela não paga de novo", () => {
    expect(paidExternallyOutcomeOf(result(), TARGET)).toEqual({
      kind: "success",
      text: "Pagamento de Ana Souza marcado como pago por fora: R$ 120,00 em 23/11. A Freela não vai pagar de novo.",
    });
  });

  it("valor diferente aparece com o devido entre parênteses", () => {
    const out = paidExternallyOutcomeOf(
      result({
        paidExternally: { at: "2026-11-23T15:00:00.000Z", amountPaidInCents: 10000, reason: "x", proof: null, adminId: "a" },
      }),
      TARGET,
    );
    expect(out.text).toContain("R$ 100,00 (de R$ 120,00) em 23/11");
  });

  it("já marcado (repetição) e bônus pendente → aviso", () => {
    expect(paidExternallyOutcomeOf(result({ alreadyMarked: true }), TARGET).text).toBe(
      "O pagamento de Ana Souza já estava marcado como pago por fora (23/11). Nada mudou.",
    );
    const bonus = paidExternallyOutcomeOf(result({ pendingBonusInCents: 1500 }), TARGET);
    expect(bonus.kind).toBe("warning");
    expect(bonus.text).toContain("bônus de avaliação de R$ 15,00");
  });
});

describe("selo do pago por fora", () => {
  it("'Pago por fora' com o bloco; senão o do status", () => {
    expect(repasseRowBadge({ status: "COMPLETED", paidExternally: { at: "x" } }).label).toBe("Pago por fora");
    expect(repasseRowBadge({ status: "COMPLETED", paidExternally: null }).label).toBe("Concluído");
  });
});

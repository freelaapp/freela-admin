import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import type { HeldRepassesTotals } from "../infrastructure/held-repasses-api";
import {
  advancedCompositionCalc,
  advancedSlices,
  deadlineDistance,
  firstName,
  heldCardsOf,
  heldSituationText,
  paidByFreelaCardOf,
  releaseAvailability,
  releaseErrorOf,
  releaseOutcomeOf,
} from "./held-repasses-presentation";

/** Hoje = ter 20/10/2026 10:00 em Brasília (13:00Z). */
const NOW = new Date("2026-10-20T13:00:00.000Z");

const TOTALS: HeldRepassesTotals = {
  all: { count: 3, totalInCents: 28500 },
  awaitingClose: { count: 1, totalInCents: 12000 },
  invoiceOpen: { count: 1, totalInCents: 7000 },
  invoiceOverdue: { count: 1, totalInCents: 9500 },
  releasing: { count: 0, totalInCents: 0 },
  deadline48h: { count: 1, totalInCents: 9500 },
  calc: "fatura ainda aberta R$ 120,00 (1) + a vencer R$ 70,00 (1) + vencida R$ 95,00 (1) + liberando R$ 0,00 (0) = R$ 285,00 (3 retidos)",
  source: "Repasse retido (shared.repasses com status AWAITING_INVOICE).",
};

const BREAKDOWN = {
  onCompletion: { count: 40, valueInCents: 523170 },
  deadline: { count: 1, valueInCents: 9500 },
  admin: { count: 1, valueInCents: 9500 },
  invoiceCancelled: { count: 0, valueInCents: 0 },
};

function axiosError(status: number | null, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  if (status === null) return new AxiosError("Network Error", "ERR_NETWORK", config, null);
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: code ? { error: { code, message: code } } : {},
  });
}

describe("distância até o teto (dias de Brasília)", () => {
  it("em N dias, em 2 dias (atenção), amanhã às 00:00 (perigo), teto atingido", () => {
    expect(deadlineDistance("2026-10-30T03:00:00.000Z", NOW)).toEqual({ label: "em 10 dias", tone: "neutral" });
    expect(deadlineDistance("2026-10-22T03:00:00.000Z", NOW)).toEqual({ label: "em 2 dias", tone: "warning" });
    expect(deadlineDistance("2026-10-21T03:00:00.000Z", NOW)).toEqual({ label: "amanhã às 00:00", tone: "danger" });
    expect(deadlineDistance("2026-10-20T03:00:00.000Z", NOW)).toEqual({
      label: "teto atingido: a Freela paga na próxima varredura",
      tone: "danger",
    });
  });

  it("23:30 em Brasília (02:30Z do dia seguinte): o teto de 00:00 é 'amanhã', não 'hoje'", () => {
    const lateNight = new Date("2026-10-21T02:30:00.000Z"); // ter 20/10 23:30 BRT
    expect(deadlineDistance("2026-10-21T03:00:00.000Z", lateNight).label).toBe("amanhã às 00:00");
  });
});

describe("situação da fatura do retido", () => {
  const invoice = { id: "inv-1", number: "FAT-2026-000123", status: "ISSUED", dueDate: "2026-10-19" };
  it("vencida há N dias, a vencer, ainda aberta, liberando", () => {
    expect(heldSituationText({ situation: "invoice_overdue", invoice }, NOW)).toEqual({
      label: "Vencida há 1 dia (venceu seg 19/10)",
      tone: "danger",
    });
    expect(heldSituationText({ situation: "invoice_open", invoice: { ...invoice, dueDate: "2026-10-26" } }, NOW).label).toBe(
      "A vencer: vence seg 26/10",
    );
    expect(heldSituationText({ situation: "awaiting_close", invoice: null }, NOW).label).toBe(
      "Fatura ainda aberta: o serviço entra no próximo fechamento",
    );
    expect(heldSituationText({ situation: "releasing", invoice }, NOW)).toEqual({
      label: "Liberando: o Pix sai em até 10 min",
      tone: "success",
    });
  });
});

describe("botão 'Pagar agora' da linha", () => {
  const freelancer = { providerGlobalId: "pg-1", name: "Ana Souza", hasPixKey: true };
  it("disponível com chave e retido", () => {
    expect(releaseAvailability({ situation: "invoice_open", releaseAuthorized: false, freelancer })).toEqual({
      enabled: true,
    });
  });
  it("sem chave Pix: indisponível (o Pix falharia e o pagamento deixaria de aguardar a fatura)", () => {
    const result = releaseAvailability({
      situation: "invoice_open",
      releaseAuthorized: false,
      freelancer: { ...freelancer, hasPixKey: false },
    });
    expect(result).toMatchObject({ enabled: false });
    expect(!result.enabled && result.reason).toContain("Ana não tinha chave Pix");
  });
  it("já autorizado ou liberando: indisponível", () => {
    expect(releaseAvailability({ situation: "releasing", releaseAuthorized: false, freelancer }).enabled).toBe(false);
    expect(releaseAvailability({ situation: "invoice_open", releaseAuthorized: true, freelancer }).enabled).toBe(false);
  });
});

describe("cards (cada número com a conta e a fonte)", () => {
  it("retido e 'em até 2 dias' saem das somas da lista; a janela de 48 h em Brasília", () => {
    const [held, due] = heldCardsOf(TOTALS, NOW);
    expect(held).toMatchObject({
      title: "Retido aguardando fatura",
      valueInCents: 28500,
      meta: "3 pagamentos retidos · 1 com fatura vencida (R$ 95,00)",
      calc: TOTALS.calc,
      source: TOTALS.source,
    });
    expect(due).toMatchObject({
      title: "A Freela paga em até 2 dias se as empresas não pagarem",
      valueInCents: 9500,
      meta: "1 pagamento · teto até qui 22/10 às 10:00",
      calc: "soma dos pagamentos retidos com teto até qui 22/10 às 10:00 = R$ 95,00 (1 pagamento)",
    });
    expect(due.source).toContain(TOTALS.source);
  });

  it("pagos pela Freela antes da fatura = teto + Pagar agora + fatura cancelada (sem os do encerramento)", () => {
    const card = paidByFreelaCardOf(BREAKDOWN, "Repasses concluídos de vagas faturadas.");
    expect(card.valueInCents).toBe(19000);
    expect(card.calc).toBe(
      "no teto R$ 95,00 (1) + Pagar agora R$ 95,00 (1) + fatura cancelada R$ 0,00 (0) = R$ 190,00",
    );
    expect(card.source).toContain("Repasses concluídos de vagas faturadas.");
    expect(card.help).toContain("foto de agora");
  });

  it("composição do 'Adiantado': as quatro fatias e o total", () => {
    expect(advancedCompositionCalc(BREAKDOWN)).toBe(
      "no encerramento (antes da regra) R$ 5.231,70 (40) + no teto R$ 95,00 (1) + Pagar agora R$ 95,00 (1) + fatura cancelada R$ 0,00 (0) = R$ 5.421,70",
    );
    expect(advancedSlices(BREAKDOWN).map((s) => s.label)).toEqual([
      "no encerramento",
      "no teto",
      "Pagar agora",
      "fatura cancelada",
    ]);
  });
});

describe("'Pagar agora': erro → texto, e se a lista recarrega", () => {
  it("códigos da API", () => {
    expect(releaseErrorOf(axiosError(422, "REASON_REQUIRED"))).toEqual({
      text: "Escreva o motivo, com pelo menos 5 caracteres.",
      refresh: false,
    });
    expect(releaseErrorOf(axiosError(409, "REPASSE_ALREADY_RELEASED"))).toMatchObject({ refresh: true });
    expect(releaseErrorOf(axiosError(409, "REPASSE_ALREADY_RELEASED")).text).toContain("Nada foi enviado de novo");
    expect(releaseErrorOf(axiosError(409, "REPASSE_NOT_HELD")).text).toContain("não está mais aguardando");
    expect(releaseErrorOf(axiosError(404, "REPASSE_NOT_FOUND")).text).toContain("Não achamos este pagamento");
  });
  it("403, rota ausente (404 sem código), rede e 5xx", () => {
    expect(releaseErrorOf(axiosError(403)).text).toBe("Só quem tem acesso ao Financeiro pode pagar agora.");
    expect(releaseErrorOf(axiosError(404)).text).toContain("ainda não está disponível");
    for (const err of [axiosError(null), axiosError(500), new Error("boom")]) {
      expect(releaseErrorOf(err)).toEqual({
        text: "Não conseguimos confirmar se o Pix saiu. Recarregue a lista antes de tentar de novo, para não pagar duas vezes.",
        refresh: true,
      });
    }
  });
});

describe("'Pagar agora': resultado do 200", () => {
  const target = { name: "Ana Souza", amountInCents: 9500 };
  const base = { repasseId: "rep-1", vacancyId: "vac-1", failureReason: null };
  it("pago, enviando, autorizado para a varredura", () => {
    expect(releaseOutcomeOf({ ...base, status: "COMPLETED" }, target)).toEqual({
      kind: "success",
      text: "R$ 95,00 enviados para Ana Souza.",
    });
    expect(releaseOutcomeOf({ ...base, status: "PROCESSING" }, target).kind).toBe("success");
    expect(releaseOutcomeOf({ ...base, status: "AWAITING_INVOICE" }, target).text).toContain("sai em até 10 min");
  });
  it("200 com FAILED ou CREDIT_UNKNOWN é aviso, nunca sucesso", () => {
    const failed = releaseOutcomeOf(
      { ...base, status: "FAILED", failureReason: "Freelancer não possui chave Pix padrão cadastrada." },
      target,
    );
    expect(failed.kind).toBe("warning");
    expect(failed.text).toContain("Freelancer não possui chave Pix padrão cadastrada.");
    expect(releaseOutcomeOf({ ...base, status: "CREDIT_UNKNOWN" }, target)).toMatchObject({ kind: "warning" });
    expect(releaseOutcomeOf({ ...base, status: null }, target).text).toContain("Em processamento");
  });
});

describe("primeiro nome", () => {
  it("do nome completo; sem nome, 'o freelancer'", () => {
    expect(firstName("Ana Souza")).toBe("Ana");
    expect(firstName(null)).toBe("o freelancer");
    expect(firstName("  ")).toBe("o freelancer");
  });
});

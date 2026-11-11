import { describe, expect, it } from "vitest";
import type { AdminLotLine } from "@/modules/admin/infrastructure/lot-lines-api";
import {
  arrivalText,
  askText,
  attendanceText,
  chosenText,
  hourLabel,
  linesSummary,
  momentLabel,
  paymentText,
} from "./lot-lines-presentation";

const DAY = "2026-11-14";
// Brasília = UTC-3.
const ask = (over: Partial<NonNullable<AdminLotLine["ask"]>> = {}): NonNullable<AdminLotLine["ask"]> => ({
  state: "YES",
  askedForVacancyId: "v1",
  scheduledFor: null,
  askedAt: "2026-11-14T17:02:04.000Z",
  deadlineAt: "2026-11-14T18:02:00.000Z",
  answeredAt: "2026-11-14T17:12:31.000Z",
  answeredVia: "WHATSAPP",
  deliveredAt: "2026-11-14T17:02:05.000Z",
  closedAt: null,
  ...over,
});
const ctx = { serviceDate: DAY, vacancyId: "v1" };

describe("horários em Brasília", () => {
  it("14h02 e 14h (minuto zero); inválido vira traço", () => {
    expect(hourLabel("2026-11-14T17:02:00.000Z")).toBe("14h02");
    expect(hourLabel("2026-11-14T17:00:00.000Z")).toBe("14h");
    expect(hourLabel(null)).toBe("—");
    expect(hourLabel("lixo")).toBe("—");
  });

  it("meia-noite UTC ainda é o dia anterior em Brasília", () => {
    expect(momentLabel("2026-11-14T02:30:00.000Z", "2026-11-13")).toBe("23h30");
    expect(momentLabel("2026-11-14T02:30:00.000Z", "2026-11-14")).toBe("13/11 23h30");
  });

  it("inclui a data quando cai noutro dia que o do serviço (pergunta na véspera)", () => {
    expect(momentLabel("2026-11-13T17:02:00.000Z", DAY)).toBe("13/11 14h02");
  });
});

describe("askText: 'Ainda pode vir?'", () => {
  it("sem pergunta", () => {
    expect(askText(null, ctx).text).toBe("Sem pergunta.");
  });

  it("YES: perguntado às, respondeu às, e o WhatsApp aceito", () => {
    const r = askText(ask(), ctx);
    expect(r.text).toBe("Perguntado às 14h02, respondeu às 14h12 pelo WhatsApp: ainda pode vir.");
    expect(r.tone).toBe("ok");
    expect(r.notes).toContain("WhatsApp aceito pelo provedor às 14h02.");
  });

  it("ASKED sem entrega ainda NÃO é 'não entregue': seguimos tentando", () => {
    const r = askText(ask({ state: "ASKED", deliveredAt: null, answeredAt: null, answeredVia: null }), ctx);
    expect(r.text).toContain("o WhatsApp ainda não foi aceito pelo provedor. Seguimos tentando até 15h02");
    expect(r.text).not.toContain("não entregue");
  });

  it("UNDELIVERED: não entregue, a pessoa continua escolhida", () => {
    const r = askText(ask({ state: "UNDELIVERED", deliveredAt: null }), ctx);
    expect(r.text).toBe("Pergunta não entregue: o WhatsApp não foi aceito até o prazo. A pessoa continua escolhida.");
    expect(r.tone).toBe("bad");
  });

  it("NO e NO_ANSWER dizem que saiu da vaga", () => {
    expect(askText(ask({ state: "NO" }), ctx).text).toContain("não pode mais. Saiu da vaga e não volta");
    expect(askText(ask({ state: "NO_ANSWER", answeredAt: null }), ctx).text).toContain("não respondeu");
    expect(askText(ask({ state: "NO_ANSWER", answeredAt: null }), ctx).text).toContain("voltou à lista");
  });

  it("SCHEDULED, SUPERSEDED, CANCELLED, SKIPPED e estado novo", () => {
    expect(askText(ask({ state: "SCHEDULED", scheduledFor: "2026-11-14T17:02:00.000Z" }), ctx).text).toBe(
      "Vai perguntar às 14h02.",
    );
    expect(askText(ask({ state: "SUPERSEDED" }), ctx).text).toContain("paga antes da resposta");
    expect(askText(ask({ state: "CANCELLED" }), ctx).text).toContain("cancelada");
    expect(askText(ask({ state: "SKIPPED" }), ctx).text).toContain("não foi feita");
    expect(askText(ask({ state: "NOVO" }), ctx).text).toBe("Pergunta: NOVO.");
  });

  it("pergunta feita para outra vaga do grupo vira nota", () => {
    const r = askText(ask({ askedForVacancyId: "v2" }), ctx);
    expect(r.notes.join(" ")).toContain("outra vaga do mesmo grupo");
  });
});

describe("paymentText", () => {
  const paid = {
    paid: true,
    paymentId: "pay-1",
    method: "WALLET",
    at: "2026-11-13T19:40:10.000Z",
    amountInCents: 18100,
    byBatch: true,
    batchId: "b-1",
    pixFeeWaivedInCents: 85,
  };

  it("pendente quando há escolhido e falta pagar; livre sem pagamento", () => {
    expect(paymentText(null, { serviceDate: DAY, hasChosen: true }).text).toBe("Pendente: falta pagar.");
    expect(paymentText(null, { serviceDate: DAY, hasChosen: false }).tone).toBe("neutral");
  });

  it("pago em pagamento único: id, valor e a taxa do Pix dispensada com a conta", () => {
    const r = paymentText(paid, { serviceDate: DAY, hasChosen: true });
    expect(r.text).toBe("Pago com saldo da carteira às 13/11 16h40.");
    expect(r.notes).toContain("Valor pago nesta vaga: R$ 181,00.");
    expect(r.notes.join(" ")).toContain("Pagamento único (b-1)");
    const fee = r.notes.find((n) => n.startsWith("Taxa do Pix dispensada"));
    expect(fee).toContain("R$ 0,85");
    expect(fee).toContain("Conta: R$ 181,00 pagos + R$ 0,85 dispensados = R$ 181,85, o valor cheio da vaga.");
  });

  it("sem pagamento único e sem taxa dispensada: sem essas notas; método desconhecido aparece cru", () => {
    const r = paymentText(
      { ...paid, byBatch: false, batchId: null, pixFeeWaivedInCents: 0, method: "BOLETO" },
      { serviceDate: DAY, hasChosen: true },
    );
    expect(r.text).toContain("com BOLETO");
    expect(r.notes.join(" ")).not.toContain("Pagamento único");
    expect(r.notes.join(" ")).not.toContain("dispensada");
  });
});

describe("arrivalText e attendanceText", () => {
  const arr = (over: Record<string, unknown> = {}) =>
    ({
      state: "ANSWERED",
      askedAt: "2026-11-14T21:15:02.000Z",
      answer: "ARRIVED",
      answeredAt: "2026-11-14T21:17:40.000Z",
      answeredAtLabel: "18h17",
      answeredVia: "SITE",
      outcome: null,
      aboutChosen: true,
      ...over,
    }) as AdminLotLine["arrival"];

  it("chegou, não chegou (e o que aconteceu), sem resposta", () => {
    expect(arrivalText(arr(), { serviceDate: DAY }).text).toBe("Chegou 18h17, respondido pelo site.");
    const no = arrivalText(arr({ answer: "NOT_ARRIVED", outcome: "CALLED" }), { serviceDate: DAY });
    expect(no.text).toBe("Não chegou (respondido às 18h17 pelo site).");
    expect(no.notes).toContain("O suplente foi chamado.");
    expect(arrivalText(arr({ state: "PENDING", answer: null, answeredAt: null, answeredAtLabel: null }), { serviceDate: DAY }).tone).toBe("wait");
    expect(arrivalText(null, { serviceDate: DAY }).tone).toBe("neutral");
  });

  it("resposta sobre a pessoa anterior não aparece como 'não chegou' do suplente", () => {
    const r = arrivalText(arr({ answer: "NOT_ARRIVED", aboutChosen: false }), { serviceDate: DAY });
    expect(r.text).toContain("sobre a pessoa anterior");
    expect(r.text).toContain("o suplente entrou depois");
    expect(r.text).not.toMatch(/^Não chegou/);
  });

  it("presença: aberta, decisões e estado novo", () => {
    expect(attendanceText(null).text).toBe("Ainda não abriu.");
    const a = attendanceText({
      status: "PENDING_CONTRACTOR_CONFIRMATION",
      contractorDecision: null,
      providerDecision: true,
      blockedReason: "ARRIVAL_NOT_ARRIVED",
      openedAt: null,
      contractorRespondedAt: null,
    });
    expect(a.tone).toBe("wait");
    expect(a.notes).toEqual(["Freelancer: compareceu.", "A empresa marcou “não chegou” sobre a pessoa."]);
    expect(
      attendanceText({ status: "XYZ", contractorDecision: false, providerDecision: null, blockedReason: null, openedAt: null, contractorRespondedAt: null }).text,
    ).toBe("Presença: XYZ.");
  });
});

describe("chosenText e linesSummary", () => {
  it("nomes e a conta do resumo", () => {
    expect(chosenText({ chosen: null })).toBe("Vaga livre");
    expect(chosenText({ chosen: { candidacyId: "c", providerGlobalId: null, name: null } })).toBe("Pessoa escolhida (sem nome)");
    const chosen = { candidacyId: "c", providerGlobalId: "g", name: "Ana" };
    const pay = (paid: boolean) => ({ paid, paymentId: null, method: null, at: null, amountInCents: null, byBatch: false, batchId: null, pixFeeWaivedInCents: 0 });
    expect(
      linesSummary([
        { chosen, payment: pay(true) },
        { chosen, payment: pay(false) },
        { chosen: null, payment: null },
      ]),
    ).toBe("3 vagas no lote = 2 com escolhido + 1 livres · dos 2 escolhidos, 1 pagos e 1 pendentes");
  });
});

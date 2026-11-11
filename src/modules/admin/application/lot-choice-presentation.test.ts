import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import {
  asksLine,
  canSelect,
  choiceErrorMessage,
  confirmLines,
  exitReasonText,
  isChoiceDisabled,
  isGroupGone,
  isRetryable,
  itemAskText,
  itemStatusLabel,
  resultPayLine,
  resultSummaryText,
  toggleSelection,
  unpaidLine,
  whyNotChoosable,
} from "./lot-choice-presentation";

function httpError(status: number, error?: Record<string, unknown>) {
  const err = new AxiosError("x");
  err.response = { status, data: error ? { error } : {} } as never;
  return err;
}

describe("erros da escolha", () => {
  it("404 com o código da chave, 404 sem código (API antiga): recurso desligado", () => {
    expect(isChoiceDisabled(httpError(404, { code: "VACANCY_LOT_CHOICE_DISABLED" }))).toBe(true);
    expect(isChoiceDisabled(httpError(404))).toBe(true);
    expect(isChoiceDisabled(httpError(404, { code: "LOT_NOT_FOUND" }))).toBe(false);
    expect(isChoiceDisabled(httpError(500))).toBe(false);
  });

  it("função mudou, muitas pessoas (com o máximo) e mensagem da API", () => {
    expect(isGroupGone(httpError(404, { code: "LOT_GROUP_NOT_FOUND" }))).toBe(true);
    expect(choiceErrorMessage(httpError(404, { code: "LOT_GROUP_NOT_FOUND" }))).toContain("Esta função mudou");
    expect(choiceErrorMessage(httpError(422, { code: "LOT_CHOICE_TOO_MANY", message: "m", max: 20 }))).toBe(
      "Muitas pessoas de uma vez. O máximo por escolha é 20.",
    );
    expect(choiceErrorMessage(httpError(400, { code: "X", message: "Texto da API" }))).toBe("Texto da API");
    expect(choiceErrorMessage(new Error("boom"))).toContain("Nada foi alterado");
  });

  it("só rede e 5xx tentam de novo", () => {
    expect(isRetryable(new Error("rede"))).toBe(true);
    expect(isRetryable(httpError(503))).toBe(true);
    expect(isRetryable(httpError(422, { code: "LOT_CHOICE_TOO_MANY" }))).toBe(false);
  });
});

describe("marcação", () => {
  it("segue a ordem dos cliques, desmarca e respeita o teto", () => {
    let s: string[] = [];
    s = toggleSelection(s, "a", 2);
    s = toggleSelection(s, "b", 2);
    s = toggleSelection(s, "c", 2);
    expect(s).toEqual(["a", "b"]);
    expect(toggleSelection(s, "a", 2)).toEqual(["b"]);
  });

  it("só dá para marcar quem é `choosable` e tem identidade; diz o porquê", () => {
    const base = { choosable: true, busy: false, chosenInOtherFunction: null, provider: { providerGlobalId: "g" } };
    expect(canSelect(base)).toBe(true);
    expect(canSelect({ ...base, provider: { providerGlobalId: null } })).toBe(false);
    expect(whyNotChoosable(base)).toBeNull();
    expect(whyNotChoosable({ ...base, choosable: false, busy: true })).toContain("outro serviço nesse horário");
    expect(whyNotChoosable({ ...base, choosable: false, chosenInOtherFunction: "Cozinha" })).toBe("Já escolhida como Cozinha neste dia.");
  });
});

describe("textos do resultado", () => {
  const summary = {
    requested: 3, accepted: 2, alreadyChosen: 0, failed: 1, billing: "PREPAID",
    chosenAmountInCents: 36000, dayUnpaidCount: 7, dayUnpaidInCents: 156000,
  };

  it("resumo com a conta e o 'falta pagar'", () => {
    expect(resultSummaryText(summary)).toBe("3 pedidas = 2 escolhidas agora + 0 já estavam escolhidas + 1 recusadas");
    expect(resultPayLine(summary)).toContain("R$ 360,00");
    expect(resultPayLine(summary)).toContain("Falta pagar no dia: 7 vagas = R$ 1560,00.");
    expect(resultPayLine({ ...summary, accepted: 0, dayUnpaidCount: 0 })).toBeNull();
  });

  it("rótulo por item; status desconhecido = não entrou", () => {
    expect(itemStatusLabel("ACCEPTED")).toBe("Escolhida");
    expect(itemStatusLabel("ALREADY_CHOSEN")).toBe("Já estava escolhida");
    expect(itemStatusLabel("SLOT_TAKEN")).toBe("Não entrou");
  });

  it("a pergunta agendada pela API aparece no item", () => {
    expect(itemAskText(null)).toBeNull();
    expect(itemAskText({ state: "SCHEDULED", askAt: "2026-11-14T17:02:00.000Z" })).toContain("sai às 14h02");
  });
});

describe("confirmação e dia", () => {
  it("pré-pago, faturado e a pergunta automática", () => {
    const pre = confirmLines({ count: 2, billing: "PREPAID", askPlanned: true });
    expect(pre.join(" ")).toContain("a empresa é quem paga");
    expect(pre.join(" ")).toContain("às 2 pessoas escolhidas");
    const inv = confirmLines({ count: 1, billing: "INVOICED", askPlanned: false });
    expect(inv.join(" ")).toContain("entram na fatura");
    expect(inv.join(" ")).not.toContain("Ainda pode vir");
    expect(inv[0]).toContain("1 aviso");
  });

  it("falta pagar com a conta, e a contagem das perguntas", () => {
    expect(unpaidLine({ unpaidCount: 0, unpaidInCents: 0 })).toBe("Nada falta pagar neste dia.");
    expect(unpaidLine({ unpaidCount: 7, unpaidInCents: 156000 })).toContain("7 vagas com escolhido e sem pagamento = R$ 1560,00");
    expect(asksLine(null)).toBeNull();
    expect(asksLine({ scheduled: 1, asking: 2, confirmed: 3, undelivered: 0, nextDeadlineAt: "2026-11-14T19:02:00.000Z" })).toBe(
      "“Ainda pode vir?”: 1 a perguntar · 2 esperando resposta · 3 disseram que ainda podem vir · 0 sem entrega (continuam escolhidas). Próximo prazo: 16h02.",
    );
  });

  it("motivos de saída, com o texto novo da pergunta", () => {
    expect(exitReasonText("LOT_ASK_DECLINED")).toBe("respondeu “Não posso mais”");
    expect(exitReasonText("OUTRO")).toBe("saiu da vaga");
  });
});

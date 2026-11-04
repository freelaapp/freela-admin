import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import {
  canKeepOccurrence,
  canRegisterConversation,
  conversationLabel,
  dayLabel,
  deadlineLabel,
  isPenaltyLadderDisabled,
  liftReasonHint,
  originLabel,
  reasonLabel,
  returnLabel,
  stateLabel,
} from "./suspensions-presentation";
import { suspensionItem } from "./suspensions.test-fixtures";

function apiError(status: number, code: string) {
  return new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: { error: { code, message: "x" } },
  });
}

describe("Suspensões — textos (fatia G, designer §5.5)", () => {
  it("chave desligada = 404 FEATURE_DISABLED", () => {
    expect(isPenaltyLadderDisabled(apiError(404, "FEATURE_DISABLED"))).toBe(true);
    expect(isPenaltyLadderDisabled(apiError(500, "INTERNAL_SERVER_ERROR"))).toBe(false);
  });

  it("datas em Brasília", () => {
    expect(dayLabel("2026-11-14T03:00:00.000Z")).toBe("sáb 14/11");
    expect(deadlineLabel("2026-11-10T21:00:00.000Z")).toBe("ter 10/11 às 18h");
  });

  it("colunas: motivo, volta, conversa, origem e situação", () => {
    const item = suspensionItem();
    expect(reasonLabel(item)).toBe("Falta sem aviso");
    expect(returnLabel(item)).toBe("sáb 14/11, depois da conversa");
    expect(returnLabel({ endsAt: null, requiresConversation: true })).toBe("Depois da conversa");
    expect(returnLabel({ endsAt: item.endsAt, requiresConversation: false })).toBe("sáb 14/11");
    expect(conversationLabel(item)).toBe("Pendente");
    expect(conversationLabel({ requiresConversation: true, conversationAt: "2026-11-10T15:00:00.000Z" })).toBe(
      "Feita em 10/11",
    );
    expect(conversationLabel({ requiresConversation: false, conversationAt: null })).toBe("—");
    expect(originLabel(item)).toBe("Garçom, sáb 07/11 · pode contestar até ter 10/11 às 18h");
    expect(stateLabel(item)).toBe("Sem poder se candidatar");
    expect(
      originLabel(
        suspensionItem({ source: null, vacancy: null, reasonKey: "MANUAL", manualReason: "Briga na loja" }),
      ),
    ).toBe("Suporte: Briga na loja");
  });

  it("ações: conversa só quando pendente; manter só com a contestação aberta", () => {
    expect(canRegisterConversation(suspensionItem())).toBe(true);
    expect(canRegisterConversation(suspensionItem({ conversationAt: "2026-11-10T15:00:00.000Z" }))).toBe(false);
    expect(canKeepOccurrence(suspensionItem())).toBe(false);
    const contested = suspensionItem({
      source: { ...suspensionItem().source!, status: "CONTESTED", contest: { status: "SENT", until: null } },
    });
    expect(canKeepOccurrence(contested)).toBe(true);
    expect(canKeepOccurrence({ ...contested, state: "LIFTED" })).toBe(false);
  });

  it("o diálogo diz o que cada motivo faz", () => {
    expect(liftReasonHint("CONTEST_ACCEPTED", true)).toMatch(/ocorrência é anulada/);
    expect(liftReasonHint("SYSTEM_ERROR", true)).toMatch(/Só a suspensão sai/);
    expect(liftReasonHint("OTHER", true)).toMatch(/Escreva o motivo/);
  });
});

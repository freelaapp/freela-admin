import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  appliedLabel,
  buildDecideBody,
  confirmationOf,
  contestLabel,
  decideErrorOf,
  decisionLine,
  decisionShort,
  firstName,
  historyLine,
  initialFormState,
  keepHint,
  revokedLine,
  submitLabel,
  successText,
  suspendHint,
  systemRecordedText,
  validateDecideForm,
  vacancyLine,
  placeLine,
  type DecideFormState,
} from "./occurrences-presentation";
import { decisionRecord, occurrenceDetail, occurrenceItem } from "./occurrences.test-fixtures";

const now = new Date("2026-11-20T15:00:00.000Z"); // sex 20/11 12h
const detail = occurrenceDetail();
const form = (over: Partial<DecideFormState> = {}): DecideFormState => ({
  ...initialFormState(detail),
  whatHappened: "A empresa disse que ela não apareceu.",
  contact: "CALL",
  ...over,
});

function apiError(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: "mensagem da API", ...extra } },
  });
}

describe("ocorrências: textos do caso", () => {
  it("primeiro nome, vaga, lugar e o que o sistema registrou (por origem)", () => {
    const item = occurrenceItem();
    expect(firstName(item)).toBe("Maria");
    expect(firstName(occurrenceItem({ person: { ...item.person, name: null } }))).toBe("a pessoa");
    expect(vacancyLine(item)).toBe("Garçom · qui 19/11, 18h");
    expect(placeLine(item)).toBe("Coco Bambu · Osasco");
    expect(systemRecordedText(occurrenceItem({ createdBy: "contractor_not_arrived" }))).toBe(
      'A empresa marcou "Não chegou". Se a empresa mantiver Maria ou o serviço começar com Maria na vaga, a falta sai sozinha.',
    );
    expect(systemRecordedText(occurrenceItem({ createdBy: "system" }))).toMatch(/não teve início/);
  });

  it('"O que o sistema aplicou": 7 dias + conversa · volta qui 26/11', () => {
    expect(appliedLabel(occurrenceItem())).toBe("7 dias + conversa · volta qui 26/11");
    expect(appliedLabel(occurrenceItem({ applied: null }))).toBe("Só os pontos");
    const item = occurrenceItem();
    expect(
      appliedLabel(occurrenceItem({ applied: { ...item.applied!, liftedAt: "2026-11-21T12:00:00.000Z" } })),
    ).toBe("Levantada em 21/11");
  });

  it("contestação: prazo, a responder, negada", () => {
    expect(contestLabel(occurrenceItem())).toBe("Pode contestar até dom 22/11 às 18h40");
    const item = occurrenceItem();
    expect(contestLabel(occurrenceItem({ contest: { ...item.contest, status: "SENT" } }))).toBe(
      "Contestação a responder",
    );
    expect(contestLabel(occurrenceItem({ contest: { ...item.contest, status: "DENIED" } }))).toBe(
      "Contestação negada",
    );
  });

  it("linha da decisão, desfeita e coluna das Decididas", () => {
    const d = decisionRecord();
    expect(decisionLine(d)).toBe(
      "Decidido por Ana em sex 20/11 às 10h05: suspender por 30 dias (até sáb 19/12).",
    );
    expect(revokedLine(d)).toBeNull();
    expect(
      revokedLine(decisionRecord({ revokedAt: "2026-11-21T12:00:00.000Z", revokedKind: "INFRACTION_ANNULLED" })),
    ).toBe("Desfeito porque a falta foi anulada em 21/11.");
    expect(
      revokedLine(
        decisionRecord({
          revokedAt: "2026-11-21T12:00:00.000Z",
          revokedKind: "ADMIN",
          revokedByName: "Bia",
          revokedReason: "Era outra pessoa",
        }),
      ),
    ).toBe('Desfeito por Bia em 21/11: "Era outra pessoa".');
    expect(
      decisionShort(
        occurrenceItem({
          decision: {
            id: "dec-1",
            decision: "SUSPEND",
            suspensionDays: 30,
            decidedAt: "2026-11-20T13:05:00.000Z",
            decidedByName: "Ana",
            contestAnswer: null,
            suspensionEndsAt: null,
            suspensionLiftedAt: null,
          },
        }),
      ),
    ).toBe("Suspender 30 dias · Ana, 20/11");
  });

  it("histórico com plural certo", () => {
    expect(historyLine({ days: 90, noShows: 1, lateWithdrawals: 0, suspensions: 2 })).toBe(
      "Últimos 90 dias, em Empresas: 1 falta sem aviso · 0 desistências em cima da hora · 2 suspensões.",
    );
  });
});

describe("ocorrências: formulário", () => {
  const item = occurrenceItem();
  const options = detail.options;

  it("validação: 10 letras, falou com a pessoa, contestação e escolha", () => {
    expect(validateDecideForm(form({ whatHappened: "curto", contact: "" }), options, item, now)).toEqual({
      whatHappened: "Escreva pelo menos 10 letras.",
      contact: "Diga se falou com Maria.",
      choice: "Escolha o que fazer.",
    });
    const contested = { ...options, needsContestAnswer: true };
    expect(validateDecideForm(form({ choice: "RELEASE" }), contested, item, now)).toEqual({
      contestAnswer: "Responda a contestação.",
    });
    expect(validateDecideForm(form({ choice: "SUSPEND" }), options, item, now)).toEqual({
      days: "Escolha por quantos dias.",
    });
  });

  it("corpo: Liberar com advertência, Suspender 30, aceitar = anular, só negar", () => {
    expect(buildDecideBody(form({ choice: "RELEASE", releaseMode: "WARNING" }), options)).toEqual({
      whatHappened: "A empresa disse que ela não apareceu.",
      contactResult: "CALL",
      decision: "RELEASE",
      warning: true,
    });
    expect(buildDecideBody(form({ choice: "SUSPEND", days: 30 }), options)).toMatchObject({
      decision: "SUSPEND",
      days: 30,
    });
    const contested = { ...options, needsContestAnswer: true };
    expect(buildDecideBody(form({ contestAnswer: "ACCEPTED", choice: "KEEP" }), contested)).toMatchObject({
      contestAnswer: "ACCEPTED",
      decision: "ANNUL",
    });
    const only = { ...contested, contestOnly: true };
    const body = buildDecideBody(form({ contestAnswer: "DENIED" }), only);
    expect(body.contestAnswer).toBe("DENIED");
    expect(body.decision).toBeUndefined();
  });

  it("dica do Manter: a volta real", () => {
    expect(keepHint(item, "CALL", now)).toBe("A conversa fica registrada. Maria volta em qui 26/11.");
    expect(keepHint(item, "NO_ANSWER", now)).toBe(
      "Continua sem se candidatar até qui 26/11 e só volta depois que alguém registrar a conversa.",
    );
  });

  it("Suspender conta do início da automática (D6) e o botão diz até quando", () => {
    expect(suspendHint(item, 30, now)).toMatch(/^Maria fica sem se candidatar até sáb 19\/12\./);
    expect(submitLabel(form({ choice: "SUSPEND", days: 30 }), options, item, now)).toBe(
      "Suspender até sáb 19/12",
    );
    expect(submitLabel(form({ choice: "KEEP" }), options, item, now)).toBe("Manter e registrar");
    expect(submitLabel(form(), options, item, now)).toBe("Escolha o que fazer");
  });

  it("confirmações: anular (sem volta) e suspender 30 dias com a regra publicada", () => {
    expect(confirmationOf(form({ choice: "ANNUL" }), options, item, now)).toEqual({
      title: "Anular a falta de Maria?",
      body: 'Os 5 pontos voltam (nota de 95 para 100) e a suspensão desta falta sai agora. Maria recebe "Você já pode se candidatar de novo". Não tem volta: falta anulada não reabre.',
      action: "Anular a falta",
    });
    expect(confirmationOf(form({ choice: "SUSPEND", days: 30 }), options, item, now)).toEqual({
      title: "Suspender Maria por 30 dias?",
      body: "Maria fica sem se candidatar até sáb 19/12. A regra publicada para este caso é 7 dias.",
      action: "Suspender até 19/12",
    });
    expect(confirmationOf(form({ choice: "SUSPEND", days: 7 }), options, item, now)).toBeNull();
    expect(confirmationOf(form({ choice: "RELEASE" }), options, item, now)).toBeNull();
  });

  it("mensagens de sucesso", () => {
    const base = {
      decision: decisionRecord({ decision: "RELEASE", suspensionDays: null }),
      contestAnswer: null,
      effects: {
        conversationRegistered: false,
        liftedAutomatic: true,
        suspendedUntil: null,
        pointsReturned: null,
        stillSuspended: false,
      },
    };
    expect(successText({ ...base, outcome: "DECIDED" }, item)).toBe(
      "Maria já pode se candidatar. Mandamos o aviso pelo app.",
    );
    expect(
      successText(
        {
          ...base,
          outcome: "DECIDED",
          decision: decisionRecord(),
          effects: { ...base.effects, suspendedUntil: "2026-12-19T03:00:00.000Z" },
        },
        item,
      ),
    ).toBe("Maria fica sem se candidatar até 19/12. Mandamos o aviso pelo app.");
    expect(successText({ ...base, outcome: "ANNULLED", decision: null }, item)).toBe(
      "Falta anulada. Os pontos voltaram.",
    );
    expect(
      successText(
        {
          ...base,
          outcome: "DECIDED",
          contestAnswer: "DENIED",
          decision: decisionRecord({ decision: "KEEP", suspensionDays: null }),
          effects: { ...base.effects, liftedAutomatic: false, conversationRegistered: true },
        },
        item,
      ),
    ).toBe('Decisão registrada. Conversa registrada. Mandamos "Mantivemos a ocorrência" pelo app.');
  });

  it("erros pelo código, não pela mensagem da API", () => {
    expect(
      decideErrorOf(
        apiError(409, "OCCURRENCE_ALREADY_DECIDED", {
          details: {
            decision: "SUSPEND",
            suspensionDays: 30,
            decidedAt: "2026-11-20T13:05:00.000Z",
            decidedByName: "Ana",
            decidedByMe: false,
          },
        }),
        item,
      ),
    ).toEqual({
      text: "Outra pessoa já decidiu este caso (Ana, 10h05: suspender 30 dias). Sua escolha não foi aplicada. O que você escreveu continua aqui.",
      action: "reload",
    });
    expect(decideErrorOf(apiError(409, "OCCURRENCE_ANNULLED"), item).text).toMatch(
      /^Esta falta foi anulada enquanto você decidia \(a empresa manteve Maria/,
    );
    expect(decideErrorOf(apiError(422, "SUSPENSION_DAYS_NOT_ALLOWED"), item)).toEqual({
      text: "mensagem da API",
      action: null,
    });
    expect(decideErrorOf(new Error("rede"), item).action).toBe("retry");
  });
});

import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import {
  deadlinesLine,
  reasonLabel,
  selectionLoadErrorVisible,
  situationLabel,
  stageLine,
  weekdayHour,
} from "./selection-round-presentation";
import type {
  AdminSelectionPerson,
  AdminSelectionRound,
} from "../infrastructure/selection-round-api";

const round = (over: Partial<AdminSelectionRound> = {}): AdminSelectionRound => ({
  id: "r1",
  stage: "em_selecao",
  phase: "ASKING",
  band: "HOURS_24_TO_48",
  preselectionSize: 10,
  windowClosedAt: "2026-11-06T16:00:00.000Z",
  availabilityDeadlineAt: "2026-11-06T17:00:00.000Z",
  optionsSentAt: null,
  contractorDeadlineAt: null,
  otherNamesUsed: 0,
  otherNamesMax: 2,
  closedAt: null,
  closedReason: null,
  closedByKind: null,
  waitlistBuiltAt: null,
  waitlistEndedAt: null,
  ...over,
});

const person = (over: Partial<AdminSelectionPerson>): AdminSelectionPerson => ({
  candidacyId: "c1",
  position: 1,
  batch: 1,
  name: "Ana",
  rankReason: null,
  workedHereCount: 0,
  situation: "ASKED",
  reservePosition: null,
  waitlistPosition: null,
  answer: null,
  askedAt: "2026-11-06T16:00:00.000Z",
  answerDeadlineAt: "2026-11-06T17:00:00.000Z",
  answeredAt: null,
  answeredVia: null,
  ...over,
});

describe("selection-round-presentation (fatia E)", () => {
  it("prazo como nas mensagens: dia da semana e hora de Brasília", () => {
    expect(weekdayHour("2026-11-06T17:00:00.000Z")).toBe("sex 14h");
    expect(weekdayHour("2026-11-07T20:45:00.000Z")).toBe("sáb 17h45");
    expect(weekdayHour(null)).toBe("—");
  });

  it("a linha dos prazos (designer §5.6): sem o prazo da empresa antes das opções", () => {
    expect(deadlinesLine(round())).toBe("Disponibilidade até sex 14h · Outros nomes: 0 de 2");
    expect(
      deadlinesLine(round({ contractorDeadlineAt: "2026-11-06T19:00:00.000Z", otherNamesUsed: 1 })),
    ).toBe("Disponibilidade até sex 14h · Empresa até sex 16h · Outros nomes: 1 de 2");
  });

  it("a etapa e, encerrada, o motivo e quem", () => {
    expect(stageLine(round())).toBe("Esperando as respostas");
    expect(
      stageLine(
        round({
          stage: "contratante_escolheu",
          phase: "CLOSED",
          closedReason: "ACCEPTED_OUTSIDE",
          closedByKind: "ADMIN",
        }),
      ),
    ).toBe("O suporte escolheu alguém de fora da rodada");
    expect(
      stageLine(round({ stage: "sem_disponiveis", phase: "CLOSED", closedReason: "NO_ONE_AVAILABLE", closedByKind: "SYSTEM" })),
    ).toBe("Ninguém confirmou a tempo");
  });

  it("lote 3: a frase de quem escolheu sem repetir (QA de 04/11, achado 12) e os motivos novos", () => {
    const closed = (closedReason: AdminSelectionRound["closedReason"], closedByKind: AdminSelectionRound["closedByKind"]) =>
      stageLine(round({ stage: "contratante_escolheu", phase: "CLOSED", closedReason, closedByKind }));
    expect(closed("ACCEPTED_IN_ROUND", "CONTRACTOR")).toBe("A empresa escolheu alguém da rodada");
    expect(closed("ACCEPTED_IN_ROUND", "SYSTEM")).toBe("Foi escolhido alguém da rodada");
    expect(closed("VACANCY_CANCELLED", "SYSTEM")).toBe("Encerrada: a vaga foi cancelada");
    expect(closed("SCHEDULE_CHANGED", "SYSTEM")).toBe(
      "Encerrada: o horário da vaga mudou (quem confirmou foi liberado)",
    );
    expect(closed("STOPPED", "SYSTEM")).toBe("Encerrada pelo suporte (piloto parado)");
  });

  it("lote 3, item 14: erro visível só quando a rodada vale para a vaga", () => {
    const axiosError = (status: number) => {
      const headers = new AxiosHeaders();
      return new AxiosError("x", "ERR", { headers }, null, {
        status,
        statusText: "x",
        data: {},
        headers,
        config: { headers },
      });
    };
    // Revisão D1: só com uma rodada de verdade já carregada.
    expect(selectionLoadErrorVisible({ roundLoaded: false, error: axiosError(404) })).toBe(false);
    expect(selectionLoadErrorVisible({ roundLoaded: true, error: axiosError(404) })).toBe(false);
    expect(selectionLoadErrorVisible({ roundLoaded: false, error: axiosError(502) })).toBe(false);
    expect(selectionLoadErrorVisible({ roundLoaded: false, error: new Error("rede") })).toBe(false);
    expect(selectionLoadErrorVisible({ roundLoaded: true, error: axiosError(500) })).toBe(true);
    expect(selectionLoadErrorVisible({ roundLoaded: true, error: new Error("rede") })).toBe(true);
  });

  it("a situação de cada pessoa", () => {
    expect(situationLabel(person({ situation: "ASKED" }))).toBe("Perguntado");
    expect(situationLabel(person({ situation: "AVAILABLE" }))).toBe("Disponível");
    expect(situationLabel(person({ situation: "NOT_AVAILABLE" }))).toBe("Não pode");
    expect(situationLabel(person({ situation: "NO_RESPONSE" }))).toBe("Sem resposta");
    expect(situationLabel(person({ situation: "SENT_TO_CONTRACTOR" }))).toBe("Enviado à empresa");
    expect(situationLabel(person({ situation: "WORKING" }))).toBe("Vai trabalhar");
    expect(situationLabel(person({ situation: "RESERVE", reservePosition: 2 }))).toBe("Suplente 2");
    expect(situationLabel(person({ situation: "WAITLIST", waitlistPosition: 3 }))).toBe(
      "Fila de espera nº 3",
    );
    expect(situationLabel(person({ situation: "DECLINED_BY_CONTRACTOR" }))).toBe(
      "Trocado por outros nomes",
    );
    expect(situationLabel(person({ situation: "LEFT_WAITLIST" }))).toBe("Saiu da fila de espera");
    // Lote 3: quem foi suplente e o "Não chegou" (antes "Saiu da vaga").
    expect(situationLabel(person({ situation: "LEFT_RESERVES" }))).toBe("Saiu da fila de suplentes");
    expect(situationLabel(person({ situation: "RESERVE_ENDED" }))).toBe("Não é mais suplente");
    expect(situationLabel(person({ situation: "NOT_ARRIVED" }))).toBe("Não chegou");
    expect(situationLabel(person({ situation: "RELEASED" }))).toBe("Liberado");
  });

  it("o motivo da posição por escrito (nunca a nota)", () => {
    expect(reasonLabel(person({ rankReason: "WORKED_HERE", workedHereCount: 1 }))).toBe(
      "Já trabalhou aqui: 1 turno",
    );
    expect(reasonLabel(person({ rankReason: "WORKED_HERE", workedHereCount: 3 }))).toBe(
      "Já trabalhou aqui: 3 turnos",
    );
    expect(reasonLabel(person({ rankReason: "APPLIED_FIRST", batch: 2 }))).toBe(
      "Candidatou-se antes (outros nomes)",
    );
    expect(reasonLabel(person({ rankReason: null }))).toBe("—");
  });
});

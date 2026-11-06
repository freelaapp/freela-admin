import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import {
  adminHurryTrigger,
  canReleaseList,
  chooseBillingLine,
  chooseConfirmLabel,
  chooseErrorMessage,
  chooseSuccessText,
  choiceReserveIds,
  defaultHurryMinutes,
  EMPTY_CHOICE,
  hourLabel,
  hurryErrorMessage,
  isTransientError,
  nextFreeSlot,
  payWayOf,
  pruneChoice,
  reconcileChoice,
  toggleChoice,
  clockLabel,
  companyViewCard,
  deadlinesLine,
  releaseErrorMessage,
  releaseNoteProblem,
  reasonLabel,
  selectionLoadErrorVisible,
  situationLabel,
  stageLine,
  weekdayHour,
} from "./selection-round-presentation";
import type {
  AdminCompanyView,
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

describe("A empresa vê (pré-seleção curada)", () => {
  // Sex 06/11/2026, 07h em Brasília.
  const NOW = new Date("2026-11-06T10:00:00.000Z");
  const view = (over: Partial<AdminCompanyView> = {}): AdminCompanyView => ({
    mode: "HIDDEN",
    curated: true,
    stage: "RECEIVING",
    optionsBy: "2026-11-06T17:00:00.000Z",
    reason: null,
    releasedAt: null,
    applicants: 8,
    asked: null,
    options: 0,
    listReleasedByKind: null,
    listReleaseNote: null,
    openTrigger: null,
    ...over,
  });

  it("hora: hoje às, amanhã às, ou o dia da semana", () => {
    expect(clockLabel("2026-11-06T17:00:00.000Z", NOW)).toBe("hoje às 14h");
    expect(clockLabel("2026-11-07T12:30:00.000Z", NOW)).toBe("amanhã às 9h30");
    expect(clockLabel("2026-11-09T17:00:00.000Z", NOW)).toBe("seg 14h");
    expect(clockLabel(null, NOW)).toBe("—");
  });

  it("sem companyView: nada", () => {
    expect(companyViewCard(null, NOW)).toBeNull();
    expect(companyViewCard(undefined, NOW)).toBeNull();
  });

  it("escondida: Estamos selecionando + hora prometida", () => {
    const card = companyViewCard(view(), NOW);
    expect(card?.headline).toBe('A empresa vê "Estamos selecionando" · opções até hoje às 14h');
    expect(card?.rows).toEqual([{ label: "Hora prometida", value: "opções até hoje às 14h" }]);
  });

  it("opções, opções em primeiro, lista toda, ninguém se candidatou, sem curadoria", () => {
    expect(companyViewCard(view({ mode: "OPTIONS_ONLY", options: 3 }), NOW)?.headline).toBe(
      "A empresa vê só as 3 opções (sem a lista de candidatos)",
    );
    expect(companyViewCard(view({ mode: "OPTIONS_FIRST", options: 2, reason: "FEWER_CONFIRMED" }), NOW)?.headline).toBe(
      "A empresa vê as 2 que confirmaram + a lista com os outros candidatos",
    );
    expect(companyViewCard(view({ mode: "FULL", reason: "NO_ONE_CONFIRMED" }), NOW)?.headline).toBe(
      "A empresa vê a lista toda de candidatos",
    );
    expect(companyViewCard(view({ mode: "FULL", reason: "NO_CANDIDATES" }), NOW)?.headline).toContain("Ninguém se candidatou");
    expect(companyViewCard(view({ curated: false, mode: "FULL", reason: "DISABLED" }), NOW)?.headline).toContain("sem pré-seleção");
  });

  it("liberada: hora, motivo, quem, nota e gatilho", () => {
    const card = companyViewCard(
      view({
        mode: "FULL",
        reason: "ADMIN",
        releasedAt: "2026-11-06T16:50:00.000Z",
        listReleasedByKind: "ADMIN",
        listReleaseNote: "Pedido do dono.",
        openTrigger: "LIST_RELEASED",
      }),
      NOW,
    );
    expect(card?.rows.map((r) => `${r.label}: ${r.value}`)).toEqual([
      "Hora prometida: opções até hoje às 14h",
      "Lista liberada: hoje às 13h50",
      "Motivo da liberação: liberada pelo suporte",
      "Quem liberou: pelo suporte",
      "Nota da liberação: Pedido do dono.",
      "Como abriu: o suporte liberou a lista",
    ]);
  });

  it("o botão só com a lista escondida", () => {
    expect(canReleaseList(view())).toBe(true);
    expect(canReleaseList(view({ mode: "OPTIONS_ONLY", options: 3 }))).toBe(true);
    expect(canReleaseList(view({ mode: "OPTIONS_FIRST" }))).toBe(false);
    expect(canReleaseList(view({ mode: "FULL" }))).toBe(false);
    expect(canReleaseList(view({ curated: false }))).toBe(false);
    expect(canReleaseList(null)).toBe(false);
  });

  it("nota: obrigatória e até 500", () => {
    expect(releaseNoteProblem("   ")).toMatch(/Escreva/);
    expect(releaseNoteProblem("x".repeat(501))).toMatch(/500/);
    expect(releaseNoteProblem("x".repeat(500))).toBeNull();
  });

  it("erros em português; erro de rede = mensagem geral", () => {
    expect(releaseErrorMessage(new Error("rede"))).toBe("Não foi possível liberar a lista. Tente de novo.");
  });
});

// ---------------------------------------------------------------------------------------------
// "Selecionar agora" e "Escolher titular e suplentes" (05/11 noite)
// ---------------------------------------------------------------------------------------------

function apiErr(status: number, code: string | null, message: string | null) {
  const headers = new AxiosHeaders();
  return new AxiosError("x", "ERR_BAD_REQUEST", { headers }, null, {
    status,
    statusText: "x",
    data: { error: { ...(code ? { code } : {}), ...(message ? { message } : {}) } },
    headers,
    config: { headers },
  });
}

describe("'Como abriu' com o suporte adiantando", () => {
  const hurried = round({
    windowClosedAt: "2026-11-05T22:58:00.000Z", // 19h58 em Brasília
    openTrigger: "ADMIN_HURRY",
    openedBy: { id: "u1", name: "Denner", email: "d@x.com" },
    openNote: "A empresa ligou com pressa",
    availabilityMinutes: 20,
  });

  it("hora de Brasília", () => {
    expect(hourLabel("2026-11-05T22:58:00.000Z")).toBe("19h58");
    expect(hourLabel("2026-11-05T23:00:00.000Z")).toBe("20h");
    expect(hourLabel(null)).toBe("—");
  });

  it("diz quem, a hora e o prazo; a nota vai em 'Nota'", () => {
    expect(adminHurryTrigger(hurried)).toBe("o suporte adiantou (Denner, 19h58, 20 min)");
    const card = companyViewCard(
      {
        mode: "HIDDEN",
        curated: true,
        stage: "ASKING",
        optionsBy: "2026-11-06T00:20:00.000Z",
        reason: null,
        releasedAt: null,
        applicants: 17,
        asked: 10,
        options: 0,
        listReleasedByKind: null,
        listReleaseNote: null,
        openTrigger: "ADMIN_HURRY",
      },
      new Date("2026-11-05T22:59:00.000Z"),
      hurried,
    );
    expect(card?.rows).toContainEqual({
      label: "Como abriu",
      value: "o suporte adiantou (Denner, 19h58, 20 min)",
    });
    expect(card?.rows).toContainEqual({ label: "Nota", value: "A empresa ligou com pressa" });
  });

  it("sem os dados da rodada: só 'o suporte adiantou'", () => {
    expect(adminHurryTrigger(null)).toBe("o suporte adiantou");
  });
});

describe("tempo que já vem marcado", () => {
  const opt = (minutes: 10 | 20 | 45, allowed: boolean) => ({
    minutes,
    allowed,
    reason: null,
    answersBy: "",
    optionsBy: "",
  });
  it("20 min quando pode; senão o maior permitido; nenhum = null", () => {
    expect(defaultHurryMinutes([opt(10, true), opt(20, true), opt(45, true)])).toBe(20);
    expect(defaultHurryMinutes([opt(10, true), opt(20, false), opt(45, false)])).toBe(10);
    expect(defaultHurryMinutes([opt(10, true), opt(20, false), opt(45, true)])).toBe(45);
    expect(defaultHurryMinutes([opt(10, false), opt(20, false), opt(45, false)])).toBeNull();
    expect(defaultHurryMinutes([])).toBeNull();
  });
});

describe("erros do 'Selecionar agora' e do 'Escolher'", () => {
  it("mostra a message da API; sem ela, o texto do código; rede, o texto de rede", () => {
    expect(hurryErrorMessage(apiErr(422, "SELECTION_HURRY_NO_TIME", "Pronta. Nada mudou."))).toBe("Pronta. Nada mudou.");
    expect(hurryErrorMessage(apiErr(422, "SELECTION_HURRY_NO_CANDIDATES", null))).toBe(
      "Ninguém se candidatou a esta vaga ainda. Nada mudou.",
    );
    expect(hurryErrorMessage(apiErr(404, "VACANCY_NOT_FOUND", null))).toBe("Vaga não encontrada.");
    expect(hurryErrorMessage(new Error("x"))).toContain("Não conseguimos falar com o servidor");
    expect(chooseErrorMessage(apiErr(409, "CANDIDACY_NOT_PENDING", "Maria saiu. Nada foi aprovado."))).toBe(
      "Maria saiu. Nada foi aprovado.",
    );
    expect(chooseErrorMessage(apiErr(422, "RESERVES_TOO_MANY", null))).toContain("até 2 suplentes");
    expect(chooseErrorMessage(new Error("x"))).toContain("Não sabemos se deu certo");
  });

  it("erro transitório = rede ou 5xx", () => {
    expect(isTransientError(new Error("x"))).toBe(true);
    expect(isTransientError(apiErr(502, null, null))).toBe(true);
    expect(isTransientError(apiErr(422, "X", null))).toBe(false);
  });
});

describe("marcação do titular e dos suplentes", () => {
  it("ocupa o primeiro lugar vazio: titular, suplente 1, suplente 2; o 4º não entra", () => {
    let sel = toggleChoice(EMPTY_CHOICE, "a");
    sel = toggleChoice(sel, "b");
    sel = toggleChoice(sel, "c");
    expect(sel).toEqual({ principal: "a", reserves: ["b", "c"] });
    expect(toggleChoice(sel, "d")).toEqual(sel);
    expect(nextFreeSlot(sel)).toBeNull();
    expect(choiceReserveIds(sel)).toEqual(["b", "c"]);
  });

  it("desmarcar deixa o lugar vazio: ninguém sobe", () => {
    const sel = toggleChoice({ principal: "a", reserves: ["b", "c"] }, "a");
    expect(sel).toEqual({ principal: null, reserves: ["b", "c"] });
    // O próximo toque preenche o lugar de titular.
    expect(toggleChoice(sel, "d")).toEqual({ principal: "d", reserves: ["b", "c"] });
    // Tirar o suplente 1 deixa o 2 onde está; o próximo ocupa o 1.
    const sel2 = toggleChoice({ principal: "a", reserves: ["b", "c"] }, "b");
    expect(sel2).toEqual({ principal: "a", reserves: [null, "c"] });
    expect(choiceReserveIds(sel2)).toEqual(["c"]);
    expect(toggleChoice(sel2, "d")).toEqual({ principal: "a", reserves: ["d", "c"] });
  });

  it("quem não pode ser suplente só entra de titular; maxReserves limita os lugares", () => {
    const cheioDeTitular = { principal: "a", reserves: [null, null] as [null, null] };
    expect(toggleChoice(cheioDeTitular, "x", { canBeReserve: false })).toEqual(cheioDeTitular);
    expect(toggleChoice(EMPTY_CHOICE, "x", { canBeReserve: false })).toEqual({ principal: "x", reserves: [null, null] });
    expect(toggleChoice({ principal: "a", reserves: ["b", null] }, "c", { maxReserves: 1 })).toEqual({
      principal: "a",
      reserves: ["b", null],
    });
    expect(nextFreeSlot({ principal: "a", reserves: ["b", null] }, 1)).toBeNull();
  });

  it("pruneChoice tira quem saiu da lista", () => {
    expect(pruneChoice({ principal: "a", reserves: ["b", "c"] }, new Set(["a", "c"]))).toEqual({
      principal: "a",
      reserves: [null, "c"],
    });
  });
});

describe("textos da confirmação pelo jeito de pagar", () => {
  it("PREPAID e ausente = Pix só para PREPAID; INVOICED_* = fatura; ausente = neutro", () => {
    expect(payWayOf("PREPAID")).toBe("PIX");
    expect(payWayOf("INVOICED_15")).toBe("INVOICE");
    expect(payWayOf(undefined)).toBe("UNKNOWN");
    expect(chooseConfirmLabel("INVOICE")).toBe("Aprovar e lançar na fatura");
    expect(chooseConfirmLabel("PIX")).toBe("Aprovar e pedir o Pix");
    expect(chooseConfirmLabel("UNKNOWN")).toBe("Aprovar");
    expect(chooseBillingLine("INVOICE", "Bar", "R$ 160,00", "Ana")).toContain("entra agora na fatura da Bar");
    expect(chooseBillingLine("PIX", "Bar", "R$ 160,00", "Ana")).toContain("por Pix");
  });

  it("sucesso conforme o billing da API", () => {
    const base = { principalName: "Ana", reserveNames: ["João", "Maria"], autoFill: true };
    expect(chooseSuccessText({ ...base, billing: "INVOICE" })).toBe(
      "Ana vai trabalhar. Suplentes: 1 João, 2 Maria. Valor lançado na fatura.",
    );
    expect(chooseSuccessText({ ...base, billing: "AWAITING_PAYMENT" })).toBe(
      "Ana aprovado(a). Suplentes: 1 João, 2 Maria. A empresa recebeu o pedido de pagamento.",
    );
    expect(chooseSuccessText({ ...base, reserveNames: [], billing: "ALREADY_PAID" })).toBe(
      "Ana vai trabalhar. Os suplentes, o sistema escolhe depois do pagamento.",
    );
  });
});

describe("reconcileChoice: o que vai no POST é o que a tela mostra", () => {
  const pend = new Set(["a", "b", "c"]);
  it("tira suplente fora da lista de suplentes e acima de maxReserves", () => {
    const sel = { principal: "a", reserves: ["b", "c"] as [string, string] };
    expect(reconcileChoice(sel, pend, new Set(["b", "c"]), 2)).toEqual(sel);
    expect(reconcileChoice(sel, pend, new Set(["c"]), 2)).toEqual({ principal: "a", reserves: [null, "c"] });
    expect(reconcileChoice(sel, pend, new Set(["b", "c"]), 1)).toEqual({ principal: "a", reserves: ["b", null] });
    expect(reconcileChoice(sel, new Set(["b", "c"]), new Set(["b", "c"]), 2).principal).toBeNull();
  });
});

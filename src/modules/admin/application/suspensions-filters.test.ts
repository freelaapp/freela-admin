import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  apiFilterOf,
  applySuspensionFilters,
  clearFilters,
  contestText,
  conversationDetail,
  countText,
  createdByText,
  emptyText,
  hasActiveFilters,
  liftedText,
  matchesPeriod,
  matchesReason,
  matchesSearch,
  matchesSituation,
  occurrenceText,
  spDayStart,
  suspensionIdFromSearch,
  vacancyHref,
  vacancyText,
} from "./suspensions-presentation";
import { suspensionItem } from "./suspensions.test-fixtures";

/** D5, fatia A1: filtros, ordem, contador e detalhe da tela Suspensões (tudo no navegador). */
describe("Suspensões — filtros e detalhe (D5, fatia A1)", () => {
  it("situação: as três 'Valendo…' pedem active; o resto pede all", () => {
    expect(apiFilterOf("active")).toBe("active");
    expect(apiFilterOf("active_pending")).toBe("active");
    expect(apiFilterOf("active_overdue")).toBe("active");
    expect(apiFilterOf("ended")).toBe("all");
    expect(apiFilterOf("lifted")).toBe("all");
    expect(apiFilterOf("all")).toBe("all");
  });

  it("situação: pendente, atrasada, cumprida e levantada", () => {
    const pending = suspensionItem();
    const done = suspensionItem({ conversationAt: "2026-11-10T15:00:00.000Z" });
    const overdue = suspensionItem({ conversationOverdue: true });
    expect(matchesSituation(pending, "active_pending")).toBe(true);
    expect(matchesSituation(done, "active_pending")).toBe(false);
    expect(matchesSituation(overdue, "active_overdue")).toBe(true);
    // API antiga, sem o campo: não entra em "atrasada".
    expect(matchesSituation(pending, "active_overdue")).toBe(false);
    expect(matchesSituation(suspensionItem({ state: "ENDED" }), "ended")).toBe(true);
    expect(matchesSituation(suspensionItem({ state: "ENDED" }), "active")).toBe(false);
    expect(matchesSituation(suspensionItem({ state: "LIFTED" }), "lifted")).toBe(true);
    expect(matchesSituation(suspensionItem({ state: "LIFTED" }), "all")).toBe(true);
  });

  it("motivo: falta, desistência e feita pelo suporte", () => {
    expect(matchesReason({ reasonKey: "NO_SHOW_REPEAT" }, "no_show")).toBe(true);
    expect(matchesReason({ reasonKey: "LATE_WITHDRAWAL_FIRST_SHIFT" }, "no_show")).toBe(false);
    expect(matchesReason({ reasonKey: "LATE_WITHDRAWAL_REPEAT" }, "late_withdrawal")).toBe(true);
    expect(matchesReason({ reasonKey: "MANUAL" }, "manual")).toBe(true);
    expect(matchesReason({ reasonKey: "NO_SHOW" }, "manual")).toBe(false);
    expect(matchesReason({ reasonKey: "MANUAL" }, "all")).toBe(true);
  });

  it("busca: nome sem acento, e-mail e pedaço do telefone", () => {
    const item = suspensionItem({
      person: { providerGlobalId: "g", name: "Ána Sóuza", email: "ana@x.test", phone: "+55 11 98888-7777" },
    });
    expect(matchesSearch(item, "ana souza")).toBe(true);
    expect(matchesSearch(item, "ANA@X")).toBe(true);
    expect(matchesSearch(item, "98888")).toBe(true);
    expect(matchesSearch(item, "11 9888")).toBe(true);
    expect(matchesSearch(item, "Caio")).toBe(false);
    // Dois dígitos não bastam para casar telefone (evita casar tudo).
    expect(matchesSearch(item, "77")).toBe(false);
    expect(matchesSearch(item, "  ")).toBe(true);
  });

  it("começou em: o dia é o de Brasília, também perto da meia-noite", () => {
    // 18/11 às 00h30 em Brasília = 03h30 UTC.
    const now = new Date("2026-11-18T03:30:00.000Z");
    expect(spDayStart(now).toISOString()).toBe("2026-11-18T03:00:00.000Z");
    // 17/11 às 23h50 em Brasília (já é 18/11 em UTC): ainda é 17/11.
    expect(spDayStart(new Date("2026-11-18T02:50:00.000Z")).toISOString()).toBe(
      "2026-11-17T03:00:00.000Z",
    );
    const at = (startsAt: string) => ({ startsAt });
    expect(matchesPeriod(at("2026-11-18T03:00:00.000Z"), "today", now)).toBe(true);
    expect(matchesPeriod(at("2026-11-18T02:59:00.000Z"), "today", now)).toBe(false);
    // 7 dias contando hoje: de 12/11 (00h de Brasília) em diante.
    expect(matchesPeriod(at("2026-11-12T03:00:00.000Z"), "7d", now)).toBe(true);
    expect(matchesPeriod(at("2026-11-12T02:59:00.000Z"), "7d", now)).toBe(false);
    expect(matchesPeriod(at("2026-10-20T03:00:00.000Z"), "30d", now)).toBe(true);
    expect(matchesPeriod(at("2026-10-19T03:00:00.000Z"), "30d", now)).toBe(false);
    expect(matchesPeriod(at("2020-01-01T00:00:00.000Z"), "any", now)).toBe(true);
  });

  it("ordem: 'conversa pendente primeiro' mantém a da API; 'mais recentes' ordena pelo início", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const a = suspensionItem({ id: "a", startsAt: "2026-11-01T12:00:00.000Z" });
    const b = suspensionItem({ id: "b", startsAt: "2026-11-15T12:00:00.000Z" });
    const c = suspensionItem({ id: "c", startsAt: "2026-11-10T12:00:00.000Z" });
    const ids = (order: "pending_first" | "newest") =>
      applySuspensionFilters([a, b, c], { ...DEFAULT_FILTERS, order }, now).map((i) => i.id);
    expect(ids("pending_first")).toEqual(["a", "b", "c"]);
    expect(ids("newest")).toEqual(["b", "c", "a"]);
  });

  it("filtros juntos, contador e textos do vazio", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const items = [
      suspensionItem({ id: "1" }),
      suspensionItem({ id: "2", reasonKey: "MANUAL", source: null, vacancy: null, createdByKind: "ADMIN" }),
    ];
    const out = applySuspensionFilters(items, { ...DEFAULT_FILTERS, reason: "manual" }, now);
    expect(out.map((i) => i.id)).toEqual(["2"]);
    expect(countText(1, 2)).toBe("Mostrando 1 de 2 suspensões carregadas.");
    expect(countText(1, 1)).toBe("Mostrando 1 de 1 suspensão carregada.");
    expect(emptyText("active", 0)).toBe("Ninguém está sem poder se candidatar agora.");
    expect(emptyText("lifted", 0)).toBe("Nenhuma suspensão registrada ainda.");
    expect(emptyText("active_pending", 40)).toBe(
      "Nenhuma suspensão com esses filtros entre as 40 carregadas.",
    );
  });

  it("limpar filtros: volta à base da situação e mantém a ordem", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, situation: "all" })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, order: "newest" })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "ana" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, situation: "ended" })).toBe(true);
    expect(
      clearFilters({
        situation: "ended",
        q: "ana",
        period: "7d",
        reason: "manual",
        order: "newest",
        company: "u-coco",
        city: "Osasco|SP",
      }),
    ).toEqual({ ...DEFAULT_FILTERS, situation: "all", order: "newest" });
    expect(clearFilters({ ...DEFAULT_FILTERS, situation: "active_overdue" }).situation).toBe("active");
  });

  it("?s=<id> do detalhe", () => {
    expect(suspensionIdFromSearch("?s=susp-1")).toBe("susp-1");
    expect(suspensionIdFromSearch("?s=<script>")).toBeNull();
    expect(suspensionIdFromSearch("")).toBeNull();
  });

  it("detalhe: por quê, ocorrência, contestação, conversa, levantada e vaga", () => {
    const item = suspensionItem();
    expect(createdByText(item)).toBe("Automática, pela regra de faltas e desistências");
    expect(createdByText({ createdByKind: "ADMIN", manualReason: "Briga na loja" })).toBe(
      "Feita pelo suporte: “Briga na loja”",
    );
    expect(occurrenceText(item)).toBe("Falta sem aviso, registrada em sáb 07/11 às 18h");
    expect(occurrenceText({ ...item, reasonKey: "LATE_WITHDRAWAL_REPEAT" })).toMatch(
      /^Desistência em cima da hora/,
    );
    expect(occurrenceText({ ...item, source: null })).toBeNull();

    expect(contestText(item)).toBe("Pode contestar até ter 10/11 às 18h");
    const src = item.source!;
    expect(
      contestText({
        source: {
          ...src,
          status: "CONTESTED",
          contestedAt: "2026-11-09T15:00:00.000Z",
          contestReason: "EMERGENCY",
          justification: "Fiquei doente.",
          contest: { status: "SENT", until: null },
        },
      }),
    ).toBe("Contestou em seg 09/11. Motivo: Emergência. “Fiquei doente.”");
    expect(contestText({ source: { ...src, status: "RESOLVED", contestedAt: "2026-11-09T15:00:00.000Z" } })).toBe(
      "Contestação negada",
    );
    expect(contestText({ source: { ...src, contest: { status: "CLOSED", until: src.contest.until } } })).toBe(
      "Prazo encerrado sem contestação",
    );
    expect(contestText({ source: { ...src, status: "ANNULLED" } })).toBe("Ocorrência anulada: os pontos voltaram.");
    expect(contestText({ source: null })).toBeNull();

    expect(conversationDetail(item)).toBe("Pendente");
    expect(conversationDetail({ ...item, conversationOverdue: true })).toBe(
      "Atrasada: a data de volta passou e ninguém registrou a conversa",
    );
    expect(conversationDetail({ ...item, endsAt: null, conversationOverdue: true })).toBe(
      "Atrasada: passaram 48 horas e ninguém registrou a conversa",
    );
    expect(
      conversationDetail({ ...item, conversationAt: "2026-11-10T15:00:00.000Z", conversationNote: "Vai avisar." }),
    ).toBe("Feita em 10/11: “Vai avisar.”");
    expect(conversationDetail({ ...item, requiresConversation: false })).toBe("Não exigida");

    expect(liftedText(item)).toBeNull();
    expect(
      liftedText({ liftedAt: "2026-11-11T15:00:00.000Z", liftedReason: "SYSTEM_ERROR", liftedNote: "Bug do F1." }),
    ).toBe("Levantada em 11/11. Motivo: Erro do sistema. “Bug do F1.”");

    expect(vacancyText(item)).toBe("Garçom · sáb 07/11, 18h");
    expect(vacancyText({ vacancy: null })).toBeNull();
    expect(vacancyHref("v1")).toBe("/jobs?vaga=v1");
  });
});

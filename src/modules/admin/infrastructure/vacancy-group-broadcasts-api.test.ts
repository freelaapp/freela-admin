import { describe, expect, it } from "vitest";

import {
  apiErrorCode,
  isRouteMissingError,
  parseGroupBroadcastPreview,
  parseOutreachGroupBroadcast,
  parseResendGroupResult,
  parseVacancyGroupBroadcasts,
} from "./vacancy-group-broadcasts-api";

const DESTINO = {
  groupJid: "120@g.us",
  groupName: "Vagas Freela Campinas SP",
  city: "Campinas",
  uf: "SP",
  distanceKm: 4.2,
  reason: "VACANCY_CITY",
  status: "SENT",
  sentAt: "2026-10-14T13:40:00.000Z",
  errorCode: null,
  error: null,
};

const RESUMO = {
  total: 1,
  sent: 1,
  failedCount: 0,
  failed: [],
  skipped: 0,
  pending: 0,
  ownCity: 1,
  inRadius: 0,
  fallback: 0,
  vip: 0,
};

function rodada(over: Record<string, unknown> = {}) {
  return {
    roundId: "auto:v1",
    origin: "auto",
    mode: "AUTO",
    requestedByAdminId: null,
    createdAt: "2026-10-14T12:12:00.000Z",
    radiusKm: 30,
    centerSource: "VACANCY",
    summary: RESUMO,
    destinations: [DESTINO],
    ...over,
  };
}

function axiosErro(status: number, code?: string) {
  return {
    isAxiosError: true,
    response: { status, data: code ? { error: { code, message: "x" } } : {} },
  };
}

describe("parseVacancyGroupBroadcasts (contrato final)", () => {
  it("lê o topo e as rodadas, a mais nova primeiro", () => {
    const data = parseVacancyGroupBroadcasts({
      radiusKm: 30,
      groupBroadcastAt: "2026-10-14T13:40:00.000Z",
      inFlight: 0,
      canResend: true,
      resendBlockedReason: null,
      rounds: [
        rodada(),
        rodada({ roundId: "r2", origin: "manual", mode: "MANUAL", requestedByAdminId: "adm-1", createdAt: "2026-10-14T13:40:00.000Z" }),
      ],
    });
    expect(data).toMatchObject({
      radiusKm: 30,
      groupBroadcastAt: "2026-10-14T13:40:00.000Z",
      inFlight: 0,
      canResend: true,
      resendBlockedReason: null,
    });
    expect(data.rounds.map((r) => r.roundId)).toEqual(["r2", "auto:v1"]);
    expect(data.rounds[0]).toMatchObject({ mode: "MANUAL", radiusKm: 30, centerSource: "VACANCY", summary: RESUMO });
    expect(data.rounds[0].destinations[0]).toEqual(DESTINO);
  });

  it("o motivo da falha vem de `error` (e aceita o nome antigo `errorMessage`)", () => {
    const data = parseVacancyGroupBroadcasts({
      rounds: [
        rodada({
          destinations: [
            { ...DESTINO, status: "FAILED", errorCode: "FALHA_NO_ENVIO", error: "O bot não está no grupo." },
            { ...DESTINO, groupJid: "2", status: "FAILED", error: undefined, errorMessage: "Sem bot" },
          ],
        }),
      ],
    });
    expect(data.rounds[0].destinations.map((d) => d.error)).toEqual(["O bot não está no grupo.", "Sem bot"]);
    expect(data.rounds[0].destinations[0].errorCode).toBe("FALHA_NO_ENVIO");
  });

  it("sem localização: centerSource nulo na rodada", () => {
    expect(parseVacancyGroupBroadcasts({ rounds: [rodada({ centerSource: null })] }).rounds[0].centerSource).toBeNull();
  });

  it("bloqueio do reenvio", () => {
    expect(
      parseVacancyGroupBroadcasts({ canResend: false, resendBlockedReason: "Só dá para divulgar vaga aberta.", rounds: [] }),
    ).toMatchObject({ canResend: false, resendBlockedReason: "Só dá para divulgar vaga aberta." });
  });

  it("tolerante: enum novo vira UNKNOWN, campo que falta vira nulo, resumo é calculado", () => {
    const data = parseVacancyGroupBroadcasts({
      radiusKm: 30,
      rounds: [
        {
          roundId: "r1",
          mode: "manual",
          createdAt: "2026-10-14T13:40:00.000Z",
          centerSource: "OUTRA_COISA",
          destinations: [
            { groupName: "Vagas Freela Vinhedo SP", reason: "NOVO_MOTIVO", status: "failed", error: "Sem bot" },
            { groupName: "Vagas Freela Campinas SP", reason: "VACANCY_CITY", status: "SENT" },
            { groupName: "Reserva", reason: "FALLBACK", status: "SKIPPED" },
            "lixo",
          ],
        },
      ],
    });
    expect(data).toMatchObject({ groupBroadcastAt: null, inFlight: 0, canResend: true, resendBlockedReason: null });
    const r = data.rounds[0];
    expect(r.mode).toBe("MANUAL");
    expect(r.centerSource).toBeNull();
    expect(r.radiusKm).toBe(0);
    expect(r.destinations).toHaveLength(3);
    expect(r.destinations[0]).toMatchObject({
      groupJid: "",
      city: null,
      distanceKm: null,
      reason: "UNKNOWN",
      status: "FAILED",
      error: "Sem bot",
      sentAt: null,
    });
    expect(r.summary).toEqual({
      total: 2,
      sent: 1,
      failedCount: 1,
      failed: [{ groupName: "Vagas Freela Vinhedo SP", errorMessage: "Sem bot" }],
      skipped: 1,
      pending: 0,
      ownCity: 1,
      inRadius: 0,
      fallback: 0,
      vip: 0,
    });
  });

  it("resposta vazia não quebra", () => {
    expect(parseVacancyGroupBroadcasts(undefined)).toEqual({
      radiusKm: 0,
      groupBroadcastAt: null,
      inFlight: 0,
      canResend: true,
      resendBlockedReason: null,
      rounds: [],
    });
  });
});

describe("parseGroupBroadcastPreview", () => {
  it("lê cidade da vaga, centro, grupos e os que ficam de fora pelo teto", () => {
    const p = parseGroupBroadcastPreview({
      radiusKm: 30,
      vacancyCity: "Gramado",
      vacancyUf: "RS",
      center: { source: "CITY_SEAT", latitude: -29.37, longitude: -50.87 },
      ownCityHasGroup: false,
      fallbackUsed: false,
      destinations: [{ groupJid: "1@g.us", groupName: "Vagas Freela Canela RS", city: "Canela", uf: "RS", distanceKm: 7.9, reason: "RADIUS" }],
      skipped: [{ groupJid: "2@g.us", groupName: "Vagas Freela Caxias RS", city: "Caxias do Sul", uf: "RS", distanceKm: 28, reason: "RADIUS" }],
      canResend: false,
      resendBlockedReason: "Só dá para divulgar vaga aberta.",
    });
    expect(p).toMatchObject({
      radiusKm: 30,
      vacancyCity: "Gramado",
      vacancyUf: "RS",
      centerSource: "CITY_SEAT",
      ownCityHasGroup: false,
      fallbackUsed: false,
      canResend: false,
      resendBlockedReason: "Só dá para divulgar vaga aberta.",
    });
    expect(p.destinations).toEqual([
      { groupJid: "1@g.us", groupName: "Vagas Freela Canela RS", city: "Canela", uf: "RS", distanceKm: 7.9, reason: "RADIUS" },
    ]);
    expect(p.skipped[0]).toMatchObject({ groupName: "Vagas Freela Caxias RS", reason: "RADIUS" });
  });

  it("campos ausentes: não bloqueia e não acusa falta de grupo", () => {
    expect(parseGroupBroadcastPreview({ radiusKm: 30, destinations: [] })).toMatchObject({
      centerSource: null,
      ownCityHasGroup: true,
      fallbackUsed: false,
      skipped: [],
      canResend: true,
      resendBlockedReason: null,
    });
  });
});

describe("parseResendGroupResult", () => {
  it("API nova: roundId + destinos", () => {
    expect(
      parseResendGroupResult({
        ok: true,
        roundId: "r9",
        ownCityHasGroup: true,
        fallbackUsed: false,
        radiusKm: 30,
        center: { source: "VACANCY", latitude: 1, longitude: 2 },
        destinations: [{ groupJid: "1", groupName: "G", reason: "RADIUS" }],
        skipped: [],
      }),
    ).toEqual({
      roundId: "r9",
      destinations: [{ groupJid: "1", groupName: "G", city: null, uf: null, distanceKm: null, reason: "RADIUS" }],
    });
  });

  it("API antiga (sem corpo ou `{ ok: true }`): roundId nulo", () => {
    expect(parseResendGroupResult(undefined)).toEqual({ roundId: null, destinations: [] });
    expect(parseResendGroupResult({ ok: true })).toEqual({ roundId: null, destinations: [] });
  });
});

describe("parseOutreachGroupBroadcast (coluna Disparo)", () => {
  it("sem o campo: API antiga", () => {
    expect(parseOutreachGroupBroadcast(undefined)).toBeUndefined();
  });

  it("null ou lastRound nulo: registro antigo", () => {
    expect(parseOutreachGroupBroadcast(null)).toEqual({ lastRound: null });
    expect(parseOutreachGroupBroadcast({ lastRound: null })).toEqual({ lastRound: null });
  });

  it("última rodada: `failed` é a lista (≤3) e o número é `failedCount`", () => {
    expect(
      parseOutreachGroupBroadcast({
        lastRound: {
          roundId: "auto:v1",
          mode: "AUTO",
          at: "2026-10-14T12:12:00.000Z",
          total: 4,
          sent: 3,
          failedCount: 1,
          failed: [{ groupName: "Vagas Freela Vinhedo SP", errorMessage: "O bot não está no grupo." }],
          skipped: 0,
          pending: 0,
          ownCity: 1,
          inRadius: 3,
          fallback: 0,
          vip: 0,
        },
      }),
    ).toEqual({
      lastRound: {
        roundId: "auto:v1",
        mode: "AUTO",
        at: "2026-10-14T12:12:00.000Z",
        total: 4,
        sent: 3,
        failedCount: 1,
        failed: [{ groupName: "Vagas Freela Vinhedo SP", errorMessage: "O bot não está no grupo." }],
        skipped: 0,
        pending: 0,
        ownCity: 1,
        inRadius: 3,
        fallback: 0,
        vip: 0,
      },
    });
  });

  it("o que faltar vira 0 / lista vazia", () => {
    expect(
      parseOutreachGroupBroadcast({ lastRound: { mode: "AUTO", at: "2026-10-14T12:12:00.000Z", total: 4, sent: 4 } }),
    ).toEqual({
      lastRound: {
        roundId: null,
        mode: "AUTO",
        at: "2026-10-14T12:12:00.000Z",
        total: 4,
        sent: 4,
        failedCount: 0,
        failed: [],
        skipped: 0,
        pending: 0,
        ownCity: 0,
        inRadius: 0,
        fallback: 0,
        vip: 0,
      },
    });
  });
});

describe("erros", () => {
  it("apiErrorCode lê `error.code`", () => {
    expect(apiErrorCode(axiosErro(409, "BROADCAST_IN_PROGRESS"))).toBe("BROADCAST_IN_PROGRESS");
    expect(apiErrorCode(new Error("x"))).toBeNull();
  });

  it("isRouteMissingError: só 404 de rota (API antiga), não 404 do domínio", () => {
    expect(isRouteMissingError(axiosErro(404))).toBe(true);
    expect(isRouteMissingError(axiosErro(404, "NOT_FOUND"))).toBe(true);
    expect(isRouteMissingError(axiosErro(404, "VACANCY_NOT_FOUND"))).toBe(false);
    expect(isRouteMissingError(axiosErro(404, "CONTRACTOR_NOT_FOUND"))).toBe(false);
    expect(isRouteMissingError(axiosErro(503, "GROUP_BROADCAST_UNAVAILABLE"))).toBe(false);
    expect(isRouteMissingError(new Error("x"))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  isNotFoundError,
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
  errorCode: null,
  errorMessage: null,
  sentAt: "2026-10-14T13:40:00.000Z",
};

describe("parseVacancyGroupBroadcasts", () => {
  it("lê o contrato completo e põe a rodada mais nova primeiro", () => {
    const data = parseVacancyGroupBroadcasts({
      radiusKm: 30,
      center: { source: "VACANCY", city: "Campinas", uf: "SP" },
      rounds: [
        {
          roundId: "auto:v1",
          mode: "AUTO",
          createdAt: "2026-10-14T12:12:00.000Z",
          summary: { total: 1, sent: 1, failed: 0, skipped: 0, pending: 0, ownCity: 1, inRadius: 0 },
          destinations: [DESTINO],
        },
        {
          roundId: "r2",
          mode: "MANUAL",
          createdAt: "2026-10-14T13:40:00.000Z",
          summary: { total: 1, sent: 1, failed: 0, skipped: 0, pending: 0, ownCity: 1, inRadius: 0 },
          destinations: [DESTINO],
        },
      ],
      legacy: null,
    });
    expect(data.radiusKm).toBe(30);
    expect(data.center).toEqual({ source: "VACANCY", city: "Campinas", uf: "SP" });
    expect(data.rounds.map((r) => r.roundId)).toEqual(["r2", "auto:v1"]);
    expect(data.rounds[0].destinations[0]).toEqual(DESTINO);
    expect(data.legacy).toBeNull();
  });

  it("tolerante: enum novo vira UNKNOWN, campo que falta vira nulo, resumo é calculado", () => {
    const data = parseVacancyGroupBroadcasts({
      radiusKm: 30,
      center: { source: "OUTRA_COISA" },
      rounds: [
        {
          roundId: "r1",
          mode: "manual",
          createdAt: "2026-10-14T13:40:00.000Z",
          destinations: [
            { groupName: "Vagas Freela Vinhedo SP", reason: "NOVO_MOTIVO", status: "failed", errorMessage: "Sem bot" },
            { groupName: "Vagas Freela Campinas SP", reason: "VACANCY_CITY", status: "SENT" },
            "lixo",
          ],
        },
      ],
    });
    expect(data.center).toEqual({ source: null, city: null, uf: null });
    const r = data.rounds[0];
    expect(r.mode).toBe("MANUAL");
    expect(r.destinations).toHaveLength(2);
    expect(r.destinations[0]).toMatchObject({
      groupJid: "",
      city: null,
      distanceKm: null,
      reason: "UNKNOWN",
      status: "FAILED",
      errorMessage: "Sem bot",
      sentAt: null,
    });
    expect(r.summary).toEqual({ total: 2, sent: 1, failed: 1, skipped: 0, pending: 0, ownCity: 1, inRadius: 0 });
    expect(data.legacy).toBeNull();
  });

  it("registro antigo só conta se tiver alguma data", () => {
    expect(parseVacancyGroupBroadcasts({ rounds: [], legacy: { autoSentAt: null, manualSentAt: null } }).legacy).toBeNull();
    expect(
      parseVacancyGroupBroadcasts({ rounds: [], legacy: { autoSentAt: "2026-08-11T23:04:00.000Z" } }).legacy,
    ).toEqual({ autoSentAt: "2026-08-11T23:04:00.000Z", manualSentAt: null });
  });

  it("resposta vazia não quebra", () => {
    expect(parseVacancyGroupBroadcasts(undefined)).toEqual({
      radiusKm: 0,
      center: { source: null, city: null, uf: null },
      rounds: [],
      legacy: null,
    });
  });
});

describe("parseGroupBroadcastPreview", () => {
  it("lê destinos e os que ficam de fora", () => {
    const p = parseGroupBroadcastPreview({
      radiusKm: 30,
      center: { source: "CITY_SEAT", city: "Gramado", uf: "RS" },
      destinations: [{ groupJid: "1@g.us", groupName: "Vagas Freela Canela RS", city: "Canela", uf: "RS", distanceKm: 7.9, reason: "RADIUS" }],
      skipped: [{ groupName: "Vagas Freela Caxias RS", city: "Caxias do Sul", uf: "RS", distanceKm: 28, reason: "Passou do limite de 20 grupos" }],
    });
    expect(p.center.source).toBe("CITY_SEAT");
    expect(p.destinations).toEqual([
      { groupJid: "1@g.us", groupName: "Vagas Freela Canela RS", city: "Canela", uf: "RS", distanceKm: 7.9, reason: "RADIUS" },
    ]);
    expect(p.skipped[0].reason).toBe("Passou do limite de 20 grupos");
  });

  it("sem `skipped`: lista vazia", () => {
    expect(parseGroupBroadcastPreview({ radiusKm: 30, destinations: [] }).skipped).toEqual([]);
  });
});

describe("parseResendGroupResult", () => {
  it("API nova: roundId + destinos", () => {
    expect(
      parseResendGroupResult({ roundId: "r9", destinations: [{ groupJid: "1", groupName: "G", reason: "RADIUS" }] }),
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

  it("null ou lastRound nulo: API nova sem rodada", () => {
    expect(parseOutreachGroupBroadcast(null)).toEqual({ lastRound: null });
    expect(parseOutreachGroupBroadcast({ lastRound: null })).toEqual({ lastRound: null });
  });

  it("última rodada com contagens (o que faltar vira 0)", () => {
    expect(
      parseOutreachGroupBroadcast({ lastRound: { mode: "AUTO", at: "2026-10-14T12:12:00.000Z", total: 4, sent: 3, failed: 1 } }),
    ).toEqual({
      lastRound: { mode: "AUTO", at: "2026-10-14T12:12:00.000Z", total: 4, sent: 3, failed: 1, skipped: 0, pending: 0, ownCity: 0, inRadius: 0 },
    });
  });
});

describe("isNotFoundError", () => {
  it("só 404 do axios", () => {
    expect(isNotFoundError({ isAxiosError: true, response: { status: 404 } })).toBe(true);
    expect(isNotFoundError({ isAxiosError: true, response: { status: 500 } })).toBe(false);
    expect(isNotFoundError(new Error("x"))).toBe(false);
  });
});

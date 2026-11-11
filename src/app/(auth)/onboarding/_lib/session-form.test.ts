import { describe, expect, it } from "vitest";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";
import {
  buildCreateSessionPayload,
  buildSeriesPayload,
  buildUpdateSessionPayload,
  sessionToForm,
  type SeriesFormState,
  type SessionFormState,
} from "./session-form";

const limits = { maxCapacity: 100 };
const now = new Date("2026-11-11T15:00:00Z");

const form: SessionFormState = {
  date: "2026-11-16",
  time: "09:00",
  durationMin: "60",
  capacity: "10",
  hostAdminId: "",
  meetUrl: "https://meet.google.com/abc-defg-hij",
  audienceUfs: [],
  audienceCities: [],
  notes: "",
};

describe("buildCreateSessionPayload", () => {
  it("monta o payload com o horário de Brasília em UTC", () => {
    const r = buildCreateSessionPayload(form, limits, now);
    expect(r).toEqual({
      ok: true,
      payload: {
        startsAt: "2026-11-16T12:00:00.000Z",
        durationMin: 60,
        capacity: 10,
        meetUrl: "https://meet.google.com/abc-defg-hij",
      },
    });
  });

  it("sem público não manda audienceUfs nem audienceCities", () => {
    const r = buildCreateSessionPayload(form, limits, now);
    expect(r.ok && "audienceUfs" in r.payload).toBe(false);
    expect(r.ok && "audienceCities" in r.payload).toBe(false);
  });

  it("com público manda os dois", () => {
    const r = buildCreateSessionPayload(
      { ...form, audienceUfs: ["SP"], audienceCities: ["Campinas"], hostAdminId: "h1", notes: " oi " },
      limits,
      now,
    );
    expect(r.ok && r.payload).toMatchObject({
      audienceUfs: ["SP"],
      audienceCities: ["Campinas"],
      hostAdminId: "h1",
      notes: "oi",
    });
  });

  it("exige o link do Meet", () => {
    expect(buildCreateSessionPayload({ ...form, meetUrl: " " }, limits, now)).toEqual({
      ok: false,
      error: "Cole o link do Meet (https://…).",
    });
    expect(buildCreateSessionPayload({ ...form, meetUrl: "meet.google.com/x" }, limits, now).ok).toBe(false);
  });

  it("recusa capacidade acima do teto", () => {
    const r = buildCreateSessionPayload({ ...form, capacity: "101" }, limits, now);
    expect(r.ok).toBe(false);
  });

  it("recusa horário no passado", () => {
    const r = buildCreateSessionPayload({ ...form, date: "2026-11-10" }, limits, now);
    expect(r).toEqual({ ok: false, error: "Esse horário já passou. Escolha uma data e hora futuras." });
  });
});

const original: OrientationSessionView = {
  id: "s1",
  startsAt: "2026-11-16T12:00:00.000Z",
  endsAt: "2026-11-16T13:00:00.000Z",
  capacity: 10,
  bookedCount: 7,
  status: "OPEN",
  hostAdminId: "h1",
  hostName: "Rebeca",
  meetUrl: "https://meet.google.com/abc-defg-hij",
  meetSource: "MANUAL",
  googleSyncStatus: "NOT_CONNECTED",
  googleSyncError: null,
  audience: { ufs: ["SP"], cities: [] },
  seriesId: null,
  notes: null,
  alerts: [],
};

describe("buildUpdateSessionPayload", () => {
  it("o formulário da turma sem mexer em nada não tem o que salvar", () => {
    expect(buildUpdateSessionPayload(sessionToForm(original), original, limits)).toEqual({
      ok: false,
      error: "Nada mudou.",
    });
  });

  it("manda só o que mudou", () => {
    const f = { ...sessionToForm(original), capacity: "12" };
    expect(buildUpdateSessionPayload(f, original, limits)).toEqual({ ok: true, payload: { capacity: 12 } });
  });

  it("mudar o horário manda startsAt", () => {
    const f = { ...sessionToForm(original), time: "10:30" };
    expect(buildUpdateSessionPayload(f, original, limits)).toEqual({
      ok: true,
      payload: { startsAt: "2026-11-16T13:30:00.000Z" },
    });
  });

  it("não deixa baixar os lugares abaixo dos inscritos", () => {
    const f = { ...sessionToForm(original), capacity: "5" };
    expect(buildUpdateSessionPayload(f, original, limits)).toEqual({
      ok: false,
      error: "Já há 7 inscritos nesta turma.",
    });
  });

  it("mudar o público manda as duas listas", () => {
    const f = { ...sessionToForm(original), audienceUfs: [], audienceCities: ["Campinas"] };
    expect(buildUpdateSessionPayload(f, original, limits)).toEqual({
      ok: true,
      payload: { audienceUfs: [], audienceCities: ["Campinas"] },
    });
  });
});

const series: SeriesFormState = {
  weekdays: [1, 2, 3, 4, 5],
  time: "09:00",
  fromDate: "2026-11-16",
  toDate: "2026-11-27",
  durationMin: "60",
  capacity: "10",
  hostAdminId: "",
  meetUrl: "https://meet.google.com/abc-defg-hij",
  audienceUfs: [],
  audienceCities: [],
};

describe("buildSeriesPayload", () => {
  it("monta a série sem notes", () => {
    const r = buildSeriesPayload(series, limits, { dryRun: false, skipDates: ["2026-11-20"], seriesId: "ser-1" });
    expect(r).toEqual({
      ok: true,
      payload: {
        weekdays: [1, 2, 3, 4, 5],
        time: "09:00",
        fromDate: "2026-11-16",
        toDate: "2026-11-27",
        durationMin: 60,
        capacity: 10,
        meetUrl: "https://meet.google.com/abc-defg-hij",
        skipDates: ["2026-11-20"],
        dryRun: false,
        seriesId: "ser-1",
      },
    });
    expect(r.ok && "notes" in r.payload).toBe(false);
  });

  it("data final antes da inicial é erro", () => {
    const r = buildSeriesPayload({ ...series, toDate: "2026-11-10" }, limits, {
      dryRun: true,
      skipDates: [],
      seriesId: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("exige ao menos um dia da semana e o link", () => {
    const opts = { dryRun: true, skipDates: [], seriesId: "x" };
    expect(buildSeriesPayload({ ...series, weekdays: [] }, limits, opts).ok).toBe(false);
    expect(buildSeriesPayload({ ...series, meetUrl: "" }, limits, opts)).toEqual({
      ok: false,
      error: "Cole o link do Meet (https://…).",
    });
  });
});

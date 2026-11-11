import { describe, expect, it } from "vitest";
import type { OrientationSettingsView } from "@/modules/admin/infrastructure/orientation-api";
import { buildSettingsPatch, settingsToForm } from "./settings-form";

const current: OrientationSettingsView = {
  gateMode: "OFF",
  newSignupsSince: null,
  gateFixedJobs: false,
  defaultCapacity: 15,
  maxCapacity: 20,
  defaultDurationMin: 60,
  bookingClosesMinBefore: 60,
  maxChanges: 2,
  maxNoShows: 2,
  sessionsShown: 4,
  joinOpensMinBefore: 15,
  resultGraceMin: 30,
  convocationMinDays: 7,
  dailyMessageCap: 200,
  updatedAt: null,
  updatedByAdminName: null,
};

describe("buildSettingsPatch", () => {
  it("manda só o campo alterado", () => {
    const form = { ...settingsToForm(current), maxChanges: "4" };
    expect(buildSettingsPatch(form, current)).toEqual({ ok: true, payload: { maxChanges: 4 } });
  });
  it("nada alterado → erro", () => {
    expect(buildSettingsPatch(settingsToForm(current), current)).toEqual({ ok: false, error: "Nada mudou." });
  });
  it("padrão de lugares maior que o teto → erro", () => {
    const form = { ...settingsToForm(current), defaultCapacity: "30" };
    const r = buildSettingsPatch(form, current);
    expect(r.ok).toBe(false);
  });
  it("teto acima de 100 → erro", () => {
    const form = { ...settingsToForm(current), maxCapacity: "101" };
    expect(buildSettingsPatch(form, current).ok).toBe(false);
  });
  it("texto ou decimal → erro", () => {
    expect(buildSettingsPatch({ ...settingsToForm(current), maxChanges: "abc" }, current).ok).toBe(false);
    expect(buildSettingsPatch({ ...settingsToForm(current), maxChanges: "2.5" }, current).ok).toBe(false);
    expect(buildSettingsPatch({ ...settingsToForm(current), maxChanges: "" }, current).ok).toBe(false);
  });
  it("fora da faixa da API → erro", () => {
    expect(buildSettingsPatch({ ...settingsToForm(current), defaultDurationMin: "0" }, current).ok).toBe(false);
    expect(buildSettingsPatch({ ...settingsToForm(current), defaultDurationMin: "481" }, current).ok).toBe(false);
  });
  it("nunca manda gateMode nem gateFixedJobs", () => {
    const form = { ...settingsToForm(current), dailyMessageCap: "0" };
    const r = buildSettingsPatch(form, current);
    expect(r).toEqual({ ok: true, payload: { dailyMessageCap: 0 } });
  });
  it("aumentar o padrão junto com o teto vale", () => {
    const form = { ...settingsToForm(current), defaultCapacity: "30", maxCapacity: "40" };
    expect(buildSettingsPatch(form, current)).toEqual({
      ok: true,
      payload: { defaultCapacity: 30, maxCapacity: 40 },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, put, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
}));
const factory = vi.hoisted(() => vi.fn());

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: (base: string) => {
    factory(base);
    return { get, post, put, patch };
  },
}));

import {
  approveWithoutClass,
  cancelOrientationSeries,
  cancelOrientationSession,
  cancelProviderBooking,
  finishAttendance,
  getBookingLink,
  getOrientationSettings,
  listOrientationSessions,
  resetChanges,
  updateOrientationSettings,
  updateOrientationSession,
} from "./orientation-api";

const ok = (data: unknown) => ({ data: { data } });

describe("orientation-api", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    patch.mockReset();
  });

  it("usa a base /v1/admins/orientation", () => {
    expect(factory).toHaveBeenCalledWith("/v1/admins/orientation");
  });

  it("lê as configurações e devolve data.data", async () => {
    get.mockResolvedValueOnce(ok({ gateMode: "OFF" }));
    await expect(getOrientationSettings()).resolves.toEqual({ gateMode: "OFF" });
    expect(get).toHaveBeenCalledWith("/settings");
  });

  it("updateOrientationSettings manda PUT /settings só com o patch", async () => {
    put.mockResolvedValueOnce(ok({ maxChanges: 4 }));
    await expect(updateOrientationSettings({ maxChanges: 4 })).resolves.toEqual({ maxChanges: 4 });
    expect(put).toHaveBeenCalledWith("/settings", { maxChanges: 4 });
  });

  it("listOrientationSessions manda from/to como params", async () => {
    get.mockResolvedValueOnce(ok([{ id: "s1" }]));
    await expect(listOrientationSessions({ from: "a", to: "b" })).resolves.toEqual([{ id: "s1" }]);
    expect(get).toHaveBeenCalledWith("/sessions", { params: { from: "a", to: "b" } });
  });

  it("cancelOrientationSeries manda dryRun", async () => {
    post.mockResolvedValueOnce(ok({ sessions: 3, cancelledEnrollments: 0 }));
    await expect(cancelOrientationSeries("ser-1", { dryRun: true })).resolves.toEqual({
      sessions: 3,
      cancelledEnrollments: 0,
    });
    expect(post).toHaveBeenCalledWith("/series/ser-1/cancel", { dryRun: true });
  });

  it("finishAttendance manda { marks }", async () => {
    const marks = [{ enrollmentId: "e1", result: "APPROVED" as const }];
    post.mockResolvedValueOnce(ok({ approved: 1 }));
    await expect(finishAttendance("s1", marks)).resolves.toEqual({ approved: 1 });
    expect(post).toHaveBeenCalledWith("/sessions/s1/finish", { marks });
  });

  it("cancelOrientationSession manda o motivo", async () => {
    post.mockResolvedValueOnce(ok({ cancelledEnrollments: 2 }));
    await cancelOrientationSession("s1", "feriado");
    expect(post).toHaveBeenCalledWith("/sessions/s1/cancel", { reason: "feriado" });
  });

  it("updateOrientationSession usa PATCH", async () => {
    patch.mockResolvedValueOnce(ok({ id: "s1", scheduleChanged: false }));
    await updateOrientationSession("s1", { capacity: 12 });
    expect(patch).toHaveBeenCalledWith("/sessions/s1", { capacity: 12 });
  });

  it("resetChanges manda o motivo", async () => {
    post.mockResolvedValueOnce(ok({ ok: true }));
    await expect(resetChanges("pg-1", "pediu")).resolves.toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith("/providers/pg-1/reset-changes", { reason: "pediu" });
  });

  it("approveWithoutClass manda o motivo", async () => {
    post.mockResolvedValueOnce(ok({ ok: true }));
    await approveWithoutClass("pg-1", "veterano");
    expect(post).toHaveBeenCalledWith("/providers/pg-1/approve-manual", { reason: "veterano" });
  });

  it("cancelProviderBooking não manda corpo", async () => {
    post.mockResolvedValueOnce(ok({ cancelled: true }));
    await expect(cancelProviderBooking("pg-1")).resolves.toEqual({ cancelled: true });
    expect(post).toHaveBeenCalledWith("/providers/pg-1/cancel-booking");
  });

  it("getBookingLink lê o link", async () => {
    get.mockResolvedValueOnce(ok({ url: "u", expiresAt: "x" }));
    await expect(getBookingLink("pg-1")).resolves.toEqual({ url: "u", expiresAt: "x" });
    expect(get).toHaveBeenCalledWith("/providers/pg-1/booking-link");
  });
});

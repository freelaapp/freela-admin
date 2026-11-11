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
  createConvocation,
  exportOrientationQueue,
  getOrientationQueue,
  getOrientationQueueCounters,
  getOrientationQueuePeople,
  listConvocations,
  previewConvocation,
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

  it("getOrientationQueue manda só filtros preenchidos e mantém 0", async () => {
    get.mockResolvedValueOnce(ok({ groups: [], groupsTruncated: false }));
    await getOrientationQueue({ status: "PENDING", uf: "", city: "Campinas", activeWithinDays: 0 });
    expect(get).toHaveBeenCalledWith("/queue", {
      params: { status: "PENDING", city: "Campinas", activeWithinDays: 0 },
    });
  });

  it("contadores vêm de /queue/counters", async () => {
    get.mockResolvedValueOnce(ok({ counters: {}, measuredSince: null }));
    await getOrientationQueueCounters();
    expect(get).toHaveBeenCalledWith("/queue/counters");
  });

  it("pessoas e exportação", async () => {
    get.mockResolvedValue(ok({ rows: [], total: 0, page: 2, pageSize: 50 }));
    await getOrientationQueuePeople({ status: "PENDING", workedBefore: false }, 2);
    expect(get).toHaveBeenCalledWith("/queue/people", {
      params: { status: "PENDING", workedBefore: false, page: 2 },
    });
    await exportOrientationQueue({ uf: "SP" });
    expect(get).toHaveBeenCalledWith("/queue/export", { params: { uf: "SP" } });
  });

  it("previewConvocation manda dryRun e o filtro", async () => {
    post.mockResolvedValueOnce(ok({ people: 1 }));
    await previewConvocation({ filter: { uf: "SP" }, limit: 10 });
    expect(post).toHaveBeenCalledWith("/queue/convocations", {
      filter: { uf: "SP" },
      limit: 10,
      dryRun: true,
    });
  });

  it("createConvocation manda a chave e a confirmação, sem dryRun", async () => {
    post.mockResolvedValueOnce(ok({ convocationId: "c", queued: 5 }));
    await createConvocation({ filter: { uf: "SP" }, requestKey: "abc12345", confirmCount: 5 });
    expect(post).toHaveBeenCalledWith("/queue/convocations", {
      filter: { uf: "SP" },
      requestKey: "abc12345",
      confirmCount: 5,
    });
  });

  it("listConvocations lê o andamento", async () => {
    get.mockResolvedValueOnce(ok([{ id: "c" }]));
    await expect(listConvocations()).resolves.toEqual([{ id: "c" }]);
    expect(get).toHaveBeenCalledWith("/queue/convocations");
  });
});

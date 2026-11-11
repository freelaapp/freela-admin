import { describe, expect, it } from "vitest";
import type { OrientationEnrollee, OrientationSessionDetail } from "@/modules/admin/infrastructure/orientation-api";
import {
  approveJoined,
  bookedEnrollees,
  clearDraft,
  finishBlockers,
  finishSummary,
  loadDraft,
  markRestNoShow,
  pruneMarks,
  saveDraft,
  toFinishPayload,
  type Marks,
} from "./attendance";

function enrollee(id: string, name: string, over: Partial<OrientationEnrollee> = {}): OrientationEnrollee {
  return {
    enrollmentId: id,
    providerGlobalId: `pg-${id}`,
    userId: `u-${id}`,
    status: "BOOKED",
    origin: "APP",
    bookedAt: "2026-11-10T10:00:00.000Z",
    notes: null,
    firstJoinClickAt: null,
    name,
    phone: null,
    city: null,
    uf: null,
    roles: [],
    totalCompletedServices: 0,
    previousNoShows: 0,
    ...over,
  };
}

const ana = enrollee("e1", "Ana", { firstJoinClickAt: "2026-11-16T12:03:00.000Z" });
const bruno = enrollee("e2", "Bruno");
const carla = enrollee("e3", "Carla");
const booked = [ana, bruno, carla];
const STARTS = "2026-11-16T12:00:00.000Z";

describe("bookedEnrollees", () => {
  it("só BOOKED, por nome", () => {
    const d = {
      enrollees: [carla, enrollee("x", "Zé", { status: "CANCELLED" }), ana, bruno],
    } as unknown as OrientationSessionDetail;
    expect(bookedEnrollees(d).map((e) => e.name)).toEqual(["Ana", "Bruno", "Carla"]);
  });
});

describe("marcações em lote", () => {
  it("approveJoined aprova só quem tocou em Entrar e ainda não tem marca", () => {
    expect(approveJoined({}, booked)).toEqual({ e1: { result: "APPROVED", notes: "" } });
    const m: Marks = { e1: { result: "REJECTED", notes: "x" } };
    expect(approveJoined(m, booked)).toEqual(m);
  });

  it("markRestNoShow marca o resto como Faltou e não mexe em quem já tem marca", () => {
    const m: Marks = { e1: { result: "APPROVED", notes: "" } };
    expect(markRestNoShow(m, booked)).toEqual({
      e1: { result: "APPROVED", notes: "" },
      e2: { result: "NO_SHOW", notes: "" },
      e3: { result: "NO_SHOW", notes: "" },
    });
  });

  it("pruneMarks tira marca de quem saiu da lista", () => {
    const m: Marks = { e1: { result: "APPROVED", notes: "" }, e9: { result: "NO_SHOW", notes: "" } };
    expect(pruneMarks(m, booked)).toEqual({ e1: { result: "APPROVED", notes: "" } });
  });
});

describe("finishBlockers", () => {
  const before = new Date("2026-11-16T11:00:00.000Z");
  const after = new Date("2026-11-16T12:30:00.000Z");

  it("falta marcar e aula não começou", () => {
    const b = finishBlockers({}, booked, STARTS, before);
    expect(b).toContain("Faltam 3 pessoas");
    expect(b).toContain("A aula ainda não começou (9h)");
  });

  it("singular", () => {
    const m: Marks = {
      e1: { result: "APPROVED", notes: "" },
      e2: { result: "APPROVED", notes: "" },
    };
    expect(finishBlockers(m, booked, STARTS, after)).toEqual(["Falta 1 pessoa"]);
  });

  it("reprovado sem anotação (só espaços também)", () => {
    const m: Marks = {
      e1: { result: "APPROVED", notes: "" },
      e2: { result: "REJECTED", notes: "   " },
      e3: { result: "NO_SHOW", notes: "" },
    };
    expect(finishBlockers(m, booked, STARTS, after)).toEqual(["Reprovado sem anotação: Bruno"]);
  });

  it("tudo certo = sem bloqueio", () => {
    const m: Marks = {
      e1: { result: "APPROVED", notes: "" },
      e2: { result: "REJECTED", notes: "não prestou atenção" },
      e3: { result: "NO_SHOW", notes: "" },
    };
    expect(finishBlockers(m, booked, STARTS, after)).toEqual([]);
  });
});

describe("toFinishPayload e finishSummary", () => {
  const m: Marks = {
    e1: { result: "APPROVED", notes: "  " },
    e2: { result: "REJECTED", notes: "  saiu cedo  " },
    e3: { result: "NO_SHOW", notes: "" },
  };

  it("apara a nota e omite se vazia", () => {
    expect(toFinishPayload(m)).toEqual([
      { enrollmentId: "e1", result: "APPROVED" },
      { enrollmentId: "e2", result: "REJECTED", notes: "saiu cedo" },
      { enrollmentId: "e3", result: "NO_SHOW" },
    ]);
  });

  it("resumo no singular", () => {
    expect(finishSummary(STARTS, m)).toBe(
      "Encerrar chamada de segunda, 16/11, 9h: 1 aprovado, 1 não aprovado, 1 faltou.",
    );
  });

  it("resumo no plural", () => {
    const big: Marks = {};
    for (let i = 0; i < 18; i++) big[`a${i}`] = { result: "APPROVED", notes: "" };
    for (let i = 0; i < 2; i++) big[`r${i}`] = { result: "REJECTED", notes: "x" };
    for (let i = 0; i < 5; i++) big[`f${i}`] = { result: "NO_SHOW", notes: "" };
    expect(finishSummary(STARTS, big)).toBe(
      "Encerrar chamada de segunda, 16/11, 9h: 18 aprovados, 2 não aprovados, 5 faltaram.",
    );
  });
});

describe("rascunho", () => {
  function fakeStorage(): Storage {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (k) => data.get(k) ?? null,
      key: (i) => [...data.keys()][i] ?? null,
      removeItem: (k) => void data.delete(k),
      setItem: (k, v) => void data.set(k, v),
    };
  }

  it("salva e lê de volta igual", () => {
    const s = fakeStorage();
    const m: Marks = { e1: { result: "REJECTED", notes: "x" } };
    saveDraft(s, "s1", m);
    expect(s.getItem("orientation-attendance:s1")).not.toBeNull();
    expect(loadDraft(s, "s1")).toEqual(m);
  });

  it("JSON quebrado ou formato estranho vira {}", () => {
    const s = fakeStorage();
    s.setItem("orientation-attendance:s1", "{quebrado");
    expect(loadDraft(s, "s1")).toEqual({});
    s.setItem("orientation-attendance:s1", JSON.stringify({ e1: { result: "TALVEZ" }, e2: 3 }));
    expect(loadDraft(s, "s1")).toEqual({});
  });

  it("clearDraft apaga a chave; salvar vazio também", () => {
    const s = fakeStorage();
    saveDraft(s, "s1", { e1: { result: "APPROVED", notes: "" } });
    clearDraft(s, "s1");
    expect(s.getItem("orientation-attendance:s1")).toBeNull();
    saveDraft(s, "s1", { e1: { result: "APPROVED", notes: "" } });
    saveDraft(s, "s1", {});
    expect(s.getItem("orientation-attendance:s1")).toBeNull();
  });
});

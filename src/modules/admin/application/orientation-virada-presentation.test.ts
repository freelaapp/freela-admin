import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import type { HistoryPreview, Readiness } from "../infrastructure/orientation-api";
import { historyErrorMessage, historyPreviewLines, readinessChecks } from "./orientation-virada-presentation";

const p: HistoryPreview = {
  eligible: 158,
  withBooking: 3,
  noRatings: 40,
  lowRating: 12,
  alreadyApproved: 900,
  rejected: 5,
  sample: [],
  formula: "f",
  formulas: {
    eligible: "e",
    withBooking: "b",
    noRatings: "n",
    lowRating: "l",
    alreadyApproved: "a",
    rejected: "r",
  },
  source: "shared.provider_globals (total_completed_services, average_rating, total_ratings) + shared.users ativos",
};

function readiness(over: { value?: string | null; ok?: boolean; cities?: Readiness["supply"]["cities"]; openWithoutCity?: number } = {}): Readiness {
  const cities = over.cities ?? [];
  const gap = cities.filter((c) => !c.ok).length;
  return {
    generatedAt: "2026-11-11T15:00:00.000Z",
    appMinimum: {
      value: over.value === undefined ? "1.0.50" : over.value,
      required: "1.0.50",
      ok: over.ok ?? true,
      source: "env APP_MINIMUM_VERSION",
    },
    supply: {
      windowDays: 14,
      recentDays: 30,
      cities,
      openWithoutCity: over.openWithoutCity ?? 0,
      citiesWithGap: gap,
      ok: gap === 0,
      formula: "Cidade ok quando ...",
      source: "bares_restaurantes.vacancies ...",
    },
  };
}
const city = (name: string, open: number, approved: number) => ({
  uf: "SP",
  city: name,
  openVacancies: open,
  approvedRecentApplicants: approved,
  ok: approved >= open,
});

describe("historyPreviewLines", () => {
  it("cada linha diz o que conta, a conta e a fonte", () => {
    const lines = historyPreviewLines(p, { minCompletedServices: 1, minRating: 4 });
    expect(lines).toHaveLength(6);
    expect(lines[0].label).toBe("Serão aprovados");
    expect(lines[0].value).toBe(158);
    expect(lines[0].how).toContain("nota ≥ 4,0");
    expect(lines[0].how).toContain("≥ 1 serviço concluído");
    expect(lines[0].how).toContain("provider_globals");
    expect(lines[1].label).toBe("Com aula marcada (liberam o lugar na turma)");
  });

  it("plural de serviços e vírgula na nota", () => {
    const l = historyPreviewLines(p, { minCompletedServices: 3, minRating: 4.5 });
    expect(l[0].how).toContain("≥ 3 serviços concluídos");
    expect(l[0].how).toContain("nota ≥ 4,5");
    expect(l[2].label).toBe("Ficam de fora: serviço mas nenhuma avaliação");
    expect(l[3].label).toBe("Ficam de fora: nota abaixo do mínimo");
  });
});

describe("readinessChecks", () => {
  it("sem resposta: uma conferência desconhecida, nunca ok", () => {
    const unknown = [{ label: "Conferências", state: "unknown", detail: "Não deu para conferir agora." }];
    expect(readinessChecks(null, true)).toEqual(unknown);
    expect(readinessChecks(null, false)).toEqual(unknown);
  });

  it("app mínimo ok", () => {
    expect(readinessChecks(readiness({ cities: [city("Campinas", 2, 5)] }), false)[0]).toEqual({
      label: "App mínimo ≥ 1.0.50",
      state: "ok",
      detail: "Hoje: 1.0.50 (APP_MINIMUM_VERSION no servidor)",
    });
  });

  it("app mínimo velho ou ausente falha", () => {
    expect(readinessChecks(readiness({ value: "1.0.49", ok: false }), false)[0]).toMatchObject({
      state: "fail",
      detail: "Hoje: 1.0.49 (APP_MINIMUM_VERSION no servidor)",
    });
    expect(readinessChecks(readiness({ value: null, ok: false }), false)[0].detail).toContain("não definido");
  });

  it("cidades: falta mostra a conta de cada uma, até 5, e guarda todas", () => {
    const cities = [
      city("Campinas", 12, 4),
      city("A", 10, 1),
      city("B", 10, 2),
      city("C", 10, 3),
      city("D", 10, 4),
      city("E", 10, 5),
      city("Ok", 1, 9),
    ];
    const c = readinessChecks(readiness({ cities }), false)[1];
    expect(c.state).toBe("fail");
    expect(c.detail).toContain("Campinas/SP: 12 vagas abertas, 4 aprovados ativos");
    expect(c.detail).not.toContain("Ok/SP");
    expect(c.allCities).toHaveLength(6);
    expect(c.detail.split("; ")).toHaveLength(5);
    expect(c.how).toContain("Cidade ok quando");
  });

  it("cidades ok: conta quantas foram conferidas", () => {
    const c = readinessChecks(readiness({ cities: [city("Campinas", 2, 5), city("Valinhos", 1, 1)] }), false)[1];
    expect(c.state).toBe("ok");
    expect(c.detail).toContain("2 cidades");
  });

  it("zero vagas abertas com cidade: não conferiu, nunca ok", () => {
    expect(readinessChecks(readiness({ cities: [] }), false)[1].state).toBe("unknown");
  });

  it("vagas sem cidade viram aviso", () => {
    const c = readinessChecks(readiness({ cities: [city("Campinas", 2, 5)], openWithoutCity: 7 }), false)[1];
    expect(c.detail).toContain("7 vagas sem cidade não entram na conferência");
    expect(c.state).toBe("ok");
  });
});

function apiError(status: number, body: Record<string, unknown>) {
  const err = new AxiosError("fail");
  err.response = { status, data: body } as AxiosError["response"];
  return err;
}

describe("historyErrorMessage", () => {
  it("HISTORY_COUNT_MISMATCH usa o número novo (corpo plano ou embrulhado)", () => {
    const want = "A contagem mudou para 160. Veja a prévia de novo.";
    expect(historyErrorMessage(apiError(409, { code: "HISTORY_COUNT_MISMATCH", message: "x", eligible: 160 }), "f")).toBe(want);
    expect(
      historyErrorMessage(apiError(409, { error: { code: "HISTORY_COUNT_MISMATCH", message: "x", eligible: 160 } }), "f"),
    ).toBe(want);
  });
  it("HISTORY_TOO_MANY mostra a mensagem da API", () => {
    expect(historyErrorMessage(apiError(422, { code: "HISTORY_TOO_MANY", message: "São 3.000 pessoas." }), "f")).toBe(
      "São 3.000 pessoas.",
    );
  });
  it("HISTORY_EMPTY e REASON_REQUIRED", () => {
    expect(historyErrorMessage(apiError(422, { code: "HISTORY_EMPTY", message: "x" }), "f")).toBe("Ninguém com esses critérios.");
    expect(historyErrorMessage(apiError(422, { code: "REASON_REQUIRED", message: "x" }), "f")).toBe("Escreva o motivo.");
  });
  it("falha no meio diz o que já foi feito", () => {
    const m = historyErrorMessage(
      apiError(500, { code: "HISTORY_APPLY_FAILED", message: "parou", batchId: "b", approved: 40, skipped: 2 }),
      "f",
    );
    expect(m).toContain("40");
    expect(m).toContain("Rode de novo");
  });
  it("outros erros caem na tabela geral", () => {
    expect(historyErrorMessage(new Error("x"), "Falhou.")).toBe("Falhou.");
  });
});

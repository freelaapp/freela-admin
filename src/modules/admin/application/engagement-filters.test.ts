import { describe, expect, it } from "vitest";
import type { EngagementFilters } from "../infrastructure/engagement-api";
import { SAMPLE_OVERVIEW } from "./engagement.test-fixtures";
import {
  backToListHref,
  customRangeError,
  DEFAULT_LIST_STATE,
  listStateExtras,
  listStateFromSearchParams,
  defaultFilters,
  describeFilters,
  fichaHref,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFilterReady,
  isoDayBrasilia,
  parseEngagementTab,
  withQuery,
} from "./engagement-filters";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const sp = (qs: string) => new URLSearchParams(qs);

describe("isoDayBrasilia", () => {
  it("usa o dia de Brasília (00:30 UTC ainda é o dia anterior)", () => {
    expect(isoDayBrasilia(0, new Date("2026-10-08T00:30:00.000Z"))).toBe("2026-10-07");
    expect(isoDayBrasilia(29, NOW)).toBe("2026-09-08");
  });
});

describe("URL ↔ filtros", () => {
  it("URL vazia = mês corrente, tudo; personalizado já sugere os últimos 30 dias", () => {
    expect(filtersFromSearchParams(sp(""), NOW)).toEqual({
      period: "this_month",
      from: "2026-09-08",
      to: "2026-10-07",
      city: "",
      uf: "",
      product: "all",
      channel: "all",
    });
  });

  it("valores inválidos voltam ao padrão sem quebrar", () => {
    const f = filtersFromSearchParams(
      sp("periodo=xpto&de=2026-13-40&ate=ontem&produto=bar&canal=tv&uf=Minas"),
      NOW,
    );
    expect(f).toEqual(defaultFilters(NOW));
  });

  it("personalizado com data inexistente cai na data padrão e continua pronto", () => {
    const f = filtersFromSearchParams(sp("periodo=custom&de=2026-02-30&ate=2026-09-30"), NOW);
    expect(f.period).toBe("custom");
    expect(f.from).toBe("2026-09-08");
    expect(f.to).toBe("2026-09-30");
    expect(isFilterReady(f)).toBe(true);
  });

  it("UF sem cidade é ignorada", () => {
    expect(filtersFromSearchParams(sp("uf=MG"), NOW).uf).toBe("");
  });

  it("ida e volta preserva tudo e só escreve o que foge do padrão", () => {
    const f: EngagementFilters = {
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
      city: "Juiz de Fora",
      uf: "MG",
      product: "bars_restaurants",
      channel: "app",
    };
    const qs = filtersToSearchParams(f, { aba: "freelancers" });
    expect(qs.toString()).toBe(
      "periodo=custom&de=2026-09-01&ate=2026-09-30&cidade=Juiz+de+Fora&uf=MG&produto=bars_restaurants&canal=app&aba=freelancers",
    );
    expect(filtersFromSearchParams(qs, NOW)).toEqual(f);
    expect(filtersToSearchParams(defaultFilters(NOW)).toString()).toBe("");
    expect(withQuery("/engajamento", filtersToSearchParams(defaultFilters(NOW)))).toBe("/engajamento");
  });
});

describe("período personalizado incompleto não pode consultar", () => {
  const base = defaultFilters(NOW);

  it.each([
    [{ ...base, period: "custom" as const, from: "" }, "Escolha a data inicial e a final."],
    [
      { ...base, period: "custom" as const, from: "2026-09-30", to: "2026-09-01" },
      "A data inicial precisa ser antes da final.",
    ],
    [
      { ...base, period: "custom" as const, from: "2024-01-01", to: "2026-09-30" },
      "Escolha um período de até 2 anos.",
    ],
  ])("caso %#", (f, msg) => {
    expect(customRangeError(f)).toBe(msg);
    expect(isFilterReady(f)).toBe(false);
  });

  it("presets estão sempre prontos, mesmo com data apagada", () => {
    expect(isFilterReady({ ...base, period: "7d", from: "" })).toBe(true);
  });
});

describe("textos e links", () => {
  it("describeFilters sem resposta usa o rótulo do preset", () => {
    const f = { ...defaultFilters(NOW), city: "Gramado", uf: "RS", product: "home_services" as const };
    expect(describeFilters(f)).toBe(
      "Período: Este mês · Cidade: Gramado - RS · Produto: Só Casa · Canal: App + site",
    );
  });

  it("com a resposta usa o rótulo da API; personalizado sem resposta mostra as datas", () => {
    const f = { ...defaultFilters(NOW), period: "custom" as const, from: "2026-09-01", to: "2026-09-30" };
    expect(describeFilters(f, SAMPLE_OVERVIEW.period)).toContain("Período: 01/09/2026 a 30/09/2026");
    expect(describeFilters(f)).toContain("Período: 01/09/2026 a 30/09/2026");
  });

  it("fichaHref codifica o id e leva filtros + aba", () => {
    expect(fichaHref("contractor", "u/1", { ...defaultFilters(NOW), period: "7d" })).toBe(
      "/engajamento/empresa/u%2F1?periodo=7d&aba=empresas",
    );
    expect(fichaHref("freelancer", "u-f1", defaultFilters(NOW))).toBe(
      "/engajamento/freelancer/u-f1?aba=freelancers",
    );
  });

  it("aba inválida cai na visão geral", () => {
    expect(parseEngagementTab("empresas")).toBe("empresas");
    expect(parseEngagementTab("nada")).toBe("visao-geral");
    expect(parseEngagementTab(null)).toBe("visao-geral");
  });
});

describe("estado da lista na URL (ida e volta da ficha)", () => {
  it("lê e escreve segmento, busca, página e contas sem acesso", () => {
    const s = listStateFromSearchParams(sp("segmento=opened_no_apply&busca=ana&pagina=3&semAcesso=1"));
    expect(s).toEqual({ segment: "opened_no_apply", search: "ana", page: 3, includeNoAccess: true });
    expect(listStateExtras(s)).toEqual({ segmento: "opened_no_apply", busca: "ana", pagina: "3", semAcesso: "1" });
  });

  it("valor inválido cai no padrão, e o padrão não suja a URL", () => {
    expect(listStateFromSearchParams(sp("pagina=-2"))).toEqual(DEFAULT_LIST_STATE);
    expect(listStateFromSearchParams(sp("pagina=x"))).toEqual(DEFAULT_LIST_STATE);
    expect(listStateExtras(DEFAULT_LIST_STATE)).toEqual({
      segmento: undefined,
      busca: undefined,
      pagina: undefined,
      semAcesso: undefined,
    });
  });

  it("a ficha leva o estado da lista e o link de volta o devolve", () => {
    const f = defaultFilters(NOW);
    const list = { segment: "cooling", search: "", page: 2, includeNoAccess: false };
    expect(fichaHref("freelancer", "u1", f, list)).toBe(
      "/engajamento/freelancer/u1?aba=freelancers&segmento=cooling&pagina=2",
    );
    expect(backToListHref(f, "freelancers", list)).toBe("/engajamento?aba=freelancers&segmento=cooling&pagina=2");
  });
});

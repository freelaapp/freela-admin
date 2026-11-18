import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applySuspensionFilters,
  cityOptions,
  companyOptions,
  contestText,
  conversationDetail,
  createdByText,
  hasActiveFilters,
  hasPlaceFields,
  liftedText,
  matchesPlace,
  placeText,
} from "./suspensions-presentation";
import { suspensionItem } from "./suspensions.test-fixtures";
import type { SuspensionItem } from "../infrastructure/suspensions-api";

/** Uma linha como a API nova (A2a) manda: empresa, cidade e nomes (chaves sempre presentes). */
function withPlace(extra: Partial<SuspensionItem> = {}, place?: { userId: string; name: string; city: string }) {
  const base = suspensionItem(extra);
  return {
    ...base,
    vacancy: base.vacancy
      ? {
          ...base.vacancy,
          jobId: "job-1",
          company: place ? { userId: place.userId, name: place.name } : null,
          city: place?.city ?? null,
          uf: place ? "SP" : null,
        }
      : null,
    liftedByName: null,
    conversationByName: null,
    createdByAdminName: null,
    ...extra,
  } as SuspensionItem;
}

const COCO = { userId: "u-coco", name: "Coco Bambu Osasco", city: "Osasco" };
const SPOLETO = { userId: "u-spo", name: "Spoleto Campinas", city: "Campinas" };

describe("Suspensões — empresa e cidade (D5, fatia A2b)", () => {
  it("API antiga (sem as chaves novas): esconde os filtros", () => {
    expect(hasPlaceFields([suspensionItem()])).toBe(false);
    expect(hasPlaceFields([])).toBe(false);
    // Suspensão do suporte (vacancy null) na API nova também conta: a chave é de topo.
    expect(hasPlaceFields([withPlace({ vacancy: null, source: null, reasonKey: "MANUAL" })])).toBe(true);
  });

  it("opções: empresas e cidades presentes, sem repetir, em ordem alfabética", () => {
    const items = [
      withPlace({ id: "1" }, SPOLETO),
      withPlace({ id: "2" }, COCO),
      withPlace({ id: "3" }, COCO),
      withPlace({ id: "4", vacancy: null, source: null }),
    ];
    expect(companyOptions(items)).toEqual([
      { value: "u-coco", label: "Coco Bambu Osasco" },
      { value: "u-spo", label: "Spoleto Campinas" },
    ]);
    expect(cityOptions(items)).toEqual([
      { value: "Campinas|SP", label: "Campinas/SP" },
      { value: "Osasco|SP", label: "Osasco/SP" },
    ]);
  });

  it("filtro: empresa e cidade; sem vaga fica de fora quando há escolha", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const items = [
      withPlace({ id: "1" }, SPOLETO),
      withPlace({ id: "2" }, COCO),
      withPlace({ id: "3", vacancy: null, source: null }),
    ];
    const ids = (company: string, city: string) =>
      applySuspensionFilters(items, { ...DEFAULT_FILTERS, company, city }, now).map((i) => i.id);
    expect(ids("", "")).toEqual(["1", "2", "3"]);
    expect(ids("u-coco", "")).toEqual(["2"]);
    expect(ids("", "Campinas|SP")).toEqual(["1"]);
    expect(ids("u-coco", "Campinas|SP")).toEqual([]);
    expect(matchesPlace(items[2], "", "")).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, company: "u-coco" })).toBe(true);
  });

  it("coluna e detalhe com nomes e a data da decisão", () => {
    expect(placeText(withPlace({}, COCO))).toBe("Coco Bambu Osasco · Osasco/SP");
    expect(placeText(withPlace())).toBe("—");
    expect(placeText(suspensionItem({ vacancy: null }))).toBe("—");

    expect(
      createdByText({ createdByKind: "ADMIN", manualReason: "Briga na loja", createdByAdminName: "Carlos" }),
    ).toBe("Feita pelo suporte (Carlos): “Briga na loja”");
    expect(
      liftedText({
        liftedAt: "2026-11-11T15:00:00.000Z",
        liftedReason: "OTHER",
        liftedNote: "Pedido do dono.",
        liftedByName: "Carlos",
      }),
    ).toBe("Levantada em 11/11 por Carlos. Motivo: Outro. “Pedido do dono.”");
    expect(
      conversationDetail({
        ...suspensionItem(),
        conversationAt: "2026-11-10T15:00:00.000Z",
        conversationByName: "Bia",
      }),
    ).toBe("Feita em 10/11 por Bia");
    const src = suspensionItem().source!;
    expect(
      contestText({
        source: {
          ...src,
          status: "RESOLVED",
          contestedAt: "2026-11-09T15:00:00.000Z",
          resolvedAt: "2026-11-10T15:00:00.000Z",
        },
      }),
    ).toBe("Contestação negada em 10/11");
  });
});

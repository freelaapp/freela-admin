import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VacancyPriceHistorySection } from "./vacancy-price-history-section";
import type { VacancyPriceHistoryEntry } from "@/modules/admin/infrastructure/admin-api";

const history = vi.hoisted(() => ({ data: [] as VacancyPriceHistoryEntry[] }));

vi.mock("@/modules/admin/application/use-vacancy-price-history", () => ({
  useVacancyPriceHistory: () => ({
    data: history.data,
    isLoading: false,
    isError: false,
  }),
}));

function entry(
  changeReason: VacancyPriceHistoryEntry["changeReason"],
  freelancerAmountInCents: number,
  chargeAmountInCents: number,
): VacancyPriceHistoryEntry {
  return {
    calculatedAt: "2026-10-16T18:00:00.000Z",
    changeReason,
    proposalId: null,
    baseAmountInCents: chargeAmountInCents,
    chargeAmountInCents,
    freelancerAmountInCents,
  };
}

describe("VacancyPriceHistorySection", () => {
  it('RAISE_SUGGESTION_ACCEPT → "Aumento sugerido aceito pelo contratante"', () => {
    history.data = [
      entry("CREATE", 9500, 12481),
      entry("RAISE_SUGGESTION_ACCEPT", 12000, 15606),
    ];

    render(<VacancyPriceHistorySection vacancyId="v-1" />);

    expect(
      screen.getByText("Aumento sugerido aceito pelo contratante"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Precificação")).not.toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FREELANCER_METRICS, VACANCY_METRICS } from "@/modules/admin/application/engagement-metrics";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "@/modules/admin/application/engagement.test-fixtures";
import { MetricGrid } from "./metric-grid";

// KpiCard: Card > (cabeçalho com o título) + valor + quebra + comparação.
const card = (title: string) => screen.getByText(title).parentElement?.parentElement as HTMLElement;

describe("MetricGrid", () => {
  it("antes da medição: aberturas com '—' e 'sem comparação' (nunca 0)", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW_BEFORE_MEASUREMENT} metrics={FREELANCER_METRICS} product="all" />);
    const c = card("Abriram o app ou site");
    expect(within(c).getByText("—")).toBeInTheDocument();
    expect(within(c).getByText("sem comparação")).toBeInTheDocument();
    expect(within(c).queryByText("0")).not.toBeInTheDocument();
  });

  it("a ajuda das aberturas diz desde quando há medição", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={FREELANCER_METRICS} product="all" />);
    expect(screen.getByLabelText("Sobre: Abriram o app ou site")).toHaveAttribute(
      "title",
      expect.stringContaining("Medido desde 20/07/2026"),
    );
  });

  it("variação e quebra Empresa × Casa nas vagas", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={VACANCY_METRICS} product="all" />);
    const c = card("Vagas publicadas");
    expect(within(c).getByText("3")).toBeInTheDocument();
    expect(within(c).getByText("anterior: 1 · +200%")).toBeInTheDocument();
    expect(within(c).getByText("Empresa")).toBeInTheDocument();
    expect(within(c).getByText("Casa")).toBeInTheDocument();
  });

  it("com um produto só, sem a quebra", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={VACANCY_METRICS} product="bars_restaurants" />);
    expect(within(card("Vagas publicadas")).queryByText("Empresa")).not.toBeInTheDocument();
  });
});

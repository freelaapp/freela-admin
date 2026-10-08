import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VACANCY_METRICS } from "@/modules/admin/application/engagement-metrics";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";
import { MetricGrid } from "./metric-grid";

// KpiCard: Card > (cabeçalho com o título) + valor + quebra + comparação.
const card = (title: string) => screen.getByText(title).parentElement?.parentElement as HTMLElement;

describe("MetricGrid", () => {
  it("sem dado: '—' e 'sem comparação' (nunca 0)", () => {
    const overview = {
      ...SAMPLE_OVERVIEW,
      vacancies: { ...SAMPLE_OVERVIEW.vacancies, medianHoursToFirstCandidacy: { current: null, previous: 4 } },
    };
    render(<MetricGrid overview={overview} metrics={VACANCY_METRICS} product="all" />);
    const c = card("Tempo até a 1ª candidatura");
    expect(within(c).getByText("—")).toBeInTheDocument();
    expect(within(c).getByText("sem comparação")).toBeInTheDocument();
    expect(within(c).queryByText("0")).not.toBeInTheDocument();
  });

  it("a ajuda de cada cartão vem do registro", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={VACANCY_METRICS} product="all" />);
    expect(screen.getByLabelText("Sobre: Sem candidato")).toHaveAttribute(
      "title",
      "Vagas publicadas no período que não receberam nenhuma candidatura.",
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

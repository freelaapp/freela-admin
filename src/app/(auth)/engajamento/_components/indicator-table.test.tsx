import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONTRACTOR_INDICATORS, FREELANCER_INDICATORS } from "@/modules/admin/application/engagement-metrics";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
  SAMPLE_OVERVIEW_WITHOUT_INDICATORS,
} from "@/modules/admin/application/engagement.test-fixtures";
import { IndicatorTable } from "./indicator-table";

// A tabela (desktop) e os cartões (celular) ficam os dois no DOM; o CSS escolhe.
const desktopRow = (label: string) => {
  const table = screen.getByRole("table");
  return within(table).getByRole("rowheader", { name: new RegExp(`^${label}`) }).closest("tr") as HTMLElement;
};
const mobileCard = (label: string) => {
  const list = screen.getByRole("list");
  return within(list)
    .getAllByRole("listitem")
    .find((li) => li.querySelector("p")?.textContent === label) as HTMLElement;
};

describe("IndicatorTable", () => {
  it("toda linha mostra nome, valor, anterior, parcelas, como calcular e fonte", () => {
    render(<IndicatorTable title="Contratante" defs={CONTRACTOR_INDICATORS} overview={SAMPLE_OVERVIEW} />);
    expect(screen.getByRole("heading", { name: "Contratante" })).toBeInTheDocument();
    expect(screen.getByText("Período: 01/09/2026 a 30/09/2026 · Anterior: 02/08/2026 a 31/08/2026")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1 + CONTRACTOR_INDICATORS.length);
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(CONTRACTOR_INDICATORS.length);

    for (const row of [desktopRow("Abriu a 1ª vaga"), mobileCard("Abriu a 1ª vaga")]) {
      expect(within(row).getByText("40%")).toBeInTheDocument();
      expect(within(row).getByText("33,3%")).toBeInTheDocument();
      expect(within(row).getByText("+20%")).toHaveClass("text-green-500");
      expect(within(row).getByText("2 de 5 cadastrados")).toBeInTheDocument();
      expect(within(row).getByText("1 de 3 cadastrados")).toBeInTheDocument();
      expect(
        within(row).getByText("% dos cadastrados no período que já abriram ao menos 1 vaga (até hoje)"),
      ).toBeInTheDocument();
      expect(
        within(row).getByText("Cadastros do período × vagas abertas por eles (qualquer data)"),
      ).toBeInTheDocument();
    }
  });

  it("menor é melhor: o tempo até a 1ª vaga subir fica vermelho", () => {
    render(<IndicatorTable title="Contratante" defs={CONTRACTOR_INDICATORS} overview={SAMPLE_OVERVIEW} />);
    const row = desktopRow("Tempo até a 1ª vaga");
    expect(within(row).getByText("4,5 dias")).toBeInTheDocument();
    expect(within(row).getByText("+125%")).toHaveClass("text-red-500");
    expect(within(row).getByText("entre 2 que abriram")).toBeInTheDocument();
  });

  it("freelancer: razões com 2 casas e as parcelas da divisão", () => {
    render(<IndicatorTable title="Freelancer" defs={FREELANCER_INDICATORS} overview={SAMPLE_OVERVIEW} />);
    const row = desktopRow("Serviços por freela");
    expect(within(row).getByText("1,50")).toBeInTheDocument();
    expect(within(row).getByText("3 serviços ÷ 2 freelas que trabalharam")).toBeInTheDocument();
    expect(within(row).getByText("1 serviço ÷ 1 freela que trabalhou")).toBeInTheDocument();
    const notWorked = desktopRow("Candidatou e não trabalhou");
    expect(within(notWorked).getByText("1 de 2 ativos (50%)")).toBeInTheDocument();
    // Anterior 0: não há % para comparar.
    expect(within(notWorked).getByText("sem base")).toBeInTheDocument();
  });

  it("antes da medição: acessos com '—' (nunca 0), sem medição e a fonte diz desde quando", () => {
    render(
      <IndicatorTable
        title="Contratante"
        defs={CONTRACTOR_INDICATORS}
        overview={SAMPLE_OVERVIEW_BEFORE_MEASUREMENT}
      />,
    );
    const row = desktopRow("Acessou");
    expect(within(row).getAllByText("—")).toHaveLength(2);
    expect(within(row).queryByText("0")).not.toBeInTheDocument();
    expect(within(row).getAllByText("sem medição neste período")).toHaveLength(2);
    expect(within(row).getByText("sem comparação")).toBeInTheDocument();
    expect(
      within(row).getByText('Registro de acessos (medido desde 07/10/2026; antes disso aparece "—")'),
    ).toBeInTheDocument();
  });

  it("sem o bloco indicators (API antiga): aviso curto no lugar da tabela", () => {
    render(
      <IndicatorTable title="Freelancer" defs={FREELANCER_INDICATORS} overview={SAMPLE_OVERVIEW_WITHOUT_INDICATORS} />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("Indicadores atualizando — publique a API");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

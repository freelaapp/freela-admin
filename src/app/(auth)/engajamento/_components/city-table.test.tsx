import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAMPLE_OVERVIEW_BEFORE_MEASUREMENT } from "@/modules/admin/application/engagement.test-fixtures";
import { CityTable } from "./city-table";

describe("CityTable", () => {
  it("a cidade aparece na tabela (desktop) e no cartão (celular); sem medição mostra '—'", () => {
    render(<CityTable rows={SAMPLE_OVERVIEW_BEFORE_MEASUREMENT.byCity} />);
    expect(screen.getAllByText("Juiz de Fora - MG")).toHaveLength(2);
    expect(screen.getAllByText("0,67")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("sem vaga no período", () => {
    render(<CityTable rows={[]} />);
    expect(screen.getByText("Nenhuma vaga publicada no período.")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";
import { FilterBar } from "./filter-bar";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const F = defaultFilters(NOW);
const CITIES = SAMPLE_OVERVIEW.filterOptions.cities;

describe("FilterBar", () => {
  it("troca o período", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...F, period: "7d" });
  });

  it("personalizado: mostra as datas e diz o que falta", () => {
    render(<FilterBar filters={{ ...F, period: "custom", from: "" }} onChange={vi.fn()} cities={CITIES} />);
    expect((screen.getByLabelText("Data inicial") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a data inicial e a final.");
  });

  it("cidade digitada igual a uma opção vira filtro (cidade + UF); apagar volta a todas", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "gramado - rs" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, city: "Gramado", uf: "RS" });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, city: "", uf: "" });
  });

  it("produto e canal", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "home_services" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, product: "home_services" });
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "app" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, channel: "app" });
  });

  it("na ficha mostra só o período", () => {
    render(<FilterBar filters={F} onChange={vi.fn()} cities={CITIES} periodOnly />);
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Produto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mês passado" })).toBeInTheDocument();
  });

  it("os botões de exportação entram na barra", () => {
    render(
      <FilterBar
        filters={F}
        onChange={vi.fn()}
        cities={CITIES}
        actions={<button type="button">Exportar PDF</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeInTheDocument();
  });

  it("no celular, os botões de exportar ficam fora do bloco recolhido de filtros", () => {
    render(
      <FilterBar filters={F} onChange={vi.fn()} cities={CITIES} actions={<button type="button">Exportar PDF</button>} />,
    );
    expect(screen.getByRole("button", { name: "Exportar PDF" }).closest(".hidden")).toBeNull();
  });
});

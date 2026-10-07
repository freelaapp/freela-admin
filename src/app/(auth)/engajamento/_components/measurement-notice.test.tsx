import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";
import { MeasurementNotice, measurementNotice } from "./measurement-notice";

const P = SAMPLE_OVERVIEW.period;

describe("aviso de medição", () => {
  it("período e comparação medidos: sem aviso", () => {
    expect(measurementNotice("2026-07-20", P)).toBeNull();
  });

  it("começa antes da medição: diz desde quando e explica o '—'", () => {
    const t = measurementNotice("2026-10-07", P);
    expect(t).toContain("Aberturas medidas desde 07/10/2026");
    expect(t).toContain("não é zero");
  });

  it("sem medição nenhuma", () => {
    expect(measurementNotice(null, P)).toContain("ainda não estão sendo medidas");
  });

  it("o componente só aparece quando há aviso", () => {
    const { rerender } = render(<MeasurementNotice measuredSince="2026-07-20" period={P} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    rerender(<MeasurementNotice measuredSince="2026-10-07" period={P} />);
    expect(screen.getByRole("note")).toHaveTextContent("Aberturas medidas desde 07/10/2026");
  });
});

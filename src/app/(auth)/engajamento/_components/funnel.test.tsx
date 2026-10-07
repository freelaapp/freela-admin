import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { freelancerFunnel } from "@/modules/admin/application/engagement-metrics";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "@/modules/admin/application/engagement.test-fixtures";
import { Funnel } from "./funnel";

describe("Funnel", () => {
  it("mostra o valor e o % sobre o 1º passo", () => {
    render(<Funnel title="Funil de freelancers" steps={freelancerFunnel(SAMPLE_OVERVIEW)} />);
    expect(screen.getByText("Funil de freelancers")).toBeInTheDocument();
    expect(screen.getByText("(100%)")).toBeInTheDocument();
    expect(screen.getAllByText("(50%)")).toHaveLength(3);
  });

  it("antes da medição: '—' no 1º passo e nenhum %", () => {
    render(<Funnel title="Funil" steps={freelancerFunnel(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT)} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

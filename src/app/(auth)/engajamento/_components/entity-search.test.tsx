import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_FREELANCER_ROW } from "@/modules/admin/application/engagement.test-fixtures";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

const { useEngagementPeople } = vi.hoisted(() => ({ useEngagementPeople: vi.fn() }));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useEngagementPeople }));
vi.mock("./use-debounced", () => ({ useDebounced: <T,>(v: T) => v }));

import { EntitySearch } from "./entity-search";

const F: EngagementFilters = {
  ...defaultFilters(new Date("2026-10-07T15:00:00.000Z")),
  period: "7d",
  city: "Gramado",
  uf: "RS",
};

beforeEach(() => {
  vi.clearAllMocks();
  useEngagementPeople.mockImplementation((side: string) =>
    side === "freelancer"
      ? { data: { rows: [SAMPLE_FREELANCER_ROW], total: 1, page: 1, limit: 5, truncated: false }, isLoading: false }
      : { data: undefined, isLoading: false },
  );
});

describe("EntitySearch", () => {
  it("só com FREELANCERS: busca só freelancers, sem prender à cidade, e leva à ficha com os filtros", () => {
    render(<EntitySearch filters={F} canFreelancers canCompanies={false} />);
    const input = screen.getByRole("textbox", { name: "Buscar freelancer" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ana" } });
    expect(screen.getByRole("link", { name: /Ana Souza/ })).toHaveAttribute(
      "href",
      "/engajamento/freelancer/u-f1?periodo=7d&cidade=Gramado&uf=RS&aba=freelancers",
    );
    expect(screen.queryByText("Empresas")).not.toBeInTheDocument();
    expect(useEngagementPeople).toHaveBeenCalledWith(
      "freelancer",
      expect.objectContaining({ period: "7d", city: "", uf: "" }),
      expect.objectContaining({ search: "ana", limit: 5, includeNoAccess: true }),
      true,
    );
    expect(useEngagementPeople).toHaveBeenCalledWith("contractor", expect.anything(), expect.anything(), false);
  });

  it("menos de 2 letras não busca", () => {
    render(<EntitySearch filters={F} canFreelancers canCompanies />);
    const input = screen.getByRole("textbox", { name: "Buscar empresa ou freelancer" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    expect(useEngagementPeople).not.toHaveBeenCalledWith("freelancer", expect.anything(), expect.anything(), true);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sem nenhuma das áreas, a busca some", () => {
    const { container } = render(<EntitySearch filters={F} canFreelancers={false} canCompanies={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

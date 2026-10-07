import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_FREELANCER_ROW } from "@/modules/admin/application/engagement.test-fixtures";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

const { useEngagementPeople, listEngagementFreelancers, listEngagementContractors, downloadSheets, toast } =
  vi.hoisted(() => ({
    useEngagementPeople: vi.fn(),
    listEngagementFreelancers: vi.fn(),
    listEngagementContractors: vi.fn(),
    downloadSheets: vi.fn(),
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  }));

vi.mock("@/modules/admin/application/use-engagement", () => ({ useEngagementPeople }));
vi.mock("@/modules/admin/infrastructure/engagement-api", () => ({
  listEngagementFreelancers,
  listEngagementContractors,
}));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./use-debounced", () => ({ useDebounced: <T,>(v: T) => v }));

import { PeopleTable } from "./people-table";

const F: EngagementFilters = {
  ...defaultFilters(new Date("2026-10-07T15:00:00.000Z")),
  period: "custom",
  from: "2026-09-01",
  to: "2026-09-30",
};

const result = (rows: unknown[], total = rows.length) => ({
  data: { rows, total, page: 1, limit: 25, truncated: false },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

beforeEach(() => vi.clearAllMocks());

describe("PeopleTable", () => {
  it("linha com link para a ficha (levando os filtros), status e WhatsApp", () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW]));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    expect(screen.getAllByRole("link", { name: "Ana Souza" })[0]).toHaveAttribute(
      "href",
      "/engajamento/freelancer/u-f1?periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers",
    );
    expect(screen.getAllByText("Esfriando").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("link", { name: /99876-5432/ })[0]).toHaveAttribute(
      "href",
      "https://wa.me/5532998765432",
    );
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  });

  it("página, segmento e contas sem acesso vão para a consulta; trocar filtro volta à página 1", () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW], 60));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ page: 2, limit: 25 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Abriram e não se candidataram" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ segment: "opened_no_apply", page: 1 }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Incluir contas sem acesso" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ includeNoAccess: true, page: 1 }),
    );
  });

  it("exportação com mais de 20.000 linhas: arquivo com as primeiras 20.000 e aviso", async () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW], 25000));
    const rows = Array.from({ length: 20000 }, (_, i) => ({ ...SAMPLE_FREELANCER_ROW, userId: `u-${i}` }));
    listEngagementFreelancers.mockResolvedValue({ rows, total: 25000, page: 1, limit: 20000, truncated: true });
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar lista/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    expect(listEngagementFreelancers).toHaveBeenCalledWith(
      F,
      expect.objectContaining({ exportAll: true, segment: null }),
    );
    const [filename, sheets] = downloadSheets.mock.calls[0];
    expect(filename).toBe("engajamento-freelancers-todos");
    expect(sheets[1].rows).toHaveLength(20001);
    expect(JSON.stringify(sheets[0].rows)).toContain("25.000");
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("primeiras 20.000"));
  });

  it("falha na exportação vira aviso de erro", async () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW]));
    listEngagementFreelancers.mockRejectedValue(new Error("rede"));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar lista/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível exportar a lista. Tente de novo."),
    );
    expect(downloadSheets).not.toHaveBeenCalled();
  });

  it("lista vazia: mensagem e exportar desligado", () => {
    useEngagementPeople.mockReturnValue(result([]));
    render(<PeopleTable side="contractor" filters={F} entries={[]} />);
    expect(screen.getByText("Ninguém neste segmento com esses filtros.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar lista/ })).toBeDisabled();
  });
});

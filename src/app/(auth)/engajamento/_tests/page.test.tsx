import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_WITHOUT_INDICATORS,
} from "@/modules/admin/application/engagement.test-fixtures";

const { replace, nav, auth, overviewHook, peopleHook, downloadSheets } = vi.hoisted(() => ({
  replace: vi.fn(),
  nav: { params: new URLSearchParams() },
  auth: { perms: [] as string[] },
  overviewHook: vi.fn(),
  peopleHook: vi.fn(),
  downloadSheets: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/engajamento",
  useSearchParams: () => nav.params,
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({
    isHydrated: true,
    isSuperAdmin: false,
    hasPermission: (p: string) => auth.perms.includes(p),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/admin/application/use-engagement", () => ({
  useEngagementOverview: overviewHook,
  useEngagementPeople: peopleHook,
}));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("@/modules/admin/infrastructure/engagement-pdf", () => ({ buildOverviewPdf: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/svg-to-png", () => ({ svgToPngDataUrl: vi.fn() }));
vi.mock("../_components/series-chart", () => ({
  SeriesChart: () => <p>grafico</p>,
  SeriesChartForExport: () => null,
}));
vi.mock("../_components/people-table", () => ({
  PeopleTable: ({ side }: { side: string }) => <p>lista-{side}</p>,
}));

import EngajamentoPage from "../page";

const ok = {
  data: SAMPLE_OVERVIEW,
  isLoading: false,
  isError: false,
  isPlaceholderData: false,
  isFetching: false,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = new URLSearchParams();
  auth.perms = [];
  overviewHook.mockReturnValue(ok);
  peopleHook.mockReturnValue({ data: undefined, isLoading: false });
});

describe("/engajamento", () => {
  it("URL inválida cai no padrão e a página abre na visão geral", () => {
    nav.params = new URLSearchParams("periodo=xpto&de=2026-13-40&aba=nada&produto=bar");
    render(<EngajamentoPage />);
    expect(overviewHook).toHaveBeenCalledWith(expect.objectContaining({ period: "this_month", product: "all" }));
    // Visão geral: as 2 tabelas de indicadores no topo, depois gráfico e cidades. Sem funil.
    expect(screen.getByRole("heading", { name: "Contratante" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Freelancer" })).toBeInTheDocument();
    expect(screen.getByText("grafico")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por cidade" })).toBeInTheDocument();
    expect(screen.queryByText(/Funil/)).not.toBeInTheDocument();
  });

  it("API antiga (sem indicators): as tabelas avisam e o resto da tela segue", () => {
    overviewHook.mockReturnValue({ ...ok, data: SAMPLE_OVERVIEW_WITHOUT_INDICATORS });
    render(<EngajamentoPage />);
    expect(screen.getAllByText("Indicadores atualizando — publique a API")).toHaveLength(2);
    expect(screen.getByText("grafico")).toBeInTheDocument();
  });

  it("abas Freelancers e Empresas: a tabela do lado no lugar dos cartões, e a lista continua", () => {
    auth.perms = ["FREELANCERS", "COMPANIES"];
    render(<EngajamentoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Freelancers" }));
    expect(screen.getByRole("heading", { name: "Freelancer" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contratante" })).not.toBeInTheDocument();
    expect(screen.getByText("lista-freelancer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empresas" }));
    expect(screen.getByRole("heading", { name: "Contratante" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Freelancer" })).not.toBeInTheDocument();
    expect(screen.getByText("lista-contractor")).toBeInTheDocument();
  });

  it("personalizado com a data apagada: pede as datas, esconde os números e a URL acompanha", () => {
    nav.params = new URLSearchParams("periodo=custom&de=2026-09-01&ate=2026-09-30");
    render(<EngajamentoPage />);
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "" } });
    expect(screen.getByText("Escolha as datas do período personalizado para ver os números.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contratante" })).not.toBeInTheDocument();
    expect(overviewHook).toHaveBeenLastCalledWith(expect.objectContaining({ period: "custom", from: "" }));
    expect(replace).toHaveBeenLastCalledWith("/engajamento?periodo=custom&ate=2026-09-30", { scroll: false });
  });

  it("sem FREELANCERS/COMPANIES: sem busca e sem listas, mas a visão geral funciona", () => {
    render(<EngajamentoPage />);
    expect(screen.queryByRole("textbox", { name: /Buscar/ })).not.toBeInTheDocument();
    // Tabela (desktop) e cartões (celular) ficam os dois no DOM.
    expect(screen.getAllByText("Abriu a 1ª vaga").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Freelancers" }));
    expect(screen.queryByText("lista-freelancer")).not.toBeInTheDocument();
    expect(screen.getByText(/A lista com contatos fica para quem tem acesso à área Freelancers/)).toBeInTheDocument();
    expect(replace).toHaveBeenLastCalledWith("/engajamento?aba=freelancers", { scroll: false });
  });

  it("com as duas áreas: busca e listas aparecem (a aba vem da URL)", () => {
    auth.perms = ["FREELANCERS", "COMPANIES"];
    nav.params = new URLSearchParams("aba=empresas");
    render(<EngajamentoPage />);
    expect(screen.getByRole("textbox", { name: "Buscar empresa ou freelancer" })).toBeInTheDocument();
    expect(screen.getByText("lista-contractor")).toBeInTheDocument();
  });

  it("erro com botão de tentar de novo", () => {
    const refetch = vi.fn();
    overviewHook.mockReturnValue({ ...ok, data: undefined, isError: true, refetch });
    render(<EngajamentoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Exportar Excel gera as abas do painel, com as 2 tabelas de indicadores", async () => {
    render(<EngajamentoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    const [name, sheets] = downloadSheets.mock.calls[0];
    expect(name).toBe("engajamento-01-09-2026-a-30-09-2026");
    expect(sheets.map((s: { name: string }) => s.name)).toEqual([
      "Filtros",
      "Contratante",
      "Freelancer",
      "Série",
      "Cidades",
    ]);
  });
});

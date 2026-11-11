import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getOrientationQueue: vi.fn(),
  getOrientationQueueCounters: vi.fn(),
  getOrientationQueuePeople: vi.fn(),
  exportOrientationQueue: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock("@/lib/csv", () => csv);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/onboarding/fila",
}));

import FilaPage from "../page";

const counters = {
  counters: {
    pending: { value: 1200, active: 3000, approved: 1500, rejected: 100, booked: 200 },
    pendingActive30: { value: 800, measuredSince: "2026-10-07" },
    freeSeats4w: { value: 80, sessions: 8 },
    weeksToServe: { value: 40, perWeek: 20 },
    approved: { value: 1500 },
  },
  measuredSince: "2026-10-07",
};
const groups = {
  groups: [
    { uf: "SP", count: 700, cities: [{ city: "Campinas", count: 400 }, { city: "Valinhos", count: 300 }] },
    { uf: "RJ", count: 100, cities: [{ city: "Niterói", count: 100 }] },
  ],
  groupsTruncated: false,
};
function row(i: number, over: Record<string, unknown> = {}) {
  return {
    providerGlobalId: `pg${i}`,
    userId: `u${i}`,
    name: `Pessoa ${i}`,
    phone: "11999990000",
    city: "Campinas",
    uf: "SP",
    roles: ["Garçom"],
    signedUpAt: "2026-10-10T15:00:00.000Z",
    totalCompletedServices: 3,
    lastActiveDay: "2026-11-09",
    noShows: 0,
    lastConvokedAt: null,
    notifyRequestedAt: null,
    status: "PENDING",
    ...over,
  };
}
const people = { rows: [row(1), row(2), row(3)], total: 60, page: 1, pageSize: 30 };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FilaPage />
    </QueryClientProvider>,
  );
}

describe("Fila", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    api.getOrientationQueueCounters.mockResolvedValue(counters);
    api.getOrientationQueue.mockResolvedValue(groups);
    api.getOrientationQueuePeople.mockResolvedValue(people);
  });

  it("contadores mostram valor + explicação (conta e fonte)", async () => {
    renderPage();
    expect(await screen.findByText("1.200")).toBeInTheDocument();
    expect(screen.getByText("Pendentes")).toBeInTheDocument();
    expect(screen.getByText(/3\.000 ativos − 1\.500 aprovados − 100 reprovados − 200 com aula marcada/)).toBeInTheDocument();
    expect(screen.getByText(/800 ÷ 20 por semana = 40 semanas/)).toBeInTheDocument();
    expect(screen.getAllByText("Ver a conta").length).toBe(5);
  });

  it("contadores não são relidos quando o filtro muda", async () => {
    const view = renderPage();
    await screen.findByText("1.200");
    nav.search = "situacao=APPROVED";
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FilaPage />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(api.getOrientationQueue).toHaveBeenLastCalledWith(expect.objectContaining({ status: "APPROVED" })));
    expect(api.getOrientationQueueCounters).toHaveBeenCalledTimes(1);
  });

  it("grupos UF → cidade com contagem; clicar na cidade aplica o filtro na URL", async () => {
    renderPage();
    expect(await screen.findByText("SP")).toBeInTheDocument();
    expect(screen.getByText("700")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Valinhos/ }));
    expect(nav.replace).toHaveBeenCalledTimes(1);
    const url = nav.replace.mock.calls[0][0] as string;
    expect(url).toContain("uf=SP");
    expect(url).toContain("cidade=Valinhos");
  });

  it("grupos cortados: mostra aviso", async () => {
    api.getOrientationQueue.mockResolvedValue({ ...groups, groupsTruncated: true });
    renderPage();
    expect(await screen.findByText(/Só aparecem as maiores cidades/)).toBeInTheDocument();
  });

  it("filtros: situação, acesso, faltas, convocado, pediu aviso, já trabalhou, função, cadastro, cidade", async () => {
    renderPage();
    await screen.findAllByText("Pessoa 1");
    const change = (label: RegExp, value: string) => {
      nav.replace.mockClear();
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      return nav.replace.mock.calls[0][0] as string;
    };
    expect(change(/Situação/, "APPROVED")).toContain("situacao=APPROVED");
    expect(change(/Acessou nos últimos/, "0")).toContain("ativoEm=0");
    expect(change(/Faltas/, "NONE")).toContain("faltas=NONE");
    expect(change(/Convocado/, "EVER")).toContain("convocado=EVER");
    expect(change(/Pediu aviso/, "sim")).toContain("pediuAviso=sim");
    expect(change(/Já trabalhou/, "nao")).toContain("jaTrabalhou=nao");
    expect(change(/Cadastro de/, "2026-10-01")).toContain("cadastroDe=2026-10-01");
    expect(change(/Cadastro até/, "2026-10-31")).toContain("cadastroAte=2026-10-31");
    nav.replace.mockClear();
    const role = screen.getByLabelText(/Função/);
    fireEvent.change(role, { target: { value: "Cozinha" } });
    fireEvent.blur(role);
    expect(nav.replace.mock.calls[0][0]).toContain("funcao=Cozinha");
    nav.replace.mockClear();
    const city = screen.getByLabelText(/^Cidade/);
    fireEvent.change(city, { target: { value: "Jundiaí" } });
    fireEvent.keyDown(city, { key: "Enter" });
    expect(nav.replace.mock.calls[0][0]).toContain("cidade=Jund");
  });

  it('situação não tem "Todas"', async () => {
    renderPage();
    await screen.findAllByText("Pessoa 1");
    const opts = within(screen.getByLabelText(/Situação/)).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["Pendente", "Aula marcada", "Aprovado", "Reprovado"]);
  });

  it("sem providerGlobalId: checkbox desabilitado com o motivo visível", async () => {
    api.getOrientationQueuePeople.mockResolvedValue({
      rows: [row(1), row(2, { providerGlobalId: null })],
      total: 2,
      page: 1,
      pageSize: 30,
    });
    renderPage();
    await screen.findAllByText("Pessoa 2");
    const box = within(screen.getByRole("table")).getByLabelText("Selecionar Pessoa 2");
    expect(box).toBeDisabled();
    const id = box.getAttribute("aria-describedby") as string;
    expect(document.getElementById(id)).toHaveTextContent("Sem convite: cadastro antigo");
    const all = within(screen.getByRole("table")).getByLabelText("Selecionar todos");
    fireEvent.click(all);
    expect(within(screen.getByRole("table")).getByLabelText("Selecionar Pessoa 1")).toBeChecked();
    expect(box).not.toBeChecked();
    expect(all).toBeChecked();
  });

  it("selecionar todos fica desabilitado quando ninguém pode ser marcado; parcial = indeterminado", async () => {
    api.getOrientationQueuePeople.mockResolvedValue({
      rows: [row(1, { providerGlobalId: null })],
      total: 1,
      page: 1,
      pageSize: 30,
    });
    const first = renderPage();
    await screen.findAllByText("Pessoa 1");
    expect(within(screen.getByRole("table")).getByLabelText("Selecionar todos")).toBeDisabled();
    first.unmount();
    api.getOrientationQueuePeople.mockResolvedValue(people);
    renderPage();
    await screen.findAllByText("Pessoa 1");
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByLabelText("Selecionar Pessoa 1"));
    expect((within(table).getByLabelText("Selecionar todos") as HTMLInputElement).indeterminate).toBe(true);
  });

  it("cadastro mostra o dia de Brasília (perto da meia-noite UTC)", async () => {
    api.getOrientationQueuePeople.mockResolvedValue({
      rows: [row(1, { signedUpAt: "2026-10-11T01:30:00.000Z" })],
      total: 1,
      page: 1,
      pageSize: 30,
    });
    renderPage();
    await screen.findAllByText("Pessoa 1");
    expect(within(screen.getByRole("table")).getByText("10/10/2026")).toBeInTheDocument();
  });

  it("voltar a um filtro anterior não traz a seleção antiga", async () => {
    const view = renderPage();
    await screen.findAllByText("Pessoa 1");
    fireEvent.click(within(screen.getByRole("table")).getByLabelText("Selecionar Pessoa 1"));
    expect(screen.getByText("1 selecionado nesta página")).toBeInTheDocument();
    const rerenderWith = (search: string) => {
      nav.search = search;
      view.rerender(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FilaPage />
        </QueryClientProvider>,
      );
    };
    rerenderWith("situacao=APPROVED");
    rerenderWith("");
    await screen.findAllByText("Pessoa 1");
    expect(screen.queryByText(/selecionado/)).not.toBeInTheDocument();
  });

  it("filtros vêm da URL", async () => {
    nav.search = "situacao=BOOKED&faltas=NONE&ativoEm=0";
    renderPage();
    await screen.findAllByText("Pessoa 1");
    expect(screen.getByLabelText(/Situação/)).toHaveValue("BOOKED");
    expect(screen.getByLabelText(/Faltas/)).toHaveValue("NONE");
    expect(api.getOrientationQueuePeople).toHaveBeenCalledWith(
      expect.objectContaining({ status: "BOOKED", noShows: "NONE", activeWithinDays: 0 }),
      1,
    );
  });

  it('"Selecionar todos" marca só a página; trocar de página limpa a seleção', async () => {
    renderPage();
    await screen.findAllByText("Pessoa 1");
    const table = screen.getByRole("table");
    fireEvent.click(within(table).getByLabelText("Selecionar todos"));
    expect(within(table).getByLabelText("Selecionar Pessoa 2")).toBeChecked();
    expect(screen.getByText("3 selecionados nesta página")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(api.getOrientationQueuePeople).toHaveBeenLastCalledWith(expect.anything(), 2));
    await waitFor(() => expect(screen.queryByText(/selecionados nesta página/)).not.toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByLabelText("Selecionar Pessoa 2")).not.toBeChecked();
  });

  it("Exportar CSV chama downloadCsv com queueCsv", async () => {
    api.exportOrientationQueue.mockResolvedValue({ rows: [row(1)], total: 1, truncated: false });
    renderPage();
    await screen.findAllByText("Pessoa 1");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalledTimes(1));
    const [name, header, rows] = csv.downloadCsv.mock.calls[0];
    expect(name).toMatch(/^fila-onboarding-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(header[0]).toBe("Nome");
    expect(rows[0][0]).toBe("Pessoa 1");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("export cortado: aviso com os números", async () => {
    api.exportOrientationQueue.mockResolvedValue({ rows: [row(1)], total: 45000, truncated: true });
    renderPage();
    await screen.findAllByText("Pessoa 1");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(await screen.findByText("Exportados 1 de 45.000. Filtre por cidade para ver o resto.")).toBeInTheDocument();
  });

  it("export com 429: texto amigável", async () => {
    const err = new AxiosError("x");
    err.response = { status: 429, data: {}, statusText: "", headers: {}, config: {} as never };
    api.exportOrientationQueue.mockRejectedValue(err);
    renderPage();
    await screen.findAllByText("Pessoa 1");
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("3 por minuto")));
    expect(csv.downloadCsv).not.toHaveBeenCalled();
  });

  it("carregando", () => {
    api.getOrientationQueuePeople.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByRole("status", { name: "Carregando" }).length).toBeGreaterThan(0);
  });

  it("vazio", async () => {
    api.getOrientationQueuePeople.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 30 });
    renderPage();
    expect(await screen.findByText("Ninguém na fila com esses filtros")).toBeInTheDocument();
  });

  it("erro na lista: botão tentar de novo", async () => {
    api.getOrientationQueuePeople.mockRejectedValueOnce(new Error("x"));
    renderPage();
    const retry = await screen.findByRole("button", { name: "Tentar de novo" });
    fireEvent.click(retry);
    expect((await screen.findAllByText("Pessoa 1")).length).toBeGreaterThan(0);
  });

  it("sucesso: mostra pessoas com situação", async () => {
    renderPage();
    expect((await screen.findAllByText("Pessoa 1")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getByText("60 pessoas")).toBeInTheDocument();
  });
});

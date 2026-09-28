import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsultorDashboardPage from "../page";
import type { ConsultantProfile, RegistrationItem } from "@/modules/consultant/domain/types";

const api = vi.hoisted(() => ({
  listRegistrationsApi: vi.fn(),
  getConsultantProfileApi: vi.fn(),
}));

vi.mock("@/modules/consultant/infrastructure/consultant-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listRegistrationsApi: api.listRegistrationsApi,
  getConsultantProfileApi: api.getConsultantProfileApi,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const item = (overrides: Partial<RegistrationItem> = {}): RegistrationItem => ({
  id: "u1",
  userId: "u1",
  name: "Zé do Bar",
  email: "ze@bar.com",
  phone: "+5585999998888",
  persona: "contractor",
  module: "bars-restaurants",
  companyName: "Bar do Zé",
  city: "Fortaleza",
  uf: "CE",
  source: "LINK",
  hasVacancy: true,
  status: "active",
  createdAt: "2026-09-01T15:00:00.000Z",
  ...overrides,
});

const freela = item({
  id: "u2",
  userId: "u2",
  name: "Maria Freela",
  persona: "provider",
  module: null,
  companyName: null,
  city: null,
  uf: null,
  source: "ON_BEHALF",
  hasVacancy: false,
  status: "pending",
});

const profile = {
  totals: { registrations: 37, freelancers: 21, contractors: 16, contractorsWithVacancy: 9 },
} as ConsultantProfile;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsultorDashboardPage />
    </QueryClientProvider>,
  );
}

describe("Meus cadastros (consultor)", () => {
  beforeEach(() => {
    api.listRegistrationsApi
      .mockReset()
      .mockResolvedValue({ total: 2, page: 1, pageSize: 50, items: [item(), freela] });
    api.getConsultantProfileApi.mockReset().mockResolvedValue(profile);
  });

  it("mostra empresa, tipo, cidade, origem, telefone completo e os totais", async () => {
    renderPage();

    expect((await screen.findAllByText("Bar do Zé")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fortaleza/CE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pelo link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cadastrado por mim").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Freelancer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(85) 99999-8888").length).toBeGreaterThan(0);
    expect(await screen.findByText("37")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(api.listRegistrationsApi).toHaveBeenCalledWith({
      type: "all",
      q: "",
      page: 1,
      pageSize: 50,
    });
  });

  it("filtro por tipo volta para a página 1", async () => {
    renderPage();
    await screen.findAllByText("Bar do Zé");

    fireEvent.click(screen.getByRole("radio", { name: "Contratantes" }));

    await waitFor(() =>
      expect(api.listRegistrationsApi).toHaveBeenLastCalledWith({
        type: "contractor",
        q: "",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("busca manda o termo aparado depois da pausa de digitação", async () => {
    renderPage();
    await screen.findAllByText("Bar do Zé");

    fireEvent.change(screen.getByPlaceholderText("Buscar por nome, e-mail ou telefone..."), {
      target: { value: "  ana " },
    });

    await waitFor(() =>
      expect(api.listRegistrationsApi).toHaveBeenLastCalledWith({
        type: "all",
        q: "ana",
        page: 1,
        pageSize: 50,
      }),
    );
  });

  it("paginação: próxima página e botão desativado na última", async () => {
    api.listRegistrationsApi.mockResolvedValue({
      total: 120,
      page: 1,
      pageSize: 50,
      items: [item()],
    });
    renderPage();

    expect(await screen.findByText("120 cadastro(s) · página 1 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(api.listRegistrationsApi).toHaveBeenLastCalledWith({
        type: "all",
        q: "",
        page: 2,
        pageSize: 50,
      }),
    );
  });

  it("uma página só: Próxima e Anterior desativados", async () => {
    renderPage();

    expect(await screen.findByText("2 cadastro(s) · página 1 de 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  });

  it("conta sem cadastros e sem filtro: estado vazio com atalho", async () => {
    api.listRegistrationsApi.mockResolvedValue({ total: 0, page: 1, pageSize: 50, items: [] });
    renderPage();

    expect(await screen.findByText("Nenhum cadastro ainda")).toBeInTheDocument();
  });
});

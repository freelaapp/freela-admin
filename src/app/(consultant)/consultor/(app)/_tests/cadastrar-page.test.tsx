import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsultorCadastrarPage from "../cadastrar/page";

const api = vi.hoisted(() => ({ createRegistrationApi: vi.fn() }));

vi.mock("@/modules/consultant/infrastructure/consultant-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createRegistrationApi: api.createRegistrationApi,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsultorCadastrarPage />
    </QueryClientProvider>,
  );
}

describe("Novo cadastro (consultor) — Freela em Casa encerrado", () => {
  beforeEach(() => {
    api.createRegistrationApi.mockReset().mockResolvedValue({
      userId: "u1",
      inviteSentByWhatsApp: true,
      inviteSentByEmail: false,
      firstAccessPassword: "Qx7#vT2m",
    });
  });

  it("contratante não oferece mais 'Serviços (Freela em Casa)' e nasce como empresa", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Contratante" }));

    expect(screen.queryByText(/Freela em Casa/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/Contratante = empresa \(bar ou restaurante\)/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Bar do Zé" } });
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), { target: { value: "85 99999-8888" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => expect(api.createRegistrationApi).toHaveBeenCalledTimes(1));
    expect(api.createRegistrationApi.mock.calls[0][0]).toEqual({
      persona: "contractor",
      module: "bars-restaurants",
      name: "Bar do Zé",
      phone: "+5585999998888",
    });
  });

  it("mostra a senha que a API gerou (aleatória), nunca uma fixa", async () => {
    api.createRegistrationApi.mockResolvedValue({
      userId: "u1",
      inviteSentByWhatsApp: true,
      inviteSentByEmail: false,
      firstAccessPassword: "Qx7#vT2m",
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), { target: { value: "85 99999-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("Qx7#vT2m")).toBeInTheDocument();
    expect(screen.queryByText("Mudar@123")).not.toBeInTheDocument();
  });

  it("sem a senha na resposta: diz que foi no convite, sem inventar 'Mudar@123'", async () => {
    api.createRegistrationApi.mockResolvedValue({
      userId: "u1",
      inviteSentByWhatsApp: true,
      inviteSentByEmail: false,
    });
    renderPage();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), { target: { value: "85 99999-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(await screen.findByText("A senha de primeiro acesso foi enviada no convite.")).toBeInTheDocument();
    expect(screen.queryByText("Mudar@123")).not.toBeInTheDocument();
    expect(screen.queryByText("Senha de 1º acesso")).not.toBeInTheDocument();
    // E não manda "passar a senha acima" quando não há senha nenhuma na tela.
    expect(screen.queryByText(/passe a senha acima/)).not.toBeInTheDocument();
  });

  it("freelancer segue sem segmento", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), { target: { value: "85 99999-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => expect(api.createRegistrationApi).toHaveBeenCalledTimes(1));
    expect(api.createRegistrationApi.mock.calls[0][0]).toEqual({
      persona: "provider",
      name: "Maria",
      phone: "+5585999997777",
    });
  });
});

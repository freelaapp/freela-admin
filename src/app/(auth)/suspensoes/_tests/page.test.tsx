import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/suspensions-api", () => ({
  listSuspensions: vi.fn(),
  createSuspension: vi.fn(),
  liftSuspension: vi.fn(),
  registerSuspensionConversation: vi.fn(),
  keepInfraction: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/admin-api", () => ({
  getAdminProviders: vi.fn(),
}));

import { toast } from "sonner";
import {
  createSuspension,
  keepInfraction,
  liftSuspension,
  listSuspensions,
  registerSuspensionConversation,
} from "@/modules/admin/infrastructure/suspensions-api";
import { getAdminProviders } from "@/modules/admin/infrastructure/admin-api";
import {
  suspensionItem,
  suspensionList,
} from "@/modules/admin/application/suspensions.test-fixtures";
import SuspensoesPage from "../page";

function apiError(status: number, code: string, message = "x") {
  return new AxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message } },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <SuspensoesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Fluxo v2, fatia G: a página "Suspensões" do admin (designer, lote 2 §5.5). */
describe("Suspensões (admin)", () => {
  it("carregando: esqueleto", () => {
    vi.mocked(listSuspensions).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByTestId("suspension-skeleton")).toHaveLength(3);
  });

  it("chave da API desligada (404 FEATURE_DISABLED): avisa, sem erro e sem insistir", async () => {
    vi.mocked(listSuspensions).mockRejectedValue(apiError(404, "FEATURE_DISABLED"));
    renderPage();
    expect(await screen.findByText("As consequências novas ainda não estão ligadas.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspender" })).not.toBeInTheDocument();
    expect(listSuspensions).toHaveBeenCalledTimes(1);
  });

  it("erro: mensagem e Tentar de novo; vazio: o texto do designer", async () => {
    vi.mocked(listSuspensions).mockRejectedValue(new Error("Network Error"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar as suspensões. Tente de novo.");
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([]));
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Ninguém está sem poder se candidatar agora.")).toBeInTheDocument();
  });

  it("lista: as colunas, o aviso do jurídico e as abas", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText(/não pode ser ligada antes do OK do jurídico/)).toBeInTheDocument();
    const row = screen.getByText("Ana Souza").closest("tr")!;
    expect(within(row).getByText("Falta sem aviso")).toBeInTheDocument();
    expect(within(row).getByText("sáb 14/11, depois da conversa")).toBeInTheDocument();
    expect(within(row).getByText("Pendente")).toBeInTheDocument();
    expect(within(row).getByText("Garçom, sáb 07/11 · pode contestar até ter 10/11 às 18h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Todas" }));
    await waitFor(() => expect(listSuspensions).toHaveBeenLastCalledWith("all"));
  });

  it("levantar: \"Outro\" pede a nota; com ela, chama a rota com o motivo", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
    vi.mocked(liftSuspension).mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Levantar suspensão" }));
    const dialog = screen.getByRole("dialog", { name: "Levantar suspensão?" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Outro" }));
    const submit = within(dialog).getByRole("button", { name: "Levantar suspensão" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/O que aconteceu/), {
      target: { value: "Pedido do dono." },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(liftSuspension).toHaveBeenCalledWith("susp-1", { reason: "OTHER", note: "Pedido do dono." }),
    );
    expect(toast.success).toHaveBeenCalledWith("Suspensão levantada.");
  });

  it("registrar conversa e manter a ocorrência contestada (P-G4)", async () => {
    const contested = suspensionItem({
      source: {
        ...suspensionItem().source!,
        status: "CONTESTED",
        justification: "Eu estava lá.",
        contestReason: "EMERGENCY",
        contest: { status: "SENT", until: null },
      },
    });
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([contested]));
    vi.mocked(registerSuspensionConversation).mockResolvedValue({});
    vi.mocked(keepInfraction).mockResolvedValue({});
    renderPage();
    expect(await screen.findByText(/Emergência: “Eu estava lá.”/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar conversa" }));
    const conv = screen.getByRole("dialog", { name: "Registrar conversa" });
    fireEvent.click(within(conv).getByRole("button", { name: "Registrar conversa" }));
    await waitFor(() => expect(registerSuspensionConversation).toHaveBeenCalledWith("susp-1", {}));

    fireEvent.click(screen.getByRole("button", { name: "Manter a ocorrência" }));
    const keep = screen.getByRole("dialog", { name: "Manter a ocorrência?" });
    const submit = within(keep).getByRole("button", { name: "Manter a ocorrência" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(keep).getByLabelText(/Por que mantém/), { target: { value: "Sem prova." } });
    fireEvent.click(submit);
    await waitFor(() => expect(keepInfraction).toHaveBeenCalledWith("inf-1", "Sem prova."));
  });

  it("suspender: busca a pessoa, dias e motivo obrigatório", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([]));
    vi.mocked(getAdminProviders).mockResolvedValue({
      data: [{ id: "p1", providerGlobalId: "g-bia", name: "Bia Lima", phone: "5511977776666", email: null } as never],
      total: 1,
      page: 1,
      limit: 5,
    });
    vi.mocked(createSuspension).mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    const dialog = screen.getByRole("dialog", { name: "Suspender freelancer" });
    fireEvent.change(within(dialog).getByLabelText(/Freelancer \(nome/), { target: { value: "Bia" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscar" }));
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Bia Lima/ }));
    const submit = within(dialog).getByRole("button", { name: "Suspender" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo \(obrigatório/), {
      target: { value: "Desrespeitou a equipe da loja." },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(createSuspension).toHaveBeenCalledWith({
        providerGlobalId: "g-bia",
        days: 7,
        requiresConversation: true,
        reason: "Desrespeitou a equipe da loja.",
      }),
    );
  });
});

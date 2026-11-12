import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getGoogleConnection: vi.fn(),
  startGoogleConnect: vi.fn(),
  disconnectGoogle: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { GoogleAccountCard } from "../_components/google-account-card";

const conn = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  configured: true,
  scope: "app.created",
  connection: null,
  ...over,
});
const active = {
  googleEmail: "ana@gmail.com",
  status: "ACTIVE",
  lastError: null,
  connectedAt: "2026-11-11T15:00:00.000Z",
  calendarMode: "SECONDARY",
};

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GoogleAccountCard />
    </QueryClientProvider>,
  );
}

describe("GoogleAccountCard", () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  });

  it("hidden: o cartão não renderiza nada (API sem as rotas ou chave desligada)", async () => {
    api.getGoogleConnection.mockResolvedValue(null);
    const { container } = renderCard();
    await waitFor(() => expect(api.getGoogleConnection).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
    api.getGoogleConnection.mockResolvedValue(conn({ enabled: false }));
    const second = renderCard();
    await new Promise((r) => setTimeout(r, 10));
    expect(second.container).toBeEmptyDOMElement();
  });

  it("not-configured: só o texto", async () => {
    api.getGoogleConnection.mockResolvedValue(conn({ configured: false }));
    renderCard();
    expect(await screen.findByText("A conexão com o Google ainda não foi configurada no servidor.")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Conectar chama startGoogleConnect e faz window.location.assign(url)", async () => {
    api.getGoogleConnection.mockResolvedValue(conn());
    api.startGoogleConnect.mockResolvedValue({ url: "https://accounts.google.com/auth?x=1" });
    renderCard();
    expect(await screen.findByText(/Conecte a sua conta Google/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Conectar Google Agenda" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://accounts.google.com/auth?x=1"));
  });

  it("Conectar com erro: mensagem genérica, sem navegar", async () => {
    api.getGoogleConnection.mockResolvedValue(conn());
    api.startGoogleConnect.mockRejectedValue(new Error("invalid_client secret"));
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Conectar Google Agenda" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para conectar o Google agora. Tente de novo."));
    expect(assign).not.toHaveBeenCalled();
  });

  it("Conectar com URL fora de accounts.google.com: erro genérico, sem redirecionar", async () => {
    api.getGoogleConnection.mockResolvedValue(conn());
    api.startGoogleConnect.mockResolvedValue({ url: "https://evil.example.com/auth" });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Conectar Google Agenda" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para conectar o Google agora. Tente de novo."));
    expect(assign).not.toHaveBeenCalled();
  });

  it("googleEmail nulo: 'Conectado.' e diálogo sem e-mail", async () => {
    api.getGoogleConnection.mockResolvedValue(conn({ connection: { ...active, googleEmail: null } }));
    renderCard();
    expect(await screen.findByText("Conectado.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(
      await screen.findByText("Desconectar a conta Google? As turmas já criadas continuam com o link."),
    ).toBeVisible();
  });

  it("connected: e-mail, nota do Gmail e Desconectar", async () => {
    api.getGoogleConnection.mockResolvedValue(conn({ connection: active }));
    renderCard();
    expect(await screen.findByText("Conectado como ana@gmail.com.")).toBeVisible();
    expect(
      screen.getByText(
        "Gmail pessoal corta a chamada em grupo com 60 minutos. Use turmas de até 55 minutos ou uma conta Google Workspace.",
      ),
    ).toBeVisible();
  });

  it("Desconectar abre Dialog de confirmação; sem window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    api.getGoogleConnection.mockResolvedValue(conn({ connection: active }));
    api.disconnectGoogle.mockResolvedValue({ revokedAtGoogle: true });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    expect(
      await screen.findByText("Desconectar a conta ana@gmail.com? As turmas já criadas continuam com o link."),
    ).toBeVisible();
    expect(api.disconnectGoogle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(api.disconnectGoogle).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("confirmar o Dialog chama disconnectGoogle", async () => {
    api.getGoogleConnection.mockResolvedValue(conn({ connection: active }));
    api.disconnectGoogle.mockResolvedValue({ revokedAtGoogle: true });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    await screen.findByRole("button", { name: "Manter" });
    const buttons = screen.getAllByRole("button", { name: "Desconectar" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api.disconnectGoogle).toHaveBeenCalledTimes(1));
  });

  it("needs-reconnect: mostra lastError e Conectar de novo", async () => {
    api.getGoogleConnection.mockResolvedValue(
      conn({ connection: { ...active, status: "REVOKED", lastError: "O acesso foi removido na conta Google." } }),
    );
    renderCard();
    expect(await screen.findByText("O acesso foi removido na conta Google.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Conectar de novo" })).toBeVisible();
  });
});

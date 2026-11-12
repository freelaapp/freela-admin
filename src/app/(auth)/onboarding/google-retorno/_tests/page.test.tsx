import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ completeGoogleConnect: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/orientation-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.search) }));

import GoogleRetornoPage from "../page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <GoogleRetornoPage />
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe("Retorno do Google", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
  });

  it("chama completeGoogleConnect UMA vez mesmo com o efeito rodando duas vezes (StrictMode)", async () => {
    nav.search = "code=C1&state=S1";
    api.completeGoogleConnect.mockResolvedValue({ connection: { googleEmail: "x@y.com" } });
    renderPage();
    await screen.findByText("Conectado como x@y.com");
    expect(api.completeGoogleConnect).toHaveBeenCalledTimes(1);
    expect(api.completeGoogleConnect).toHaveBeenCalledWith({ code: "C1", state: "S1" }, expect.anything());
  });

  it("tira code e state da barra antes de chamar a API", async () => {
    nav.search = "code=C1&state=S1";
    const order: string[] = [];
    replaceState.mockImplementation(() => {
      order.push("replace");
    });
    api.completeGoogleConnect.mockImplementation(async () => {
      order.push("api");
      return { connection: { googleEmail: "x@y.com" } };
    });
    renderPage();
    await screen.findByText("Conectado como x@y.com");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/onboarding/google-retorno");
    expect(order[0]).toBe("replace");
    expect(order).toContain("api");
  });

  it("?error=access_denied: cancelou, sem chamar a API", async () => {
    nav.search = "error=access_denied";
    renderPage();
    expect(await screen.findByText("Você cancelou a conexão com o Google.")).toBeVisible();
    expect(api.completeGoogleConnect).not.toHaveBeenCalled();
  });

  it("sem code/state (recarregou): orienta, sem chamar a API", async () => {
    nav.search = "";
    renderPage();
    expect(await screen.findByText("Abra Configurações e toque em Conectar de novo.")).toBeVisible();
    expect(api.completeGoogleConnect).not.toHaveBeenCalled();
  });

  it("erro da API: googleErrorMessage, nunca a message do Google", async () => {
    nav.search = "code=C1&state=S1";
    api.completeGoogleConnect.mockRejectedValue(
      new AxiosError("x", "400", undefined, undefined, {
        status: 422,
        data: { error: { code: "GOOGLE_SCOPE_MISSING", message: "invalid_grant do google" } },
      } as never),
    );
    renderPage();
    expect(
      await screen.findByText("Para criar as aulas, marque a permissão da agenda na tela do Google."),
    ).toBeVisible();
    expect(screen.queryByText(/invalid_grant/)).toBeNull();
  });

  it("erro desconhecido: texto genérico", async () => {
    nav.search = "code=C1&state=S1";
    api.completeGoogleConnect.mockRejectedValue(new Error("segredo do google"));
    renderPage();
    expect(await screen.findByText("Não deu para conectar o Google agora. Tente de novo.")).toBeVisible();
    expect(screen.queryByText(/segredo/)).toBeNull();
  });

  it("sucesso: link para Configurações", async () => {
    nav.search = "code=C1&state=S1";
    api.completeGoogleConnect.mockResolvedValue({ connection: { googleEmail: "x@y.com" } });
    renderPage();
    const link = await screen.findByRole("link", { name: "Voltar para Configurações" });
    expect(link).toHaveAttribute("href", "/onboarding/configuracoes");
    await waitFor(() => expect(api.completeGoogleConnect).toHaveBeenCalledTimes(1));
  });
});

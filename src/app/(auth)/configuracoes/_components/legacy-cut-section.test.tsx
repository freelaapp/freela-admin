// src/app/(auth)/configuracoes/_components/legacy-cut-section.test.tsx
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGACY_CUT_ITEMS, LegacyCutSection } from "./legacy-cut-section";

const api = vi.hoisted(() => ({ fetchNotificationEvents: vi.fn(), setLegacyCut: vi.fn() }));
const payload = (legacyCut: object) => ({ events: [], legacyCut });
vi.mock("@/modules/admin/infrastructure/notification-events-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><LegacyCutSection /></QueryClientProvider>);
}

async function enabledSwitch() {
  const sw = await screen.findByRole("switch", { name: "Cortar WhatsApp antigo" });
  await waitFor(() => expect(sw).toBeEnabled());
  return sw;
}

describe("LegacyCutSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchNotificationEvents.mockResolvedValue(payload({ enabled: false, updatedAt: null, updatedBy: null }));
  });

  it("lista os 18 avisos e o alerta de SPF/DKIM", async () => {
    renderSection();
    expect(await screen.findByText("Cortar WhatsApp antigo")).toBeInTheDocument();
    expect(LEGACY_CUT_ITEMS).toHaveLength(18);
    for (const item of LEGACY_CUT_ITEMS) expect(screen.getByText(item)).toBeInTheDocument();
    expect(screen.getByText(/Ligue só depois de ativar SPF\/DKIM no domínio de e-mail/)).toBeInTheDocument();
  });

  it("pede confirmação antes de ligar", async () => {
    api.setLegacyCut.mockResolvedValue({ enabled: true, updatedAt: "2026-10-02T13:00:00.000Z", updatedBy: "Denner" });
    renderSection();
    fireEvent.click(await enabledSwitch());
    expect(api.setLegacyCut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ligar o corte" }));
    await waitFor(() => expect(api.setLegacyCut).toHaveBeenCalledWith(true));
    expect(await screen.findByText(/Ligado por Denner/)).toBeInTheDocument();
  });

  it("cancelar a confirmação não muda nada", async () => {
    renderSection();
    fireEvent.click(await enabledSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.setLegacyCut).not.toHaveBeenCalled();
  });

  it("mostra quem ligou e quando", async () => {
    api.fetchNotificationEvents.mockResolvedValue(payload({ enabled: true, updatedAt: "2026-10-02T13:00:00.000Z", updatedBy: "Diego" }));
    renderSection();
    expect(await screen.findByText(/Ligado por Diego em 02\/10\/2026/)).toBeInTheDocument();
  });

  it("mostra a mensagem da API quando a mudança é recusada", async () => {
    const err = new AxiosError("fail");
    err.response = { data: { error: { code: "FORBIDDEN_ROLE", message: "Seu perfil não pode alterar o WhatsApp oficial." } } } as AxiosError["response"];
    api.setLegacyCut.mockRejectedValue(err);
    renderSection();
    fireEvent.click(await enabledSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Ligar o corte" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Seu perfil não pode alterar o WhatsApp oficial."));
  });
});

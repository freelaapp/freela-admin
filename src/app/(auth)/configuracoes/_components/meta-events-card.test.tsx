import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MetaEventsCard } from "./meta-events-card";

const api = vi.hoisted(() => ({
  listNotificationEvents: vi.fn(),
  setNotificationEvent: vi.fn(),
  submitNotificationTemplate: vi.fn(),
  sendNotificationTest: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/notification-events-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const row = (over: object = {}) => ({
  eventKey: "W01_VAGA_APROVADA",
  label: "Aprovado na vaga (confirme)",
  audience: "provider",
  metaEnabled: false,
  updatedAt: null,
  template: { name: "vaga_aprovada_confirmar_v1", status: "APPROVED", category: "UTILITY", rejectedReason: null },
  categoryWarning: false,
  last7Days: { sent: 12, delivered: 11, read: 9, failed: 0 },
  ...over,
});

function apiError(message: string) {
  const err = new AxiosError("fail");
  err.response = { data: { error: { code: "X", message } } } as AxiosError["response"];
  return err;
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MetaEventsCard /></QueryClientProvider>);
}

describe("MetaEventsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o aviso, a situação do modelo e os números", async () => {
    api.listNotificationEvents.mockResolvedValue([row()]);
    renderCard();
    expect(await screen.findByText("Aprovado na vaga (confirme)")).toBeInTheDocument();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText(/12 enviados · 11 entregues · 9 lidos · 0 falhas/)).toBeInTheDocument();
  });

  it("liga o aviso", async () => {
    api.listNotificationEvents.mockResolvedValue([row()]);
    api.setNotificationEvent.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(await screen.findByRole("switch", { name: /Aprovado na vaga/ }));
    await waitFor(() => expect(api.setNotificationEvent).toHaveBeenCalledWith("W01_VAGA_APROVADA", true));
  });

  it("interruptor desabilitado quando o modelo não foi aprovado", async () => {
    api.listNotificationEvents.mockResolvedValue([row({ template: { name: "x", status: "PENDING", category: null, rejectedReason: null } })]);
    renderCard();
    expect(await screen.findByRole("switch", { name: /Aprovado na vaga/ })).toBeDisabled();
    expect(screen.getByText("Em análise na Meta")).toBeInTheDocument();
  });

  it("mostra o motivo da recusa e o botão de enviar para aprovação", async () => {
    api.listNotificationEvents.mockResolvedValue([row({ template: { name: "x", status: "REJECTED", category: null, rejectedReason: "INVALID_FORMAT" } })]);
    api.submitNotificationTemplate.mockResolvedValue(undefined);
    renderCard();
    expect(await screen.findByText(/INVALID_FORMAT/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(api.submitNotificationTemplate).toHaveBeenCalledWith("W01_VAGA_APROVADA"));
  });

  it("recarrega a lista depois de enviar para aprovação", async () => {
    api.listNotificationEvents
      .mockResolvedValueOnce([row({ template: { name: "x", status: "MISSING", category: null, rejectedReason: null } })])
      .mockResolvedValue([row({ template: { name: "x", status: "PENDING", category: null, rejectedReason: null } })]);
    api.submitNotificationTemplate.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(api.listNotificationEvents).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Em análise na Meta")).toBeInTheDocument();
  });

  it("mostra na notificação a mensagem de erro da API ao enviar para aprovação", async () => {
    api.listNotificationEvents.mockResolvedValue([row({ template: { name: "x", status: "MISSING", category: null, rejectedReason: null } })]);
    api.submitNotificationTemplate.mockRejectedValue(apiError("A Meta recusou: nome inválido"));
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A Meta recusou: nome inválido"));
  });

  it("envia o teste para o telefone informado e mostra o motivo se não saiu", async () => {
    api.listNotificationEvents.mockResolvedValue([row()]);
    api.sendNotificationTest.mockRejectedValue(apiError("Número sem consentimento"));
    renderCard();
    const teste = await screen.findByRole("button", { name: /Enviar teste/ });
    expect(teste).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Seu WhatsApp para os testes"), { target: { value: "(11) 98888-7777" } });
    fireEvent.click(teste);
    await waitFor(() => expect(api.sendNotificationTest).toHaveBeenCalledWith("W01_VAGA_APROVADA", "(11) 98888-7777"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Número sem consentimento"));
  });

  it("mostra a mensagem da API quando ligar o aviso é recusado", async () => {
    api.listNotificationEvents.mockResolvedValue([row()]);
    api.setNotificationEvent.mockRejectedValue(apiError("Modelo ainda não aprovado"));
    renderCard();
    fireEvent.click(await screen.findByRole("switch", { name: /Aprovado na vaga/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Modelo ainda não aprovado"));
  });
});

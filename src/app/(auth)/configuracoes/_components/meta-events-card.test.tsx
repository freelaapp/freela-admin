import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MetaEventsCard } from "./meta-events-card";

const api = vi.hoisted(() => ({
  fetchNotificationEvents: vi.fn(),
  setNotificationEvent: vi.fn(),
  submitNotificationTemplate: vi.fn(),
  sendNotificationTest: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/notification-events-api", async (orig) => ({ ...(await orig<object>()), ...api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const mockEvents = (events: unknown[], legacyCut = { enabled: false, updatedAt: null, updatedBy: null }) =>
  api.fetchNotificationEvents.mockResolvedValue({ events, legacyCut });

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
    mockEvents([row()]);
    renderCard();
    expect(await screen.findByText("Aprovado na vaga (confirme)")).toBeInTheDocument();
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
    expect(screen.getByText(/12 enviados · 11 entregues · 9 lidos · 0 falhas/)).toBeInTheDocument();
  });

  it("liga o aviso", async () => {
    mockEvents([row()]);
    api.setNotificationEvent.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(await screen.findByRole("switch", { name: /Aprovado na vaga/ }));
    await waitFor(() => expect(api.setNotificationEvent).toHaveBeenCalledWith("W01_VAGA_APROVADA", true));
  });

  it("interruptor desabilitado quando o modelo não foi aprovado", async () => {
    mockEvents([row({ template: { name: "x", status: "PENDING", category: null, rejectedReason: null } })]);
    renderCard();
    expect(await screen.findByRole("switch", { name: /Aprovado na vaga/ })).toBeDisabled();
    expect(screen.getByText("Em análise na Meta")).toBeInTheDocument();
  });

  it("mostra o motivo da recusa e o botão de enviar para aprovação", async () => {
    mockEvents([row({ template: { name: "x", status: "REJECTED", category: null, rejectedReason: "INVALID_FORMAT" } })]);
    api.submitNotificationTemplate.mockResolvedValue(undefined);
    renderCard();
    expect(await screen.findByText(/INVALID_FORMAT/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(api.submitNotificationTemplate).toHaveBeenCalledWith("W01_VAGA_APROVADA"));
  });

  it("recarrega a lista depois de enviar para aprovação", async () => {
    const legacyCut = { enabled: false, updatedAt: null, updatedBy: null };
    api.fetchNotificationEvents
      .mockResolvedValueOnce({ events: [row({ template: { name: "x", status: "MISSING", category: null, rejectedReason: null } })], legacyCut })
      .mockResolvedValue({ events: [row({ template: { name: "x", status: "PENDING", category: null, rejectedReason: null } })], legacyCut });
    api.submitNotificationTemplate.mockResolvedValue(undefined);
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(api.fetchNotificationEvents).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Em análise na Meta")).toBeInTheDocument();
  });

  it("mostra na notificação a mensagem de erro da API ao enviar para aprovação", async () => {
    mockEvents([row({ template: { name: "x", status: "MISSING", category: null, rejectedReason: null } })]);
    api.submitNotificationTemplate.mockRejectedValue(apiError("A Meta recusou: nome inválido"));
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para aprovação" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A Meta recusou: nome inválido"));
  });

  it("envia o teste para o telefone informado e mostra o motivo se não saiu", async () => {
    mockEvents([row()]);
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
    mockEvents([row()]);
    api.setNotificationEvent.mockRejectedValue(apiError("Modelo ainda não aprovado"));
    renderCard();
    fireEvent.click(await screen.findByRole("switch", { name: /Aprovado na vaga/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Modelo ainda não aprovado"));
  });

  it("mostra o selo Autenticação no A01, sem aviso de categoria", async () => {
    mockEvents([
      row({
        eventKey: "A01_CODIGO_VERIFICACAO",
        label: "Código de verificação (Freela VIP)",
        templateCategory: "AUTHENTICATION",
        template: { name: "codigo_verificacao_v1", status: "APPROVED", category: "AUTHENTICATION", rejectedReason: null },
      }),
    ]);
    renderCard();
    expect(await screen.findByText("Código de verificação (Freela VIP)")).toBeInTheDocument();
    expect(screen.getByText("Autenticação")).toBeInTheDocument();
    expect(screen.queryByText(/A Meta mudou a categoria/)).not.toBeInTheDocument();
    expect(await screen.findByText("Cortar WhatsApp antigo")).toBeInTheDocument();
    expect(api.fetchNotificationEvents).toHaveBeenCalledTimes(1);
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SupportContactCard } from "./support-contact-card";

const api = vi.hoisted(() => ({ getSupportContact: vi.fn(), updateSupportContact: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/support-contact-api", () => api);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const view = (over: object = {}) => ({
  whatsappE164: "5511971777563",
  display: "(11) 97177-7563",
  whatsappUrl: "https://wa.me/5511971777563",
  email: "contato@freelaservicos.com.br",
  emailIsDefault: true,
  isDefault: true,
  updatedAt: null,
  updatedBy: null,
  ...over,
});

function apiError(code: string, message: string) {
  const err = new AxiosError("fail");
  err.response = { data: { error: { code, message } } } as AxiosError["response"];
  return err;
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SupportContactCard />
    </QueryClientProvider>,
  );
}

describe("SupportContactCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSupportContact.mockResolvedValue(view());
  });

  it("título novo, e-mail atual com a indicação de padrão e a ajuda", async () => {
    renderCard();
    expect(await screen.findByText("Contato de suporte")).toBeInTheDocument();
    expect(await screen.findByText("contato@freelaservicos.com.br")).toBeInTheDocument();
    expect(screen.getByText(/E-mail padrão do sistema/)).toBeInTheDocument();
    expect(screen.getByText("Aparece no site, no app e nos e-mails do Freela.")).toBeInTheDocument();
  });

  it("e-mail salvo: mostra quem alterou, sem a indicação de padrão", async () => {
    api.getSupportContact.mockResolvedValue(
      view({ email: "ajuda@freela.com", emailIsDefault: false, updatedBy: { id: "1", name: "Diego" }, updatedAt: "2026-11-24T12:00:00Z" }),
    );
    renderCard();
    expect(await screen.findByText("ajuda@freela.com")).toBeInTheDocument();
    expect(screen.queryByText(/E-mail padrão do sistema/)).not.toBeInTheDocument();
  });

  it("e-mail inválido: mensagem no campo e botão travado", async () => {
    renderCard();
    const input = await screen.findByLabelText("Novo e-mail de suporte");
    fireEvent.change(input, { target: { value: "sem-arroba" } });
    expect(screen.getByText("Informe um e-mail válido, ex.: contato@freelaservicos.com.br.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar e-mail" })).toBeDisabled();
  });

  it("salvar e-mail manda só o e-mail, normalizado, após confirmar", async () => {
    api.updateSupportContact.mockResolvedValue(view({ email: "novo@freela.com", emailIsDefault: false }));
    renderCard();
    const input = await screen.findByLabelText("Novo e-mail de suporte");
    fireEvent.change(input, { target: { value: " Novo@Freela.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e-mail" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.updateSupportContact).toHaveBeenCalledWith({ email: "novo@freela.com" }));
    expect(toast.success).toHaveBeenCalled();
  });

  it("salvar WhatsApp manda só o WhatsApp", async () => {
    api.updateSupportContact.mockResolvedValue(view());
    renderCard();
    const input = await screen.findByLabelText("Novo número (celular com DDD)");
    fireEvent.change(input, { target: { value: "11 98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar WhatsApp" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.updateSupportContact).toHaveBeenCalledWith({ whatsapp: "5511988887777" }));
  });

  it("erro INVALID_SUPPORT_EMAIL da API aparece no campo do e-mail", async () => {
    api.updateSupportContact.mockRejectedValue(apiError("INVALID_SUPPORT_EMAIL", "E-mail recusado pela API."));
    renderCard();
    const input = await screen.findByLabelText("Novo e-mail de suporte");
    fireEvent.change(input, { target: { value: "ok@freela.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e-mail" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("E-mail recusado pela API.")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

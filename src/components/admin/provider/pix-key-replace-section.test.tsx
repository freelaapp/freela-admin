import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PixKeyReplaceSection } from "./pix-key-replace-section";

const api = vi.hoisted(() => ({ replaceProviderPixKey: vi.fn() }));

vi.mock("@/modules/admin/infrastructure/pix-keys-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  replaceProviderPixKey: api.replaceProviderPixKey,
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function abrirEPreencher(tipo: string, valor: string) {
  render(<PixKeyReplaceSection providerGlobalId="pg-1" />);
  fireEvent.click(screen.getByRole("button", { name: /trocar chave pix/i }));
  fireEvent.change(screen.getByLabelText("Tipo de chave"), { target: { value: tipo } });
  fireEvent.change(screen.getByLabelText("Valor da chave"), { target: { value: valor } });
}

describe("PixKeyReplaceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("troca a chave e mostra que o Pix aceitou", async () => {
    api.replaceProviderPixKey.mockResolvedValue({
      providerGlobalId: "pg-1",
      keyType: "telefone",
      keyValue: "(11) 99159-4494",
      updatedModules: ["bars-restaurants", "home-services"],
      subaccountReady: true,
      subaccountError: null,
    });
    abrirEPreencher("telefone", " (11) 99159-4494 ");

    fireEvent.click(screen.getByRole("button", { name: /^trocar chave$/i }));

    await waitFor(() =>
      expect(api.replaceProviderPixKey).toHaveBeenCalledWith("pg-1", "telefone", "(11) 99159-4494"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("O Pix aceitou a chave");
    expect(toast.success).toHaveBeenCalled();
  });

  it("mostra o motivo quando o Pix recusa a chave", async () => {
    api.replaceProviderPixKey.mockResolvedValue({
      providerGlobalId: "pg-1",
      keyType: "email",
      keyValue: "x@y.com",
      updatedModules: ["bars-restaurants"],
      subaccountReady: false,
      subaccountError: "A chave Pix informada é inválida ou não foi encontrada",
    });
    abrirEPreencher("email", "x@y.com");

    fireEvent.click(screen.getByRole("button", { name: /^trocar chave$/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "o Pix recusou: A chave Pix informada é inválida ou não foi encontrada",
    );
    expect(toast.warning).toHaveBeenCalled();
  });

  it("erro da API (formato inválido etc.) vira toast de erro", async () => {
    api.replaceProviderPixKey.mockRejectedValue(new Error("boom"));
    abrirEPreencher("cpf", "123");

    fireEvent.click(screen.getByRole("button", { name: /^trocar chave$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("não envia com valor vazio", () => {
    abrirEPreencher("cpf", "  ");
    expect(screen.getByRole("button", { name: /^trocar chave$/i })).toBeDisabled();
  });
});

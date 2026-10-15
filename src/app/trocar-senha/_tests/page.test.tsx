import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace, push: vi.fn() }) }));

const auth = vi.hoisted(() => ({
  isHydrated: true,
  isAuthenticated: true,
  mustChangePassword: true,
  clearMustChangePassword: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => auth }));

const api = vi.hoisted(() => ({ changeAdminPasswordApi: vi.fn() }));
vi.mock("@/modules/auth/infrastructure/auth.api", () => api);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import TrocarSenhaPage from "../page";

function axiosError(status: number, message?: string) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: message ? { error: { code: "X", message } } : {} },
  });
}

function preencher(atual: string, nova: string, confirmacao = nova) {
  fireEvent.change(screen.getByLabelText("Senha temporária"), { target: { value: atual } });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: nova } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: confirmacao } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.isHydrated = true;
  auth.isAuthenticated = true;
  auth.mustChangePassword = true;
});

describe("Troca obrigatória da senha temporária do admin", () => {
  it("troca a senha, libera o painel e vai para o dashboard", async () => {
    api.changeAdminPasswordApi.mockResolvedValue(undefined);
    render(<TrocarSenhaPage />);
    preencher("Temp@1234", "Nova@Senha9");

    await waitFor(() => expect(api.changeAdminPasswordApi).toHaveBeenCalledWith("Temp@1234", "Nova@Senha9"));
    expect(auth.clearMustChangePassword).toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(toast.success).toHaveBeenCalledWith("Senha atualizada!");
  });

  it("API antiga sem a rota (404): deixa entrar com aviso, sem quebrar o login", async () => {
    api.changeAdminPasswordApi.mockRejectedValue(axiosError(404));
    render(<TrocarSenhaPage />);
    preencher("Temp@1234", "Nova@Senha9");

    await waitFor(() => expect(auth.clearMustChangePassword).toHaveBeenCalled());
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(toast.info.mock.calls[0][0]).toMatch(/ainda não está disponível no servidor/);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("senha temporária errada (401): mostra a mensagem da API e continua na tela", async () => {
    api.changeAdminPasswordApi.mockRejectedValue(axiosError(401, "Senha atual incorreta."));
    render(<TrocarSenhaPage />);
    preencher("errada", "Nova@Senha9");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Senha atual incorreta."));
    expect(auth.clearMustChangePassword).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("senha fraca, confirmação diferente ou igual à temporária: nem chama a API", () => {
    render(<TrocarSenhaPage />);
    preencher("Temp@1234", "fraca");
    preencher("Temp@1234", "Nova@Senha9", "Nova@Senha8");
    preencher("Temp@1234", "Temp@1234");

    expect(api.changeAdminPasswordApi).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(3);
  });

  it("sem senha temporária para trocar: volta para o dashboard; sem sessão: para o login", () => {
    auth.mustChangePassword = false;
    const { unmount } = render(<TrocarSenhaPage />);
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByLabelText("Nova senha")).not.toBeInTheDocument();
    unmount();

    auth.isAuthenticated = false;
    render(<TrocarSenhaPage />);
    expect(nav.replace).toHaveBeenCalledWith("/login");
  });
});

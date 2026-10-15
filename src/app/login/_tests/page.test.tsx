import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  isAuthenticated: false,
  mustChangePassword: false,
}));
vi.mock("@/modules/auth/application/use-auth", () => ({ useAuth: () => auth }));

import LoginPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated = false;
  auth.mustChangePassword = false;
});

function entrar() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "novo@freela.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Temp@1234" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Login do painel — senha temporária", () => {
  it("entrou com a senha temporária: vai para a troca de senha, não para o dashboard", async () => {
    auth.login.mockResolvedValue({ mustChangePassword: true });
    render(<LoginPage />);
    entrar();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/trocar-senha"));
    expect(nav.push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("senha definitiva: dashboard", async () => {
    auth.login.mockResolvedValue({ mustChangePassword: false });
    render(<LoginPage />);
    entrar();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("já logado com a senha temporária: volta para a troca", () => {
    auth.isAuthenticated = true;
    auth.mustChangePassword = true;
    render(<LoginPage />);
    expect(nav.replace).toHaveBeenCalledWith("/trocar-senha");
  });
});

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ loginApi: vi.fn() }));
vi.mock("@/modules/auth/infrastructure/auth.api", () => ({ loginApi: api.loginApi }));
vi.mock("@/modules/auth/infrastructure/admin-session.api", () => ({
  getAdminMe: vi.fn(() => new Promise(() => {})),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useAuthStore } from "./auth.store";
import { useAuth } from "./use-auth";

/** JWT sem assinatura válida: o painel só lê as claims. */
function token(claims: Record<string, unknown>): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })}.assinatura`;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: null, isHydrated: false });
});

describe("useAuth — senha temporária", () => {
  it("login com o token marcando a senha temporária: guarda o aviso, e a troca libera", async () => {
    api.loginApi.mockResolvedValue({
      data: { accessToken: token({ role: "ADMIN", mustChangePassword: true }), refreshToken: "r" },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let user: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      user = await result.current.login({ email: "novo@freela.com", password: "Temp@1234" });
    });
    expect(user?.mustChangePassword).toBe(true);
    expect(result.current.mustChangePassword).toBe(true);

    act(() => result.current.clearMustChangePassword());
    expect(result.current.mustChangePassword).toBe(false);
    // Fica gravado: recarregar a página não volta a pedir a troca.
    expect(JSON.parse(localStorage.getItem("authUser") ?? "{}").mustChangePassword).toBe(false);
  });

  it("login com senha definitiva: entra direto", async () => {
    api.loginApi.mockResolvedValue({
      data: { accessToken: token({ role: "ADMIN", mustChangePassword: false }), refreshToken: "r" },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login({ email: "ana@freela.com", password: "Senha@Boa1" });
    });
    expect(result.current.mustChangePassword).toBe(false);
  });
});

describe("useAuth — endSession (depois da troca de senha)", () => {
  it("apaga a sessão local sem recarregar a página", async () => {
    api.loginApi.mockResolvedValue({
      data: { accessToken: token({ role: "ADMIN", mustChangePassword: true }), refreshToken: "r" },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login({ email: "novo@freela.com", password: "Temp@1234" });
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => result.current.endSession());
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("authUser")).toBeNull();
  });
});

describe("auth.store — sessão gravada antes do campo existir", () => {
  it("lê a senha temporária do token uma vez", () => {
    localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "admin",
        name: "Novo",
        email: "novo@freela.com",
        role: "ADMIN",
        accessToken: token({ role: "ADMIN", mustChangePassword: true }),
        refreshToken: "r",
      }),
    );
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(true);
  });

  it("depois da troca (campo false), o token antigo não volta a pedir", () => {
    localStorage.setItem(
      "authUser",
      JSON.stringify({
        id: "admin",
        name: "Novo",
        email: "novo@freela.com",
        role: "ADMIN",
        accessToken: token({ role: "ADMIN", mustChangePassword: true }),
        refreshToken: "r",
        mustChangePassword: false,
      }),
    );
    useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().user?.mustChangePassword).toBe(false);
  });
});

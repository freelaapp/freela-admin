import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace }) }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const auth = vi.hoisted(() => ({
  isHydrated: true,
  isAuthenticated: true,
  isSessionLoading: false,
  isSessionError: false,
  granted: [] as string[],
}));
vi.mock("./use-auth", () => ({
  useAuth: () => ({ ...auth, hasPermission: (key: string) => auth.granted.includes(key) }),
}));

import { SESSION_ERROR_TOAST_ID, useAreaGuard } from "./use-area-guard";
import { useAnyAreaGuard } from "./use-any-area-guard";

beforeEach(() => {
  vi.clearAllMocks();
  auth.isSessionError = false;
  auth.granted = [];
});

describe("guarda de área — /me falhou", () => {
  it("sem conseguir conferir as permissões: volta ao início COM aviso", () => {
    auth.isSessionError = true;
    renderHook(() => useAreaGuard("WALLETS"));

    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls[0][0]).toMatch(/Não foi possível conferir suas permissões/);
    expect(toast.error.mock.calls[0][1]).toEqual({ id: SESSION_ERROR_TOAST_ID });
  });

  it("sem a permissão (o /me respondeu): volta ao início sem aviso de erro", () => {
    renderHook(() => useAreaGuard("WALLETS"));
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("com a permissão: fica na tela", () => {
    auth.granted = ["WALLETS"];
    const { result } = renderHook(() => useAreaGuard("WALLETS"));
    expect(result.current.allowed).toBe(true);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("guarda de várias áreas avisa do mesmo jeito", () => {
    auth.isSessionError = true;
    renderHook(() => useAnyAreaGuard(["VIP_ADMIN", "VIP_READONLY"]));
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
    expect(toast.error.mock.calls[0][1]).toEqual({ id: SESSION_ERROR_TOAST_ID });
  });
});

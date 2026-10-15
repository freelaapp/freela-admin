import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace }) }));

const auth = vi.hoisted(() => ({
  isHydrated: true,
  isAuthenticated: true,
  isAdmin: true,
  mustChangePassword: false,
  logout: vi.fn(),
}));
vi.mock("./use-auth", () => ({ useAuth: () => auth }));

import { CHANGE_PASSWORD_PATH, useAuthGuard } from "./use-auth-guard";

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated = true;
  auth.isAdmin = true;
  auth.mustChangePassword = false;
});

describe("useAuthGuard — senha temporária", () => {
  it("com a senha temporária, manda para a troca antes de qualquer tela do painel", () => {
    auth.mustChangePassword = true;
    const { result } = renderHook(() => useAuthGuard(true));

    expect(nav.replace).toHaveBeenCalledWith(CHANGE_PASSWORD_PATH);
    expect(CHANGE_PASSWORD_PATH).toBe("/trocar-senha");
    expect(result.current.mustChangePassword).toBe(true);
  });

  it("senha já trocada: segue no painel", () => {
    renderHook(() => useAuthGuard(true));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("sem sessão: vai para o login (não para a troca)", () => {
    auth.isAuthenticated = false;
    auth.mustChangePassword = true;
    renderHook(() => useAuthGuard(true));
    expect(nav.replace).toHaveBeenCalledWith("/login");
    expect(nav.replace).not.toHaveBeenCalledWith(CHANGE_PASSWORD_PATH);
  });
});

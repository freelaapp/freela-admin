"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";

/** Tela da troca obrigatória da senha temporária (fora do layout do painel). */
export const CHANGE_PASSWORD_PATH = "/trocar-senha";

export function useAuthGuard(requireAdmin = true) {
  const { isAuthenticated, isAdmin, isHydrated, mustChangePassword, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (requireAdmin && !isAdmin) {
      // Autenticado mas sem papel de admin (ex.: RECRUITER): sem limpar a
      // sessão, o /login via isAuthenticated devolvia pro /dashboard e a
      // conta ficava num loop infinito login↔dashboard.
      logout();
      return;
    }

    // Senha temporária: nada do painel antes da troca (mesma barreira do
    // portal do consultor).
    if (mustChangePassword) router.replace(CHANGE_PASSWORD_PATH);
  }, [isAuthenticated, isAdmin, isHydrated, mustChangePassword, requireAdmin, router, logout]);

  return { isHydrated, isAuthenticated, isAdmin, mustChangePassword };
}

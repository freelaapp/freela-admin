"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";

export function useAuthGuard(requireAdmin = true) {
  const { isAuthenticated, isAdmin, isHydrated, logout } = useAuth();
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
  }, [isAuthenticated, isAdmin, isHydrated, requireAdmin, router, logout]);

  return { isHydrated, isAuthenticated, isAdmin };
}

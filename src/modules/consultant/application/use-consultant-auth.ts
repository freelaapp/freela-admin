"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useConsultantAuthStore } from "./consultant-auth.store";
import { loginConsultantApi } from "@/modules/consultant/infrastructure/consultant-api";

export function useConsultantAuth() {
  const { session, isHydrated, setSession, hydrate, clear } = useConsultantAuthStore();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginConsultantApi(email, password);
      setSession({
        email,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        mustChangePassword: data.mustChangePassword,
      });
      return data;
    },
    [setSession],
  );

  const logout = useCallback(() => {
    clear();
    toast.info("Você saiu.");
    window.location.href = "/consultor/login";
  }, [clear]);

  /** Atualiza o flag após a troca de senha obrigatória. */
  const clearMustChangePassword = useCallback(() => {
    if (session) setSession({ ...session, mustChangePassword: false });
  }, [session, setSession]);

  return {
    session,
    isHydrated,
    isAuthenticated: !!session,
    mustChangePassword: !!session?.mustChangePassword,
    login,
    logout,
    clearMustChangePassword,
  };
}

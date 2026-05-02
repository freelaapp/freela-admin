"use client";

import { useCallback, useEffect } from "react";
import { useAuthStore } from "./auth.store";
import { loginApi } from "@/modules/auth/infrastructure/auth.api";
import { LoginPayload, AuthUser } from "@/modules/auth/domain/types";
import { toast } from "sonner";

export function useAuth() {
  const { user, isHydrated, setUser, hydrate, clear } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const response = await loginApi(payload);
        const authUser: AuthUser = {
          id: "admin",
          name: "Admin",
          email: payload.email,
          role: "ADMIN",
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        };
        setUser(authUser);
        toast.success("Login realizado com sucesso!");
        return authUser;
      } catch (error) {
        toast.error("Email ou senha inválidos");
        throw error;
      }
    },
    [setUser]
  );

  const logout = useCallback(() => {
    clear();
    toast.info("Você saiu do sistema");
    window.location.href = "/login";
  }, [clear]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return {
    user,
    isHydrated,
    isAuthenticated: !!user,
    isAdmin,
    login,
    logout,
  };
}

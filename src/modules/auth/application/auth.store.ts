import { create } from "zustand";
import { AuthUser } from "@/modules/auth/domain/types";
import { isJwtExpired } from "@/modules/shared/infrastructure/jwt";

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => void;
  clear: () => void;
}

const STORAGE_KEY = "authUser";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const user = JSON.parse(stored) as AuthUser;
        // Sessão com token vencido é descartada na hidratação — senão o guard
        // considera autenticado, o /login fica inalcançável e o dashboard
        // quebra em 401 silencioso.
        if (isJwtExpired(user.accessToken)) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          set({ user, isHydrated: true });
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ isHydrated: true });
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));

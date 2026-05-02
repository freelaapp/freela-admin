import { create } from "zustand";
import { AuthUser } from "@/modules/auth/domain/types";

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
        set({ user, isHydrated: true });
        return;
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

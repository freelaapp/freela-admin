"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";

export function useAuthGuard(requireAdmin = true) {
  const { isAuthenticated, isAdmin, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (requireAdmin && !isAdmin) {
      router.replace("/login");
      return;
    }
  }, [isAuthenticated, isAdmin, isHydrated, requireAdmin, router]);

  return { isHydrated, isAuthenticated, isAdmin };
}

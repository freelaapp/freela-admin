"use client";

import { AdminLayout } from "@/components/shared/admin-layout";
import { useAuthGuard } from "@/modules/auth/application/use-auth-guard";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isHydrated } = useAuthGuard(true);

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
        </div>
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}

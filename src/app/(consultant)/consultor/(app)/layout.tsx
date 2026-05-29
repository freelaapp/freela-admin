"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LogOut, LayoutDashboard, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsultantAuth } from "@/modules/consultant/application/use-consultant-auth";

export default function ConsultorAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrated, isAuthenticated, mustChangePassword, logout } = useConsultantAuth();

  const onChangePassword = pathname === "/consultor/trocar-senha";

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.replace("/consultor/login");
      return;
    }
    if (mustChangePassword && !onChangePassword) {
      router.replace("/consultor/trocar-senha");
    }
  }, [isHydrated, isAuthenticated, mustChangePassword, onChangePassword, router]);

  if (!isHydrated || !isAuthenticated || (mustChangePassword && !onChangePassword)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f7]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <header className="h-16 bg-[#1d1d1b] text-white flex items-center px-4 lg:px-6 gap-4">
        <span className="text-lg font-bold tracking-tight">
          FREELA <span className="text-[#eca826]">CONSULTOR</span>
        </span>
        {!onChangePassword && (
          <nav className="ml-6 flex items-center gap-1">
            <NavLink href="/consultor" active={pathname === "/consultor"} icon={LayoutDashboard}>
              Meus cadastros
            </NavLink>
            <NavLink
              href="/consultor/cadastrar"
              active={pathname === "/consultor/cadastrar"}
              icon={UserPlus}
            >
              Novo cadastro
            </NavLink>
          </nav>
        )}
        <button
          onClick={logout}
          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[#d4d4d4] hover:bg-[#2e2e2e] hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>
      <main className="p-4 lg:p-6 max-w-4xl mx-auto">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutDashboard;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-[#eca826] text-white" : "text-[#d4d4d4] hover:bg-[#2e2e2e] hover:text-white",
      )}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, LayoutDashboard, Loader2, LogOut, User, UserPlus } from "lucide-react";
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
      <header className="flex h-16 items-center gap-2 bg-[#1d1d1b] px-4 text-white sm:gap-4 lg:px-6">
        <span className="shrink-0 text-base font-bold tracking-tight sm:text-lg">
          FREELA <span className="text-[#eca826]">CONSULTOR</span>
        </span>
        {!onChangePassword && (
          <nav className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto sm:ml-6">
            <NavLink
              href="/consultor"
              active={pathname === "/consultor"}
              icon={LayoutDashboard}
              label="Meus cadastros"
            />
            <NavLink
              href="/consultor/vagas"
              active={pathname === "/consultor/vagas"}
              icon={Briefcase}
              label="Vagas"
            />
            <NavLink
              href="/consultor/cadastrar"
              active={pathname === "/consultor/cadastrar"}
              icon={UserPlus}
              label="Novo cadastro"
            />
            <NavLink
              href="/consultor/perfil"
              active={pathname === "/consultor/perfil"}
              icon={User}
              label="Meu perfil"
            />
          </nav>
        )}
        <button
          onClick={logout}
          aria-label="Sair"
          className="ml-auto flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[#d4d4d4] transition-colors hover:bg-[#2e2e2e] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>
      <main className="mx-auto max-w-6xl p-4 lg:p-6">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  // No celular só o ícone (4 itens + logo + Sair não cabem em 375px); o nome fica no
  // aria-label/title. A partir de `lg` o texto aparece.
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-[#eca826] text-white" : "text-[#d4d4d4] hover:bg-[#2e2e2e] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  LayoutDashboard,
  Loader2,
  LogOut,
  User,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConsultantAuth } from "@/modules/consultant/application/use-consultant-auth";

export default function ConsultorAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrated, isAuthenticated, mustChangePassword, logout } = useConsultantAuth();

  const onChangePassword = pathname === "/consultor/trocar-senha";
  // Só a troca OBRIGATÓRIA (senha temporária) esconde o menu. Quem veio do "Meu perfil"
  // trocar a senha por vontade própria precisa do menu para voltar.
  const showNav = !(mustChangePassword && onChangePassword);

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
      {/* No celular (360–375px) logo + 6 itens + Sair não cabem numa linha: o menu desce para
          uma linha própria, de largura inteira (`order-last w-full`). A partir de `sm` volta
          para a mesma linha, entre o logo e o Sair. */}
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-[#1d1d1b] px-4 py-2 text-white sm:h-16 sm:flex-nowrap sm:gap-4 sm:py-0 lg:px-6">
        <span className="shrink-0 text-base font-bold tracking-tight sm:text-lg">
          FREELA <span className="text-[#eca826]">CONSULTOR</span>
        </span>
        {showNav && (
          <nav className="order-last flex w-full items-center gap-1 sm:order-none sm:ml-6 sm:w-auto sm:min-w-0 sm:overflow-x-auto">
            <NavLink
              href="/consultor/painel"
              active={pathname === "/consultor/painel"}
              icon={BarChart3}
              label="Painel"
            />
            <NavLink
              href="/consultor/carteira"
              active={pathname === "/consultor/carteira"}
              icon={Wallet}
              label="Carteira"
            />
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
  // Até `lg` só o ícone; o nome fica no aria-label/title. No celular cada item ocupa
  // 1/6 da linha do menu (alvo de toque maior). A partir de `lg` o texto aparece.
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:py-1.5",
        active ? "bg-[#eca826] text-white" : "text-[#d4d4d4] hover:bg-[#2e2e2e] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}

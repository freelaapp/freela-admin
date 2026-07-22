"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  Briefcase,
  Home,
  ClipboardList,
  TrendingUp,
  MapPin,
  Map,
  BookOpen,
  GraduationCap,
  Ticket,
  UserCheck,
  Star,
  DollarSign,
  BarChart3,
  Shield,
  Handshake,
  Store,
  Megaphone,
  MessageCircle,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Wallet,
  UserCog,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/modules/auth/application/use-auth";
import {
  buildProducts,
  productIdFromPath,
  type NavItem,
} from "@/modules/shared/domain/products";

/**
 * Nav da vertical de SERVIÇOS (as rotas ficam na raiz por retrocompatibilidade).
 *
 * `permission` marca as áreas controladas por `admins.permissions`: sem a chave,
 * o item some do menu (e a página redireciona para o dashboard). Itens sem
 * `permission` seguem abertos a qualquer usuário do painel logado.
 */
const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Freelancers", icon: Users, path: "/freelancers", permission: "FREELANCERS" },
  { label: "Empresas", icon: Building2, path: "/empresas", permission: "COMPANIES" },
  { label: "Contratantes — Casa", icon: Building, path: "/contratantes-casa" },
  { label: "Vagas / Jobs", icon: Briefcase, path: "/jobs", permission: "JOBS" },
  { label: "Vagas — Casa", icon: Home, path: "/vagas-casa", permission: "CASA_VACANCIES" },
  { label: "Vagas Fixas / CLT", icon: ClipboardList, path: "/vagas-fixas", permission: "FIXED_JOBS" },
  { label: "Pipeline", icon: TrendingUp, path: "/pipeline" },
  { label: "Cidades", icon: MapPin, path: "/cidades" },
  { label: "Cargos", icon: UserCheck, path: "/cargos" },
  { label: "Cargos por Cidade", icon: Map, path: "/cidades-cargos" },
  { label: "Catálogo", icon: BookOpen, path: "/catalogo" },
  { label: "Cupons", icon: Ticket, path: "/cupons" },
  { label: "Treinamentos", icon: GraduationCap, path: "/treinamentos" },
  { label: "Avaliações", icon: Star, path: "/avaliacoes" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro", permission: "FINANCE" },
  { label: "Carteiras", icon: Wallet, path: "/carteiras", permission: "WALLETS" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Usuários", icon: Shield, path: "/usuarios", permission: "USERS" },
  {
    // Consultores continua super-admin-only (a tela mexe em comissão e acesso do
    // consultor). A permissão CONSULTANTS existe no catálogo, mas só passa a
    // valer aqui quando a página deixar de ser exclusiva do super-admin.
    label: "Consultores",
    icon: Handshake,
    path: "/consultores",
    superAdminOnly: true,
  },
  {
    label: "Parcerias",
    icon: Store,
    path: "/parcerias",
    permission: "PARTNERSHIPS",
  },
  {
    label: "Propagandas",
    icon: Megaphone,
    path: "/propagandas",
    permission: "ADVERTISEMENTS",
  },
  {
    label: "Grupos WhatsApp",
    icon: MessageCircle,
    path: "/grupos-whatsapp",
    permission: "WHATSAPP_GROUPS",
  },
  {
    label: "Usuários do painel",
    icon: UserCog,
    path: "/usuarios-painel",
    superAdminOnly: true,
  },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
];

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const { user, logout, isSuperAdmin, hasPermission } = useAuth();

  // A vertical vem da URL (não de estado guardado): link compartilhado e refresh
  // caem sempre na mesma tela.
  const products = buildProducts(navItems);
  const activeProductId = productIdFromPath(pathname);
  const activeProduct =
    products.find((p) => p.id === activeProductId) ?? products[0];
  // Item some do menu quando o admin não tem a permissão da área. Enquanto
  // `GET /v1/admins/me` não responde, `hasPermission` é falso — o item aparece
  // logo que a sessão resolve (preferimos "aparecer depois" a "sumir depois").
  const visibleNavItems = activeProduct.nav.filter(
    (item) =>
      (!item.superAdminOnly || isSuperAdmin) &&
      (!item.permission || hasPermission(item.permission)),
  );

  const displayName = user?.name || "Admin";
  const displayEmail = user?.email || "";
  const initials = getInitials(displayName || displayEmail || "AD");

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f7f7]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#1d1d1b] text-[#d4d4d4] flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-[#333333]">
          <span className="text-lg font-bold text-white tracking-tight">
            FREELA
          </span>
          <span className="text-xs font-medium text-[#eca826] bg-[#eca826]/10 px-1.5 py-0.5 rounded">
            {activeProduct.badge}
          </span>
          <button
            className="ml-auto lg:hidden text-[#d4d4d4]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de vertical */}
        <div className="px-3 pt-3 relative">
          <button
            type="button"
            onClick={() => setProductMenuOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2e2e2e] text-sm font-medium text-white hover:bg-[#3a3a3a] transition-colors cursor-pointer"
          >
            <activeProduct.icon className="w-4 h-4 shrink-0 text-[#eca826]" />
            <span className="truncate">{activeProduct.label}</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 ml-auto shrink-0 transition-transform",
                productMenuOpen && "rotate-180",
              )}
            />
          </button>
          {productMenuOpen && (
            <div className="absolute left-3 right-3 mt-1 z-10 rounded-lg bg-[#2e2e2e] border border-[#3a3a3a] overflow-hidden shadow-lg">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={product.basePath}
                  onClick={() => {
                    setProductMenuOpen(false);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm transition-colors",
                    product.id === activeProduct.id
                      ? "bg-[#eca826] text-white"
                      : "text-[#d4d4d4] hover:bg-[#3a3a3a] hover:text-white",
                  )}
                >
                  <product.icon className="w-4 h-4 shrink-0" />
                  {product.label}
                  {product.comingSoon && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide opacity-70">
                      em breve
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-[#eca826] text-white"
                    : "text-[#d4d4d4] hover:bg-[#2e2e2e] hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
                {item.comingSoon && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">
                    em breve
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-[#333333]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2e2e2e] flex items-center justify-center text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-[#737373] truncate">{displayEmail}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-[#2e2e2e] text-[#737373] transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-[#e5e5e5] flex items-center px-4 lg:px-6 gap-4 shrink-0">
          <button
            className="lg:hidden text-[#1d1d1b]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
              <input
                type="text"
                placeholder="Buscar freelancers, empresas, jobs..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button className="relative p-2 rounded-lg hover:bg-[#f7f7f7] text-[#737373] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#eca826] rounded-full" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#e5e5e5]">
              <div className="w-8 h-8 rounded-full bg-[#eca826]/10 flex items-center justify-center text-xs font-semibold text-[#eca826]">
                {initials}
              </div>
              <span className="text-sm font-medium text-[#1d1d1b]">{displayName}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="animate-in fade-in duration-200">{children}</div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Home,
  ClipboardList,
  TrendingUp,
  MapPin,
  UserCheck,
  Star,
  DollarSign,
  BarChart3,
  Shield,
  Handshake,
  MessageCircle,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/modules/auth/application/use-auth";

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  superAdminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Freelancers", icon: Users, path: "/freelancers" },
  { label: "Empresas", icon: Building2, path: "/empresas" },
  { label: "Vagas / Jobs", icon: Briefcase, path: "/jobs" },
  { label: "Vagas — Casa", icon: Home, path: "/vagas-casa" },
  { label: "Vagas Fixas / CLT", icon: ClipboardList, path: "/vagas-fixas" },
  { label: "Pipeline", icon: TrendingUp, path: "/pipeline" },
  { label: "Cidades", icon: MapPin, path: "/cidades" },
  { label: "Cargos", icon: UserCheck, path: "/cargos" },
  { label: "Avaliações", icon: Star, path: "/avaliacoes" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Usuários", icon: Shield, path: "/usuarios" },
  {
    label: "Consultores",
    icon: Handshake,
    path: "/consultores",
    superAdminOnly: true,
  },
  {
    label: "Grupos WhatsApp",
    icon: MessageCircle,
    path: "/grupos-whatsapp",
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
  const { user, logout, isSuperAdmin } = useAuth();
  const visibleNavItems = navItems.filter(
    (item) => !item.superAdminOnly || isSuperAdmin,
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
            ADMIN
          </span>
          <button
            className="ml-auto lg:hidden text-[#d4d4d4]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
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

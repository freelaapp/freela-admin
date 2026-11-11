"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Turmas", href: "/onboarding" },
  { label: "Fila", href: "/onboarding/fila" },
  { label: "Configurações", href: "/onboarding/configuracoes" },
];

/** Abas do Onboarding. "Turmas" fica ativa também nas telas de uma turma (/onboarding/turmas/...). */
export function OnboardingTabs() {
  const pathname = usePathname() ?? "";
  const active = (href: string) =>
    href === "/onboarding"
      ? pathname === "/onboarding" || pathname.startsWith("/onboarding/turmas")
      : pathname.startsWith(href);
  return (
    <nav aria-label="Seções do Onboarding" className="mb-4 flex gap-1 overflow-x-auto border-b border-[#e5e5e5]">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={active(tab.href) ? "page" : undefined}
          className={cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
            active(tab.href)
              ? "border-[#eca826] text-[#1d1d1b]"
              : "border-transparent text-[#737373] hover:text-[#1d1d1b]",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

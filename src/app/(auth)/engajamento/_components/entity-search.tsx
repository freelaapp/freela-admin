"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fichaHref } from "@/modules/admin/application/engagement-filters";
import type { EngagementSide } from "@/modules/admin/application/engagement-format";
import { useEngagementPeople } from "@/modules/admin/application/use-engagement";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";
import { useDebounced } from "./use-debounced";

interface EntitySearchProps {
  filters: EngagementFilters;
  canFreelancers: boolean;
  canCompanies: boolean;
}

/**
 * "Buscar empresa ou freelancer" (spec §5.1): só nos lados que o admin pode
 * ver. A busca não fica presa à cidade/produto escolhidos (procurar alguém
 * pelo nome não deve depender do filtro), mas o link da ficha leva todos os
 * filtros na URL.
 */
export function EntitySearch({ filters, canFreelancers, canCompanies }: EntitySearchProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const term = useDebounced(text.trim(), 350);
  const active = term.length >= 2;
  const searchFilters: EngagementFilters = { ...filters, city: "", uf: "", product: "all", channel: "all" };
  const params = { search: term, includeNoAccess: true, page: 1, limit: 5 };
  const freelancers = useEngagementPeople("freelancer", searchFilters, params, canFreelancers && active);
  const companies = useEngagementPeople("contractor", searchFilters, params, canCompanies && active);

  if (!canFreelancers && !canCompanies) return null;

  const label =
    canFreelancers && canCompanies
      ? "Buscar empresa ou freelancer"
      : canFreelancers
        ? "Buscar freelancer"
        : "Buscar empresa";
  const groups: { title: string; side: EngagementSide; q: typeof freelancers }[] = [];
  if (canFreelancers) groups.push({ title: "Freelancers", side: "freelancer", q: freelancers });
  if (canCompanies) groups.push({ title: "Empresas", side: "contractor", q: companies });

  return (
    <div className="relative w-full md:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
      <Input
        aria-label={label}
        placeholder={`${label} (nome, e-mail, telefone ou documento)`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Espera o clique no resultado acontecer antes de fechar.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="pl-9"
      />
      {open && active && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white p-2 shadow-lg">
          {groups.map((g) => {
            const rows = g.q.data?.rows ?? [];
            return (
              <div key={g.side} className="py-1">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  {g.title}
                </p>
                {g.q.isLoading ? (
                  <p className="px-2 py-1 text-sm text-[#737373]">Buscando…</p>
                ) : rows.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-[#737373]">Ninguém encontrado.</p>
                ) : (
                  rows.map((r) => (
                    <Link
                      key={r.userId}
                      href={fichaHref(g.side, r.userId, filters)}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#f7f7f7]"
                    >
                      <span className="truncate font-medium text-[#1d1d1b]">{r.name}</span>
                      <span className="shrink-0 text-xs text-[#737373]">
                        {[r.city, r.uf].filter(Boolean).join(" - ") || "—"}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

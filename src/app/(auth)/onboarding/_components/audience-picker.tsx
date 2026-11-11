"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCitiesCatalog } from "@/modules/admin/application/use-cities-catalog";

export const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const MAX_SUGGESTIONS = 8;

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Props {
  ufs: string[];
  cities: string[];
  onChange: (next: { ufs: string[]; cities: string[] }) => void;
  disabled?: boolean;
}

/** Quem pode se inscrever: estados (botões) e cidades do catálogo. Vazio = todas as cidades. */
export function AudiencePicker({ ufs, cities, onChange, disabled }: Props) {
  const catalog = useCitiesCatalog();
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return (catalog.data ?? [])
      .filter(
        (c) =>
          normalize(c.name).includes(q) &&
          !cities.includes(c.name) &&
          (ufs.length === 0 || ufs.includes(c.uf)),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [catalog.data, query, cities, ufs]);

  const toggleUf = (uf: string) =>
    onChange({ ufs: ufs.includes(uf) ? ufs.filter((u) => u !== uf) : [...ufs, uf], cities });

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-[#1d1d1b]">Quem pode se inscrever</legend>
      <p className="text-xs text-[#737373]">
        {ufs.length === 0 && cities.length === 0
          ? "Todas as cidades."
          : "Só quem mora nos estados e cidades abaixo vê esta turma."}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Estados">
        {BRAZIL_UFS.map((uf) => {
          const on = ufs.includes(uf);
          return (
            <button
              key={uf}
              type="button"
              aria-pressed={on}
              onClick={() => toggleUf(uf)}
              className={cn(
                "min-h-11 min-w-11 rounded-lg border px-2 text-sm font-medium",
                on
                  ? "border-[#eca826] bg-[#eca826]/15 text-[#1d1d1b]"
                  : "border-[#e5e5e5] bg-white text-[#525252]",
              )}
            >
              {uf}
            </button>
          );
        })}
      </div>
      <div className="space-y-1">
        <Label htmlFor="audience-city-search">Cidades</Label>
        <Input
          id="audience-city-search"
          value={query}
          autoComplete="off"
          placeholder={catalog.isLoading ? "Carregando cidades…" : "Digite o nome da cidade"}
          onChange={(e) => setQuery(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="rounded-lg border border-[#e5e5e5] bg-white">
            {suggestions.map((c) => (
              <li key={`${c.name}-${c.uf}`}>
                <button
                  type="button"
                  className="min-h-11 w-full px-3 text-left text-sm hover:bg-[#f5f5f5]"
                  onClick={() => {
                    onChange({ ufs, cities: [...cities, c.name] });
                    setQuery("");
                  }}
                >
                  {c.name} · {c.uf}
                </button>
              </li>
            ))}
          </ul>
        )}
        {cities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Cidades escolhidas">
            {cities.map((name) => (
              <li
                key={name}
                className="flex items-center gap-1 rounded-full bg-[#f5f5f5] py-1 pl-3 pr-1 text-sm"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Tirar ${name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#e5e5e5]"
                  onClick={() => onChange({ ufs, cities: cities.filter((c) => c !== name) })}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}

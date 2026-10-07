"use client";

import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  CHANNEL_OPTIONS,
  PERIOD_PRESETS,
  PRODUCT_OPTIONS,
  customRangeError,
  describeFilters,
} from "@/modules/admin/application/engagement-filters";
import type {
  CityOption,
  EngagementChannel,
  EngagementFilters,
  EngagementProduct,
} from "@/modules/admin/infrastructure/engagement-api";

interface FilterBarProps {
  filters: EngagementFilters;
  onChange: (next: EngagementFilters) => void;
  /** Opções já canonizadas pela API (`overview.filterOptions.cities`). */
  cities: CityOption[];
  /** Fichas: só o período (a API ignora cidade, produto e canal nelas). */
  periodOnly?: boolean;
  /** Botões de exportação, no fim da barra. */
  actions?: React.ReactNode;
}

// Mesmo visual dos presets do dashboard.
const pill = (active: boolean) =>
  cn(
    "h-8 rounded-md px-3 text-sm transition-colors",
    active ? "bg-[#eca826] font-semibold text-[#1d1d1b]" : "text-[#737373] hover:bg-[#f7f7f7]",
  );
const DATE_INPUT = "h-9 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm";

function cityLabel(city: string, uf: string): string {
  return city ? (uf ? `${city} - ${uf}` : city) : "";
}

/**
 * Cidade com busca: campo com sugestões (datalist nativo, funciona no celular).
 * Só vira filtro quando o texto bate com uma opção; apagar volta a "todas".
 */
function CityPicker({
  cities,
  city,
  uf,
  onPick,
}: {
  cities: CityOption[];
  city: string;
  uf: string;
  onPick: (c: CityOption | null) => void;
}) {
  const listId = useId();
  const current = cityLabel(city, uf);
  const [text, setText] = useState(current);
  const [shown, setShown] = useState(current);
  // O filtro mudou por fora (URL, outro controle): o texto acompanha.
  // É o padrão "ajustar estado durante o render" da documentação do React.
  if (shown !== current) {
    setShown(current);
    setText(current);
  }
  const match = (v: string) => cities.find((c) => c.label.toLowerCase() === v.trim().toLowerCase()) ?? null;
  return (
    <>
      <Input
        list={listId}
        aria-label="Cidade"
        placeholder="Todas as cidades"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (!v.trim()) {
            onPick(null);
            return;
          }
          const hit = match(v);
          if (hit) onPick(hit);
        }}
        onBlur={() => {
          if (text.trim() && !match(text)) setText(current);
        }}
        className="h-9 md:w-56"
      />
      <datalist id={listId}>
        {cities.map((c) => (
          <option key={c.label} value={c.label} />
        ))}
      </datalist>
    </>
  );
}

export function FilterBar({ filters, onChange, cities, periodOnly = false, actions }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<EngagementFilters>) => onChange({ ...filters, ...patch });
  const rangeError = customRangeError(filters);
  const summary = periodOnly ? describeFilters(filters).split(" · ")[0] : describeFilters(filters);

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-3 md:sticky md:top-0 md:z-20">
      {/* Celular: os filtros ficam recolhidos atrás de um resumo. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm text-[#1d1d1b] md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#eca826]" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="shrink-0 text-xs font-semibold text-[#eca826]">{open ? "Fechar" : "Filtros"}</span>
      </button>

      <div
        className={cn(
          open ? "flex" : "hidden",
          "mt-3 flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-center",
        )}
      >
        <div
          role="group"
          aria-label="Período"
          className="inline-flex flex-wrap self-start rounded-lg border border-[#e5e5e5] bg-white p-0.5"
        >
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={filters.period === p.id}
              onClick={() => set({ period: p.id })}
              className={pill(filters.period === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {filters.period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Data inicial"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className={DATE_INPUT}
            />
            <span className="text-sm text-[#737373]">até</span>
            <input
              type="date"
              aria-label="Data final"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className={DATE_INPUT}
            />
            {rangeError && (
              <span role="alert" className="text-xs font-medium text-red-600">
                {rangeError}
              </span>
            )}
          </div>
        )}

        {!periodOnly && (
          <>
            <CityPicker
              cities={cities}
              city={filters.city}
              uf={filters.uf}
              onPick={(c) => set({ city: c?.city ?? "", uf: c?.uf ?? "" })}
            />
            <NativeSelect
              aria-label="Produto"
              value={filters.product}
              onChange={(e) => set({ product: e.target.value as EngagementProduct })}
              className="h-9 py-0 md:w-auto"
            >
              {PRODUCT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Canal"
              value={filters.channel}
              onChange={(e) => set({ channel: e.target.value as EngagementChannel })}
              className="h-9 py-0 md:w-auto"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </>
        )}

        {actions && <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div>}
      </div>
    </div>
  );
}

"use client";

import type { OrientationQueueFilter, QueueGroup } from "@/modules/admin/infrastructure/orientation-api";
import { formatCount } from "@/modules/admin/application/orientation-presentation";

interface Props {
  groups: QueueGroup[];
  truncated: boolean;
  filter: OrientationQueueFilter;
  onPick: (place: { uf: string; city?: string }) => void;
}

/** Quem está na Fila por estado e cidade (segue os filtros). Clicar filtra a lista. */
export function QueueGroups({ groups, truncated, filter, onPick }: Props) {
  if (groups.length === 0) return null;
  return (
    <section aria-label="Fila por estado e cidade" className="rounded-lg border border-[#e5e5e5] bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Por estado e cidade</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.uf ?? "sem-uf"}>
            <div className="flex items-center justify-between text-sm font-medium text-[#1d1d1b]">
              {g.uf ? (
                <button
                  type="button"
                  className={`min-h-9 underline ${filter.uf === g.uf && !filter.city ? "font-bold" : ""}`}
                  onClick={() => onPick({ uf: g.uf as string })}
                >
                  {g.uf}
                </button>
              ) : (
                <span>Sem estado</span>
              )}
              <span className="tabular-nums">{formatCount(g.count)}</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-sm text-[#525252]">
              {g.cities.map((c) => (
                <li key={c.city ?? "sem-cidade"} className="flex items-center justify-between gap-2">
                  {g.uf && c.city ? (
                    <button
                      type="button"
                      className="min-h-9 text-left hover:underline"
                      onClick={() => onPick({ uf: g.uf as string, city: c.city as string })}
                    >
                      {c.city}
                    </button>
                  ) : (
                    <span className="min-h-9 leading-9">{c.city ?? "Sem cidade"}</span>
                  )}
                  <span className="tabular-nums">{formatCount(c.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {truncated && (
        <p className="mt-2 text-xs text-[#737373]">
          Só aparecem as maiores cidades. Filtre por estado ou cidade para ver as menores.
        </p>
      )}
    </section>
  );
}

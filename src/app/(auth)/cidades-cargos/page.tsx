"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPin, Tags, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { useAllProviders } from "@/modules/admin/application/use-both-modules";
import { useCatalogRoles } from "@/modules/admin/application/use-admin-catalog";
import { MODULE_LABEL, type ServiceModule } from "@/modules/admin/infrastructure/catalog-api";

type ModuleFilter = "all" | ServiceModule;

interface CityRow {
  city: string;
  uf: string | null;
  total: number;
  counts: Map<string, number>;
}

/**
 * Cargos por Cidade — quantos prestadores de cada função existem em cada cidade
 * (ex.: quantos garçons em São Paulo). Dado real: agrega a listagem admin de
 * prestadores (Empresa + Casa) por cidade × função, rotulando pelo catálogo.
 */
export default function CidadesCargosPage() {
  const { data: providers = [], isLoading } = useAllProviders();
  const { data: catalogRoles = [] } = useCatalogRoles();

  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [role, setRole] = useState<string>("all");
  const [citySearch, setCitySearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  // slug/nome/alias → nome canônico da função (rótulo bonito do catálogo).
  const roleLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of catalogRoles) {
      map.set(r.slug.toLowerCase(), r.name);
      map.set(r.name.toLowerCase(), r.name);
      for (const a of r.aliases) map.set(a.toLowerCase(), r.name);
    }
    return map;
  }, [catalogRoles]);

  const filteredProviders = useMemo(() => {
    const base = providers.filter(
      (p) => (moduleFilter === "all" || p.module === moduleFilter) && (!activeOnly || p.isActive),
    );
    if (moduleFilter !== "all") return base;
    // "Todos": a mesma pessoa pode ter perfil nos DOIS módulos (identidade é
    // global) — dedup por userId fundindo os serviços, senão conta 2x.
    const byUser = new Map<string, (typeof base)[number]>();
    for (const p of base) {
      const existing = byUser.get(p.userId);
      if (!existing) {
        byUser.set(p.userId, { ...p, services: [...(p.services ?? [])] });
      } else {
        const merged = new Set([...(existing.services ?? []), ...(p.services ?? [])]);
        existing.services = [...merged];
      }
    }
    return [...byUser.values()];
  }, [providers, moduleFilter, activeOnly]);

  const { cityRows, roleOptions, totals } = useMemo(() => {
    const canon = (s: string) => roleLabel.get(s.trim().toLowerCase()) ?? s.trim();
    const cityMap = new Map<string, CityRow>();
    const roleSet = new Set<string>();
    for (const p of filteredProviders) {
      const cityName = (p.city && p.city.trim()) || "Sem cidade";
      const key = `${cityName}|${p.uf ?? ""}`;
      let entry = cityMap.get(key);
      if (!entry) {
        entry = { city: cityName, uf: p.uf, total: 0, counts: new Map() };
        cityMap.set(key, entry);
      }
      entry.total += 1;
      const seen = new Set<string>();
      for (const s of p.services ?? []) {
        const label = canon(s);
        if (!label || seen.has(label)) continue;
        seen.add(label);
        roleSet.add(label);
        entry.counts.set(label, (entry.counts.get(label) ?? 0) + 1);
      }
    }
    return {
      cityRows: [...cityMap.values()],
      roleOptions: [...roleSet].sort((a, b) => a.localeCompare(b, "pt-BR")),
      totals: { providers: filteredProviders.length, cities: cityMap.size },
    };
  }, [filteredProviders, roleLabel]);

  const q = citySearch.trim().toLowerCase();

  // Linhas exibidas conforme a função selecionada.
  const allRoles = role === "all";
  const rows = useMemo(() => {
    const matchesCity = (r: CityRow) =>
      !q || r.city.toLowerCase().includes(q) || (r.uf ?? "").toLowerCase().includes(q);
    const base = cityRows.filter(matchesCity);
    if (allRoles) return base.sort((a, b) => b.total - a.total);
    return base
      .map((r) => ({ ...r, sel: r.counts.get(role) ?? 0 }))
      .filter((r) => r.sel > 0)
      .sort((a, b) => b.sel - a.sel);
  }, [cityRows, q, role, allRoles]);

  const selSummary = useMemo(() => {
    if (allRoles) return null;
    let total = 0;
    let cities = 0;
    for (const r of cityRows) {
      const n = r.counts.get(role) ?? 0;
      total += n;
      if (n > 0) cities += 1;
    }
    return { total, cities };
  }, [cityRows, role, allRoles]);

  return (
    <div>
      <PageHeader
        title="Cargos por Cidade"
        description="Quantos prestadores de cada função existem em cada cidade (ex.: garçons por cidade)."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando prestadores...
        </div>
      ) : (
        <div className="space-y-5">
          {/* Contadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Prestadores" value={totals.providers} />
            <StatCard icon={<MapPin className="w-4 h-4" />} label="Cidades" value={totals.cities} />
            <StatCard icon={<Tags className="w-4 h-4" />} label="Funções distintas" value={roleOptions.length} />
          </div>

          {/* Filtros */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Função</Label>
              <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} className="w-56">
                <option value="all">Todas as funções</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Módulo</Label>
              <NativeSelect
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)}
                className="w-56"
              >
                <option value="all">Todos</option>
                <option value="bars-restaurants">{MODULE_LABEL["bars-restaurants"]}</option>
                <option value="home-services">{MODULE_LABEL["home-services"]}</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs text-muted-foreground">Buscar cidade</Label>
              <Input
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Ex.: São Paulo"
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
              <Label htmlFor="active-only" className="text-sm">
                Somente ativos
              </Label>
            </div>
          </div>

          {selSummary && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{selSummary.total}</span> prestador(es) de{" "}
              <span className="font-semibold text-foreground">{role}</span> em{" "}
              <span className="font-semibold text-foreground">{selSummary.cities}</span> cidade(s).
            </p>
          )}

          {/* Tabela */}
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Cidade</th>
                  <th className="text-left font-medium py-3 px-4">UF</th>
                  {allRoles ? (
                    <>
                      <th className="text-right font-medium py-3 px-4">Prestadores</th>
                      <th className="text-left font-medium py-3 px-4">Principais cargos</th>
                    </>
                  ) : (
                    <th className="text-right font-medium py-3 px-4">Qtd. de {role}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.city}|${r.uf ?? ""}`}
                    className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">{r.city}</td>
                    <td className="py-3 px-4 text-muted-foreground">{r.uf ?? "—"}</td>
                    {allRoles ? (
                      <>
                        <td className="py-3 px-4 text-right font-semibold text-foreground">{r.total}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {[...r.counts.entries()]
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 4)
                              .map(([label, n]) => (
                                <span
                                  key={label}
                                  className="text-xs text-muted-foreground bg-accent rounded px-1.5 py-0.5"
                                >
                                  {label} <span className="font-semibold text-foreground">{n}</span>
                                </span>
                              ))}
                            {r.counts.size > 4 && (
                              <span className="text-xs text-muted-foreground">+{r.counts.size - 4}</span>
                            )}
                            {r.counts.size === 0 && (
                              <span className="text-xs text-muted-foreground">sem funções informadas</span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      <td className="py-3 px-4 text-right">
                        <Badge variant="secondary">{(r as CityRow & { sel: number }).sel}</Badge>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={allRoles ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                      {providers.length === 0 ? "Nenhum prestador encontrado." : "Nenhuma cidade para este filtro."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

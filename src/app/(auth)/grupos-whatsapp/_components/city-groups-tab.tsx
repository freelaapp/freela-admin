"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  EMPTY_CITY_FILTERS,
  cityOptions,
  filterCityGroups,
  groupsCountLabel,
  reconcileCityFilter,
  ufOptions,
  withUf,
  type CityFilters,
} from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupView } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import { AdminGroupsList } from "./admin-groups-list";
import { BotFilterSelect } from "./bot-filter-select";

export function CityGroupsTab({
  groups,
  onAddMembers,
  onDelete,
}: {
  groups: AdminGroupView[];
  onAddMembers: (group: AdminGroupView) => void;
  onDelete: (group: AdminGroupView) => void;
}) {
  const [filters, setFilters] = useState<CityFilters>(EMPTY_CITY_FILTERS);
  const ufs = useMemo(() => ufOptions(groups), [groups]);
  const cities = useMemo(() => cityOptions(groups, filters.uf), [groups, filters.uf]);
  // A cidade filtrada pode sumir das opções (ex.: o último grupo dela foi excluído e a lista
  // recarregou) sem que a UF mude — ignora o filtro fantasma em vez de esvaziar a lista.
  const effectiveFilters = useMemo(() => reconcileCityFilter(filters, cities), [filters, cities]);
  const rows = useMemo(() => filterCityGroups(groups, effectiveFilters), [groups, effectiveFilters]);
  const hasAny = groups.some((g) => g.kind === "CITY");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Buscar grupo"
          placeholder="Buscar pelo nome do grupo"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <NativeSelect aria-label="UF" value={filters.uf} onChange={(e) => setFilters(withUf(filters, e.target.value))}>
          <option value="">Todas as UFs</option>
          {ufs.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Cidade"
          value={effectiveFilters.city}
          disabled={!filters.uf}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        >
          <option value="">{filters.uf ? "Todas as cidades" : "Escolha a UF primeiro"}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <BotFilterSelect value={filters.bot} onChange={(bot) => setFilters({ ...filters, bot })} />
      </div>
      <p className="text-[13px] text-[#737373]">{groupsCountLabel(rows.length)}</p>
      <AdminGroupsList
        groups={rows}
        showLocation
        emptyText={hasAny ? "Nenhum grupo com esses filtros." : "Nenhum grupo de cidade cadastrado ainda. Use “Criar grupo”."}
        onAddMembers={onAddMembers}
        onDelete={onDelete}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  EMPTY_DEDICATED_FILTERS,
  filterDedicatedGroups,
  groupsCountLabel,
  type DedicatedFilters,
} from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupView } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import { AdminGroupsList } from "./admin-groups-list";
import { BotFilterSelect } from "./bot-filter-select";
import { DedicatedRulesSection } from "./dedicated-rules-section";

/** Grupos DEDICATED do painel (mesmas ações da aba Cidades) + as regras, sem mudança de comportamento. */
export function DedicatedGroupsTab({
  groups,
  defaultPhones,
  onAddMembers,
  onDelete,
}: {
  groups: AdminGroupView[];
  defaultPhones: string[];
  onAddMembers: (group: AdminGroupView) => void;
  onDelete: (group: AdminGroupView) => void;
}) {
  const [filters, setFilters] = useState<DedicatedFilters>(EMPTY_DEDICATED_FILTERS);
  const rows = useMemo(() => filterDedicatedGroups(groups, filters), [groups, filters]);
  const hasAny = groups.some((g) => g.kind === "DEDICATED");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <Input
          aria-label="Buscar grupo dedicado"
          placeholder="Buscar pelo nome do grupo"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <BotFilterSelect value={filters.bot} onChange={(bot) => setFilters({ ...filters, bot })} />
      </div>
      <p className="text-[13px] text-[#737373]">{groupsCountLabel(rows.length)}</p>
      <AdminGroupsList
        groups={rows}
        showLocation={false}
        emptyText={
          hasAny
            ? "Nenhum grupo com esses filtros."
            : "Nenhum grupo dedicado criado ainda. Crie pelo botão de uma regra abaixo."
        }
        onAddMembers={onAddMembers}
        onDelete={onDelete}
      />
      <DedicatedRulesSection defaultPhones={defaultPhones} />
    </div>
  );
}

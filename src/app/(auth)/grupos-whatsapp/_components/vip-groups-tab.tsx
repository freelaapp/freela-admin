"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useVipRole } from "@/modules/admin/application/use-freela-vip";
import { VIP_GROUP_STATUS_LABELS, vipGroupStatusVariant } from "@/modules/admin/application/vip-groups-presentation";
import {
  EMPTY_VIP_FILTERS,
  VIP_STATE_FILTER_OPTIONS,
  filterVipStores,
  groupsCountLabel,
  hasVipGroup,
  type VipFilters,
  type VipStateFilter,
} from "@/modules/admin/application/whatsapp-groups-presentation";
import type { VipStoreSummary } from "@/modules/admin/infrastructure/vip-groups-api";
import { QueryError } from "@/app/(auth)/freela-vip/_components/query-error";
import { BotFilterSelect } from "./bot-filter-select";
import { BotStatusBadge } from "./bot-status-badge";

/** Sem Excluir: o grupo VIP é do plano da loja e se gerencia na área Freela VIP. */
function ManageLink({ store, canView }: { store: VipStoreSummary; canView: boolean }) {
  if (!canView) return <span className="text-[12px] text-[#a3a3a3]">Sem acesso à área VIP</span>;
  return (
    <Link
      href={`/freela-vip/grupos/${store.contractorUserId}`}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-[#b7791f] hover:underline"
    >
      Gerenciar <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function StateBadge({ store }: { store: VipStoreSummary }) {
  return (
    <Badge variant={vipGroupStatusVariant(store.status)} className="w-fit">
      {VIP_GROUP_STATUS_LABELS[store.status]}
    </Badge>
  );
}

export function VipGroupsTab({
  stores,
  isLoading,
  isError,
  onRetry,
}: {
  stores: VipStoreSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const role = useVipRole();
  const [filters, setFilters] = useState<VipFilters>(EMPTY_VIP_FILTERS);
  const withGroup = useMemo(() => stores.filter(hasVipGroup), [stores]);
  const rows = useMemo(() => filterVipStores(stores, filters), [stores, filters]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-[#a3a3a3]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }
  if (isError) return <QueryError message="Não foi possível carregar os grupos VIP." onRetry={onRetry} />;
  if (withGroup.length === 0) {
    return (
      <p className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-8 text-center text-[13px] text-[#a3a3a3]">
        Nenhum grupo VIP criado ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          aria-label="Buscar loja"
          placeholder="Buscar pelo nome da loja"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <NativeSelect
          aria-label="Estado do grupo"
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value as VipStateFilter })}
        >
          {VIP_STATE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <BotFilterSelect value={filters.bot} onChange={(bot) => setFilters({ ...filters, bot })} />
      </div>
      <p className="text-[13px] text-[#737373]">{groupsCountLabel(rows.length)}</p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-8 text-center text-[13px] text-[#a3a3a3]">
          Nenhum grupo com esses filtros.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f7f7] text-left text-[#737373]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Loja</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Bot</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Membros ativos</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Gerenciar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {rows.map((s) => (
                  <tr key={s.contractorUserId}>
                    <td className="px-4 py-2.5 font-medium text-[#171717]">{s.storeName}</td>
                    <td className="px-4 py-2.5 text-[#525252]">{s.groupName ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <StateBadge store={s} />
                    </td>
                    <td className="px-4 py-2.5">{s.groupJid ? <BotStatusBadge botInGroup={s.botInGroup} /> : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[#525252]">{s.activeMembers}</td>
                    <td className="px-4 py-2.5 text-right">
                      <ManageLink store={s} canView={role.canView} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => (
              <div key={s.contractorUserId} className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px]">
                <p className="font-medium text-[#171717]">{s.storeName}</p>
                {s.groupName && <p className="text-[#737373]">{s.groupName}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StateBadge store={s} />
                  {s.groupJid && <BotStatusBadge botInGroup={s.botInGroup} />}
                  <span className="text-[#737373]">{s.activeMembers} membros ativos</span>
                </div>
                <div className="mt-2">
                  <ManageLink store={s} canView={role.canView} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

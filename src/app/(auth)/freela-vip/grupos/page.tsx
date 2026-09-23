"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVipRole } from "@/modules/admin/application/use-freela-vip";
import { useVipGroupMutations, useVipGroups } from "@/modules/admin/application/use-vip-groups";
import {
  VIP_GROUP_STATUS_LABELS,
  vipEmptyListWarning,
  vipGroupActionLabel,
  vipGroupStatusVariant,
  vipStorePendingSummary,
} from "@/modules/admin/application/vip-groups-presentation";
import type { VipStoreSummary } from "@/modules/admin/infrastructure/vip-groups-api";
import { VipGuard } from "../_components/vip-guard";
import { QueryError } from "../_components/query-error";

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function VipGroupsPage() {
  return (
    <VipGuard>
      <VipGroupsScreen />
    </VipGuard>
  );
}

/** "Criar grupo"/"Tentar criar de novo" de uma loja (só VIP_ADMIN vê). */
function CreateGroupButton({ store }: { store: VipStoreSummary }) {
  const { ensure } = useVipGroupMutations(store.contractorUserId);
  const label = vipGroupActionLabel(store.status);
  if (!label) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={ensure.isPending}
      onClick={(e) => {
        e.stopPropagation();
        ensure.mutate();
      }}
    >
      {ensure.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
      {label}
    </Button>
  );
}

function StatusCell({ store }: { store: VipStoreSummary }) {
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={vipGroupStatusVariant(store.status)} className="w-fit">
        {VIP_GROUP_STATUS_LABELS[store.status]}
      </Badge>
      {store.lastError && <span className="text-[12px] text-red-600">{store.lastError}</span>}
    </div>
  );
}

function MembersCell({ store }: { store: VipStoreSummary }) {
  const warning = vipEmptyListWarning(store.activeMembers);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular-nums">{store.activeMembers}</span>
      {warning && <span className="text-[12px] text-amber-700">{warning}</span>}
    </div>
  );
}

function VipGroupsScreen() {
  const router = useRouter();
  const role = useVipRole();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 300);
  const { data: stores = [], isLoading, isError, refetch } = useVipGroups(debouncedSearch);
  const open = (store: VipStoreSummary) => router.push(`/freela-vip/grupos/${store.contractorUserId}`);
  const emptyText = debouncedSearch
    ? "Nenhuma loja com esse nome."
    : "Nenhuma loja no plano Grandes Redes ainda.";

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="Grupos VIP"
        description="Grupo de WhatsApp VIP e lista VIP de cada loja Grandes Redes. Com a lista preenchida, as vagas da loja são só para os VIPs."
        action={
          <Button variant="outline" onClick={() => router.push("/freela-vip")}>
            <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
            Ciclos
          </Button>
        }
      />

      <div className="max-w-md">
        <Label htmlFor="vip-groups-search">Filtrar por nome da loja</Label>
        <Input
          id="vip-groups-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ex.: Coco Bambu"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-[#94A3B8]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : isError ? (
        <QueryError message="Não foi possível carregar as lojas." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th scope="col" className="px-3 py-2">Loja</th>
                  <th scope="col" className="px-3 py-2">Grupo</th>
                  <th scope="col" className="px-3 py-2">VIPs ativos</th>
                  <th scope="col" className="px-3 py-2">Pendências</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {stores.map((s) => (
                  <tr key={s.contractorUserId} className="cursor-pointer hover:bg-[#F8FAFC]" onClick={() => open(s)}>
                    <td className="px-3 py-2 font-medium text-[#0F172A]">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-[#94A3B8]" aria-hidden />
                        {s.storeName}
                      </span>
                    </td>
                    <td className="px-3 py-2"><StatusCell store={s} /></td>
                    <td className="px-3 py-2"><MembersCell store={s} /></td>
                    <td className="px-3 py-2 text-[#475569]">{vipStorePendingSummary(s)}</td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {role.canAdmin && <CreateGroupButton store={s} />}
                    </td>
                  </tr>
                ))}
                {stores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[#94A3B8]">{emptyText}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {stores.map((s) => (
              <div
                key={s.contractorUserId}
                className="cursor-pointer rounded-lg border border-[#E2E8F0] bg-white p-3 text-[13px]"
                onClick={() => open(s)}
              >
                <p className="flex items-center gap-2 font-medium text-[#0F172A]">
                  <MessageCircle className="h-4 w-4 text-[#94A3B8]" aria-hidden />
                  {s.storeName}
                </p>
                <div className="mt-2 flex flex-col gap-2 text-[#64748B]">
                  <StatusCell store={s} />
                  <div className="flex items-baseline gap-1">
                    <span>VIPs ativos:</span>
                    <MembersCell store={s} />
                  </div>
                  <p>{vipStorePendingSummary(s)}</p>
                </div>
                {role.canAdmin && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <CreateGroupButton store={s} />
                  </div>
                )}
              </div>
            ))}
            {stores.length === 0 && (
              <p className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-center text-[13px] text-[#94A3B8]">{emptyText}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

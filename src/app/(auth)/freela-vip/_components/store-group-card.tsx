"use client";

import Link from "next/link";
import { Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVipGroupDetail, useVipGroupMutations } from "@/modules/admin/application/use-vip-groups";
import { VIP_GROUP_STATUS_LABELS, vipGroupActionLabel, vipGroupStatusVariant } from "@/modules/admin/application/vip-groups-presentation";
import type { VipGroupStatus } from "@/modules/admin/infrastructure/vip-groups-api";

/**
 * Grupo de WhatsApp VIP da loja do ciclo, dentro da tela do ciclo: status, quantos
 * VIPs, criar/tentar de novo e o atalho para gerenciar. Quem é aprovado no funil
 * entra sozinho na lista VIP desta loja.
 */
export function StoreGroupCard({ contractorUserId, canAdmin }: { contractorUserId: string; canAdmin: boolean }) {
  const { data, isLoading, isError } = useVipGroupDetail(contractorUserId);
  const { ensure } = useVipGroupMutations(contractorUserId);

  const status: VipGroupStatus = data?.group?.status ?? "NONE";
  const activeMembers = (data?.members ?? []).filter((m) => !m.removedAt).length;
  const action = vipGroupActionLabel(status);

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#0F172A]">
            <MessageCircle className="h-4 w-4 text-[#b7791f]" aria-hidden /> Grupo VIP da loja
          </h2>
          <p className="mt-1 text-[12.5px] text-[#475569]">
            Quem você aprovar como VIP entra sozinho na lista VIP desta loja e, se ela tiver grupo, no grupo de WhatsApp.
          </p>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#94A3B8]" aria-hidden />
        ) : isError ? (
          <span className="text-[12px] text-[#94A3B8]">Grupo indisponível agora.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={vipGroupStatusVariant(status)}>{VIP_GROUP_STATUS_LABELS[status]}</Badge>
            <span className="text-[12.5px] tabular-nums text-[#475569]">{activeMembers} VIP{activeMembers === 1 ? "" : "s"} na lista</span>
          </div>
        )}
      </div>
      {data?.group?.lastError && <p className="mt-2 text-[12px] text-red-600">{data.group.lastError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canAdmin && action && (
          <Button size="sm" disabled={ensure.isPending} onClick={() => ensure.mutate()}>
            {ensure.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
            {action}
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/freela-vip/grupos/${contractorUserId}`}>Ver lista e grupo</Link>
        </Button>
      </div>
    </section>
  );
}

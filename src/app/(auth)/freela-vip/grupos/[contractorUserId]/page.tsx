"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVipRole } from "@/modules/admin/application/use-freela-vip";
import { useVipGroupDetail, useVipGroupMutations } from "@/modules/admin/application/use-vip-groups";
import { formatDate } from "@/modules/admin/application/freela-vip-presentation";
import {
  VIP_GROUP_STATUS_LABELS,
  VIP_SOURCE_LABELS,
  VIP_WHATSAPP_STATE_LABELS,
  vipEmptyListWarning,
  vipGroupActionLabel,
  vipGroupStatusVariant,
  vipMembersPendingAdd,
  vipWhatsappStateVariant,
} from "@/modules/admin/application/vip-groups-presentation";
import type { VipGroupMember } from "@/modules/admin/infrastructure/vip-groups-api";
import { VipGuard } from "../../_components/vip-guard";
import { QueryError } from "../../_components/query-error";
import { AddVipDialog } from "../../_components/add-vip-dialog";

export default function VipGroupStorePage() {
  return (
    <VipGuard>
      <StoreScreen />
    </VipGuard>
  );
}

const REMOVE_CONFIRM = (name: string) =>
  `Tirar ${name} da lista VIP desta loja?\n\nO sistema não remove ninguém do grupo do WhatsApp: depois de tirar, remova a pessoa no grupo e marque “Feito” em “Remover no WhatsApp”.`;

function StoreScreen() {
  const { contractorUserId } = useParams<{ contractorUserId: string }>();
  const router = useRouter();
  const role = useVipRole();
  const { data, isLoading, isError, refetch } = useVipGroupDetail(contractorUserId);
  const { ensure, remove, markRemoved, sync } = useVipGroupMutations(contractorUserId);
  const [adding, setAdding] = useState(false);

  const back = (
    <Button variant="outline" onClick={() => router.push("/freela-vip/grupos")}>
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
      Grupos VIP
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-[#94A3B8]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
        <PageHeader title="Grupo VIP" action={back} />
        <QueryError message="Não foi possível carregar esta loja." onRetry={() => refetch()} />
      </div>
    );
  }

  const status = data.group?.status ?? "NONE";
  const actionLabel = vipGroupActionLabel(status);
  const pendingAdd = vipMembersPendingAdd(data.members);
  const emptyWarning = vipEmptyListWarning(data.members.length);

  const removeButton = (m: VipGroupMember) =>
    role.canAdmin && (
      <Button
        size="sm"
        variant="ghost"
        disabled={remove.isPending && remove.variables === m.providerGlobalId}
        onClick={() => {
          if (window.confirm(REMOVE_CONFIRM(m.name ?? "este freela"))) remove.mutate(m.providerGlobalId);
        }}
      >
        Remover
      </Button>
    );

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title={data.storeName ?? "Loja"}
        description="Grupo de WhatsApp VIP e lista VIP desta loja. Com a lista preenchida, toda vaga nova da loja é só para os VIPs."
        action={
          <div className="flex flex-wrap gap-2">
            {back}
            {role.canAdmin && (
              <Button onClick={() => setAdding(true)}>
                <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                Adicionar VIP
              </Button>
            )}
          </div>
        }
      />

      <section className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#64748B]">Grupo:</span>
          <Badge variant={vipGroupStatusVariant(status)}>{VIP_GROUP_STATUS_LABELS[status]}</Badge>
          {data.group && <span className="text-[#0F172A]">{data.group.groupName}</span>}
        </div>
        {data.group?.lastError && <p className="text-[12.5px] text-red-600">{data.group.lastError}</p>}
        {role.canAdmin && (
          <div className="flex flex-wrap gap-2">
            {actionLabel && (
              <Button size="sm" variant="outline" disabled={ensure.isPending} onClick={() => ensure.mutate()}>
                {ensure.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
                {actionLabel}
              </Button>
            )}
            {status === "ACTIVE" && pendingAdd > 0 && (
              <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" aria-hidden />
                )}
                Adicionar pendentes ao grupo ({pendingAdd})
              </Button>
            )}
          </div>
        )}
      </section>

      {emptyWarning && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {emptyWarning}
        </div>
      )}

      <h2 className="text-[14px] font-semibold text-[#0F172A]">Lista VIP ({data.members.length})</h2>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="w-full text-[13px]">
          <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
            <tr>
              <th scope="col" className="px-3 py-2">Freela</th>
              <th scope="col" className="px-3 py-2">Cidade</th>
              <th scope="col" className="px-3 py-2">Origem</th>
              <th scope="col" className="px-3 py-2">WhatsApp</th>
              <th scope="col" className="px-3 py-2">Desde</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {data.members.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-[#0F172A]">{m.name ?? "Freela"}</p>
                      <p className="text-[12px] text-[#64748B]">{m.phone ?? "sem telefone"}</p>
                    </div>
                    {!m.providerActive && <Badge variant="warning">Desativado</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2 text-[#475569]">{m.city ?? "—"}</td>
                <td className="px-3 py-2">{VIP_SOURCE_LABELS[m.source]}</td>
                <td className="px-3 py-2">
                  <Badge variant={vipWhatsappStateVariant(m.whatsappState)}>{VIP_WHATSAPP_STATE_LABELS[m.whatsappState]}</Badge>
                  {m.lastError && <p className="mt-1 text-[12px] text-red-600">{m.lastError}</p>}
                </td>
                <td className="px-3 py-2 text-[#475569]">{formatDate(m.createdAt)}</td>
                <td className="px-3 py-2 text-right">{removeButton(m)}</td>
              </tr>
            ))}
            {data.members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#94A3B8]">Ninguém na lista VIP ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {data.members.map((m) => (
          <div key={m.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[#0F172A]">{m.name ?? "Freela"}</p>
              {!m.providerActive && <Badge variant="warning">Desativado</Badge>}
            </div>
            <div className="mt-1 space-y-0.5 text-[#64748B]">
              <p>{m.phone ?? "sem telefone"}</p>
              <p>{m.city ?? "—"} · {VIP_SOURCE_LABELS[m.source]} · desde {formatDate(m.createdAt)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={vipWhatsappStateVariant(m.whatsappState)}>{VIP_WHATSAPP_STATE_LABELS[m.whatsappState]}</Badge>
              {removeButton(m)}
            </div>
            {m.lastError && <p className="mt-1 text-[12px] text-red-600">{m.lastError}</p>}
          </div>
        ))}
        {data.members.length === 0 && (
          <p className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-center text-[13px] text-[#94A3B8]">Ninguém na lista VIP ainda.</p>
        )}
      </div>

      {data.pendingRemovals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Remover no WhatsApp ({data.pendingRemovals.length})</h2>
          <p className="text-[12.5px] text-[#64748B]">
            Saíram da lista, mas o sistema não tira ninguém do grupo. Remova no WhatsApp e marque “Feito”.
          </p>
          <ul className="flex flex-col gap-2">
            {data.pendingRemovals.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px]">
                <div className="min-w-0">
                  <p className="font-medium text-[#0F172A]">{m.name ?? "Freela"}</p>
                  <p className="text-[12px] text-[#64748B]">{m.phone ?? "sem telefone"}</p>
                </div>
                {role.canAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={markRemoved.isPending && markRemoved.variables === m.providerGlobalId}
                    onClick={() => markRemoved.mutate(m.providerGlobalId)}
                  >
                    Feito
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {role.canAdmin && (
        <AddVipDialog open={adding} contractorUserId={contractorUserId} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

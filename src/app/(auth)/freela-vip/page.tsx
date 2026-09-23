"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Plus, Settings, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { useAdminContractorsList, useVipCycles, useVipCycleMutations, useVipRole } from "@/modules/admin/application/use-freela-vip";
import { cycleInviteBudget, formatDate } from "@/modules/admin/application/freela-vip-presentation";
import type { VipCycle } from "@/modules/admin/infrastructure/freela-vip-api";
import { VipGuard } from "./_components/vip-guard";
import { CycleDialog } from "./_components/cycle-dialog";
import { redeLabel } from "./_components/rede-select";
import { QueryError } from "./_components/query-error";

export default function FreelaVipPage() {
  return (
    <VipGuard>
      <CyclesScreen />
    </VipGuard>
  );
}

function CyclesScreen() {
  const router = useRouter();
  const role = useVipRole();
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("true");
  const { data: cycles = [], isLoading, isError, refetch } = useVipCycles(activeFilter === "all" ? undefined : activeFilter === "true");
  const { data: contractors } = useAdminContractorsList();
  const { update } = useVipCycleMutations();
  const [dialog, setDialog] = useState<{ open: boolean; cycle?: VipCycle }>({ open: false });

  const renderActions = (c: VipCycle) => (
    <>
      <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: c.id, input: { linkOpen: !c.linkOpen } })}>
        {c.linkOpen ? "Fechar link" : "Abrir link"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, cycle: c })}>Editar</Button>
    </>
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="Freela VIP"
        description="Ciclos de seleção de freelancers VIP por rede (Grandes Redes)."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/freela-vip/vips")}>
              <Crown className="mr-1 h-4 w-4" aria-hidden /> VIPs ativos
            </Button>
            {role.canAdmin && (
              <>
                <Button variant="outline" onClick={() => router.push("/freela-vip/config")}>
                  <Settings className="mr-1 h-4 w-4" aria-hidden /> Configuração
                </Button>
                <Button onClick={() => setDialog({ open: true })}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden /> Novo ciclo
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <label htmlFor="f-active" className="text-[12.5px] text-[#64748B]">Mostrar</label>
        <NativeSelect id="f-active" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="all">Todos</option>
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>
      ) : isError ? (
        <QueryError message="Não foi possível carregar os ciclos." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th scope="col" className="px-3 py-2">Ciclo</th>
                  <th scope="col" className="px-3 py-2">Rede</th>
                  <th scope="col" className="px-3 py-2">Cidades · funções</th>
                  <th scope="col" className="px-3 py-2">Vagas · convites</th>
                  <th scope="col" className="px-3 py-2">Período</th>
                  <th scope="col" className="px-3 py-2">Link</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {cycles.map((c) => (
                  <tr key={c.id} className={`cursor-pointer hover:bg-[#F8FAFC] ${c.active ? "" : "opacity-60"}`} onClick={() => router.push(`/freela-vip/${c.id}`)}>
                    <td className="px-3 py-2 font-medium text-[#0F172A]">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[#94A3B8]" aria-hidden />{c.name}</span>
                    </td>
                    <td className="px-3 py-2">{redeLabel(contractors, c.targetContractorUserId)}</td>
                    <td className="px-3 py-2 text-[#475569]">{c.cities.join(", ")} · {c.roles.join(", ")}</td>
                    <td className="px-3 py-2 tabular-nums">{c.targetVacancies} · {cycleInviteBudget(c)}</td>
                    <td className="px-3 py-2 text-[#475569]">{formatDate(c.startsAt)} – {formatDate(c.endsAt)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{c.linkOpen ? "aberto" : "fechado"}</Badge>
                      {!c.active && <Badge variant="secondary" className="ml-1">inativo</Badge>}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {role.canAdmin && <span className="flex justify-end gap-1">{renderActions(c)}</span>}
                    </td>
                  </tr>
                ))}
                {cycles.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-[#94A3B8]">Nenhum ciclo. Crie um para começar uma seleção.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {cycles.map((c) => (
              <div
                key={c.id}
                className={`cursor-pointer rounded-lg border border-[#E2E8F0] bg-white p-3 text-[13px] ${c.active ? "" : "opacity-60"}`}
                onClick={() => router.push(`/freela-vip/${c.id}`)}
              >
                <p className="flex items-center gap-2 font-medium text-[#0F172A]"><Users className="h-4 w-4 text-[#94A3B8]" aria-hidden />{c.name}</p>
                <div className="mt-1 space-y-0.5 text-[#64748B]">
                  <p>{redeLabel(contractors, c.targetContractorUserId)}</p>
                  <p>{c.cities.join(", ")} · {c.roles.join(", ")}</p>
                  <p>{c.targetVacancies} vagas · {cycleInviteBudget(c)} convites</p>
                  <p>{formatDate(c.startsAt)} – {formatDate(c.endsAt)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">{c.linkOpen ? "aberto" : "fechado"}</Badge>
                  {!c.active && <Badge variant="secondary">inativo</Badge>}
                </div>
                {role.canAdmin && (
                  <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    {renderActions(c)}
                  </div>
                )}
              </div>
            ))}
            {cycles.length === 0 && (
              <p className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-center text-[13px] text-[#94A3B8]">Nenhum ciclo. Crie um para começar uma seleção.</p>
            )}
          </div>
        </>
      )}

      <CycleDialog open={dialog.open} cycle={dialog.cycle} onClose={() => setDialog({ open: false })} />
    </div>
  );
}

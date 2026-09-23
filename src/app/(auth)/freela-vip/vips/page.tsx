"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useActiveVips, useVipRole, VIP_KEYS } from "@/modules/admin/application/use-freela-vip";
import { formatDate, VIP_STATUS_LABELS } from "@/modules/admin/application/freela-vip-presentation";
import { moveVipStage } from "@/modules/admin/infrastructure/freela-vip-api";
import { VipGuard } from "../_components/vip-guard";
import { RedeSelect } from "../_components/rede-select";
import { QueryError } from "../_components/query-error";

export default function VipsPage() {
  return (
    <VipGuard>
      <VipsScreen />
    </VipGuard>
  );
}

function VipsScreen() {
  const router = useRouter();
  const role = useVipRole();
  const qc = useQueryClient();
  const [rede, setRede] = useState("");
  const { data: vips = [], isLoading, isError, refetch } = useActiveVips(rede);
  const suspend = useMutation({
    mutationFn: (applicationId: string) => moveVipStage(applicationId, "VIP_SUSPENDED"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: VIP_KEYS.vips(rede) }); toast.success("VIP suspenso."); },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Não foi possível suspender.")),
  });

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="VIPs ativos"
        description="Freelancers promovidos a VIP por rede (todos os ciclos). Um VIP ativo entra nos favoritos da rede e ganha a janela de prioridade nas vagas."
        action={<Button variant="outline" onClick={() => router.push("/freela-vip")}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Ciclos</Button>}
      />
      <div className="max-w-md">
        <Label htmlFor="rede">Rede</Label>
        <RedeSelect value={rede} onChange={setRede} />
      </div>

      {!rede ? (
        <p className="text-[12.5px] text-[#94A3B8]">Selecione uma rede para ver os VIPs.</p>
      ) : isLoading ? (
        <div className="flex justify-center py-10 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>
      ) : isError ? (
        <QueryError message="Não foi possível carregar os VIPs desta rede." onRetry={() => refetch()} />
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th scope="col" className="px-3 py-2">Freelancer</th>
                  <th scope="col" className="px-3 py-2">Cidade · função</th>
                  <th scope="col" className="px-3 py-2">Ciclo</th>
                  <th scope="col" className="px-3 py-2">Promovido em</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {vips.map((v) => (
                  <tr key={v.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2 font-medium text-[#0F172A]">
                      <button className="flex items-center gap-2 hover:underline" onClick={() => router.push(`/freela-vip/candidatos/${v.id}`)}>
                        <Crown className="h-4 w-4 text-[#EAB308]" aria-hidden />{v.displayName ?? "VIP"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-[#475569]">{v.city ?? "—"} · {v.mainRole ?? "—"}</td>
                    <td className="px-3 py-2">{v.cycleName}</td>
                    <td className="px-3 py-2">{formatDate(v.decidedAt)}</td>
                    <td className="px-3 py-2"><Badge variant={v.status === "VIP_ACTIVE" ? "success" : v.status === "VIP_SUSPENDED" ? "warning" : "secondary"}>{VIP_STATUS_LABELS[v.status]}</Badge></td>
                    <td className="px-3 py-2 text-right">
                      {role.canAdmin && v.status === "VIP_ACTIVE" && (
                        <Button size="sm" variant="ghost" disabled={suspend.isPending && suspend.variables === v.id} onClick={() => { if (window.confirm(`Suspender ${v.displayName ?? "este VIP"}?`)) suspend.mutate(v.id); }}>Suspender</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {vips.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-[#94A3B8]">Nenhum VIP ativo nesta rede ainda.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 md:hidden">
            {vips.map((v) => (
              <div key={v.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3 text-[13px]">
                <button className="flex items-center gap-2 font-medium text-[#0F172A] hover:underline" onClick={() => router.push(`/freela-vip/candidatos/${v.id}`)}>
                  <Crown className="h-4 w-4 text-[#EAB308]" aria-hidden />{v.displayName ?? "VIP"}
                </button>
                <div className="mt-1 space-y-0.5 text-[#64748B]">
                  <p>{v.city ?? "—"} · {v.mainRole ?? "—"}</p>
                  <p>{v.cycleName}</p>
                  <p>Promovido em {formatDate(v.decidedAt)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={v.status === "VIP_ACTIVE" ? "success" : v.status === "VIP_SUSPENDED" ? "warning" : "secondary"}>{VIP_STATUS_LABELS[v.status]}</Badge>
                  {role.canAdmin && v.status === "VIP_ACTIVE" && (
                    <Button size="sm" variant="ghost" disabled={suspend.isPending && suspend.variables === v.id} onClick={() => { if (window.confirm(`Suspender ${v.displayName ?? "este VIP"}?`)) suspend.mutate(v.id); }}>Suspender</Button>
                  )}
                </div>
              </div>
            ))}
            {vips.length === 0 && <p className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-center text-[13px] text-[#94A3B8]">Nenhum VIP ativo nesta rede ainda.</p>}
          </div>
        </>
      )}
    </div>
  );
}

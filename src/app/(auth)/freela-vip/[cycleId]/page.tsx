"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVipContractors, useVipCycle, useVipKanban, useVipRole } from "@/modules/admin/application/use-freela-vip";
import { cycleInviteBudget, formatDate } from "@/modules/admin/application/freela-vip-presentation";
import { buildVipCycleLink } from "@/modules/admin/infrastructure/referral-link";
import { VipGuard } from "../_components/vip-guard";
import { redeLabel } from "../_components/rede-select";
import { PreselectedTab } from "../_components/preselected-tab";
import { FunnelBoard } from "../_components/funnel-board";
import { IndicatorsTab } from "../_components/indicators-tab";
import { QueryError } from "../_components/query-error";
import { InvitesTab } from "../_components/invites-tab";
import { StoreGroupCard } from "../_components/store-group-card";
import { TodoStrip, type CycleTab } from "../_components/todo-strip";

export default function VipCyclePage() {
  return (
    <VipGuard>
      <CycleScreen />
    </VipGuard>
  );
}

function CycleScreen() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const role = useVipRole();
  const { data: cycle, isLoading, isError, refetch } = useVipCycle(cycleId);
  const { data: contractors } = useVipContractors();
  const { data: board } = useVipKanban(cycleId);
  const [tab, setTab] = useState<CycleTab>(role.canAdmin ? "convidar" : "funil");

  if (isLoading) return <div className="flex justify-center py-12 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  if (isError || !cycle) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
        <Button variant="outline" onClick={() => router.push("/freela-vip")}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Ciclos</Button>
        <QueryError message="Não foi possível carregar o ciclo." onRetry={() => refetch()} />
      </div>
    );
  }

  const hasBackground = !!cycle.backgroundJustification?.trim();
  const publicUrl = buildVipCycleLink(cycle.id, {
    webAppUrl: process.env.NEXT_PUBLIC_WEB_APP_URL,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  async function copyPublicUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado");
    } catch {
      // Clipboard bloqueado: mostra o link para copiar na mão (igual vagas fixas).
      toast.error(`Não foi possível copiar. Link: ${publicUrl}`);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title={cycle.name}
        description={`${redeLabel(contractors, cycle.targetContractorUserId)} · ${cycle.cities.join(", ")} · ${cycle.roles.join(", ")} · ${cycle.targetVacancies} vagas · ${cycleInviteBudget(cycle)} convites · ${formatDate(cycle.startsAt)} – ${formatDate(cycle.endsAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push("/freela-vip")}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Ciclos</Button>
            <Button
              variant="outline"
              onClick={copyPublicUrl}
            >
              <Copy className="mr-1 h-4 w-4" aria-hidden />Link público
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        <Badge variant="secondary" title="Com o link aberto, qualquer pessoa com o link público pode se inscrever.">{cycle.linkOpen ? "link público aberto" : "link público fechado"}</Badge>
        <Badge variant="secondary">{cycle.active ? "ativo" : "inativo"}</Badge>
        <Badge variant="secondary">{cycle.backgroundJustification ? "pede antecedentes" : "sem etapa de antecedentes"}</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {board ? (
          <TodoStrip board={board} cycleHasBackground={hasBackground} onGo={setTab} />
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-[12.5px] text-[#94A3B8]">Carregando o que há para fazer…</div>
        )}
        <StoreGroupCard contractorUserId={cycle.targetContractorUserId} canAdmin={role.canAdmin} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CycleTab)}>
        <TabsList className="flex-wrap">
          {role.canAdmin && <TabsTrigger value="convidar">Convidar</TabsTrigger>}
          <TabsTrigger value="convites">Convites enviados</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="ind">Indicadores</TabsTrigger>
        </TabsList>
        {role.canAdmin && <TabsContent value="convidar" className="mt-4"><PreselectedTab cycle={cycle} onSent={() => setTab("convites")} /></TabsContent>}
        <TabsContent value="convites" className="mt-4"><InvitesTab cycleId={cycle.id} canAdmin={role.canAdmin} /></TabsContent>
        <TabsContent value="funil" className="mt-4"><FunnelBoard cycleId={cycle.id} cycleHasBackground={hasBackground} /></TabsContent>
        <TabsContent value="ind" className="mt-4"><IndicatorsTab cycleId={cycle.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

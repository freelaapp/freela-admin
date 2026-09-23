"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminContractorsList, useVipCycle, useVipRole } from "@/modules/admin/application/use-freela-vip";
import { cycleInviteBudget, formatDate } from "@/modules/admin/application/freela-vip-presentation";
import { VipGuard } from "../_components/vip-guard";
import { redeLabel } from "../_components/rede-select";
import { PreselectedTab } from "../_components/preselected-tab";
import { FunnelBoard } from "../_components/funnel-board";
import { IndicatorsTab } from "../_components/indicators-tab";
import { QueryError } from "../_components/query-error";

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
  const { data: contractors } = useAdminContractorsList();
  const [tab, setTab] = useState(role.canAdmin ? "pre" : "funil");

  if (isLoading) return <div className="flex justify-center py-12 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  if (isError || !cycle) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
        <Button variant="outline" onClick={() => router.push("/freela-vip")}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Ciclos</Button>
        <QueryError message="Não foi possível carregar o ciclo." onRetry={() => refetch()} />
      </div>
    );
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? ""}/vip/ciclo/${cycle.id}`;

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
              onClick={() => { navigator.clipboard.writeText(publicUrl); toast.info("Link copiado. A página do candidato entra com o sub-projeto A2."); }}
            >
              <Copy className="mr-1 h-4 w-4" aria-hidden />Link público
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        <Badge variant="secondary">{cycle.linkOpen ? "link aberto" : "link fechado"}</Badge>
        <Badge variant="secondary">{cycle.active ? "ativo" : "inativo"}</Badge>
        <Badge variant="secondary">{cycle.backgroundJustification ? "com antecedentes" : "sem etapa de antecedentes"}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {role.canAdmin && <TabsTrigger value="pre">Pré-selecionados</TabsTrigger>}
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="ind">Indicadores</TabsTrigger>
        </TabsList>
        {role.canAdmin && <TabsContent value="pre" className="mt-4"><PreselectedTab cycle={cycle} /></TabsContent>}
        <TabsContent value="funil" className="mt-4"><FunnelBoard cycleId={cycle.id} /></TabsContent>
        <TabsContent value="ind" className="mt-4"><IndicatorsTab cycleId={cycle.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

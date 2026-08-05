"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FunnelBoard } from "./_components/funnel-board";
import { ProspectBoard } from "./_components/prospect-board";
import { CompanyDialog } from "./_components/company-dialog";
import { TasksPanel } from "./_components/tasks-panel";

/**
 * Aba Pipeline do painel admin. A aba principal é o FUNIL DE CONTRATANTES
 * (kanban automático: cadastro novo → 1ª/2ª/3ª contratação → fidelizado);
 * a prospecção manual de empresas e as tarefas do CRM seguem nas outras abas.
 */
export default function PipelinePage() {
  const [tab, setTab] = useState("funil");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Funil de contratantes — do cadastro novo ao cliente fidelizado"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="funil">Pipeline</TabsTrigger>
          <TabsTrigger value="prospeccao">Prospecção</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="funil">
          <FunnelBoard />
        </TabsContent>

        <TabsContent value="prospeccao">
          <ProspectBoard onOpenCompany={(id) => setSelectedId(id)} />
        </TabsContent>

        <TabsContent value="tarefas">
          <TasksPanel onOpenCompany={(id) => setSelectedId(id)} />
        </TabsContent>
      </Tabs>

      <CompanyDialog companyId={selectedId} onOpenChange={(v) => !v && setSelectedId(null)} />
    </div>
  );
}

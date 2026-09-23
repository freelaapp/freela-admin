"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { QuestionsTab } from "../_components/questions-tab";
import { ScoringTab } from "../_components/scoring-tab";
import { TemplatesTab } from "../_components/templates-tab";

export default function VipConfigPage() {
  const { isChecking, allowed } = useAreaGuard("VIP_ADMIN");
  const router = useRouter();
  const [tab, setTab] = useState("perguntas");
  if (isChecking || !allowed) return <div className="flex justify-center py-16 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="Configuração do Freela VIP"
        description="Banco de perguntas por função, pesos e cortes da nota, e mensagens de cada momento — sem deploy."
        action={<Button variant="outline" onClick={() => router.push("/freela-vip")}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Ciclos</Button>}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
          <TabsTrigger value="nota">Nota</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
        </TabsList>
        <TabsContent value="perguntas" className="mt-4"><QuestionsTab /></TabsContent>
        <TabsContent value="nota" className="mt-4"><ScoringTab /></TabsContent>
        <TabsContent value="mensagens" className="mt-4"><TemplatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

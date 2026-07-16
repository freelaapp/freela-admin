"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, Search, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCrmCompanies, useCrmMutations } from "@/modules/admin/application/use-admin-crm";
import type { CrmCompanyStatus, CrmPriority } from "@/modules/admin/infrastructure/crm-api";
import { PRIORITY_META, PRIORITY_OPTIONS, STATUS_COLUMNS } from "./_components/crm-constants";
import { NewCompanyDialog } from "./_components/new-company-dialog";
import { CompanyDialog } from "./_components/company-dialog";
import { TasksPanel } from "./_components/tasks-panel";

export default function PipelinePage() {
  const { data: companies = [], isLoading } = useCrmCompanies();
  const { moveCompany } = useCrmMutations();

  const [tab, setTab] = useState("pipeline");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<CrmPriority | "">("");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return companies.filter((c) => {
      if (priority && c.priority !== priority) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.city ?? "").toLowerCase().includes(term) ||
        (c.segment ?? "").toLowerCase().includes(term)
      );
    });
  }, [companies, q, priority]);

  const byStatus = useMemo(() => {
    const map: Record<CrmCompanyStatus, typeof filtered> = {
      NOVO: [],
      EM_CONTATO: [],
      NEGOCIANDO: [],
      FECHADO: [],
      PERDIDO: [],
    };
    for (const c of filtered) map[c.status]?.push(c);
    return map;
  }, [filtered]);

  function onDrop(status: CrmCompanyStatus) {
    if (!draggingId) return;
    const current = companies.find((c) => c.id === draggingId);
    setDraggingId(null);
    if (!current || current.status === status) return;
    // Ordem calculada da lista COMPLETA da coluna: com busca/filtro ativo,
    // byStatus só vê os cards visíveis e a posição salva colidia com os ocultos.
    const fullColumnLength = companies.filter((c) => c.status === status).length;
    moveCompany.mutate({ id: draggingId, status, boardOrder: fullColumnLength });
  }

  return (
    <div>
      <PageHeader
        title="Pipeline Comercial"
        description="Empresas em prospecção — organize por etapa, prioridade e tarefas"
        action={
          <Button
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova empresa
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#737373]" />
              <Input
                className="pl-8 w-64"
                placeholder="Buscar empresa, cidade, segmento…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <NativeSelect
              className="w-44"
              value={priority}
              onChange={(e) => setPriority(e.target.value as CrmPriority | "")}
            >
              <option value="">Todas prioridades</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {isLoading ? (
            <p className="text-sm text-[#737373]">Carregando pipeline…</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUS_COLUMNS.map((col) => {
                const Icon = col.icon;
                const cards = byStatus[col.status];
                return (
                  <div
                    key={col.status}
                    className="min-w-[270px] flex-shrink-0"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(col.status)}
                  >
                    <div className="border-t-4 border-[#eca826] bg-white rounded-xl border border-[#e5e5e5]">
                      <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                        <h3 className="font-semibold text-xs text-[#1d1d1b] flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-[#eca826]" />
                          {col.label}
                        </h3>
                        <span className="text-xs font-medium text-[#737373] bg-[#f7f7f7] px-2 py-0.5 rounded-full">
                          {cards.length}
                        </span>
                      </div>
                      <div className="p-3 space-y-2 min-h-[80px]">
                        {cards.map((c) => (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={() => setDraggingId(c.id)}
                            onDragEnd={() => setDraggingId(null)}
                            onClick={() => setSelectedId(c.id)}
                            className={`bg-[#f7f7f7]/50 rounded-lg p-3 cursor-pointer hover:bg-[#f7f7f7] transition-colors ${
                              draggingId === c.id ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-[#1d1d1b]">{c.name}</p>
                              <GripVertical className="w-4 h-4 text-[#c4c4c4] shrink-0" />
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5 mt-2">
                              <Badge
                                variant={PRIORITY_META[c.priority].variant}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {PRIORITY_META[c.priority].label}
                              </Badge>
                              {c.city && <span className="text-xs text-[#737373]">{c.city}</span>}
                              {c.openTasksCount > 0 && (
                                <span className="text-[10px] text-[#737373] bg-white border border-[#e5e5e5] px-1.5 py-0 rounded-full">
                                  {c.openTasksCount} tarefa{c.openTasksCount > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {cards.length === 0 && (
                          <p className="text-[11px] text-[#c4c4c4] text-center py-3">
                            Arraste empresas aqui
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tarefas">
          <TasksPanel onOpenCompany={(id) => setSelectedId(id)} />
        </TabsContent>
      </Tabs>

      <NewCompanyDialog open={newOpen} onOpenChange={setNewOpen} />
      <CompanyDialog companyId={selectedId} onOpenChange={(v) => !v && setSelectedId(null)} />
    </div>
  );
}

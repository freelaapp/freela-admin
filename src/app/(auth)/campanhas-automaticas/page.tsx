"use client";

import { useState } from "react";
import { AlertTriangle, History, Loader2, Pause, Pencil, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignDetailDialog } from "@/app/(auth)/campanhas/_components/campaign-detail-dialog";
import { lastRunSummary } from "@/app/(auth)/campanhas/_lib/campaign-results";
import { CampaignWizard } from "@/app/(auth)/campanhas/_components/campaign-wizard";
import { MarketingStatusBadge } from "@/app/(auth)/campanhas/_components/marketing-status-badge";
import { MarketingTemplatesTab } from "@/app/(auth)/campanhas/_components/marketing-templates-tab";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCampaignTemplates,
  useSetCampaignTemplateEnabled,
} from "@/modules/admin/application/use-campaign-templates";
import type {
  CampaignChannel,
  CampaignTemplate,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import { AutomaticRunsDialog } from "./_components/automatic-runs-dialog";
import { describeSchedule } from "./_lib/describe-schedule";

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
};

/** Literal da API (spec 2026-10-01 campanhas §5.1); ela manda em `whatsappNotice`. */
const NEEDS_TEMPLATE_NOTICE = "Escolha um modelo aprovado para voltar a mandar WhatsApp";

type PageTab = "automaticas" | "modelos";

interface WizardRequest {
  open: boolean;
  edit?: CampaignTemplate | null;
  templateId?: string | null;
}

/**
 * Campanhas automáticas (recorrentes): agenda, canais, modelo do WhatsApp, ligado/pausado.
 * Criar/editar é a "Nova campanha em 4 passos" (a mesma da avulsa, com o passo 3 da
 * automática); a aba "Modelos" é a biblioteca compartilhada com a avulsa.
 */
export default function CampanhasAutomaticasPage() {
  const { allowed, isChecking } = useAreaGuard("REFERRALS");
  const { user } = useAuth();
  const templates = useCampaignTemplates();
  const setEnabled = useSetCampaignTemplateEnabled();
  const [tab, setTab] = useState<PageTab>("automaticas");
  const [wizard, setWizard] = useState<WizardRequest>({ open: false });
  // Parte 2 (spec 2026-10-01 parte 2 §8.5): histórico e o detalhe de uma execução.
  const [history, setHistory] = useState<CampaignTemplate | null>(null);
  const [runDetailId, setRunDetailId] = useState<string | null>(null);


  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const meta = templates.data?.meta;
  // A automática cria a execução (agendador da automática), mas quem manda é o despachante:
  // com qualquer um desligado, nada sai.
  const schedulerOff = Boolean(meta) && !(meta?.schedulerEnabled && meta?.templatesSchedulerEnabled);

  async function handleToggleEnabled(template: CampaignTemplate) {
    try {
      await setEnabled.mutateAsync({ id: template.id, enabled: !template.enabled });
      toast.success(template.enabled ? "Campanha pausada." : "Campanha ligada.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível mudar a campanha automática."));
    }
  }

  const columns = [
    {
      header: "Nome",
      accessor: (row: CampaignTemplate) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{row.name}</span>
          {row.whatsappNeedsTemplate && (
            <span className="flex items-start gap-1 text-[11px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {row.whatsappNotice ?? NEEDS_TEMPLATE_NOTICE}
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortAccessor: (row: CampaignTemplate) => row.name,
    },
    {
      header: "Agenda",
      accessor: (row: CampaignTemplate) => (
        <span className="text-xs text-[#737373]">{describeSchedule(row)}</span>
      ),
    },
    {
      header: "Canais",
      accessor: (row: CampaignTemplate) => (
        <div className="flex flex-wrap gap-1">
          {row.channels.map((channel) => (
            <span
              key={channel}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
            >
              {CHANNEL_LABELS[channel]}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Modelo do WhatsApp",
      accessor: (row: CampaignTemplate) =>
        !row.channels.includes("WHATSAPP") ? (
          <span className="text-neutral-400">—</span>
        ) : row.marketingTemplate ? (
          <span className="flex flex-wrap items-center gap-1 text-xs">
            {row.marketingTemplate.name}
            <MarketingStatusBadge status={row.marketingTemplate.status} />
          </span>
        ) : (
          <span className="text-xs text-amber-800">Sem modelo</span>
        ),
    },
    {
      header: "Status",
      accessor: (row: CampaignTemplate) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.enabled ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
          }`}
        >
          {row.enabled ? "Ligado" : "Pausado"}
        </span>
      ),
    },
    {
      header: "Última execução",
      accessor: (row: CampaignTemplate) => (
        <div className="flex flex-col items-start gap-1 text-xs">
          <span className="text-[#737373]" data-testid={`last-run-${row.id}`}>
            {lastRunSummary(row.lastRun)}
          </span>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => setHistory(row)}>
            <History className="mr-1 h-3.5 w-3.5" aria-hidden /> Ver histórico
          </Button>
        </div>
      ),
      sortable: true,
      sortAccessor: (row: CampaignTemplate) => row.lastRunAt,
    },
    {
      header: "Ações",
      accessor: (row: CampaignTemplate) => {
        const togglingThisRow = setEnabled.isPending && setEnabled.variables?.id === row.id;
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => setWizard({ open: true, edit: row })}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={togglingThisRow}
              onClick={() => handleToggleEnabled(row)}
            >
              {togglingThisRow ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : row.enabled ? (
                <Pause className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              {row.enabled ? "Pausar" : "Ligar"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        className="flex-col sm:flex-row"
        title="Campanhas automáticas"
        description="O agendador dispara sozinho: semanal (todo dia X às Y) ou por data. O WhatsApp sai pela API oficial da Meta, com um modelo aprovado."
        action={
          <Button className="min-h-11" onClick={() => setWizard({ open: true })}>
            <Plus className="mr-1 h-4 w-4" /> Nova campanha automática
          </Button>
        }
      />

      {schedulerOff && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O agendador está <strong>desligado</strong> (<code>CAMPAIGN_TEMPLATES_ENABLED</code> ou{" "}
            <code>ACTIVATION_CAMPAIGNS_ENABLED</code> não está como <code>true</code> em produção). Você pode
            criar e ligar campanhas automáticas, mas nenhuma mensagem vai sair.
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as PageTab)}>
        <TabsList className="mb-3 h-auto">
          <TabsTrigger value="automaticas" className="min-h-11">
            Campanhas automáticas
          </TabsTrigger>
          <TabsTrigger value="modelos" className="min-h-11">
            Modelos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="automaticas">
          <DataTable
            columns={columns}
            data={templates.data?.data ?? []}
            isFetching={templates.isFetching}
            searchPlaceholder="Buscar campanha automática…"
            searchKey="name"
          />
        </TabsContent>
        <TabsContent value="modelos">
          <MarketingTemplatesTab
            onUse={(template) => {
              setTab("automaticas");
              setWizard({ open: true, templateId: template.id });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Montado só aberto: não busca a biblioteca nem guarda estado de outra automática. */}
      {wizard.open && (
        <CampaignWizard
          open
          kind="automatica"
          adminEmail={user?.email ?? ""}
          initialTemplateId={wizard.templateId ?? null}
          editAutomatic={wizard.edit ?? null}
          onOpenChange={(open) => setWizard((current) => ({ ...current, open }))}
          onDone={() => setTab("automaticas")}
        />
      )}
      <AutomaticRunsDialog
        template={history}
        onClose={() => setHistory(null)}
        onOpenRun={(id) => {
          setHistory(null);
          setRunDetailId(id);
        }}
      />
      <CampaignDetailDialog campaignId={runDetailId} onClose={() => setRunDetailId(null)} />
    </div>
  );
}

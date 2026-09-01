"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Pencil, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDateTime } from "@/lib/date.utils";
import {
  useCampaignTemplates,
  useSetCampaignTemplateEnabled,
} from "@/modules/admin/application/use-campaign-templates";
import type {
  CampaignChannel,
  CampaignTemplate,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import { describeSchedule } from "./_lib/describe-schedule";
import { TemplateDialog } from "./_components/template-dialog";

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
};

/**
 * Lista de campanhas automáticas (recorrentes): agenda legível, canais,
 * ligado/pausado e ligar/pausar. Criar/editar delega inteiramente ao
 * `TemplateDialog` (item #2) — esta página só decide COM QUAL template ele
 * abre (nenhum = criar; uma linha = editar).
 */
export default function CampanhasAutomaticasPage() {
  const { allowed, isChecking } = useAreaGuard("REFERRALS");
  const templates = useCampaignTemplates();
  const setEnabled = useSetCampaignTemplateEnabled();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  function openCreate() {
    setEditingTemplate(null);
    setDialogOpen(true);
  }

  function openEdit(template: CampaignTemplate) {
    setEditingTemplate(template);
    setDialogOpen(true);
  }

  async function handleToggleEnabled(template: CampaignTemplate) {
    try {
      await setEnabled.mutateAsync({ id: template.id, enabled: !template.enabled });
      toast.success(template.enabled ? "Campanha pausada." : "Campanha ligada.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  }

  const columns = [
    {
      header: "Nome",
      accessor: (row: CampaignTemplate) => <span className="font-medium">{row.name}</span>,
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
      header: "Último run",
      accessor: (row: CampaignTemplate) =>
        row.lastRunAt ? formatInstantDateTime(row.lastRunAt) : "—",
      sortable: true,
      sortAccessor: (row: CampaignTemplate) => row.lastRunAt,
    },
    {
      header: "Ações",
      accessor: (row: CampaignTemplate) => {
        const togglingThisRow = setEnabled.isPending && setEnabled.variables?.id === row.id;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
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
        title="Campanhas automáticas"
        description="Templates que o agendador dispara sozinho: semanal (todo dia X às Y) ou por data (aniversário, feriado, com aviso de N dias antes)."
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> Nova campanha automática
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={templates.data ?? []}
        isFetching={templates.isFetching}
        searchPlaceholder="Buscar campanha automática…"
        searchKey="name"
      />

      {/* Fica montado o tempo todo: abrir "criar" ou "editar" só troca a prop
          `template` (ausente = criar), sem desmontar/remontar o diálogo. */}
      <TemplateDialog
        open={dialogOpen}
        template={editingTemplate}
        onOpenChange={setDialogOpen}
        onSaved={() => setEditingTemplate(null)}
      />
    </div>
  );
}

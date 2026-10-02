"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarX,
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  Pause,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInstantDate, formatInstantDateTime } from "@/lib/date.utils";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCampaigns,
  useSetCampaignState,
  useUnscheduleCampaign,
} from "@/modules/admin/application/use-admin-referrals";
import type { Campaign } from "@/modules/admin/infrastructure/referrals-api";
import { audienceLabel, type WizardAudience } from "./_lib/campaign-wizard";
import { CampaignDetailDialog } from "./_components/campaign-detail-dialog";
import { CampaignStatusBadge } from "./_components/campaign-status-badge";
import { CampaignWizard } from "./_components/campaign-wizard";
import { MarketingStatusBadge } from "./_components/marketing-status-badge";
import { MarketingTemplatesTab } from "./_components/marketing-templates-tab";

type PageTab = "campanhas" | "modelos";

interface WizardRequest {
  open: boolean;
  audience?: WizardAudience;
  templateId?: string | null;
  resume?: Campaign | null;
}

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
    </div>
  );
}

/** Rótulo curto da origem para a lista (planilha ou recorte da base). */
function audienceShortLabel(row: Campaign): string {
  if (row.audience === "EXTERNAL_LIST") return `Planilha${row.listFileName ? ` · ${row.listFileName}` : ""}`;
  return audienceLabel(row.audience);
}

export default function CampanhasPage() {
  const { allowed, isChecking } = useAreaGuard("REFERRALS");
  if (isChecking || !allowed) return <Spinner />;
  // `?campanha=<id>` (link do e-mail "Resposta à campanha …") usa useSearchParams: pede Suspense.
  return (
    <Suspense fallback={<Spinner />}>
      <CampanhasScreen />
    </Suspense>
  );
}

function CampanhasScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const campaigns = useCampaigns();
  const setState = useSetCampaignState();
  const unschedule = useUnscheduleCampaign();

  const [tab, setTab] = useState<PageTab>("campanhas");
  const campaignParam = searchParams.get("campanha");
  const [selectedId, setSelectedId] = useState<string | null>(campaignParam);

  // Reativo: o link do e-mail pode chegar com a página já aberta (navegação na mesma rota).
  useEffect(() => {
    if (campaignParam) setSelectedId(campaignParam);
  }, [campaignParam]);
  const [wizard, setWizard] = useState<WizardRequest>({ open: false });

  const openWizard = (request: Omit<WizardRequest, "open">) => setWizard({ open: true, ...request });

  const closeDetail = () => {
    setSelectedId(null);
    // Tira o ?campanha= da URL: o F5 não reabre o detalhe.
    if (campaignParam) router.replace(pathname, { scroll: false });
  };

  const handleState = async (id: string, action: "start" | "pause" | "cancel") => {
    try {
      await setState.mutateAsync({ id, action });
      toast.success(action === "start" ? "Disparo retomado." : action === "pause" ? "Pausada." : "Cancelada.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível mudar a campanha."));
    }
  };

  const handleUnschedule = async (id: string) => {
    try {
      await unschedule.mutateAsync(id);
      toast.success("Agendamento cancelado. A campanha voltou para rascunho.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível desagendar."));
    }
  };

  const columns = [
    {
      header: "Campanha",
      accessor: (row: Campaign) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <button
            className="text-left font-medium underline"
            onClick={() => setSelectedId(row.id)}
            data-testid={`open-campaign-${row.id}`}
          >
            {row.name}
          </button>
          <span className="text-[11px] text-[#737373]">
            {audienceShortLabel(row)}
            {row.createdBy?.name && ` · por ${row.createdBy.name}`}
          </span>
          {row.marketingTemplate && (
            <span className="flex flex-wrap items-center gap-1 text-[11px] text-[#737373]">
              Modelo: {row.marketingTemplate.name}
              <MarketingStatusBadge status={row.marketingTemplate.status} />
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (row: Campaign) => (
        <div className="flex flex-col items-start gap-1">
          <CampaignStatusBadge status={row.status} />
          {row.status === "SCHEDULED" && row.scheduledStartAt && (
            <span className="text-[11px] text-violet-800">
              Agendada para {formatInstantDateTime(row.scheduledStartAt)}
            </span>
          )}
          {row.status === "PAUSED" && row.pausedReason && (
            <span className="max-w-56 text-[11px] text-amber-800">{row.pausedReason}</span>
          )}
        </div>
      ),
    },
    { header: "Destinatários", accessor: (row: Campaign) => row._count?.recipients ?? 0 },
    {
      header: "Enviados",
      accessor: (row: Campaign) => {
        const stats = row.stats;
        if (!stats) return "—";
        // "Processados" = tudo que a fila já tentou: é o denominador honesto da taxa.
        const processados = stats.SENT + stats.FAILED;
        const taxa = processados > 0 ? Math.round((stats.SENT / processados) * 100) : null;
        return (
          <div className="flex flex-col gap-0.5 text-xs tabular-nums">
            <span>
              <strong className="text-[#1d1d1b]">{stats.SENT}</strong> efetivos
              {taxa !== null && <span className="text-[#737373]"> ({taxa}%)</span>}
            </span>
            <span className="text-[#737373]">
              {stats.FAILED > 0 ? <span className="text-red-600">{stats.FAILED} falharam</span> : "0 falharam"}
              {/* Pulado ≠ falhado: é quem a campanha nem tentou (saída, SAIR, preferência…). */}
              {stats.SKIPPED > 0 && ` · ${stats.SKIPPED} pulados`}
              {stats.PENDING > 0 && ` · ${stats.PENDING} na fila`}
            </span>
          </div>
        );
      },
    },
    {
      header: "Ritmo",
      accessor: (row: Campaign) => (
        <span className="text-xs">
          {row.messagesPerHour}/h · teto {row.dailyCap}/dia · {row.windowStartHour}h–{row.windowEndHour}h
          {row.weekdaysOnly ? " · dias úteis" : ""}
        </span>
      ),
    },
    {
      header: "Próximo envio",
      accessor: (row: Campaign) => (row.nextSendAt ? formatInstantDate(row.nextSendAt) : "—"),
    },
    {
      header: "Ações",
      accessor: (row: Campaign) => (
        <div className="flex flex-wrap gap-2">
          {row.status === "DRAFT" && (
            <Button size="sm" className="min-h-11" onClick={() => openWizard({ resume: row })}>
              <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Revisar e disparar
            </Button>
          )}
          {row.status === "SCHEDULED" && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={unschedule.isPending}
              onClick={() => handleUnschedule(row.id)}
            >
              <CalendarX className="mr-1 h-3.5 w-3.5" /> Desagendar
            </Button>
          )}
          {row.status === "PAUSED" && (
            <Button size="sm" className="min-h-11" onClick={() => handleState(row.id, "start")}>
              <Play className="mr-1 h-3.5 w-3.5" /> Retomar
            </Button>
          )}
          {row.status === "RUNNING" && (
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => handleState(row.id, "pause")}>
              <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
            </Button>
          )}
          {row.status !== "COMPLETED" && row.status !== "CANCELLED" && (
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => handleState(row.id, "cancel")}>
              <Square className="mr-1 h-3.5 w-3.5" /> Encerrar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        className="flex-col sm:flex-row"
        title="Campanhas de ativação"
        description="WhatsApp pela API oficial da Meta, com modelo aprovado e ritmo controlado; e-mail para quem não tem telefone."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => openWizard({ audience: "EXTERNAL_LIST" })}
              data-testid="new-sheet-campaign"
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Nova campanha por planilha
            </Button>
            <Button className="min-h-11" onClick={() => openWizard({})}>
              <Plus className="mr-1 h-4 w-4" /> Nova campanha
            </Button>
          </div>
        }
      />

      {/* Sem esse aviso, uma campanha "Disparando" sem nada saindo vira uma hora de investigação. */}
      {campaigns.data && !campaigns.data.schedulerEnabled && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O agendador está <strong>desligado</strong> (<code>ACTIVATION_CAMPAIGNS_ENABLED</code> não está
            como <code>true</code> em produção). Você pode criar e iniciar campanhas, mas nenhuma mensagem vai
            sair.
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as PageTab)}>
        <TabsList className="mb-3 h-auto">
          <TabsTrigger value="campanhas" className="min-h-11">
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="modelos" className="min-h-11">
            Modelos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campanhas">
          <DataTable
            columns={columns}
            data={campaigns.data?.data ?? []}
            isFetching={campaigns.isFetching}
            searchPlaceholder="Buscar campanha…"
          />
        </TabsContent>
        <TabsContent value="modelos">
          <MarketingTemplatesTab
            onUse={(template) => {
              setTab("campanhas");
              openWizard({ templateId: template.id });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Montado só aberto: não busca a biblioteca nem guarda estado de uma campanha antiga. */}
      {wizard.open && (
        <CampaignWizard
          open
          kind="avulsa"
          adminEmail={user?.email ?? ""}
          initialAudience={wizard.audience}
          initialTemplateId={wizard.templateId ?? null}
          resumeCampaign={wizard.resume ?? null}
          onOpenChange={(open) => setWizard((current) => ({ ...current, open }))}
          onDone={({ campaignId }) => {
            if (campaignId) setSelectedId(campaignId);
          }}
        />
      )}

      <CampaignDetailDialog campaignId={selectedId} onClose={closeDetail} />
    </div>
  );
}

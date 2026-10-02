"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignStatusBadge } from "@/app/(auth)/campanhas/_components/campaign-status-badge";
import {
  formatCost,
  formatPercent,
  occurrenceLabel,
} from "@/app/(auth)/campanhas/_lib/campaign-results";
import {
  RUNS_PAGE_SIZE,
  useCampaignTemplateRuns,
} from "@/modules/admin/application/use-campaign-templates";
import type {
  CampaignRun,
  CampaignTemplate,
} from "@/modules/admin/infrastructure/campaign-templates-api";

interface Props {
  template: CampaignTemplate | null;
  onClose: () => void;
  /** Abre o detalhe da execução (o mesmo detalhe da campanha avulsa). */
  onOpenRun: (campaignId: string) => void;
}

const dash = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : String(value);

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Histórico da campanha automática (spec 2026-10-01 parte 2 §7/§8.5): cada execução, mais
 * nova primeiro, com os números; push só tem enviados ("—" no resto).
 */
export function AutomaticRunsDialog({ template, onClose, onOpenRun }: Props) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [template?.id]);
  const runs = useCampaignTemplateRuns(template?.id ?? null, page);
  const total = runs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / RUNS_PAGE_SIZE));

  const columns = [
    {
      header: "Execução",
      accessor: (run: CampaignRun) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{occurrenceLabel(run.occurrence)}</span>
          <span className="text-[11px] text-[#737373]">
            {run.channel === "PUSH" ? "Push" : "WhatsApp"}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (run: CampaignRun) => (
        <CampaignStatusBadge status={run.status} />
      ),
    },
    {
      header: "Enviados",
      accessor: (run: CampaignRun) => (
        <span className="tabular-nums">{run.sent}</span>
      ),
    },
    {
      header: "Entregues",
      accessor: (run: CampaignRun) => (
        <span className="tabular-nums">
          {run.delivered === null
            ? "—"
            : `${run.delivered} (${formatPercent(run.rates?.deliveredRate)})`}
        </span>
      ),
    },
    {
      header: "Lidos",
      accessor: (run: CampaignRun) => (
        <span className="tabular-nums">{dash(run.read)}</span>
      ),
    },
    {
      header: "Cliques",
      accessor: (run: CampaignRun) => (
        <span className="tabular-nums">{dash(run.clicked)}</span>
      ),
    },
    {
      header: "Custo",
      accessor: (run: CampaignRun) => (
        <span className="tabular-nums" title="Custo estimado">
          {run.costBrl === null ? "—" : formatCost(run.costBrl)}
        </span>
      ),
    },
    {
      header: "Depois",
      accessor: (run: CampaignRun) =>
        run.channel === "PUSH" ? (
          "—"
        ) : (
          <span className="text-xs">
            {plural(run.signups ?? 0, "cadastro", "cadastros")} ·{" "}
            {plural(run.publishedVacancy ?? 0, "vaga", "vagas")} ·{" "}
            {plural(run.hired ?? 0, "contratação", "contratações")}
          </span>
        ),
    },
    {
      header: "Ações",
      accessor: (run: CampaignRun) => (
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => onOpenRun(run.id)}
        >
          <Eye className="mr-1 h-3.5 w-3.5" aria-hidden /> Ver detalhe
        </Button>
      ),
    },
  ];

  return (
    <Dialog
      open={Boolean(template)}
      onOpenChange={(open) => !open && onClose()}
      className="max-w-5xl"
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {template?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Cada execução desta campanha automática, a mais nova primeiro.
            &quot;Depois&quot; conta cadastros e contratações em até 30 dias e
            vagas em até 14 dias do envio.
          </DialogDescription>
        </DialogHeader>
        {!runs.data ? (
          <p className="text-sm text-neutral-500">
            {runs.isError
              ? "Não foi possível carregar o histórico."
              : "Carregando…"}
          </p>
        ) : runs.data.items.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma execução ainda.</p>
        ) : (
          <DataTable
            columns={columns}
            data={runs.data.items}
            footer={
              <div className="flex items-center justify-between text-sm text-[#737373]">
                <span>{`${total.toLocaleString("pt-BR")} execuções`}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || runs.isFetching}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#e5e5e5] disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-[#1d1d1b]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || runs.isFetching}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[#e5e5e5] disabled:opacity-40"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

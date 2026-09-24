"use client";

import { useState } from "react";
import { AlertTriangle, Archive, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  JOB_ISSUE_CATEGORY_LABEL,
  type AdminJobIssueReport,
} from "@/modules/admin/infrastructure/issue-reports-api";
import { useDismissIssueReport } from "@/modules/admin/application/use-issue-reports";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";

/**
 * Fila dos relatos de problema (F6) ainda ABERTOS, no topo da tela de vagas.
 *
 * É o "indicador + lista" do épico: até então o relato nascia OPEN e ficava
 * mudo. Aqui o suporte vê quantos há e abre a vaga correspondente (o modal de
 * detalhes traz as opções de resolução). Some sozinha quando não há nenhum.
 *
 * "Arquivar" também fica aqui: a vaga de um relato antigo pode já ter saído da
 * lista carregada (encerrada), e aí o modal — antes o único caminho para
 * resolver — nunca abre e o relato fica preso no topo para sempre.
 */
export function IssueReportQueue({
  reports,
  onOpen,
}: {
  reports?: AdminJobIssueReport[];
  onOpen: (vacancyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const dismissMut = useDismissIssueReport();
  const open = (reports ?? []).filter((r) => r.status === "OPEN");
  if (open.length === 0) return null;

  async function arquivar(r: AdminJobIssueReport) {
    const quem = r.contractorName ? ` de ${r.contractorName}` : "";
    if (
      !window.confirm(
        `Arquivar o relato${quem} (${formatInstantDate(r.createdAt)})? Ele sai desta lista; use quando o problema já foi tratado.`,
      )
    ) {
      return;
    }
    try {
      await dismissMut.mutateAsync({ id: r.id, note: undefined });
      toast.success("Relato arquivado.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível arquivar o relato."));
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="w-4 h-4" />
          Problemas relatados ({open.length})
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-amber-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-700" />
        )}
      </button>
      {expanded && (
        <ul className="divide-y divide-amber-200 border-t border-amber-200">
          {open.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-amber-700">
                  {JOB_ISSUE_CATEGORY_LABEL[r.category]}
                  {r.contractorName ? ` · ${r.contractorName}` : ""}
                  {` · ${formatInstantDate(r.createdAt)}`}
                </p>
                <p className="text-sm text-amber-900 break-words sm:truncate">{r.description}</p>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <Button
                  variant="outline"
                  onClick={() => onOpen(r.vacancyId)}
                  className="flex-1 sm:flex-none border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Abrir vaga
                </Button>
                <Button
                  variant="outline"
                  onClick={() => arquivar(r)}
                  disabled={dismissMut.isPending}
                  className="flex-1 sm:flex-none border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  <Archive className="w-3.5 h-3.5 mr-1.5" />
                  Arquivar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

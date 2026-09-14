"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  JOB_ISSUE_CATEGORY_LABEL,
  type AdminJobIssueReport,
} from "@/modules/admin/infrastructure/issue-reports-api";

/**
 * Fila dos relatos de problema (F6) ainda ABERTOS, no topo da tela de vagas.
 *
 * É o "indicador + lista" do épico: até então o relato nascia OPEN e ficava
 * mudo. Aqui o suporte vê quantos há e abre a vaga correspondente (o modal de
 * detalhes traz as opções de resolução). Some sozinha quando não há nenhum.
 */
export function IssueReportQueue({
  reports,
  onOpen,
}: {
  reports?: AdminJobIssueReport[];
  onOpen: (vacancyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const open = (reports ?? []).filter((r) => r.status === "OPEN");
  if (open.length === 0) return null;

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
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-amber-700">
                  {JOB_ISSUE_CATEGORY_LABEL[r.category]}
                  {r.contractorName ? ` · ${r.contractorName}` : ""}
                </p>
                <p className="truncate text-sm text-amber-900">{r.description}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => onOpen(r.vacancyId)}
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Abrir vaga
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

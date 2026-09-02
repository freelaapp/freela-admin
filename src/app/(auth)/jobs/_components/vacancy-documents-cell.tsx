import { FileText } from "lucide-react";

import type { VacancyDocuments, VacancyDocumentsDetail } from "@/modules/admin/infrastructure/admin-api";
import {
  DOCUMENT_KEYS,
  documentBadge,
  toneClasses,
} from "@/modules/admin/application/system-health-presentation";

/**
 * Documentos da vaga — contrato, recibo, RPA e NF-e — em quatro pastilhas.
 *
 * `compact` é a coluna da listagem: sigla + símbolo, o motivo fica no `title`.
 * `full` é a linha do modal de detalhes: nome inteiro + situação, com o motivo
 * escrito embaixo quando existe (é onde o operador vai ler POR QUE a nota não
 * saiu, sem precisar passar o mouse).
 *
 * Sem `documents` (API anterior ao épico, ou vaga sem job) mostra "—" — não
 * pinta nada de vermelho por falta de informação.
 */
export function VacancyDocumentsCell({
  documents,
  detail,
  variant = "compact",
}: {
  documents: VacancyDocuments | null | undefined;
  detail?: VacancyDocumentsDetail | null;
  variant?: "compact" | "full";
}) {
  if (!documents) {
    return variant === "compact" ? (
      <span className="text-xs text-[#a3a3a3]" title="Sem informação de documentos">
        —
      </span>
    ) : (
      <DocumentsBox>
        <p className="text-xs text-[#a3a3a3]">Sem informação de documentos para esta vaga.</p>
      </DocumentsBox>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1">
        {DOCUMENT_KEYS.map(({ key, short, label }) => {
          const badge = documentBadge(documents[key]);
          const motivo = detail?.[key];
          return (
            <span
              key={key}
              title={`${label}: ${badge.label}${motivo ? ` — ${motivo}` : ""}`}
              className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded border px-1 py-px text-[10px] font-semibold leading-tight ${toneClasses(badge.tone).chip}`}
            >
              {short}
              <span aria-hidden="true">{badge.symbol}</span>
              <span className="sr-only">{badge.label}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <DocumentsBox>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {DOCUMENT_KEYS.map(({ key, label }, i) => {
          const badge = documentBadge(documents[key]);
          const motivo = detail?.[key];
          return (
            <span key={key} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-[#a3a3a3]">·</span>}
              <span
                title={motivo ?? badge.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${toneClasses(badge.tone).chip}`}
              >
                <span className="text-[#1d1d1b]">{label}</span>
                <span aria-hidden="true">{badge.symbol}</span>
                <span className="font-normal">{badge.label}</span>
              </span>
            </span>
          );
        })}
      </div>
      {detail && DOCUMENT_KEYS.some(({ key }) => detail[key]) && (
        <ul className="space-y-0.5 text-[11px] text-[#737373]">
          {DOCUMENT_KEYS.filter(({ key }) => detail[key]).map(({ key, label }) => (
            <li key={key}>
              <span className="font-medium text-[#1d1d1b]">{label}:</span> {detail[key]}
            </li>
          ))}
        </ul>
      )}
    </DocumentsBox>
  );
}

function DocumentsBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        Documentos
      </p>
      {children}
    </div>
  );
}

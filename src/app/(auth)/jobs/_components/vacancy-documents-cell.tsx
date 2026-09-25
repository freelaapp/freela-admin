"use client";

import { useState } from "react";
import axios from "axios";
import { ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { reissueVacancyNfse } from "@/modules/admin/infrastructure/vacancy-documents-api";

import type { VacancyDocuments, VacancyDocumentsDetail } from "@/modules/admin/infrastructure/admin-api";
import {
  DOCUMENT_KEYS,
  documentBadge,
  toneClasses,
  type DocumentKey,
} from "@/modules/admin/application/system-health-presentation";
import {
  canOpenDocument,
  openVacancyDocument,
} from "@/modules/admin/application/vacancy-documents-open";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";

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
 *
 * Com `vacancyId`, a variante `full` ganha "Abrir" em cada documento que existe
 * (emitido; o contrato também com uma assinatura faltando) — abre numa aba nova
 * pronto para imprimir/salvar em PDF; a NF-e abre o PDF da prefeitura.
 */
export function VacancyDocumentsCell({
  documents,
  detail,
  variant = "compact",
  vacancyId,
}: {
  documents: VacancyDocuments | null | undefined;
  detail?: VacancyDocumentsDetail | null;
  variant?: "compact" | "full";
  vacancyId?: string | null;
}) {
  const [opening, setOpening] = useState<DocumentKey | null>(null);
  const qc = useQueryClient();
  // Reemitir é ato fiscal (nota nova na prefeitura): 1º toque arma, 2º confirma.
  const [reissueArmed, setReissueArmed] = useState(false);
  const [reissuing, setReissuing] = useState(false);

  async function handleReissueNfse() {
    if (!vacancyId) return;
    if (!reissueArmed) {
      setReissueArmed(true);
      setTimeout(() => setReissueArmed(false), 6000);
      return;
    }
    setReissueArmed(false);
    setReissuing(true);
    try {
      const res = await reissueVacancyNfse(vacancyId);
      if (res.status === "FAILED") {
        toast.error(`A prefeitura recusou de novo: ${res.failureReason ?? "sem motivo informado"}`);
      } else {
        toast.success("NF-e reenviada. A prefeitura responde em alguns minutos; a nota vai por e-mail ao contratante.");
      }
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível reemitir a NF-e."));
    } finally {
      setReissuing(false);
    }
  }

  async function handleOpen(key: DocumentKey, label: string) {
    if (!vacancyId) return;
    setOpening(key);
    try {
      await openVacancyDocument(vacancyId, key);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err) || !(err instanceof Error)
          ? getAxiosErrorMessage(err, `Não foi possível abrir o ${label.toLowerCase()}.`)
          : err.message,
      );
    } finally {
      setOpening(null);
    }
  }

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
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {DOCUMENT_KEYS.map(({ key, label }) => {
          const badge = documentBadge(documents[key]);
          const motivo = detail?.[key];
          const openable = Boolean(vacancyId) && canOpenDocument(key, documents[key]);
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-md border border-[#e5e5e5] bg-white px-2 py-1"
            >
              <span
                title={motivo ?? badge.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${toneClasses(badge.tone).chip}`}
              >
                <span className="text-[#1d1d1b]">{label}</span>
                <span aria-hidden="true">{badge.symbol}</span>
                <span className="font-normal">{badge.label}</span>
              </span>
              {key === "nfse" && vacancyId && (documents[key] ?? "").toUpperCase() === "FAILED" && (
                <button
                  type="button"
                  onClick={handleReissueNfse}
                  disabled={reissuing}
                  title="Emite uma nova NF-e na prefeitura (a recusada não vale como nota)"
                  className={`inline-flex min-h-8 items-center gap-1 rounded px-1.5 font-medium disabled:opacity-50 ${
                    reissueArmed ? "bg-red-50 text-red-600" : "text-[#eca826] hover:text-[#d4951e]"
                  }`}
                >
                  {reissuing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  {reissueArmed ? "Confirmar reemissão" : "Reemitir"}
                </button>
              )}
              {openable && (
                <button
                  type="button"
                  onClick={() => handleOpen(key, label)}
                  disabled={opening !== null}
                  title={`Abrir ${label} em uma nova aba`}
                  className="inline-flex min-h-8 items-center gap-1 rounded px-1.5 font-medium text-[#eca826] hover:text-[#d4951e] disabled:opacity-50"
                >
                  {opening === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" />
                  )}
                  Abrir
                </button>
              )}
            </li>
          );
        })}
      </ul>
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

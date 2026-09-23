"use client";

import { useState } from "react";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipApplicationMutations, useVipBackgroundDocuments, useVipDocumentDownload } from "@/modules/admin/application/use-freela-vip";
import { formatDate } from "@/modules/admin/application/freela-vip-presentation";
import type { VipStatus } from "@/modules/admin/infrastructure/freela-vip-api";

const DOC_LABELS: Record<string, string> = {
  BACKGROUND_FEDERAL: "Certidão Polícia Federal",
  BACKGROUND_SSP_SP: "Certidão SSP-SP",
  BACKGROUND_TJSP: "Certidão TJSP",
};

export function BackgroundSection({ applicationId, cycleId, status, backgroundResult }: {
  applicationId: string; cycleId: string; status: VipStatus; backgroundResult: "APT" | "NOT_APT" | "IN_ANALYSIS" | null;
}) {
  const { data: docs = [], isLoading } = useVipBackgroundDocuments(applicationId, true);
  const download = useVipDocumentDownload(applicationId);
  const { decideBackground } = useVipApplicationMutations(applicationId, cycleId);
  const [confirm, setConfirm] = useState<"APT" | "NOT_APT" | null>(null);
  const canDecide = status === "BACKGROUND_PENDING";

  return (
    <section className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#92400E]"><ShieldAlert className="h-4 w-4" aria-hidden />Antecedentes (sigilo)</h2>
      <p className="mt-1 text-[12px] text-[#92400E]">Só quem tem a permissão de antecedentes vê este bloco. Cada abertura de certidão fica registrada no histórico. Não baixe em computador pessoal.</p>
      <p className="mt-2 text-[13px]">Resultado: <strong>{backgroundResult === "APT" ? "Apto" : backgroundResult === "NOT_APT" ? "Não apto" : backgroundResult === "IN_ANALYSIS" ? "Em análise" : "—"}</strong></p>

      {isLoading ? (
        <div className="py-4 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>
      ) : docs.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-[#92400E]">Nenhuma certidão enviada ainda.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#FDE68A]">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
              <span>{DOC_LABELS[d.type] ?? d.type} · {d.fileName} · {formatDate(d.uploadedAt)}{d.validationCode ? ` · cód. ${d.validationCode}` : ""}</span>
              <Button size="sm" variant="outline" disabled={download.isPending} aria-label={`Abrir ${DOC_LABELS[d.type] ?? d.type}`} onClick={() => download.mutate(d.id)}>
                <ExternalLink className="mr-1 h-4 w-4" aria-hidden />Abrir
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canDecide && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => setConfirm("APT")}>Apto</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirm("NOT_APT")}>Não apto</Button>
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "APT" ? "Marcar como apto?" : "Marcar como não apto?"}</DialogTitle>
            <DialogDescription>{confirm === "APT" ? "O candidato segue para a aprovação final." : "O candidato será reprovado com a mensagem genérica — ela nunca cita antecedentes."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button disabled={decideBackground.isPending} onClick={() => confirm && decideBackground.mutate(confirm, { onSuccess: () => setConfirm(null) })}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

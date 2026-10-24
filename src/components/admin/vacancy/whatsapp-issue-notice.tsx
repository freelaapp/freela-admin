"use client";

import { AlertTriangle } from "lucide-react";
import type { VacancyCandidacyWhatsAppIssue } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDateTime } from "@/lib/date.utils";

/**
 * Aviso de que o último WhatsApp para o freelancer não chegou.
 *
 * Existe porque a falha ficava só no log de entregas: em 24/10/2026 os 4 avisos
 * para uma freelancer contratada falharam (número sem WhatsApp) e o suporte só
 * descobriu ao tentar falar com ela. `suspectNumber` (Meta 131026) é o caso em
 * que o número não recebe WhatsApp — aí o caminho é ligar ou mandar e-mail.
 */
export function WhatsAppIssueNotice({ issue }: { issue: VacancyCandidacyWhatsAppIssue }) {
  const quando = formatInstantDateTime(issue.at);
  const tone = issue.suspectNumber
    ? "border-red-200 bg-red-50 text-red-900"
    : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div role="status" className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 ${tone}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div className="text-[11px] leading-tight">
        <p className="font-semibold">
          {issue.suspectNumber
            ? "WhatsApp não chega neste número"
            : "O último WhatsApp não foi entregue"}
        </p>
        <p>
          {issue.label}. Falhou em {quando}.
          {issue.suspectNumber && " Ligue ou mande e-mail."}
        </p>
      </div>
    </div>
  );
}

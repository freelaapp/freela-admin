"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Phone,
  PhoneCall,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SupportCaseItem } from "@/modules/admin/infrastructure/support-cases-api";
import {
  actionLabel,
  contactsLabel,
  isActive,
  newsClock,
  reasonLabel,
  statusLabel,
  whenLabel,
} from "@/modules/admin/application/support-queue-presentation";

export type SupportCaseDialog = "messages" | "contact" | "close" | "tools";

/**
 * Um caso da fila (designer, lote 2 §5.3): quando, motivo (texto + ícone, nunca só cor), vaga e
 * empresa, o relógio da notícia, os contatos e as ações. Caso fechado: como terminou.
 */
export function SupportCaseCard({
  item,
  now,
  cutoffLabel,
  myAdminId,
  assuming,
  onAssume,
  onOpenDialog,
}: {
  item: SupportCaseItem;
  now: Date;
  cutoffLabel: string;
  myAdminId: string | null;
  assuming: boolean;
  onAssume: () => void;
  onOpenDialog: (dialog: SupportCaseDialog) => void;
}) {
  const active = isActive(item);
  const clock = active ? newsClock(item.newsDueAt, now) : null;
  const place = [item.vacancy.companyName, item.vacancy.neighborhood]
    .filter(Boolean)
    .join(" · ");
  const status = statusLabel(item, myAdminId);

  return (
    <article
      aria-label={`${item.vacancy.title} · ${reasonLabel(item, cutoffLabel)}`}
      className="rounded-lg border border-[#e5e5e5] bg-white p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums text-[#1d1d1b]">
          {whenLabel(item, now)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-[#fff4dd] px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {reasonLabel(item, cutoffLabel)}
          </span>
          <span className="rounded bg-[#f7f7f7] px-2 py-0.5 text-xs font-semibold text-[#1d1d1b]">
            {status}
          </span>
        </div>
      </div>

      <p className="mt-1 truncate text-sm text-[#1d1d1b]">
        {item.vacancy.title}
        {place ? ` · ${place}` : ""}
      </p>

      {active && (
        <p className="mt-0.5 text-xs text-[#737373]">
          Ação sugerida: {actionLabel(item.reason)}
        </p>
      )}

      {clock && (
        <p
          role={clock.late ? "alert" : undefined}
          className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${clock.late ? "text-red-600" : "text-[#1d1d1b]"}`}
        >
          {clock.late ? (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {clock.text}
        </p>
      )}

      <p className="mt-1 text-xs text-[#737373]">
        {contactsLabel(item.contactsCount)}
      </p>

      {!active && (
        <p className="mt-1 text-xs text-[#737373]">
          {item.closedBy?.kind === "SYSTEM"
            ? "Fechado pelo sistema."
            : `Fechado por ${item.closedBy?.name ?? "alguém do suporte"}.`}
          {item.closeNote ? ` Motivo: ${item.closeNote}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === "OPEN" && (
          <Button size="sm" onClick={onAssume} disabled={assuming}>
            {assuming ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Assumir
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/jobs?vaga=${item.vacancyId}`}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Abrir a vaga
          </Link>
        </Button>
        {active && item.contractor.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${item.contractor.phone}`}>
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Ligar para a empresa
            </a>
          </Button>
        )}
        {active && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDialog("messages")}
            >
              <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              Mensagens prontas
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDialog("tools")}
            >
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              Ações da vaga
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenDialog("contact")}
            >
              <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
              Registrar contato
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onOpenDialog("close")}
            >
              Fechar caso
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

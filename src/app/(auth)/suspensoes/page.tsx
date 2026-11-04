"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useSuspensions } from "@/modules/admin/application/use-suspensions";
import {
  DISABLED_TEXT,
  EMPTY_TEXT,
  ERROR_TEXT,
  canKeepOccurrence,
  canRegisterConversation,
  contestReasonLabel,
  conversationLabel,
  dayLabel,
  isActive,
  isPenaltyLadderDisabled,
  originLabel,
  reasonLabel,
  returnLabel,
  stateLabel,
} from "@/modules/admin/application/suspensions-presentation";
import type {
  SuspensionFilter,
  SuspensionItem,
} from "@/modules/admin/infrastructure/suspensions-api";
import {
  KeepOccurrenceDialog,
  LiftSuspensionDialog,
  RegisterConversationDialog,
  SuspendDialog,
} from "./_components/suspension-dialogs";

type DialogState =
  | { kind: "lift" | "conversation" | "keep"; item: SuspensionItem }
  | { kind: "suspend" }
  | null;

const TH = "px-3 py-2 text-left text-xs font-semibold text-[#737373]";
const TD = "px-3 py-3 align-top text-sm text-[#1d1d1b]";

/**
 * Suspensões (fluxo de vagas v2, fatia G; designer, lote 2 §5.5): quem não pode se candidatar,
 * até quando e por quê; registrar a conversa, levantar (motivo obrigatório) e suspender. Com a
 * chave da API desligada (404 `FEATURE_DISABLED`, a chave só liga depois do jurídico), avisa que
 * as consequências novas ainda não estão ligadas, sem tela de erro.
 */
export default function SuspensoesPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  const [filter, setFilter] = useState<SuspensionFilter>("active");
  const [dialog, setDialog] = useState<DialogState>(null);
  const list = useSuspensions(filter, allowed);

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const disabled = list.isError && isPenaltyLadderDisabled(list.error);
  const header = (
    <PageHeader
      title="Suspensões"
      description="Quem não pode se candidatar agora, até quando e por quê."
      action={
        disabled ? undefined : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${list.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "suspend" })}>
              Suspender
            </Button>
          </div>
        )
      }
    />
  );

  if (disabled) {
    return (
      <div>
        {header}
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">{DISABLED_TEXT}</p>
      </div>
    );
  }

  const data = list.data;
  const items = data?.items ?? [];
  const tabs: Array<[SuspensionFilter, string]> = [
    ["active", "Valendo agora"],
    ["all", "Todas"],
  ];

  return (
    <div>
      {header}

      {data?.legalNotice && (
        <p
          role="note"
          className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{data.legalNotice}</span>
        </p>
      )}

      <div className="mb-4 inline-flex rounded-md border border-[#e5e5e5] bg-white p-0.5" role="tablist">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
              filter === value ? "bg-[#1d1d1b] text-white" : "text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.isLoading && (
        <div className="grid gap-3" aria-label="Carregando as suspensões" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" data-testid="suspension-skeleton" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{ERROR_TEXT}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => list.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && items.length === 0 && (
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">{EMPTY_TEXT}</p>
      )}

      {data && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <tr>
                <th scope="col" className={TH}>Pessoa</th>
                <th scope="col" className={TH}>Motivo</th>
                <th scope="col" className={TH}>Início</th>
                <th scope="col" className={TH}>Volta em</th>
                <th scope="col" className={TH}>Conversa</th>
                <th scope="col" className={TH}>Origem (ocorrência)</th>
                <th scope="col" className={TH}>Situação</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f0f0] last:border-0">
                  <td className={TD}>
                    <p className="font-semibold">{item.person.name ?? "Sem nome"}</p>
                    <p className="text-xs text-[#737373]">{item.person.phone ?? item.person.email ?? ""}</p>
                  </td>
                  <td className={TD}>{reasonLabel(item)}</td>
                  <td className={TD}>{dayLabel(item.startsAt)}</td>
                  <td className={TD}>{returnLabel(item)}</td>
                  <td className={TD}>{conversationLabel(item)}</td>
                  <td className={TD}>
                    <p>{originLabel(item)}</p>
                    {item.source?.status === "CONTESTED" && item.source.justification && (
                      <p className="mt-1 text-xs text-[#737373]">
                        {contestReasonLabel(item.source.contestReason)
                          ? `${contestReasonLabel(item.source.contestReason)}: `
                          : ""}
                        “{item.source.justification}”
                      </p>
                    )}
                  </td>
                  <td className={TD}>{stateLabel(item)}</td>
                  <td className={TD}>
                    {isActive(item) && (
                      <div className="flex flex-col items-start gap-1.5">
                        {canRegisterConversation(item) && (
                          <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "conversation", item })}>
                            Registrar conversa
                          </Button>
                        )}
                        {canKeepOccurrence(item) && (
                          <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "keep", item })}>
                            Manter a ocorrência
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "lift", item })}>
                          Levantar suspensão
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "lift" && <LiftSuspensionDialog item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "conversation" && (
        <RegisterConversationDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "keep" && <KeepOccurrenceDialog item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "suspend" && <SuspendDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

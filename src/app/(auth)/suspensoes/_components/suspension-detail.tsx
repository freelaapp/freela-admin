"use client";

import { ArrowLeft, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NO_VACANCY_TEXT,
  canKeepOccurrence,
  canRegisterConversation,
  contestText,
  conversationDetail,
  createdByText,
  isActive,
  liftedText,
  occurrenceText,
  reasonLabel,
  returnLabel,
  stateLabel,
  vacancyHref,
  vacancyText,
} from "@/modules/admin/application/suspensions-presentation";
import type { SuspensionItem } from "@/modules/admin/infrastructure/suspensions-api";

export type DetailAction = "lift" | "conversation" | "keep";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#f0f0f0] py-3 last:border-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#737373]">{title}</h3>
      <div className="text-sm text-[#1d1d1b]">{children}</div>
    </section>
  );
}

/**
 * Detalhe da suspensão (D5, fatia A1): painel lateral não modal, com endereço `?s=<id>`, para o
 * suporte trabalhar a lista sem perder os filtros. No celular ocupa a tela, com "← Voltar à lista".
 * As ações abrem os mesmos diálogos da linha.
 */
export function SuspensionDetailPanel({
  item,
  notFound,
  canSearchAll,
  onSearchAll,
  onClose,
  onAction,
}: {
  item: SuspensionItem | null;
  /** O `?s=` aponta para uma suspensão fora das linhas carregadas. */
  notFound: boolean;
  /** A situação escolhida pede só as que valem agora: dá para procurar em "Todas". */
  canSearchAll: boolean;
  onSearchAll: () => void;
  onClose: () => void;
  onAction: (kind: DetailAction, item: SuspensionItem) => void;
}) {
  const occurrence = item ? occurrenceText(item) : null;
  const contest = item ? contestText(item) : null;
  const lifted = item ? liftedText(item) : null;
  const vacancy = item ? vacancyText(item) : null;

  return (
    <aside
      role="complementary"
      aria-label="Detalhe da suspensão"
      className="fixed inset-0 z-40 overflow-y-auto bg-white p-4 md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:border-[#e5e5e5] md:shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#1d1d1b] md:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar à lista
        </button>
        <h2 className="hidden text-base font-semibold text-[#1d1d1b] md:block">Detalhe da suspensão</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar o detalhe"
          className="hidden rounded p-1 text-[#737373] hover:text-[#1d1d1b] md:inline-flex"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!item && notFound && (
        <div className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          <p>Esta suspensão não está entre as carregadas com a situação escolhida.</p>
          {canSearchAll && (
            <Button size="sm" variant="outline" className="mt-3" onClick={onSearchAll}>
              Procurar em Todas
            </Button>
          )}
        </div>
      )}

      {item && (
        <>
          <Block title="Pessoa">
            <p className="font-semibold">{item.person.name ?? "Sem nome"}</p>
            {item.person.phone && <p>{item.person.phone}</p>}
            {item.person.email && <p className="break-all">{item.person.email}</p>}
          </Block>

          <Block title="Por quê">
            <p>{reasonLabel(item)}</p>
            <p className="text-xs text-[#737373]">{createdByText(item)}</p>
            <p className="mt-1 text-xs text-[#737373]">
              {stateLabel(item)} · volta: {returnLabel(item)}
            </p>
          </Block>

          {occurrence && (
            <Block title="A ocorrência">
              <p>{occurrence}</p>
            </Block>
          )}

          {contest && (
            <Block title="Contestação">
              <p>{contest}</p>
            </Block>
          )}

          <Block title="Conversa">
            <p>{conversationDetail(item)}</p>
          </Block>

          {lifted && (
            <Block title="Levantada">
              <p>{lifted}</p>
            </Block>
          )}

          <Block title="Vaga">
            {item.vacancy ? (
              <>
                <p>{vacancy}</p>
                <a
                  href={vacancyHref(item.vacancy.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#b07a10] underline-offset-2 hover:underline"
                >
                  Abrir a vaga em outra aba
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <p className="mt-1 break-all text-xs text-[#a3a3a3]">Id da vaga: {item.vacancy.id}</p>
              </>
            ) : (
              <p className="text-[#737373]">{NO_VACANCY_TEXT}</p>
            )}
          </Block>

          {isActive(item) && (
            <div className="flex flex-wrap gap-2 pt-3">
              {canRegisterConversation(item) && (
                <Button size="sm" variant="outline" onClick={() => onAction("conversation", item)}>
                  Registrar conversa
                </Button>
              )}
              {canKeepOccurrence(item) && (
                <Button size="sm" variant="outline" onClick={() => onAction("keep", item)}>
                  Manter a ocorrência
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onAction("lift", item)}>
                Levantar suspensão
              </Button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

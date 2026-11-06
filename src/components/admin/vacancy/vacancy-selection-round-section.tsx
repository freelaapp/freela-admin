"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";

import { useVacancySelectionRound } from "@/modules/admin/application/use-selection-round";
import {
  canReleaseList,
  companyViewCard,
  deadlinesLine,
  reasonLabel,
  selectionLoadErrorVisible,
  situationLabel,
  stageLine,
  viaLabel,
} from "@/modules/admin/application/selection-round-presentation";
import { formatInstantDateTime } from "@/lib/date.utils";
import { Button } from "@/components/ui/button";
import { ReleaseListDialog } from "./release-list-dialog";

/**
 * "Rodada de seleção" no modal da vaga (fluxo v2, fatia E, piloto; designer, lote 2 §5.6). Só
 * leitura: quem foi perguntado, por que está naquela posição, a situação de cada um, os prazos e
 * quantas vezes a empresa pediu outros nomes. Carregando: nada (revisão de 04/11, E7: o modal
 * piscava antes do 404 da chave desligada). Sem a rodada na API (qualquer 404: chave desligada,
 * empresa fora do piloto, API de antes), a seção não aparece. Outro erro: "Não foi possível
 * carregar a rodada de seleção." com "Tentar de novo", só com uma rodada já carregada no modal (lote
 * 3, item 14; revisão D1: um 502 no deploy não abre a caixa em todo modal de vaga).
 */
export function VacancySelectionRoundSection({ vacancyId }: { vacancyId: string }) {
  const { data, error, isError, isFetching, refetch } = useVacancySelectionRound(vacancyId);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const company = companyViewCard(data?.companyView, new Date(), data?.round);
  const loadError =
    isError && selectionLoadErrorVisible({ roundLoaded: Boolean(data?.round), error }) ? (
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
        <p role="alert">Não foi possível carregar a rodada de seleção.</p>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1 font-medium text-[#1d1d1b] hover:bg-[#f0f0f0] disabled:opacity-60"
        >
          {isFetching ? "Carregando…" : "Tentar de novo"}
        </button>
      </div>
    ) : null;

  if (!data) return null;

  return (
    <section
      aria-labelledby={`selecao-titulo-${vacancyId}`}
      className="space-y-3 rounded-lg border border-[#e5e5e5] p-3"
    >
      <p
        id={`selecao-titulo-${vacancyId}`}
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#737373]"
      >
        <ListChecks className="h-3.5 w-3.5" />
        Rodada de seleção
      </p>

      {loadError}

      {company && (
        <div
          data-testid="company-view"
          className="space-y-2 rounded-md bg-[#f7f7f7] p-3 text-xs"
        >
          <p className="font-medium text-[#1d1d1b]">{company.headline}</p>
          {company.rows.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
              {company.rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[#737373]">{row.label}</dt>
                  <dd className="break-words text-[#1d1d1b]">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {canReleaseList(data?.companyView) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setReleaseOpen(true)}
              className="min-h-11 w-full border-[#eca826]/40 text-[#c97b0e] hover:bg-[#eca826]/10 sm:w-auto"
            >
              Liberar a lista agora
            </Button>
          )}
        </div>
      )}
      <ReleaseListDialog
        vacancyId={vacancyId}
        open={releaseOpen}
        onClose={() => setReleaseOpen(false)}
      />

      {data && !data.round && (
        <p className="text-xs text-[#737373]">
          {company ? "Ainda sem rodada de seleção." : "Esta vaga não teve rodada de seleção."}
        </p>
      )}

      {data?.round && (
        <>
          <div className="space-y-0.5 text-xs">
            <p className="font-medium text-[#1d1d1b]">{stageLine(data.round)}</p>
            <p className="text-[#737373]">{deadlinesLine(data.round)}</p>
          </div>

          {data.people.length === 0 ? (
            <p className="text-xs text-[#737373]">Ninguém foi perguntado nesta rodada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[#737373]">
                  <tr>
                    <th scope="col" className="py-1 pr-2 font-medium">Posição</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Pessoa</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Por que está aqui</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Situação</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Perguntado às</th>
                    <th scope="col" className="py-1 font-medium">Respondeu às</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((person) => (
                    <tr key={person.candidacyId} className="border-t border-[#f0f0f0] align-top">
                      <td className="py-1.5 pr-2 font-semibold text-[#1d1d1b]">{person.position}</td>
                      <td className="py-1.5 pr-2 text-[#1d1d1b]">{person.name}</td>
                      <td className="py-1.5 pr-2 text-[#737373]">{reasonLabel(person)}</td>
                      <td className="py-1.5 pr-2 font-medium text-[#1d1d1b]">
                        {situationLabel(person)}
                      </td>
                      <td className="py-1.5 pr-2 text-[#737373]">
                        {formatInstantDateTime(person.askedAt)}
                      </td>
                      <td className="py-1.5 text-[#737373]">
                        {person.answeredAt
                          ? `${formatInstantDateTime(person.answeredAt)} ${viaLabel(person.answeredVia) ?? ""}`.trim()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

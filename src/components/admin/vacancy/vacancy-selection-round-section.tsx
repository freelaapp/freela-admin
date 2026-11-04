"use client";

import { ListChecks, Loader2 } from "lucide-react";

import { useVacancySelectionRound } from "@/modules/admin/application/use-selection-round";
import {
  deadlinesLine,
  isSelectionDisabled,
  reasonLabel,
  situationLabel,
  stageLine,
  viaLabel,
} from "@/modules/admin/application/selection-round-presentation";
import { formatInstantDateTime } from "@/lib/date.utils";

/**
 * "Rodada de seleção" no modal da vaga (fluxo v2, fatia E, piloto; designer, lote 2 §5.6). Só
 * leitura: quem foi perguntado, por que está naquela posição, a situação de cada um, os prazos e
 * quantas vezes a empresa pediu outros nomes. Com a chave da API desligada (404
 * `FEATURE_DISABLED`), a seção não aparece.
 */
export function VacancySelectionRoundSection({ vacancyId }: { vacancyId: string }) {
  const { data, isLoading, isError, error } = useVacancySelectionRound(vacancyId);

  if (isError && isSelectionDisabled(error)) return null;

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

      {isLoading && (
        <p className="flex items-center gap-1.5 text-xs text-[#737373]">
          <Loader2 className="h-3 w-3 animate-spin" />
          Carregando a rodada…
        </p>
      )}

      {isError && (
        <p role="alert" className="text-xs text-red-600">
          Não foi possível carregar a rodada de seleção.
        </p>
      )}

      {data && !data.round && (
        <p className="text-xs text-[#737373]">Esta vaga não teve rodada de seleção.</p>
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

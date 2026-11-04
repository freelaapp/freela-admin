"use client";

import { ListChecks } from "lucide-react";

import { useVacancySelectionRound } from "@/modules/admin/application/use-selection-round";
import {
  deadlinesLine,
  reasonLabel,
  situationLabel,
  stageLine,
  viaLabel,
} from "@/modules/admin/application/selection-round-presentation";
import { formatInstantDateTime } from "@/lib/date.utils";

/**
 * "Rodada de seleção" no modal da vaga (fluxo v2, fatia E, piloto; designer, lote 2 §5.6). Só
 * leitura: quem foi perguntado, por que está naquela posição, a situação de cada um, os prazos e
 * quantas vezes a empresa pediu outros nomes. Sem dados, nada (revisão de 04/11, E7): nem
 * "Carregando…" (o modal piscava antes do 404 da chave desligada), nem erro, como a seção de
 * suplentes. Sem a rodada na API (qualquer 404), a seção não aparece.
 */
export function VacancySelectionRoundSection({ vacancyId }: { vacancyId: string }) {
  const { data } = useVacancySelectionRound(vacancyId);

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

      {!data.round && (
        <p className="text-xs text-[#737373]">Esta vaga não teve rodada de seleção.</p>
      )}

      {data.round && (
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

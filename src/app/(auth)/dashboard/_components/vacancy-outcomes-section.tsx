"use client";

import { Ban, Briefcase, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { buildVacancyOutcomeView } from "@/modules/admin/application/dashboard-presentation";
import type { AdminDashboard } from "@/modules/admin/infrastructure/dashboard-api";

/**
 * Destino das vagas criadas no período e faltas (pedidos do Diego 14259e7a e 684928c5). Segue a
 * barra de período. Três faixas: (1) total bruto = oficiais + falsas + teste, e as oficiais
 * destrinchadas em grupos, uma linha por categoria com o "?" (o que é, a conta e a fonte);
 * (2) um card por tipo de vaga falsa; (3) faltas ("chamado e não foi") e os dois detalhes que não
 * entram nelas. Toda conta vem pronta da API.
 */
export function VacancyOutcomesSection({ data }: { data: AdminDashboard }) {
  const view = buildVacancyOutcomeView(data);
  if (!view) {
    return (
      <p className="mb-6 text-xs text-[#737373]">
        O destino de cada vaga criada (oficiais, falsas e de teste) e as faltas
        aparecem aqui quando a API for atualizada.
      </p>
    );
  }

  const byService = view.base === "service";

  return (
    <>
      <section aria-labelledby="destino-vagas" className="mb-6">
        <h2
          id="destino-vagas"
          className="mb-1 text-base font-semibold text-[#1d1d1b]"
        >
          {byService
            ? "Destino das vagas do período"
            : "Destino das vagas criadas"}
        </h2>
        <p className="mb-3 text-xs text-[#737373]">
          {byService
            ? "Cada vaga com serviço no período (pela data do serviço) entra em uma categoria só, pela situação de agora. Aqui está o detalhe de cada grupo da seção Vagas, com os mesmos números. Toque no nome de uma linha para ver o que ela é e a conta."
            : "Cada vaga criada no período entra em um grupo só, pela situação de agora. Toque no nome de uma linha para ver o que ela é e a conta."}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {view.summary.map((card) => (
            <KpiCard
              key={card.id}
              title={card.title}
              value={card.value}
              icon={Briefcase}
              caption={card.caption}
              meta={card.meta}
              metaColor={card.metaColor}
              details={card.details}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {view.officialGroups.map((group) => (
            <Card key={group.id} className="min-w-0 p-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#1d1d1b]">
                  {group.title}
                </h3>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1d1d1b]">
                  {group.total}
                </span>
              </div>
              <ul className="divide-y divide-[#f0f0f0]">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <details>
                      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 text-sm text-[#1d1d1b]">
                          {row.title}
                          <span
                            aria-hidden="true"
                            className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d4d4d4] text-[10px] text-[#737373]"
                          >
                            ?
                          </span>
                          <span className="sr-only"> (o que é e a conta)</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1d1d1b]">
                          {row.value}
                          {row.share && (
                            <span className="ml-1.5 text-xs font-normal text-[#737373]">
                              {row.share}
                            </span>
                          )}
                        </span>
                      </summary>
                      <p className="pb-2 text-xs text-[#525252]">{row.help}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="vagas-falsas" className="mb-6">
        <h2
          id="vagas-falsas"
          className="mb-1 text-base font-semibold text-[#1d1d1b]"
        >
          Vagas falsas (fora dos números oficiais)
        </h2>
        <p className="mb-3 text-xs text-[#737373]">
          {byService
            ? "Vagas que a empresa abriu e não levou adiante, com serviço no período. Ficam fora do total e dos grupos da seção Vagas, mas aparecem aqui, cada tipo no seu card."
            : 'Vagas que a empresa abriu e não levou adiante. Ficam fora de "Vagas criadas" e das contas do período, mas aparecem aqui, cada tipo no seu card.'}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {view.fakeCards.map((card) => (
            <KpiCard
              key={card.id}
              title={card.title}
              value={card.value}
              icon={Ban}
              caption={card.caption}
              meta={card.meta}
              metaColor={card.metaColor}
              details={card.details}
            />
          ))}
        </div>
      </section>

      {view.noShowCards.length > 0 && (
        <section aria-labelledby="faltas" className="mb-6">
          <h2
            id="faltas"
            className="mb-1 text-base font-semibold text-[#1d1d1b]"
          >
            Faltas: freelancer chamado e não foi
          </h2>
          <p className="mb-3 text-xs text-[#737373]">
            {byService
              ? "Contadas por pessoa e vaga, pela data da falta (não pela data do serviço), por isso podem diferir do card \"Freelancer confirmou e não foi\" da seção Vagas. Uma vaga em que o titular faltou e o suplente trabalhou aparece como concluída lá em cima e a falta aparece aqui."
              : "Contadas por pessoa e vaga, pela data da falta. Uma vaga em que o titular faltou e o suplente trabalhou aparece como concluída lá em cima e a falta aparece aqui."}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.noShowCards.map((card) => (
              <KpiCard
                key={card.id}
                title={card.title}
                value={card.value}
                icon={UserX}
                caption={card.caption}
                badge={card.badge}
                meta={card.meta}
                metaColor={card.metaColor}
                details={card.details}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

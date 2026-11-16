import { Building2, Star } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import type { FeedbackItem } from "@/modules/admin/infrastructure/admin-api";
import {
  describeAverageCalc,
  formatAverage,
  formatReviewCount,
  summarizeReceivedRatings,
} from "../_lib/rating-summary";

interface RatingAveragesProps {
  /** A lista INTEIRA do módulo — sem busca nem filtro de nota aplicados. */
  feedbacks: ReadonlyArray<Pick<FeedbackItem, "role" | "rating">>;
  /** Nome do módulo selecionado, como aparece no seletor da tela. */
  moduleLabel: string;
}

/**
 * Nota média recebida por cada lado, no módulo selecionado. Sai da mesma lista
 * da tabela (a API devolve todas as avaliações do módulo), então o número bate
 * com as linhas que estão na tela. O Dashboard mostra outra fatia: Bares + Casa
 * juntos, só desde o lançamento — por isso o cartão diz de onde veio.
 */
export function RatingAverages({ feedbacks, moduleLabel }: RatingAveragesProps) {
  const resumo = summarizeReceivedRatings(feedbacks);

  const fonte = (autores: string) =>
    `todas as avaliações de ${moduleLabel} escritas por ${autores}, sem recorte de data ` +
    `(as mesmas da lista abaixo). Não muda com a busca nem com o filtro de nota.`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <KpiCard
        title="Nota média dos freelancers"
        value={formatAverage(resumo.freelancers.average)}
        icon={Star}
        meta={`Nota dada por contratantes · ${formatReviewCount(resumo.freelancers.count)} · ${moduleLabel}`}
        help="Média das notas (de 1 a 5) que os CONTRATANTES deram aos freelancers neste módulo. O Dashboard junta Bares e Casa e conta só desde o lançamento; aqui entram todas as avaliações do módulo selecionado."
        details={{
          calc: describeAverageCalc(resumo.freelancers),
          source: fonte("contratantes"),
        }}
      />
      <KpiCard
        title="Nota média dos contratantes"
        value={formatAverage(resumo.contractors.average)}
        icon={Building2}
        meta={`Nota dada por freelancers · ${formatReviewCount(resumo.contractors.count)} · ${moduleLabel}`}
        help="Média das notas (de 1 a 5) que os FREELANCERS deram aos contratantes neste módulo. O Dashboard junta Bares e Casa e conta só desde o lançamento; aqui entram todas as avaliações do módulo selecionado."
        details={{
          calc: describeAverageCalc(resumo.contractors),
          source: fonte("freelancers"),
        }}
      />
    </div>
  );
}

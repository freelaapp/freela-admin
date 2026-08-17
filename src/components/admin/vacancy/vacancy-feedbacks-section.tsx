"use client";

import { Loader2, Star } from "lucide-react";
import type {
  VacancyFeedbackEntry,
  VacancyFeedbacksResponse,
} from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate } from "@/lib/date.utils";

/**
 * Avaliações cruzadas da vaga (contratante ↔ freelancer), no modal de detalhes.
 *
 * COMPARTILHADA entre Vagas Empresa e Vagas — Casa: mesma resposta de API, mesma
 * leitura. Ver `VacancyCandidacyList` para o mesmo raciocínio.
 */
function FeedbackPanel({
  title,
  entry,
  emptyMessage,
}: {
  title: string;
  entry: VacancyFeedbackEntry | null;
  emptyMessage: string;
}) {
  if (!entry) {
    return (
      <div className="bg-white border border-[#e5e5e5] rounded-md p-2.5 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
        <p className="text-xs text-[#737373] italic">{emptyMessage}</p>
      </div>
    );
  }

  const ratingRounded = Math.round(entry.rating);
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-md p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i <= ratingRounded ? "text-[#eca826] fill-[#eca826]" : "text-[#e5e5e5]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-[#1d1d1b]">{entry.rating.toFixed(1)}</span>
      </div>
      {entry.comment && entry.comment.trim().length > 0 ? (
        <p className="text-xs text-[#1d1d1b] whitespace-pre-wrap break-words">{entry.comment}</p>
      ) : (
        <p className="text-xs text-[#737373] italic">Sem comentário.</p>
      )}
      <p className="text-[10px] text-[#737373]">
        {entry.authorName ?? "Autor desconhecido"} · {formatVacancyDate(entry.createdAt)}
      </p>
    </div>
  );
}

export function VacancyFeedbacksSection({
  feedbacks,
  loading,
}: {
  feedbacks: VacancyFeedbacksResponse | undefined;
  loading: boolean;
}) {
  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-3">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">Avaliações</p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Carregando avaliações...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <FeedbackPanel
            title="Contratante → Freelancer"
            entry={feedbacks?.contractor ?? null}
            emptyMessage="Contratante ainda não avaliou o freelancer."
          />
          <FeedbackPanel
            title="Freelancer → Contratante"
            entry={feedbacks?.provider ?? null}
            emptyMessage="Freelancer ainda não avaliou o contratante."
          />
        </div>
      )}
    </div>
  );
}

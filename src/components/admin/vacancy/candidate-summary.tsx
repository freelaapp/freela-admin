import { AlertTriangle, Award, Briefcase, MapPin, Star } from "lucide-react";
import type { VacancyCandidacyProvider } from "@/modules/admin/infrastructure/admin-api";
import {
  ageLabel,
  initialsOf,
  locationLabel,
  ratingLabel,
  scoreTone,
  servicesLabel,
} from "@/modules/admin/application/candidate-presentation";

const TIER_TONE: Record<string, string> = {
  OURO: "border-amber-300 bg-amber-50 text-amber-800",
  PRATA: "border-slate-300 bg-slate-100 text-slate-700",
  BRONZE: "border-orange-200 bg-orange-50 text-orange-800",
};

const SCORE_TONE = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  bad: "border-red-200 bg-red-50 text-red-700",
} as const;

/** Foto do candidato; sem foto, as iniciais. `size` em px (56 na lista, 96 no perfil). */
export function CandidateAvatar({
  name,
  src,
  size = 56,
}: {
  name: string | null;
  src: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL assinada do S3 (host dinâmico, vence)
      <img
        src={src}
        alt={name ? `Foto de ${name}` : "Foto do candidato"}
        style={style}
        className="shrink-0 rounded-full border border-[#e5e5e5] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.round(size * 0.36) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[#eca826]/15 font-semibold text-[#8a6d1f]"
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Os dados do candidato que decidem a escolha: função e nível, nota e serviços,
 * idade, bairro/distância, score e o aviso de baixa prioridade. Só `span`s, para
 * caber também dentro do cartão-botão do modo "Escolher titular e suplentes".
 */
export function CandidateFacts({
  provider,
  large = false,
}: {
  provider: VacancyCandidacyProvider;
  /** No perfil os textos crescem; na lista ficam compactos. */
  large?: boolean;
}) {
  const size = large ? "text-sm" : "text-xs";
  const age = ageLabel(provider.age);
  const place = locationLabel(provider);
  const hasRating = provider.averageRating !== null && provider.totalRatings > 0;

  return (
    <span className={`flex min-w-0 flex-col gap-1 ${size} text-[#525252]`}>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {provider.jobTitle && (
          <span className="font-medium text-[#1d1d1b]">{provider.jobTitle}</span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${
            TIER_TONE[provider.tier] ?? TIER_TONE.BRONZE
          }`}
          title="Nível do freelancer na plataforma"
        >
          <Award className="h-3 w-3" />
          {provider.tierLabel}
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="inline-flex items-center gap-1"
          title="Média das avaliações que os contratantes deram a este freelancer"
        >
          <Star
            className={`h-3.5 w-3.5 ${hasRating ? "fill-[#eca826] text-[#eca826]" : "text-[#c4c4c4]"}`}
          />
          {ratingLabel(provider)}
        </span>
        <span
          className="inline-flex items-center gap-1"
          title={`Serviços concluídos na janela recente (desde sempre: ${provider.totalCompletedServices})`}
        >
          <Briefcase className="h-3.5 w-3.5 text-[#a3a3a3]" />
          {servicesLabel(provider.completedServices)}
        </span>
        {age && <span>{age}</span>}
      </span>

      {place && (
        <span className="inline-flex items-start gap-1">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" />
          <span className="min-w-0 break-words">{place}</span>
        </span>
      )}

      {(provider.reputationScore !== null || provider.lowPriority) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {provider.reputationScore !== null && (
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                SCORE_TONE[scoreTone(provider.reputationScore)]
              }`}
              title="Score de reputação (0 a 100). Só o painel vê; a empresa não."
            >
              Score {provider.reputationScore}
            </span>
          )}
          {provider.lowPriority && (
            <span
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700"
              title="Recebeu avaliação abaixo de 3 estrelas: aparece por último na lista da empresa."
            >
              <AlertTriangle className="h-3 w-3" />
              Baixa prioridade
            </span>
          )}
        </span>
      )}
    </span>
  );
}

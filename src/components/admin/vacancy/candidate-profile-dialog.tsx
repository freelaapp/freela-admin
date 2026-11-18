"use client";

import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle, Navigation, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInstantDate } from "@/lib/date.utils";
import {
  DISTANCE_UNAVAILABLE_HINT,
  candidateDistance,
  parseCurriculum,
} from "@/modules/admin/application/candidate-presentation";
import {
  getProviderHistory,
  type VacancyCandidacyItem,
  type VacancyCandidacyProvider,
} from "@/modules/admin/infrastructure/admin-api";
import { CandidateAvatar, CandidateFacts } from "./candidate-summary";
import { MatchBadge } from "./match-badge";

/** A vaga, já formatada pela tela que abriu a lista (o perfil não formata nada). */
export interface CandidateVacancySummary {
  /** Cargo ("Garçom"). */
  role: string;
  company: string;
  /** Dia e horário ("21/11/2026 · 18:00 - 02:00"). */
  when: string;
  /** Endereço do trabalho; `null` = não informado. */
  address: string | null;
  /** O que a empresa paga ("R$ 180,00"); `null` = não mostrar. */
  value: string | null;
  /** Rótulo do valor, o mesmo do detalhe da vaga ("Contratante paga à plataforma"). */
  valueLabel?: string;
}

interface Props {
  /** `null` = fechado. Só abre para candidato que veio com os dados (`provider`). */
  candidacy: VacancyCandidacyItem | null;
  /** A vaga, para o "zoom" mostrar o trabalho junto com a pessoa. */
  vacancy?: CandidateVacancySummary;
  onClose: () => void;
}

/** Link de conversa no WhatsApp — só dígitos, com DDI 55 quando faltar. */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#737373]">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Perfil do candidato para o suporte decidir: foto grande, os números (nota,
 * serviços, score, distância), o que ele escreveu (sobre, currículo), o vídeo
 * de apresentação e as avaliações que já recebeu das empresas.
 */
export function CandidateProfileDialog({ candidacy, vacancy, onClose }: Props) {
  // Fechado não monta nada: a busca das avaliações (e a exigência do provedor de
  // consultas) só existe enquanto um perfil está aberto.
  if (!candidacy?.provider) return null;
  // Direto no <body>: a lista vive dentro do modal da vaga (que corta o que passa
  // dele e tem rolagem própria). Fora dali o perfil cobre a tela inteira, sempre.
  return createPortal(
    <OpenProfile
      candidacy={candidacy}
      provider={candidacy.provider}
      vacancy={vacancy}
      onClose={onClose}
    />,
    document.body,
  );
}

function OpenProfile({
  candidacy,
  provider,
  vacancy,
  onClose,
}: {
  candidacy: VacancyCandidacyItem;
  provider: VacancyCandidacyProvider;
  vacancy?: CandidateVacancySummary;
  onClose: () => void;
}) {
  // Avaliações recebidas: são por freelancer, não por vaga, e a lista de
  // candidatos pode ter dezenas de pessoas — busca só de quem foi aberto.
  const history = useQuery({
    queryKey: ["admin", "provider-history", candidacy.providerId],
    queryFn: () => getProviderHistory(candidacy.providerId),
    staleTime: 60_000,
    retry: false,
  });

  const name = candidacy.providerName ?? "Sem nome";
  const curriculum = parseCurriculum(provider.curriculum);
  const reviews = (history.data ?? []).filter((job) => job.rating !== null);
  const distance = candidateDistance(provider);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()} className="max-w-2xl">
      <DialogContent role="dialog" aria-label={`Perfil de ${name}`}>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Perfil do candidato</DialogTitle>
        </DialogHeader>

        {/* O Dialog do admin não limita a altura: sem isto o rodapé some em tela baixa. */}
        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
            {/* O "zoom": foto grande (128 px no celular, 160 px a partir de sm). */}
            <CandidateAvatar
              name={candidacy.providerName}
              src={provider.profileImage}
              sizeClassName="h-32 w-32 text-4xl sm:h-40 sm:w-40 sm:text-5xl"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-words text-lg font-semibold text-[#1d1d1b]">{name}</p>
              <p
                className={`flex items-start justify-center gap-1.5 text-base sm:justify-start ${
                  distance.available ? "font-semibold text-[#1d1d1b]" : "text-[#737373]"
                }`}
                data-testid="distancia-zoom"
              >
                <Navigation className="mt-1 h-4 w-4 shrink-0 text-[#eca826]" />
                <span className="min-w-0 break-words">
                  {distance.text}
                  {!distance.available && (
                    <span className="block text-xs font-normal">{DISTANCE_UNAVAILABLE_HINT}</span>
                  )}
                </span>
              </p>
              <div className="flex justify-center sm:justify-start">
                <CandidateFacts provider={provider} large hideDistance />
              </div>
              {candidacy.matchScore !== undefined && (
                <div>
                  <MatchBadge score={candidacy.matchScore} />
                </div>
              )}
            </div>
          </div>

          {vacancy && (
            <Section title="Vaga">
              <div className="space-y-1 rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm text-[#1d1d1b]">
                <p className="break-words font-medium">
                  {vacancy.role} · {vacancy.company}
                </p>
                <p className="text-[#525252]">{vacancy.when}</p>
                <p className="break-words text-[#525252]">
                  {vacancy.address?.trim() || "Endereço não informado"}
                </p>
                {vacancy.value && (
                  <p className="font-semibold">
                    {vacancy.valueLabel ? `${vacancy.valueLabel}: ${vacancy.value}` : vacancy.value}
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section title="Contato">
            <div className="flex flex-col gap-1.5 text-sm">
              {candidacy.providerPhone ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={`tel:${candidacy.providerPhone}`}
                    className="inline-flex items-center gap-1.5 text-[#1d1d1b] hover:text-[#eca826]"
                  >
                    <Phone className="h-3.5 w-3.5 text-[#737373]" />
                    {candidacy.providerPhone}
                  </a>
                  <a
                    href={waLink(candidacy.providerPhone)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#1a9e4b] hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Abrir no WhatsApp
                  </a>
                </span>
              ) : (
                <span className="text-[#a3a3a3]">Sem telefone no cadastro</span>
              )}
              {candidacy.providerEmail && (
                <a
                  href={`mailto:${candidacy.providerEmail}`}
                  className="inline-flex items-center gap-1.5 break-all text-[#1d1d1b] hover:text-[#eca826]"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[#737373]" />
                  {candidacy.providerEmail}
                </a>
              )}
            </div>
          </Section>

          {provider.bio?.trim() && (
            <Section title="Sobre">
              <p className="whitespace-pre-wrap break-words text-sm text-[#1d1d1b]">{provider.bio}</p>
            </Section>
          )}

          <Section title="Currículo">
            {curriculum.isEmpty ? (
              <p className="text-sm text-[#a3a3a3]">Este freelancer ainda não preencheu o currículo.</p>
            ) : (
              <div className="space-y-3 text-sm">
                {curriculum.experiences.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#737373]">Experiências</p>
                    <ul className="space-y-1.5">
                      {curriculum.experiences.map((e, i) => (
                        <li key={i} className="rounded-lg bg-[#f7f7f7] px-3 py-2">
                          <p className="break-words font-medium text-[#1d1d1b]">
                            {e.role || "Função não informada"}
                            {e.workplace && <span className="font-normal"> · {e.workplace}</span>}
                          </p>
                          {e.durationLabel && <p className="text-xs text-[#737373]">{e.durationLabel}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {curriculum.courses.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#737373]">Cursos</p>
                    <ul className="space-y-1.5">
                      {curriculum.courses.map((c, i) => (
                        <li key={i} className="rounded-lg bg-[#f7f7f7] px-3 py-2">
                          <p className="break-words font-medium text-[#1d1d1b]">
                            {c.title || "Curso não informado"}
                          </p>
                          {(c.durationLabel || c.completionYear) && (
                            <p className="text-xs text-[#737373]">
                              {[c.durationLabel, c.completionYear && `concluído em ${c.completionYear}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {curriculum.skills && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#737373]">Habilidades</p>
                    <p className="whitespace-pre-wrap break-words text-[#1d1d1b]">{curriculum.skills}</p>
                  </div>
                )}
                {curriculum.competitiveEdge && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[#737373]">Diferencial</p>
                    <p className="whitespace-pre-wrap break-words text-[#1d1d1b]">
                      {curriculum.competitiveEdge}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Vídeo de apresentação">
            {provider.presentationVideoUrl ? (
              // `preload="none"`: o vídeo só baixa se alguém apertar o play.
              <video
                controls
                preload="none"
                src={provider.presentationVideoUrl}
                className="max-h-80 w-full rounded-lg bg-black"
              >
                Seu navegador não toca este vídeo.
              </video>
            ) : (
              <p className="text-sm text-[#a3a3a3]">Sem vídeo de apresentação.</p>
            )}
          </Section>

          <Section title="Avaliações recebidas">
            {history.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-[#737373]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando avaliações…
              </p>
            ) : history.isError ? (
              <p className="text-sm text-[#737373]">
                Não foi possível carregar as avaliações (seu perfil pode não ter acesso à área de
                Freelancers).
              </p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-[#a3a3a3]">Nenhuma avaliação recebida até agora.</p>
            ) : (
              <ul className="space-y-2">
                {reviews.map((job) => (
                  <li key={`${job.vacancyId}-${job.date}`} className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
                    <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1d1d1b]">
                        <Star className="h-3.5 w-3.5 fill-[#eca826] text-[#eca826]" />
                        {(job.rating as number).toFixed(1).replace(".", ",")}
                      </span>
                      <span className="text-xs text-[#737373]">
                        {[job.authorCompanyName ?? job.authorName, job.title, formatInstantDate(job.date)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </p>
                    {job.comment?.trim() && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-[#525252]">{job.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

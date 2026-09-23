"use client";

import { useState } from "react";
import { Loader2, MapPin, Send, Star, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { MatchBadge } from "@/components/admin/vacancy/vacancy-candidacy-list";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCompatibleFreelancers,
  useSendCompatibleInvites,
} from "@/modules/admin/application/use-vacancy-outreach";
import type { CompatibleInviteResult } from "@/modules/admin/infrastructure/vacancy-outreach-api";

/**
 * "Convidar compatíveis" — chama no WhatsApp, 1:1, os 10 freelancers que mais
 * combinam com a vaga e AINDA NÃO se candidataram, com o link da vaga.
 *
 * Fica dentro do modal de detalhes (e não num segundo diálogo por cima) porque
 * é uma ação sobre a vaga que está aberta ali: a lista de candidatos logo
 * abaixo é justamente o resultado que o convite quer mudar.
 *
 * Quem escolhe a lista é a API (mesma nota de compatibilidade dos candidatos);
 * aqui o suporte só confere, desmarca quem não quiser e revisa o texto. Depois
 * do envio a lista se refaz sozinha — os convidados saem e entram os próximos.
 */
export function CompatibleInviteSection({ vacancyId }: { vacancyId: string }) {
  const [aberto, setAberto] = useState(false);
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [textoEditado, setTextoEditado] = useState<string | null>(null);

  const query = useCompatibleFreelancers(vacancyId, aberto);
  const enviar = useSendCompatibleInvites(vacancyId);

  const candidatos = query.data?.candidates ?? [];
  const selecionados = candidatos.filter((c) => !desmarcados.has(c.userId));
  const texto = textoEditado ?? query.data?.template ?? "";
  const podeEnviar = selecionados.length > 0 && texto.trim().length > 0 && !enviar.isPending;

  function alternar(userId: string) {
    setDesmarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(userId)) proximo.delete(userId);
      else proximo.add(userId);
      return proximo;
    });
  }

  async function disparar() {
    if (!podeEnviar) return;
    try {
      const resultado = await enviar.mutateAsync({
        userIds: selecionados.map((c) => c.userId),
        text: texto.trim(),
      });
      avisarResultado(resultado);
      setDesmarcados(new Set());
    } catch (e) {
      toast.error(getAxiosErrorMessage(e, "Não foi possível enviar os convites."));
    }
  }

  return (
    <section className="rounded-lg border border-[#e5e5e5] p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#737373]">
            <UserPlus className="h-3.5 w-3.5" />
            Convidar freelas compatíveis
          </p>
          <p className="mt-1 text-xs text-[#737373]">
            Manda no WhatsApp o link da vaga para os 10 que mais combinam e ainda não se candidataram.
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#1d1d1b] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#333]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Ver os 10 mais compatíveis
          </button>
        )}
      </div>

      {aberto && query.isLoading && (
        <p className="flex items-center gap-2 text-xs text-[#737373]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Procurando os freelas que mais combinam…
        </p>
      )}

      {aberto && query.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <p>{getAxiosErrorMessage(query.error, "Não foi possível buscar os freelas compatíveis.")}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-1.5 cursor-pointer font-semibold underline"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {aberto && query.data && (
        <>
          {query.data.alreadyInvited > 0 && (
            <p className="text-xs text-[#737373]">
              Já convidados para esta vaga: <strong>{query.data.alreadyInvited}</strong> (não entram de novo).
            </p>
          )}

          {candidatos.length === 0 ? (
            <p className="rounded-md bg-[#f7f7f7] p-2.5 text-xs text-[#737373]">
              Nenhum freela compatível disponível agora — todos da cidade/função já se candidataram, já
              foram convidados ou estão escalados nesse horário.
            </p>
          ) : (
            <ul className="divide-y divide-[#f0f0f0] rounded-md border border-[#f0f0f0]">
              {candidatos.map((c) => {
                const marcado = !desmarcados.has(c.userId);
                return (
                  <li key={c.userId}>
                    <label className="flex cursor-pointer items-start gap-2.5 p-2.5 hover:bg-[#fafafa]">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(c.userId)}
                        disabled={enviar.isPending}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#16A34A]"
                        aria-label={`Convidar ${c.name ?? "freelancer sem nome"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-[#1d1d1b]">
                            {c.name ?? "Sem nome"}
                          </span>
                          <MatchBadge score={c.matchScore} />
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#737373]">
                          {c.averageRating != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-[#eca826] text-[#eca826]" />
                              {c.averageRating.toFixed(1)}
                            </span>
                          )}
                          <span>
                            {c.totalCompletedServices}{" "}
                            {c.totalCompletedServices === 1 ? "serviço" : "serviços"}
                          </span>
                          {c.distanceInKm != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {c.distanceInKm.toLocaleString("pt-BR")} km
                            </span>
                          )}
                          <span className="tabular-nums">{c.phone}</span>
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {candidatos.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor={`convite-${vacancyId}`}
                className="block text-xs font-medium uppercase tracking-wide text-[#737373]"
              >
                Mensagem (pode editar)
              </label>
              <textarea
                id={`convite-${vacancyId}`}
                value={texto}
                onChange={(e) => setTextoEditado(e.target.value)}
                disabled={enviar.isPending}
                rows={9}
                maxLength={1500}
                className="w-full resize-y rounded-md border border-[#e5e5e5] px-3 py-2 text-[13px] leading-snug text-[#1d1d1b] focus:border-[#a3a3a3] focus:outline-none"
              />
              <p className="text-[11px] text-[#a3a3a3]">
                <code>{"{nome}"}</code> vira o primeiro nome de cada freela. O link abre a página da vaga com
                o botão de candidatura.
              </p>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    setDesmarcados(new Set());
                    setTextoEditado(null);
                  }}
                  disabled={enviar.isPending}
                  className="cursor-pointer rounded-md border border-[#e5e5e5] px-3 py-2 text-xs font-semibold text-[#737373] transition-colors hover:bg-[#f7f7f7] disabled:opacity-50"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={disparar}
                  disabled={!podeEnviar}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#16A34A] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviar.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {enviar.isPending
                    ? "Enviando… (leva alguns segundos)"
                    : `Enviar convite para ${selecionados.length} ${selecionados.length === 1 ? "freela" : "freelas"}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Um aviso só, dizendo o que de fato aconteceu com cada grupo. */
function avisarResultado(r: CompatibleInviteResult) {
  const partes: string[] = [];
  if (r.sent.length > 0) {
    partes.push(`${r.sent.length} ${r.sent.length === 1 ? "convite enviado" : "convites enviados"}`);
  }
  if (r.skipped > 0) {
    partes.push(`${r.skipped} fora da lista (já se candidatou ou foi convidado)`);
  }
  if (r.failed.length > 0) {
    const nomes = r.failed.map((f) => f.name ?? "sem nome").join(", ");
    toast.error(`Falhou para ${r.failed.length}: ${nomes}. Dá para tentar de novo.`);
  }
  if (r.sent.length > 0) toast.success(`${partes.join(" · ")}.`);
  else if (r.failed.length === 0) toast.info(partes.join(" · ") || "Nenhum convite enviado.");
}

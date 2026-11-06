"use client";

import { useEffect, useState } from "react";
import { FastForward, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ChooseFlow } from "@/modules/admin/application/use-choose-flow";
import { useVacancySelectionRound } from "@/modules/admin/application/use-selection-round";
import {
  canReleaseList,
  choiceReserveIds,
  companyViewCard,
  isSelectionDisabled,
  payWayOf,
} from "@/modules/admin/application/selection-round-presentation";
import type { VacancyCandidacyItem } from "@/modules/admin/infrastructure/admin-api";
import { ChooseConfirmDialog } from "./choose-confirm-dialog";
import { HurrySelectionDialog } from "./hurry-selection-dialog";
import { ReleaseListDialog } from "./release-list-dialog";

/**
 * Barra "Acelerar esta vaga", acima da lista de candidatos de Vagas Empresa (UX de 05/11 noite §2):
 * "Selecionar agora" (pergunta já aos mais bem colocados), "Escolher titular e suplentes" (o suporte
 * aprova os 3 de uma vez) e "Liberar a lista agora". O servidor decide o que vale (`hurry`): a tela
 * só mostra. Some inteira com a vaga fechada, começada ou já com alguém aceito.
 */
export function AccelerateVacancyBar({
  vacancyId,
  vacancyOpen,
  startTime,
  candidacies,
  loadingCandidacies,
  company,
  billingMode,
  valueLabel,
  subtitle,
  choose,
}: {
  vacancyId: string;
  vacancyOpen: boolean;
  startTime?: string | null;
  candidacies: VacancyCandidacyItem[] | undefined;
  loadingCandidacies: boolean;
  /** Nome da empresa, para os textos da confirmação. */
  company: string;
  /** `billingMode` da empresa (a lista de Empresas já o traz); ausente = não sabemos. */
  billingMode?: string | null;
  /** O valor da vaga, já formatado (o mesmo do resumo do modal). */
  valueLabel: string;
  /** "Atendente · sex 06/11, das 17h". */
  subtitle: string;
  choose: ChooseFlow;
}) {
  const round = useVacancySelectionRound(vacancyId);
  const [hurryOpen, setHurryOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  // Com o diálogo aberto, a leitura é refeita a cada 30 s: o admin pode estar no celular e as horas
  // andam. O servidor confere de novo ao gravar.
  const refetch = round.refetch;
  useEffect(() => {
    if (!hurryOpen) return;
    void refetch();
    const timer = setInterval(() => void refetch(), 30_000);
    return () => clearInterval(timer);
  }, [hurryOpen, refetch]);

  const pending = (candidacies ?? []).filter((c) => c.status === "PENDING");
  const pendingIds = pending.map((c) => c.id).join(",");
  const { prune } = choose;
  useEffect(() => {
    if (choose.active) prune(new Set(pendingIds ? pendingIds.split(",") : []));
  }, [choose.active, pendingIds, prune]);

  const accepted = (candidacies ?? []).some((c) => c.status === "ACCEPTED");
  const started = Boolean(startTime && new Date(startTime).getTime() <= Date.now());
  const gone = !vacancyOpen || accepted || started;
  // A vaga mudou enquanto marcava (alguém foi aceito, fechou): o modo sai sozinho.
  const { cancel } = choose;
  useEffect(() => {
    if (gone && choose.active) {
      cancel();
      toast.info("A vaga mudou enquanto você escolhia. Nada foi alterado.");
    }
  }, [gone, choose.active, cancel]);
  if (gone) return null;

  // Sem a lista de candidatos ou sem a rodada ainda: esqueleto do tamanho da barra (nada que
  // aparece depois e empurra a lista).
  if (loadingCandidacies || candidacies === undefined || round.isLoading) {
    return (
      <div data-testid="acelerar-esqueleto" aria-hidden className="space-y-2 rounded-lg bg-white p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[#eeeeee]" />
        <div className="h-11 w-full animate-pulse rounded bg-[#eeeeee] sm:w-1/2" />
      </div>
    );
  }
  if (pending.length === 0 && !choose.active) {
    return (
      <div className="rounded-lg bg-white p-3 text-xs text-[#737373]">
        <p className="text-sm font-semibold text-[#1d1d1b]">Acelerar esta vaga</p>
        <p>{round.data?.hurry?.message ?? "Ninguém se candidatou ainda."}</p>
      </div>
    );
  }

  const view = round.data;
  const hurry = view?.hurry ?? null;
  const card = companyViewCard(view?.companyView, new Date(), view?.round);
  const hurryVisible = Boolean(hurry && hurry.options.length > 0);
  const hurryOff = hurry?.available === false;
  const showReadError = round.isError && !isSelectionDisabled(round.error);

  if (choose.active) {
    return (
      <>
        <div className="space-y-2 rounded-lg bg-white p-3" data-testid="acelerar-escolhendo">
          <p className="text-sm font-semibold text-[#1d1d1b]">Escolher titular e suplentes</p>
          <p className="text-xs text-[#737373]">
            Toque primeiro em quem vai trabalhar. Depois, em até {choose.maxReserves} suplente
            {choose.maxReserves === 1 ? "" : "s"}, na ordem de chamada. Ninguém é avisado até você
            confirmar.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={choose.cancel}
            className="min-h-11 w-full border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] sm:w-auto"
          >
            Cancelar
          </Button>
        </div>
        {choose.reviewOpen && (
          <ConfirmFromFlow
            vacancyId={vacancyId}
            subtitle={subtitle}
            company={company}
            valueLabel={valueLabel}
            billingMode={billingMode}
            candidacies={candidacies}
            othersCount={pending.length}
            roundInProgress={view?.round?.phase === "ASKING" || view?.round?.phase === "OPTIONS_SENT"}
            choose={choose}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-3" data-testid="acelerar-barra">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-[#1d1d1b]">Acelerar esta vaga</p>
        {card && <p className="text-xs text-[#737373]">{card.headline}</p>}
        {showReadError && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
            <span role="alert">Não foi possível ver a situação da seleção.</span>
            <button
              type="button"
              onClick={() => void round.refetch()}
              disabled={round.isFetching}
              className="rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1 font-medium text-[#1d1d1b] hover:bg-[#f0f0f0] disabled:opacity-60"
            >
              Tentar de novo
            </button>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        {hurryVisible && hurry && (
          <div className="flex flex-col gap-1 sm:max-w-[16rem]">
            <Button
              type="button"
              aria-disabled={hurryOff ? true : undefined}
              aria-describedby={`acelerar-apoio-${vacancyId}`}
              onClick={() => {
                if (!hurryOff) setHurryOpen(true);
              }}
              className={`min-h-11 w-full gap-2 bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] sm:w-auto ${
                hurryOff ? "opacity-50" : ""
              }`}
            >
              <FastForward className="h-4 w-4" aria-hidden />
              Selecionar agora
            </Button>
            <p id={`acelerar-apoio-${vacancyId}`} className="text-xs text-[#737373]">
              {hurryOff && hurry.message
                ? hurry.message
                : "Fecha a janela e pergunta já aos mais bem colocados."}
            </p>
          </div>
        )}

        {choose.canChoose && (
          <div className="flex flex-col gap-1 sm:max-w-[16rem]">
            <Button
              type="button"
              variant="outline"
              aria-describedby={`acelerar-apoio-escolher-${vacancyId}`}
              onClick={choose.start}
              className="min-h-11 w-full gap-2 border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] sm:w-auto"
            >
              <ListChecks className="h-4 w-4" aria-hidden />
              Escolher titular e suplentes
            </Button>
            <p id={`acelerar-apoio-escolher-${vacancyId}`} className="text-xs text-[#737373]">
              Você aprova quem vai trabalhar e marca os suplentes.
            </p>
          </div>
        )}

        {canReleaseList(view?.companyView) && (
          <div className="flex flex-col gap-1 sm:max-w-[16rem]">
            <Button
              type="button"
              variant="outline"
              aria-describedby={`acelerar-apoio-liberar-${vacancyId}`}
              onClick={() => setReleaseOpen(true)}
              className="min-h-11 w-full border-[#eca826]/60 text-[#1d1d1b] hover:bg-[#eca826]/10 sm:w-auto"
            >
              Liberar a lista agora
            </Button>
            <p id={`acelerar-apoio-liberar-${vacancyId}`} className="text-xs text-[#737373]">
              A empresa passa a ver todos os candidatos e escolhe ela mesma.
            </p>
          </div>
        )}
      </div>

      {hurryOpen && hurry && (
        <HurrySelectionDialog
          vacancyId={vacancyId}
          hurry={hurry}
          subtitle={subtitle}
          onClose={() => setHurryOpen(false)}
        />
      )}
      <ReleaseListDialog vacancyId={vacancyId} open={releaseOpen} onClose={() => setReleaseOpen(false)} />
    </div>
  );
}

/** Monta a confirmação a partir da marcação (nomes pelos ids da lista de candidatos). */
function ConfirmFromFlow({
  vacancyId,
  subtitle,
  company,
  valueLabel,
  billingMode,
  candidacies,
  othersCount,
  roundInProgress,
  choose,
}: {
  vacancyId: string;
  subtitle: string;
  company: string;
  valueLabel: string;
  billingMode?: string | null;
  candidacies: VacancyCandidacyItem[];
  othersCount: number;
  roundInProgress: boolean;
  choose: ChooseFlow;
}) {
  const nameOf = (id: string) => candidacies.find((c) => c.id === id)?.providerName ?? "Sem nome";
  const principalId = choose.selection.principal;
  if (!principalId) return null;
  const reserves = choiceReserveIds(choose.selection).map((id) => ({ id, name: nameOf(id) }));
  return (
    <ChooseConfirmDialog
      vacancyId={vacancyId}
      subtitle={subtitle}
      company={company}
      valueLabel={valueLabel}
      way={payWayOf(billingMode)}
      principal={{ id: principalId, name: nameOf(principalId) }}
      reserves={reserves}
      maxReserves={choose.maxReserves}
      autoFill={choose.autoFill}
      othersCount={Math.max(0, othersCount - 1 - reserves.length)}
      roundInProgress={roundInProgress}
      onClose={choose.closeReview}
      onDone={choose.finish}
    />
  );
}

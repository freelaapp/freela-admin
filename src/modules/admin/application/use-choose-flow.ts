"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useVacancyReserves } from "./use-vacancy-reserves";
import {
  EMPTY_CHOICE,
  pruneChoice,
  toggleChoice,
  type ChoiceSelection,
} from "./selection-round-presentation";

/**
 * Estado do modo "Escolher titular e suplentes" de UMA vaga aberta no modal (UX de 05/11 noite §4):
 * a marcação (titular, suplente 1, suplente 2), a confirmação e quem pode ser suplente (o GET de
 * suplentes do admin, que não passa pelo portão da empresa). A marcação vive aqui porque a barra
 * (que liga o modo) e a lista (que marca) são irmãs no modal. Troca de vaga zera tudo.
 */
export function useChooseFlow(vacancyId: string | null) {
  const { data: reserves } = useVacancyReserves(vacancyId);
  const [active, setActive] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selection, setSelection] = useState<ChoiceSelection>(EMPTY_CHOICE);

  useEffect(() => {
    setActive(false);
    setReviewOpen(false);
    setSelection(EMPTY_CHOICE);
  }, [vacancyId]);

  const maxReserves = reserves?.enabled ? Math.max(0, Math.min(2, reserves.max ?? 2)) : 0;
  const reserveEligibleIds = useMemo(
    () => new Set((reserves?.candidates ?? reserves?.eligible ?? []).map((c) => c.candidacyId)),
    [reserves],
  );
  // Suplentes desligados ou fora do prazo: o modo vira só titular, e o "Colocar na vaga" do cartão
  // já faz isso em 2 toques (o botão do modo some).
  const canChoose = Boolean(reserves?.enabled && reserves.canChoose === true);

  const start = useCallback(() => {
    setSelection(EMPTY_CHOICE);
    setActive(true);
  }, []);
  const reset = useCallback(() => {
    setActive(false);
    setReviewOpen(false);
    setSelection(EMPTY_CHOICE);
  }, []);
  const toggle = useCallback(
    (id: string) =>
      setSelection((sel) =>
        toggleChoice(sel, id, { canBeReserve: reserveEligibleIds.has(id), maxReserves }),
      ),
    [reserveEligibleIds, maxReserves],
  );
  const prune = useCallback(
    (validIds: ReadonlySet<string>) => setSelection((sel) => pruneChoice(sel, validIds)),
    [],
  );

  return {
    active,
    selection,
    reviewOpen,
    canChoose,
    maxReserves,
    reserveEligibleIds,
    autoFill: reserves?.autoFill === true,
    start,
    cancel: reset,
    finish: reset,
    toggle,
    prune,
    openReview: () => setReviewOpen(true),
    closeReview: () => setReviewOpen(false),
  };
}

export type ChooseFlow = ReturnType<typeof useChooseFlow>;

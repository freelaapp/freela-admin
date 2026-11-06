"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChooseTeam } from "./use-selection-round";
import { useVacancyReserves } from "./use-vacancy-reserves";
import {
  EMPTY_CHOICE,
  reconcileChoice,
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
  // O último erro da aprovação, visível na barra quando o diálogo fecha (ex.: o titular saiu).
  const [notice, setNotice] = useState<string | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  // A mutação mora aqui (não no diálogo): é a trava de duplo POST, mesmo com o diálogo desmontado.
  const mutation = useChooseTeam(vacancyId ?? "");

  useEffect(() => {
    setActive(false);
    setReviewOpen(false);
    setSelection(EMPTY_CHOICE);
    setNotice(null);
  }, [vacancyId]);

  // Sem titular não há o que confirmar: o diálogo fecha e não reabre no próximo toque.
  useEffect(() => {
    if (reviewOpen && selection.principal === null) setReviewOpen(false);
  }, [reviewOpen, selection.principal]);

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
    setNotice(null);
    setActive(true);
  }, []);
  const reset = useCallback(() => {
    setActive(false);
    setReviewOpen(false);
    setSelection(EMPTY_CHOICE);
    setNotice(null);
  }, []);
  const toggle = useCallback(
    (id: string) => {
      setNotice(null);
      setSelection((sel) =>
        toggleChoice(sel, id, { canBeReserve: reserveEligibleIds.has(id), maxReserves }),
      );
    },
    [reserveEligibleIds, maxReserves],
  );
  // Revalida a marcação contra a lista e os suplentes de agora (relidos a cada foco/15 s).
  const prune = useCallback(
    (pendingIds: ReadonlySet<string>) => {
      const current = selectionRef.current;
      const next = reconcileChoice(current, pendingIds, reserveEligibleIds, maxReserves);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      setSelection(next);
      setNotice(
        current.principal !== null && next.principal === null
          ? "O titular marcado saiu da lista de candidatos e foi desmarcado. Nada foi aprovado."
          : "Um suplente marcado não pode mais ser suplente e foi desmarcado.",
      );
    },
    [reserveEligibleIds, maxReserves],
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
    notice,
    setNotice,
    isPending: mutation.isPending,
    submit: mutation.mutateAsync,
    openReview: () => setReviewOpen(true),
    closeReview: () => setReviewOpen(false),
  };
}

export type ChooseFlow = ReturnType<typeof useChooseFlow>;

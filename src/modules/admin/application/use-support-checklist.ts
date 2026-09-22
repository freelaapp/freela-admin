"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getSupportChecklist,
  tickSupportAction,
  tickSupportActions,
  untickSupportAction,
  type ChecklistTickDto,
  type VacancyModule,
} from "../infrastructure/support-checklist-api";

/**
 * O checklist do suporte, agora compartilhado por TODO o time (era `localStorage`
 * por navegador). Um `useQuery` só para o painel inteiro — o banner, o card e a
 * gaveta leem o mesmo cache — com escrita otimista para o tique responder na hora
 * como respondia offline. O Modo Painel já refetch a cada 60s, então o tique de
 * uma máquina aparece na outra sozinho.
 */

export interface ChecklistTick {
  at: string;
  by: string | null;
}

export interface SupportChecklist {
  /** Ações ticadas de uma vaga, por id de ação. */
  feitasDaVaga: (vacancyId: string) => Set<string>;
  /** Quando/por quem a ação foi ticada. `undefined` = ainda não foi. */
  tique: (vacancyId: string, actionId: string) => ChecklistTick | undefined;
  /** Liga/desliga o tique. Desligar existe porque ticar errado é comum. */
  alternar: (vacancyId: string, actionId: string) => void;
  /** Tica tudo que falta de uma vez, para quem resolveu a vaga no telefone. */
  ticarTodas: (vacancyId: string, actionIds: string[]) => void;
}

const QUERY_KEY = ["admin", "support-checklist"] as const;
const chave = (vacancyId: string, actionId: string) => `${vacancyId}::${actionId}`;

export function useSupportChecklist(
  quemTicou?: string | null,
  /** Só Empresa liga a área de trabalho hoje; o default cobre esse caso. */
  module: VacancyModule = "bars-restaurants",
): SupportChecklist {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getSupportChecklist,
    staleTime: 30_000,
  });

  const { porVaga, porChave } = useMemo(() => {
    const porVaga = new Map<string, Set<string>>();
    const porChave = new Map<string, ChecklistTick>();
    for (const t of data ?? []) {
      const set = porVaga.get(t.vacancyId) ?? new Set<string>();
      set.add(t.actionId);
      porVaga.set(t.vacancyId, set);
      porChave.set(chave(t.vacancyId, t.actionId), { at: t.checkedAt, by: t.by });
    }
    return { porVaga, porChave };
  }, [data]);

  const VAZIA = useMemo(() => new Set<string>(), []);

  // Patch otimista do cache: some/entra a linha na hora, e o refetch do
  // `onSettled` reconcilia com o servidor (inclusive o "por quem/quando" real).
  const patch = useCallback(
    (fn: (linhas: ChecklistTickDto[]) => ChecklistTickDto[]) => {
      const anterior = qc.getQueryData<ChecklistTickDto[]>(QUERY_KEY) ?? [];
      qc.setQueryData<ChecklistTickDto[]>(QUERY_KEY, fn(anterior));
      return anterior;
    },
    [qc],
  );

  const restaurar = useCallback(
    (anterior?: ChecklistTickDto[]) => {
      if (anterior) qc.setQueryData<ChecklistTickDto[]>(QUERY_KEY, anterior);
    },
    [qc],
  );

  const reconciliar = useCallback(
    () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    [qc],
  );

  const tickMut = useMutation({
    mutationFn: (v: { vacancyId: string; actionId: string }) =>
      tickSupportAction(v.vacancyId, v.actionId, module, quemTicou),
    onMutate: (v) =>
      patch((linhas) =>
        linhas.some((l) => l.vacancyId === v.vacancyId && l.actionId === v.actionId)
          ? linhas
          : [
              {
                vacancyId: v.vacancyId,
                actionId: v.actionId,
                checkedAt: new Date().toISOString(),
                by: quemTicou ?? null,
                sentTo: null,
                sentWhatsappAt: null,
              },
              ...linhas,
            ],
      ),
    onError: (_e, _v, anterior) => restaurar(anterior),
    onSettled: reconciliar,
  });

  const untickMut = useMutation({
    mutationFn: (v: { vacancyId: string; actionId: string }) =>
      untickSupportAction(v.vacancyId, v.actionId),
    onMutate: (v) =>
      patch((linhas) =>
        linhas.filter((l) => !(l.vacancyId === v.vacancyId && l.actionId === v.actionId)),
      ),
    onError: (_e, _v, anterior) => restaurar(anterior),
    onSettled: reconciliar,
  });

  const bulkMut = useMutation({
    mutationFn: (v: { vacancyId: string; actionIds: string[] }) =>
      tickSupportActions(v.vacancyId, v.actionIds, module, quemTicou),
    onMutate: (v) =>
      patch((linhas) => {
        const jaTem = new Set(
          linhas.filter((l) => l.vacancyId === v.vacancyId).map((l) => l.actionId),
        );
        const now = new Date().toISOString();
        const novas: ChecklistTickDto[] = v.actionIds
          .filter((id) => !jaTem.has(id))
          .map((actionId) => ({
            vacancyId: v.vacancyId,
            actionId,
            checkedAt: now,
            by: quemTicou ?? null,
            sentTo: null,
            sentWhatsappAt: null,
          }));
        return [...novas, ...linhas];
      }),
    onError: (_e, _v, anterior) => restaurar(anterior),
    onSettled: reconciliar,
  });

  const feitasDaVaga = useCallback(
    (vacancyId: string) => porVaga.get(vacancyId) ?? VAZIA,
    [porVaga, VAZIA],
  );

  const tique = useCallback(
    (vacancyId: string, actionId: string) => porChave.get(chave(vacancyId, actionId)),
    [porChave],
  );

  const alternar = useCallback(
    (vacancyId: string, actionId: string) => {
      const feita = porVaga.get(vacancyId)?.has(actionId) ?? false;
      if (feita) untickMut.mutate({ vacancyId, actionId });
      else tickMut.mutate({ vacancyId, actionId });
    },
    [porVaga, tickMut, untickMut],
  );

  const ticarTodas = useCallback(
    (vacancyId: string, actionIds: string[]) => {
      if (actionIds.length > 0) bulkMut.mutate({ vacancyId, actionIds });
    },
    [bulkMut],
  );

  return { feitasDaVaga, tique, alternar, ticarTodas };
}

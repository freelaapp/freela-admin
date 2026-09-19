"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  CHECKLIST_STORAGE_KEY,
  checklistKey,
  loadChecklist,
  parseChecklistKey,
  saveChecklist,
  type ChecklistState,
  type ChecklistTick,
} from "../infrastructure/support-checklist-storage";

/**
 * O checklist do suporte, compartilhado por todos os componentes do painel.
 *
 * Um store de módulo e não `useState` por componente: o banner vermelho, o card
 * e a gaveta leem o MESMO estado, e três cópias divergiriam no primeiro clique
 * (ticar na gaveta tem de apagar a linha do banner na mesma hora).
 */

let estado: ChecklistState | null = null;
const ouvintes = new Set<() => void>();

function snapshot(): ChecklistState {
  estado ??= loadChecklist();
  return estado;
}

/** Snapshot do servidor: vazio. O HTML do SSR não pode depender do storage do
 *  navegador, ou o React acusa divergência de hidratação. */
const VAZIO: ChecklistState = {};

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  // Outra aba do painel é outra pessoa do time na mesma máquina: sem isto, uma
  // ticaria e a outra continuaria cobrando a mesma vaga.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== CHECKLIST_STORAGE_KEY) return;
    estado = loadChecklist();
    avisar();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    ouvintes.delete(ouvinte);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/**
 * Descarta o cache do módulo e relê o storage.
 *
 * Existe para os TESTES: o store é carregado uma vez por carregamento de página
 * e, sem isto, um teste que tica herda o tique no teste seguinte mesmo depois de
 * limpar o `localStorage`. Em produção ninguém chama.
 */
export function resetSupportChecklistCache(): void {
  estado = null;
  avisar();
}

function escrever(proximo: ChecklistState): void {
  estado = proximo;
  saveChecklist(proximo);
  avisar();
}

export interface SupportChecklist {
  /** Ações ticadas de uma vaga, por id de ação. */
  feitasDaVaga: (vacancyId: string) => Set<string>;
  /** Quando/por quem a ação foi ticada. `undefined` = ainda não foi. */
  tique: (vacancyId: string, actionId: string) => ChecklistTick | undefined;
  /** Liga/desliga o tique. Desligar existe porque ticar errado é comum e, sem
   *  como desfazer, a pessoa passa a não ticar mais nada. */
  alternar: (vacancyId: string, actionId: string) => void;
  /** Tica tudo que falta de uma vez, para quem resolveu a vaga no telefone. */
  ticarTodas: (vacancyId: string, actionIds: string[]) => void;
  /** Quantas vagas têm pelo menos um tique — só para a linha de rodapé. */
  totalTiques: number;
}

export function useSupportChecklist(quemTicou?: string | null): SupportChecklist {
  const state = useSyncExternalStore(assinar, snapshot, () => VAZIO);

  /**
   * Índice vaga → ações ticadas.
   *
   * Montado uma vez por mudança de estado, não uma vez por card: o painel tem
   * dezenas de vagas e cada uma perguntaria pelo próprio conjunto.
   */
  const porVaga = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const key of Object.keys(state)) {
      const par = parseChecklistKey(key);
      if (!par) continue;
      const set = mapa.get(par.vacancyId) ?? new Set<string>();
      set.add(par.actionId);
      mapa.set(par.vacancyId, set);
    }
    return mapa;
  }, [state]);

  const VAZIA = useMemo(() => new Set<string>(), []);

  const feitasDaVaga = useCallback(
    (vacancyId: string) => porVaga.get(vacancyId) ?? VAZIA,
    [porVaga, VAZIA],
  );

  const tique = useCallback(
    (vacancyId: string, actionId: string) => state[checklistKey(vacancyId, actionId)],
    [state],
  );

  const alternar = useCallback(
    (vacancyId: string, actionId: string) => {
      const key = checklistKey(vacancyId, actionId);
      const proximo = { ...state };
      if (proximo[key]) delete proximo[key];
      else proximo[key] = { at: new Date().toISOString(), by: quemTicou ?? null };
      escrever(proximo);
    },
    [state, quemTicou],
  );

  const ticarTodas = useCallback(
    (vacancyId: string, actionIds: string[]) => {
      const proximo = { ...state };
      const agora = new Date().toISOString();
      for (const actionId of actionIds) {
        const key = checklistKey(vacancyId, actionId);
        proximo[key] ??= { at: agora, by: quemTicou ?? null };
      }
      escrever(proximo);
    },
    [state, quemTicou],
  );

  return {
    feitasDaVaga,
    tique,
    alternar,
    ticarTodas,
    totalTiques: Object.keys(state).length,
  };
}

/**
 * Onde ficam os "tiques" do checklist do suporte.
 *
 * Hoje: `localStorage` do navegador. NÃO é compartilhado entre pessoas nem
 * entre máquinas — quem ticar numa estação não aparece ticado na outra.
 *
 * Está isolado aqui, e não espalhado pela UI, porque é a única peça que muda
 * quando a API ganhar a rota do checklist: troque as quatro funções abaixo por
 * chamadas HTTP (o formato da chave, `vagaId::acaoId`, é o mesmo par que o
 * `vacancy-outreach` já usa como chave primária) e nenhuma tela precisa mudar.
 */

/** Um tique: quando foi feito e por quem. O "por quem" é o que dá para cobrar
 *  depois — checklist anônimo não sustenta conversa de turno. */
export interface ChecklistTick {
  at: string;
  by: string | null;
}

/** Chave `vagaId::acaoId` → tique. */
export type ChecklistState = Record<string, ChecklistTick>;

const STORAGE_KEY = "admin:support-checklist";

/**
 * Passado este prazo o tique é descartado na próxima leitura.
 *
 * Sem poda o `localStorage` cresce para sempre e um dia estoura a cota — e o
 * checklist de uma vaga de dois meses atrás não serve a ninguém: o painel já
 * não mostra vaga antiga.
 */
const VALIDADE_DIAS = 45;

export function checklistKey(vacancyId: string, actionId: string): string {
  return `${vacancyId}::${actionId}`;
}

/** Quebra a chave de volta em (vaga, ação). `null` se não tiver o formato. */
export function parseChecklistKey(key: string): { vacancyId: string; actionId: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  return { vacancyId: key.slice(0, i), actionId: key.slice(i + 2) };
}

/** Remove o que passou da validade. Exportada para poder ser testada sem DOM. */
export function podar(state: ChecklistState, agora: number = Date.now()): ChecklistState {
  const limite = agora - VALIDADE_DIAS * 24 * 60 * 60 * 1000;
  const saida: ChecklistState = {};
  for (const [key, tick] of Object.entries(state)) {
    const ms = Date.parse(tick?.at ?? "");
    // Tique com data ilegível fica: descartar por não saber ler a data dele
    // apagaria trabalho já feito, que é pior do que guardar lixo.
    if (Number.isNaN(ms) || ms >= limite) saida[key] = tick;
  }
  return saida;
}

export function loadChecklist(): ChecklistState {
  if (typeof window === "undefined") return {};
  try {
    const cru = window.localStorage.getItem(STORAGE_KEY);
    if (!cru) return {};
    const parsed: unknown = JSON.parse(cru);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return podar(parsed as ChecklistState);
  } catch {
    // JSON corrompido ou storage bloqueado: começar vazio é melhor que derrubar
    // o painel inteiro por causa do checklist.
    return {};
  }
}

export function saveChecklist(state: ChecklistState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cota estourada / modo privado: o tique vale para a sessão e não persiste.
    // Silencioso de propósito — um toast de erro a cada clique seria pior.
  }
}

export { STORAGE_KEY as CHECKLIST_STORAGE_KEY };

import { formatPhoneBr } from "@/lib/utils";
import type { AdminGroupSource, AdminGroupView, AdminGroupsList } from "../infrastructure/whatsapp-groups-api";
import type { VipGroupStatus, VipStoreSummary } from "../infrastructure/vip-groups-api";

// ─── Abas (?aba= na URL) ─────────────────────────────────────────────────────
export type GroupsTab = "cidades" | "dedicados" | "vip";
const GROUPS_TABS: readonly string[] = ["cidades", "dedicados", "vip"];

export function parseGroupsTab(value: string | null | undefined): GroupsTab {
  return value && GROUPS_TABS.includes(value) ? (value as GroupsTab) : "cidades";
}

// ─── Telefones ───────────────────────────────────────────────────────────────
export const NO_PARTICIPANTS_MESSAGE = "Informe ao menos um número ou cadastre os números padrão.";

/** Campo de telefones (criar, adicionar membros, números padrão): vírgula, ponto e vírgula ou linha. */
export function parsePhonesInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** "Também entram: (11) 91537-5766, …" — null sem números padrão. */
export function alsoJoinText(defaultPhones: string[]): string | null {
  if (defaultPhones.length === 0) return null;
  return `Também entram: ${defaultPhones.map((p) => formatPhoneBr(p)).join(", ")}`;
}

// ─── Bot, origem, contagem ───────────────────────────────────────────────────
export type BotStatus = "in" | "out" | "unknown";

export function botStatus(botInGroup: boolean | null | undefined): BotStatus {
  if (botInGroup === true) return "in";
  if (botInGroup === false) return "out";
  return "unknown";
}

export const BOT_STATUS_LABELS: Record<BotStatus, string> = {
  in: "Bot no grupo",
  out: "Bot fora do grupo",
  unknown: "Não conferido",
};

export type BotFilter = "all" | BotStatus;

export const BOT_FILTER_OPTIONS: Array<{ value: BotFilter; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "in", label: BOT_STATUS_LABELS.in },
  { value: "out", label: BOT_STATUS_LABELS.out },
  { value: "unknown", label: BOT_STATUS_LABELS.unknown },
];

/** O bot precisa estar (ou poder estar) no grupo para adicionar alguém. */
export function canAddMembers(group: Pick<AdminGroupView, "groupJid" | "botInGroup">): boolean {
  return Boolean(group.groupJid) && group.botInGroup !== false;
}

export const SOURCE_LABELS: Record<AdminGroupSource, string> = { PANEL: "Painel", IMPORTED: "Importado" };

export function groupsCountLabel(n: number): string {
  return n === 1 ? "1 grupo" : `${n} grupos`;
}

// ─── Filtros (tudo no cliente) ───────────────────────────────────────────────
function fold(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const byPt = (a: string, b: string) => a.localeCompare(b, "pt-BR");

function matchesBot(botInGroup: boolean | null | undefined, bot: BotFilter): boolean {
  return bot === "all" || botStatus(botInGroup) === bot;
}

export interface CityFilters {
  search: string;
  uf: string;
  city: string;
  bot: BotFilter;
}

export const EMPTY_CITY_FILTERS: CityFilters = { search: "", uf: "", city: "", bot: "all" };

/** Trocar a UF zera a cidade: a lista de cidades depende da UF. */
export function withUf(filters: CityFilters, uf: string): CityFilters {
  return { ...filters, uf, city: "" };
}

export function ufOptions(groups: AdminGroupView[]): string[] {
  const ufs = new Set<string>();
  for (const g of groups) if (g.kind === "CITY" && g.uf) ufs.add(g.uf);
  return [...ufs].sort(byPt);
}

/** Cidades da UF escolhida (sem UF → vazio), sem repetir por acento/caixa (fica a 1ª grafia). */
export function cityOptions(groups: AdminGroupView[], uf: string): string[] {
  if (!uf) return [];
  const byKey = new Map<string, string>();
  for (const g of groups) {
    if (g.kind !== "CITY" || g.uf !== uf || !g.city) continue;
    const key = fold(g.city);
    if (!byKey.has(key)) byKey.set(key, g.city);
  }
  return [...byKey.values()].sort(byPt);
}

export function filterCityGroups(groups: AdminGroupView[], f: CityFilters): AdminGroupView[] {
  const needle = fold(f.search);
  return groups.filter(
    (g) =>
      g.kind === "CITY" &&
      (!needle || fold(g.name).includes(needle)) &&
      (!f.uf || g.uf === f.uf) &&
      (!f.city || fold(g.city) === fold(f.city)) &&
      matchesBot(g.botInGroup, f.bot),
  );
}

export interface DedicatedFilters {
  search: string;
  bot: BotFilter;
}

export const EMPTY_DEDICATED_FILTERS: DedicatedFilters = { search: "", bot: "all" };

export function filterDedicatedGroups(groups: AdminGroupView[], f: DedicatedFilters): AdminGroupView[] {
  const needle = fold(f.search);
  return groups.filter(
    (g) => g.kind === "DEDICATED" && (!needle || fold(g.name).includes(needle)) && matchesBot(g.botInGroup, f.bot),
  );
}

export type VipStateFilter = "all" | Exclude<VipGroupStatus, "NONE">;

export const VIP_STATE_FILTER_OPTIONS: Array<{ value: VipStateFilter; label: string }> = [
  { value: "all", label: "Todos os estados" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "PENDING", label: "Pendente" },
  { value: "FAILED", label: "Falhou" },
];

export interface VipFilters {
  search: string;
  state: VipStateFilter;
  bot: BotFilter;
}

export const EMPTY_VIP_FILTERS: VipFilters = { search: "", state: "all", bot: "all" };

/** A loja já tem grupo VIP (não `NONE`) — usado pra filtrar a lista e decidir o estado vazio da aba. */
export function hasVipGroup(store: Pick<VipStoreSummary, "status">): boolean {
  return store.status !== "NONE";
}

/** Aba VIP: só lojas com grupo (status ≠ NONE); busca por loja (ou nome do grupo), estado e bot. */
export function filterVipStores(stores: VipStoreSummary[], f: VipFilters): VipStoreSummary[] {
  const needle = fold(f.search);
  return stores.filter(
    (s) =>
      hasVipGroup(s) &&
      (!needle || fold(s.storeName).includes(needle) || fold(s.groupName).includes(needle)) &&
      (f.state === "all" || s.status === f.state) &&
      matchesBot(s.botInGroup, f.bot),
  );
}

// ─── "Adicionar em todos os grupos" ──────────────────────────────────────────
export interface ApplyTarget {
  groupJid: string;
  name: string;
}

/**
 * Grupos das três abas com jid e bot não sabidamente fora (`botInGroup !== false`);
 * VIP só com grupo ATIVO. Sem jid repetido.
 */
export function buildApplyTargets(groups: AdminGroupView[], vipStores: VipStoreSummary[]): ApplyTarget[] {
  const out: ApplyTarget[] = [];
  const seen = new Set<string>();
  const push = (groupJid: string | null, name: string) => {
    if (!groupJid || seen.has(groupJid)) return;
    seen.add(groupJid);
    out.push({ groupJid, name });
  };
  for (const g of groups) if (g.botInGroup !== false) push(g.groupJid, g.name);
  for (const s of vipStores) {
    if (s.status === "ACTIVE" && s.botInGroup !== false) push(s.groupJid, s.groupName ?? s.storeName);
  }
  return out;
}

export interface ApplyFailure {
  name: string;
  message: string;
}

/** Um grupo por vez (não martela a bridge); falha num grupo não para os outros. Nunca lança. */
export async function applyPhonesToTargets(
  targets: ApplyTarget[],
  phones: string[],
  add: (input: { groupId: string; participants: string[] }) => Promise<unknown>,
  onProgress: (done: number, total: number) => void,
  describeError: (error: unknown) => string,
): Promise<ApplyFailure[]> {
  const failures: ApplyFailure[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    try {
      await add({ groupId: target.groupJid, participants: phones });
    } catch (error) {
      failures.push({ name: target.name, message: describeError(error) });
    }
    onProgress(i + 1, targets.length);
  }
  return failures;
}

export function progressLabel(done: number, total: number): string {
  return `${done} de ${total}`;
}

export function applySummaryText(total: number, failures: ApplyFailure[]): string {
  const ok = total - failures.length;
  return total === 1 ? `${ok} de 1 grupo recebeu os números.` : `${ok} de ${total} grupos receberam os números.`;
}

// ─── Estado do diretório ─────────────────────────────────────────────────────
export interface DirectoryBanner {
  tone: "red" | "amber";
  text: string;
}

export function directoryBanners(list: Pick<AdminGroupsList, "instance" | "directory">): DirectoryBanner[] {
  const out: DirectoryBanner[] = [];
  if (list.instance.connected === false) {
    out.push({ tone: "red", text: "Instância do WhatsApp desconectada — o status dos grupos pode estar desatualizado." });
  }
  if (!list.directory.ok) {
    out.push({ tone: "amber", text: "Não deu para conferir os grupos agora." });
  }
  return out;
}

/** "Conferido às 14:32" no horário de Brasília; null sem conferência. */
export function checkedAtLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hhmm = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  return `Conferido às ${hhmm}`;
}

// ─── Excluir ─────────────────────────────────────────────────────────────────
export function deleteGroupEffect(botInGroup: boolean | null): string {
  if (botInGroup === false) return "O bot já não está no grupo; ele só sai da lista.";
  return "O bot sai do grupo e ele para de receber vagas. Os membros continuam no grupo. Não dá para desfazer por aqui.";
}

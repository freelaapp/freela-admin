import type { OrientationQueueFilter, QueueStatus } from "@/modules/admin/infrastructure/orientation-api";

/**
 * Filtro da Fila ↔ URL (chaves em português). Só vai para a URL o que foge do
 * padrão (pendentes que acessaram nos últimos 30 dias). Valor inválido cai no padrão.
 */

export const DEFAULT_ACTIVE_DAYS = 30;
const STATUSES: QueueStatus[] = ["PENDING", "BOOKED", "APPROVED", "REJECTED"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function text(sp: URLSearchParams, key: string): string | undefined {
  const v = sp.get(key)?.trim();
  return v ? v : undefined;
}

function yesNo(sp: URLSearchParams, key: string): boolean | undefined {
  const v = sp.get(key);
  return v === "sim" ? true : v === "nao" ? false : undefined;
}

export function queueFilterFromParams(sp: URLSearchParams): OrientationQueueFilter {
  const s = sp.get("situacao");
  const status: QueueStatus = STATUSES.includes(s as QueueStatus) ? (s as QueueStatus) : "PENDING";
  const days = sp.get("ativoEm");
  const n = days !== null && /^\d{1,3}$/.test(days) ? Number(days) : DEFAULT_ACTIVE_DAYS;
  // 0 = sem filtro de atividade; o resto fica entre 1 e 365 dias.
  const activeWithinDays = n === 0 ? 0 : Math.min(365, n);
  const from = text(sp, "cadastroDe");
  const to = text(sp, "cadastroAte");
  const noShows = sp.get("faltas");
  const convoked = sp.get("convocado");

  const f: OrientationQueueFilter = { status, activeWithinDays };
  const uf = text(sp, "uf");
  if (uf && /^[A-Za-z]{2}$/.test(uf)) f.uf = uf.toUpperCase();
  const city = text(sp, "cidade");
  if (city) f.city = city;
  const role = text(sp, "funcao");
  if (role) f.role = role;
  if (from && DAY.test(from)) f.signedUpFrom = from;
  if (to && DAY.test(to)) f.signedUpTo = to;
  const worked = yesNo(sp, "jaTrabalhou");
  if (worked !== undefined) f.workedBefore = worked;
  if (noShows === "NONE" || noShows === "ANY") f.noShows = noShows;
  if (convoked === "NEVER" || convoked === "EVER") f.convoked = convoked;
  if (yesNo(sp, "pediuAviso") !== undefined) f.notifyRequested = yesNo(sp, "pediuAviso");
  return f;
}

export function queueFilterToParams(f: OrientationQueueFilter): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.status && f.status !== "PENDING") sp.set("situacao", f.status);
  if (f.activeWithinDays !== undefined && f.activeWithinDays !== DEFAULT_ACTIVE_DAYS) {
    sp.set("ativoEm", String(f.activeWithinDays));
  }
  if (f.uf) sp.set("uf", f.uf);
  if (f.city) sp.set("cidade", f.city);
  if (f.role) sp.set("funcao", f.role);
  if (f.signedUpFrom) sp.set("cadastroDe", f.signedUpFrom);
  if (f.signedUpTo) sp.set("cadastroAte", f.signedUpTo);
  if (f.workedBefore !== undefined) sp.set("jaTrabalhou", f.workedBefore ? "sim" : "nao");
  if (f.noShows) sp.set("faltas", f.noShows);
  if (f.convoked) sp.set("convocado", f.convoked);
  if (f.notifyRequested !== undefined) sp.set("pediuAviso", f.notifyRequested ? "sim" : "nao");
  return sp;
}

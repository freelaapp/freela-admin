import type {
  VipGroupStatus,
  VipMemberSource,
  VipMemberWhatsappState,
  VipStoreSummary,
  VipSyncResult,
} from "../infrastructure/vip-groups-api";

/** Variantes aceitas pelo `Badge` do painel. */
export type VipBadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export const VIP_GROUP_STATUS_LABELS: Record<VipGroupStatus, string> = {
  NONE: "Sem grupo",
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  FAILED: "Falhou",
};

export function vipGroupStatusVariant(status: VipGroupStatus): VipBadgeVariant {
  if (status === "ACTIVE") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "PENDING") return "warning";
  return "outline";
}

export const VIP_WHATSAPP_STATE_LABELS: Record<VipMemberWhatsappState, string> = {
  PENDING: "Fora do grupo",
  IN_GROUP: "No grupo",
  FAILED: "Falhou",
  REMOVE_PENDING: "Remover no WhatsApp",
};

export function vipWhatsappStateVariant(state: VipMemberWhatsappState): VipBadgeVariant {
  if (state === "IN_GROUP") return "success";
  if (state === "FAILED") return "destructive";
  return "warning";
}

export const VIP_SOURCE_LABELS: Record<VipMemberSource, string> = {
  FUNNEL: "Funil",
  TEAM: "Equipe",
};

export function vipStorePendingSummary(s: Pick<VipStoreSummary, "pendingAdd" | "pendingRemove">): string {
  const parts: string[] = [];
  if (s.pendingAdd > 0) parts.push(`${s.pendingAdd} fora do grupo`);
  if (s.pendingRemove > 0) parts.push(`${s.pendingRemove} para remover no WhatsApp`);
  return parts.length ? parts.join(" · ") : "Tudo em dia";
}

/** Spec §10: lista vazia = vaga pública — a equipe precisa ver isso. */
export const VIP_EMPTY_LIST_WARNING = "Lista vazia: as vagas desta loja estão públicas.";

export function vipEmptyListWarning(activeMembers: number): string | null {
  return activeMembers === 0 ? VIP_EMPTY_LIST_WARNING : null;
}

/** Rótulo do botão de criação do grupo; `null` = grupo ativo, sem botão. */
export function vipGroupActionLabel(status: VipGroupStatus): string | null {
  if (status === "NONE") return "Criar grupo";
  if (status === "FAILED" || status === "PENDING") return "Tentar criar de novo";
  return null;
}

export function vipMembersPendingAdd(members: Array<{ whatsappState: VipMemberWhatsappState }>): number {
  return members.filter((m) => m.whatsappState === "PENDING" || m.whatsappState === "FAILED").length;
}

export function vipEnsureResultMessage(group: { status: VipGroupStatus; lastError: string | null }): {
  ok: boolean;
  text: string;
} {
  if (group.status === "ACTIVE") return { ok: true, text: "Grupo VIP ativo." };
  return { ok: false, text: `Grupo não criado: ${group.lastError ?? "erro no WhatsApp"}` };
}

export function vipSyncResultMessage(r: VipSyncResult): string {
  if (r.attempted === 0) return "Ninguém pendente para adicionar.";
  const base = `${r.added} de ${r.attempted} adicionados ao grupo.`;
  return r.failed > 0 ? `${base} Veja o erro de quem ficou de fora.` : base;
}

export function vipAddResultMessage(member: { whatsappState: VipMemberWhatsappState }): string {
  return member.whatsappState === "IN_GROUP"
    ? "VIP adicionado e colocado no grupo."
    : "VIP adicionado à lista (ainda fora do grupo do WhatsApp).";
}

export function vipRemoveResultMessage(member: { whatsappState: VipMemberWhatsappState }): string {
  return member.whatsappState === "REMOVE_PENDING"
    ? "Tirado da lista. Falta remover no grupo do WhatsApp e marcar “Feito”."
    : "Tirado da lista.";
}

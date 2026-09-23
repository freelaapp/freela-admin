import type { AdminPermission } from "@/modules/auth/domain/permissions";

/** Permissões que dão acesso à área Freela VIP (qualquer uma). */
export const VIP_PERMISSIONS_ANY = ["VIP_ADMIN", "VIP_READONLY", "VIP_BACKGROUND"] as const;

export interface VipRole {
  /** Opera o funil (ciclos, convites, mover, aprovar/reprovar, config). */
  canAdmin: boolean;
  /** Vê certidões e decide apto/não apto. */
  canBackground: boolean;
  /** Sem PII e sem ações do funil (leitura ou só-antecedentes). */
  readOnly: boolean;
  /** Entra na área. */
  canView: boolean;
}

/**
 * Papel VIP a partir do `hasPermission` da sessão. Puro: a UI esconde o que o
 * papel não permite, mas a API continua a autoridade (um 403 vira toast).
 */
export function vipRoleFromPermissions(has: (p: AdminPermission) => boolean): VipRole {
  const canAdmin = has("VIP_ADMIN");
  const canBackground = has("VIP_BACKGROUND");
  const canRead = has("VIP_READONLY");
  return {
    canAdmin,
    canBackground,
    readOnly: !canAdmin,
    canView: canAdmin || canBackground || canRead,
  };
}

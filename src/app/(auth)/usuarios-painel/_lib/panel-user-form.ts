/**
 * Funções puras da tela "Usuários do painel": formulário de edição → payload da
 * API, e a regra de quando o botão de excluir fica travado. Nada aqui toca DOM,
 * rede ou estado.
 */
import type { AdminRole } from "@/modules/auth/domain/permissions";
import type {
  PanelUser,
  UpdatePanelUserPayload,
} from "@/modules/admin/infrastructure/panel-users-api";
import {
  formatPhoneMask,
  nationalPhoneDigits,
  parseBrPhone,
} from "@/modules/consultant/application/phone-mask";

export interface PanelUserFormState {
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  permissions: string[];
}

export const EMPTY_PANEL_USER_FORM: PanelUserFormState = {
  name: "",
  email: "",
  phone: "",
  role: "ADMIN",
  permissions: [],
};

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; error: string };

const KNOWN_ROLES: AdminRole[] = ["ADMIN", "SUPER_ADMIN", "RECRUITER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPanelUserDeleted(row: Pick<PanelUser, "deletedAt">): boolean {
  return !!row.deletedAt;
}

/** Usuário → formulário de edição. O papel real é mantido (recrutador não vira Admin). */
export function panelUserToForm(row: PanelUser): PanelUserFormState {
  return {
    name: row.name ?? "",
    email: row.email,
    phone: formatPhoneMask(row.phone ?? ""),
    role: KNOWN_ROLES.includes(row.role as AdminRole) ? (row.role as AdminRole) : "ADMIN",
    permissions: [...row.permissions],
  };
}

/**
 * Edição → PATCH. E-mail e telefone só vão quando MUDARAM: um telefone legado
 * torto e intocado não trava a edição dos outros campos (mesma regra de
 * consultores e empresas). Telefone apagado vai vazio (a API limpa).
 */
export function buildPanelUserUpdatePayload(
  values: PanelUserFormState,
  original: PanelUser,
): BuildResult<UpdatePanelUserPayload> {
  const name = values.name.trim();
  if (name.length < 2) return { ok: false, error: "Informe o nome do usuário." };

  const email = values.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe o e-mail (login do painel)." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
  const emailChanged = email !== original.email.trim().toLowerCase();

  const phoneDigits = nationalPhoneDigits(values.phone);
  const phoneChanged = phoneDigits !== nationalPhoneDigits(original.phone ?? "");
  let phone: string | undefined;
  if (phoneChanged) {
    if (!phoneDigits) {
      phone = "";
    } else {
      const parsed = parseBrPhone(values.phone, { allowLandline: true });
      if (parsed.ok === false) return { ok: false, error: parsed.message };
      phone = parsed.e164;
    }
  }

  return {
    ok: true,
    payload: {
      name,
      ...(emailChanged ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      role: values.role,
      // Super Admin tem tudo por definição — mandar lista só confundiria a API.
      permissions: values.role === "SUPER_ADMIN" ? [] : values.permissions,
    },
  };
}

/**
 * Por que o botão de excluir fica travado (null = pode excluir). A API recusa do
 * mesmo jeito (403 / 409 LAST_SUPER_ADMIN); aqui só evitamos oferecer.
 */
export function panelUserDeleteBlock(
  row: PanelUser,
  selfId: string | undefined,
  users: PanelUser[],
): string | null {
  if (selfId && row.id === selfId) return "Você não pode excluir o seu próprio usuário";
  const isActiveSuper = (u: PanelUser) =>
    u.role === "SUPER_ADMIN" && u.isActive && !isPanelUserDeleted(u);
  if (isActiveSuper(row) && !users.some((u) => u.id !== row.id && isActiveSuper(u))) {
    return "É o último super admin ativo — promova outra pessoa antes";
  }
  return null;
}

/**
 * Funções puras do "Editar dados" da tela Usuários (nome, e-mail de login,
 * telefone). Só vai para a API o que MUDOU — um telefone legado torto e
 * intocado não trava a correção do nome (mesma regra de consultores/empresas).
 */
import type { UpdateUserBasicDataPayload } from "@/modules/admin/infrastructure/admin-api";
import {
  formatPhoneMask,
  nationalPhoneDigits,
  parseBrPhone,
} from "@/modules/consultant/application/phone-mask";

export interface UserEditFormValues {
  name: string;
  email: string;
  phone: string;
}

export interface UserEditOriginal {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function userToEditForm(u: UserEditOriginal): UserEditFormValues {
  return {
    name: u.name ?? "",
    email: u.email ?? "",
    phone: formatPhoneMask(u.phone ?? ""),
  };
}

export function buildUserUpdatePayload(
  values: UserEditFormValues,
  original: UserEditOriginal,
): BuildResult<UpdateUserBasicDataPayload> {
  const payload: UpdateUserBasicDataPayload = {};

  const name = values.name.trim();
  if (name !== (original.name ?? "").trim()) {
    if (name.length < 2) return { ok: false, error: "Informe o nome (mínimo 2 letras)." };
    payload.name = name;
  }

  const email = values.email.trim().toLowerCase();
  const originalEmail = (original.email ?? "").trim().toLowerCase();
  if (email !== originalEmail) {
    if (!email) return { ok: false, error: "Informe o e-mail." };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
    payload.email = email;
  }

  const phoneDigits = nationalPhoneDigits(values.phone);
  if (phoneDigits !== nationalPhoneDigits(original.phone ?? "")) {
    if (!phoneDigits) {
      payload.phone = null;
    } else {
      // `users.phone` é login e WhatsApp: celular, como no cadastro.
      const parsed = parseBrPhone(values.phone);
      if (parsed.ok === false) return { ok: false, error: parsed.message };
      payload.phone = parsed.e164;
    }
  }

  if (Object.keys(payload).length === 0) return { ok: false, error: "Nada para alterar." };
  return { ok: true, payload };
}

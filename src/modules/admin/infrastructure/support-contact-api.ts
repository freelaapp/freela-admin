import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const adminsApi = createAuthedClient("/v1/admins");

export interface SupportContactView {
  whatsappE164: string;
  display: string;
  whatsappUrl: string;
  /** Sempre preenchido: o salvo ou o padrão do sistema. */
  email: string;
  /** Ninguém salvou e-mail ainda: vale o padrão do sistema. */
  emailIsDefault: boolean;
  /** Ninguém salvou ainda: vale o número padrão do sistema. */
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string | null } | null;
}

export async function getSupportContact(): Promise<SupportContactView> {
  const res = await adminsApi.get("/support-contact");
  return res.data.data;
}

/** Só o que veio é gravado: PUT só com e-mail não mexe no WhatsApp e vice-versa. */
export async function updateSupportContact(patch: {
  whatsapp?: string;
  email?: string;
}): Promise<SupportContactView> {
  const res = await adminsApi.put("/support-contact", patch);
  return res.data.data;
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const adminsApi = createAuthedClient("/v1/admins");

export interface SupportContactView {
  whatsappE164: string;
  display: string;
  whatsappUrl: string;
  /** Ninguém salvou ainda: vale o número padrão do sistema. */
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string | null } | null;
}

export async function getSupportContact(): Promise<SupportContactView> {
  const res = await adminsApi.get("/support-contact");
  return res.data.data;
}

export async function updateSupportContact(whatsapp: string): Promise<SupportContactView> {
  const res = await adminsApi.put("/support-contact", { whatsapp });
  return res.data.data;
}

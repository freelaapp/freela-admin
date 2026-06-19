import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const whatsappApi = createAuthedClient("/v1/admins/vacancy-group-routes");

/**
 * Routing is fully automatic from the WhatsApp group names ("Vagas <Cidade> <UF>"),
 * so the admin panel is read-only diagnostics: which groups were recognized and
 * which are off-pattern (and therefore unreachable by routing).
 */
export interface GroupDiagnostic {
  jid: string;
  name: string;
  participants: number | null;
  city: string | null;
  uf: string | null;
  recognized: boolean;
}

export async function getGroupDiagnostics(): Promise<GroupDiagnostic[]> {
  const res = await whatsappApi.get("/diagnostics");
  return res.data.data;
}

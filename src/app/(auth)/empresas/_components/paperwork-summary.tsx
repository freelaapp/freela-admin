"use client";

import { useAdminContractorSettings } from "@/modules/admin/application/use-admin-contractor-settings";
import { paperworkSummary } from "../_lib/paperwork-presentation";

/**
 * "Documentos: tudo ligado" / "Documentos: contrato desligado" no modal
 * "Detalhes da Empresa" (UX 5.2). A linha de "Cobrança" entra na Fase 3.
 */
export function PaperworkSummary({ contractorUserId }: { contractorUserId: string }) {
  const { data, isLoading, isError } = useAdminContractorSettings(contractorUserId);
  const text = isLoading
    ? "carregando…"
    : isError || !data
      ? "não foi possível carregar"
      : paperworkSummary(data);
  return <span>{`Documentos: ${text}`}</span>;
}

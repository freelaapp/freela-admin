"use client";

import { formatInstantDate } from "@/lib/date.utils";
import { useAdminContractorSettings } from "@/modules/admin/application/use-admin-contractor-settings";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import { BILLING_MODE_SHORT, currentModeLabel } from "../_lib/billing-presentation";
import { paperworkSummary } from "../_lib/paperwork-presentation";

/**
 * "Documentos: tudo ligado" / "Documentos: contrato desligado" no modal
 * "Detalhes da Empresa" (UX 5.2). A linha de "Cobrança" entra na Fase 3.
 */
/**
 * "Cobrança: Faturado semanal desde 11/10/2026" no "Detalhes da Empresa" (UX
 * 5.2). O modo vem da lista (API-3e); sem ele (API anterior), das preferências.
 */
export function BillingModeSummary({
  contractorUserId,
  company,
}: {
  contractorUserId: string;
  company: Pick<ContractorItem, "billingMode" | "billingModeLabel" | "billingModeSince">;
}) {
  const { data } = useAdminContractorSettings(contractorUserId);
  const mode = company.billingMode ?? data?.billingMode ?? "PREPAID";
  if (mode === "PREPAID") return <span>{`Cobrança: ${currentModeLabel("PREPAID")}`}</span>;
  const label = company.billingModeLabel ?? BILLING_MODE_SHORT[mode];
  const since = company.billingModeSince
    ? ` desde ${formatInstantDate(company.billingModeSince)}`
    : "";
  return <span>{`Cobrança: ${label}${since}`}</span>;
}

export function PaperworkSummary({ contractorUserId }: { contractorUserId: string }) {
  const { data, isLoading, isError } = useAdminContractorSettings(contractorUserId);
  const text = isLoading
    ? "carregando…"
    : isError || !data
      ? "não foi possível carregar"
      : paperworkSummary(data);
  return <span>{`Documentos: ${text}`}</span>;
}

import { Lock, Receipt } from "lucide-react";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import { BILLING_MODE_SHORT } from "../_lib/billing-presentation";

/**
 * Selo ao lado do nome na tabela de Empresas (UX 5.2, pedido 9.9): "Faturado
 * semanal" ou "Faturado semanal · bloqueada". Pré-pago (o padrão) não tem selo.
 * Ícone e texto, nunca só a cor.
 */
export function BillingBadge({
  company,
}: {
  company: Pick<ContractorItem, "billingMode" | "billingModeLabel" | "billingStanding">;
}) {
  const mode = company.billingMode;
  if (!mode || mode === "PREPAID") return null;
  const label = company.billingModeLabel ?? BILLING_MODE_SHORT[mode];
  const blocked = company.billingStanding?.blocked === true;
  const Icon = blocked ? Lock : Receipt;
  return (
    <span
      className={
        blocked
          ? "inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-medium text-[#b91c1c]"
          : "inline-flex items-center gap-1 rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[11px] font-medium text-[#b45309]"
      }
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {blocked ? `${label} · bloqueada` : label}
    </span>
  );
}

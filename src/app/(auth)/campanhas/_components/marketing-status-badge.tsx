import type { MarketingTemplateStatus } from "@/modules/admin/infrastructure/marketing-templates-api";
import { MARKETING_STATUS_LABEL } from "../_lib/marketing-template-rules";

/** Cores do mockup validado (Em análise âmbar, Aprovado verde, Recusado vermelho…). */
const STATUS_CLASS: Record<MarketingTemplateStatus, string> = {
  DRAFT: "bg-gray-200 text-gray-900",
  PENDING: "bg-amber-200 text-amber-900",
  APPROVED: "bg-green-200 text-green-900",
  REJECTED: "bg-red-200 text-red-900",
  PAUSED: "bg-orange-200 text-orange-900",
  DISABLED: "bg-red-200 text-red-900",
  ARCHIVED: "bg-neutral-100 text-neutral-500",
};

export function MarketingStatusBadge({
  status,
}: {
  status: MarketingTemplateStatus;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {MARKETING_STATUS_LABEL[status]}
    </span>
  );
}

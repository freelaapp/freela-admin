import type { CampaignStatus } from "@/modules/admin/infrastructure/referrals-api";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  RUNNING: "Disparando",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const STATUS_CLASS: Record<CampaignStatus, string> = {
  DRAFT: "bg-neutral-200 text-neutral-700",
  SCHEDULED: "bg-violet-100 text-violet-800",
  RUNNING: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-neutral-200 text-neutral-500",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  );
}

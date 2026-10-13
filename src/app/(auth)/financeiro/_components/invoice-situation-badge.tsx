import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Lock,
  LockOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  situationStyle,
  type SituationIcon,
  type SituationTone,
} from "@/modules/admin/application/invoice-presentation";
import type { AdminInvoiceSituation } from "@/modules/admin/infrastructure/billing-api";

const ICONS: Record<SituationIcon, LucideIcon> = {
  calendar: CalendarClock,
  clock: Clock,
  alert: AlertTriangle,
  lock: Lock,
  unlock: LockOpen,
  check: CheckCircle2,
  ban: Ban,
};

/** Tokens que passam AA em texto pequeno (UX 0.5). */
const TONES: Record<SituationTone, string> = {
  neutral: "border-[#e5e5e5] bg-white text-[#1d1d1b]",
  warning: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
  danger: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
  success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
  muted: "border-[#e5e5e5] bg-[#f7f7f7] text-[#525252]",
};

/** Situação da fatura com ícone e texto (o texto vem pronto da API, UX 7.7). */
export function InvoiceSituationBadge({
  situation,
  className,
}: {
  situation: AdminInvoiceSituation;
  className?: string;
}) {
  const { tone, icon } = situationStyle(situation.code);
  const Icon = ICONS[icon];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {situation.label}
    </span>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BOT_STATUS_LABELS, botStatus } from "@/modules/admin/application/whatsapp-groups-presentation";

const VARIANT = { in: "success", out: "destructive", unknown: "outline" } as const;

/** Verde "Bot no grupo" · vermelho "Bot fora do grupo" · cinza "Não conferido". */
export function BotStatusBadge({ botInGroup }: { botInGroup: boolean | null | undefined }) {
  const status = botStatus(botInGroup);
  return (
    <Badge
      variant={VARIANT[status]}
      className={cn("w-fit whitespace-nowrap", status === "unknown" && "bg-[#f5f5f5] text-[#737373]")}
    >
      {BOT_STATUS_LABELS[status]}
    </Badge>
  );
}

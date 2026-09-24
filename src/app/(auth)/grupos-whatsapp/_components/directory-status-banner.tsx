"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkedAtLabel, directoryBanners } from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupsList } from "@/modules/admin/infrastructure/whatsapp-groups-api";

const TONE = {
  red: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700",
  amber: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800",
} as const;

export function DirectoryStatusBanner({
  list,
  onRefresh,
  refreshing,
}: {
  list: AdminGroupsList;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const checked = checkedAtLabel(list.directory.checkedAt);
  return (
    <div className="flex flex-col gap-2">
      {directoryBanners(list).map((b) => (
        <div key={b.text} role="status" className={TONE[b.tone]}>
          {b.text}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#737373]">
        <span>{checked ?? "Os grupos ainda não foram conferidos no WhatsApp."}</span>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Atualizar
        </Button>
      </div>
    </div>
  );
}

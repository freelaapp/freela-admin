"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado de erro padrão das telas VIP: mensagem curta + repetir. */
export function QueryError({
  message = "Não foi possível carregar os dados.",
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 text-red-700 ${compact ? "px-3 py-2 text-[12px]" : "px-4 py-3 text-[13px]"}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-[12rem]">{message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}

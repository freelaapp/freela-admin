import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn("flex h-[60vh] items-center justify-center", className)}>
      <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
    </div>
  );
}

export function ErrorBox({
  message = "Não foi possível carregar os números.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:flex-row sm:items-center"
    >
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}

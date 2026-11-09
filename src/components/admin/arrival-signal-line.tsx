import type { AdminArrivalSignal } from "@/modules/admin/infrastructure/arrival-signal.types";

/**
 * Uma linha discreta com o sinal de chegada ("Chegou às 17h32, a 80 m (app)"). O texto vem pronto
 * da API. Sem dado (campo ausente, `null` ou texto vazio), nada aparece.
 */
export function ArrivalSignalLine({
  signal,
  className = "",
}: {
  signal: Pick<AdminArrivalSignal, "text"> | null | undefined;
  className?: string;
}) {
  const text = signal?.text?.trim();
  if (!text) return null;
  return (
    <p data-testid="arrival-signal" className={`text-xs text-[#737373] ${className}`.trim()}>
      {text}
    </p>
  );
}

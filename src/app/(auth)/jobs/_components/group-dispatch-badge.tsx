import {
  dispatchBadge,
  type DispatchTone,
} from "@/modules/admin/domain/group-broadcast";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";

const TOM: Record<DispatchTone, string> = {
  green: "text-green-700",
  blue: "text-blue-700",
  amber: "text-amber-700",
  red: "text-red-600",
  gray: "text-[#737373]",
};

/**
 * Selo da divulgação nos grupos (só a última rodada): `✓ 4 grupos · auto 09:12`,
 * `⚠ 3 de 4 grupos · 09:12`, `✗ Falhou · 09:12`, `✗ Não divulgada`, `✓ enviado`.
 * A conta vai no `title`. Usado na coluna "Disparo" e, no celular, como 2ª
 * linha embaixo do Status.
 */
export function GroupDispatchBadge({
  record,
  vacancyBroadcastAt,
  className = "",
}: {
  record: OutreachRecord | undefined;
  /** `groupBroadcastAt` da vaga (vaga antiga pode ter saído sem registro na coluna). */
  vacancyBroadcastAt?: string | null;
  className?: string;
}) {
  const selo = dispatchBadge(record, vacancyBroadcastAt);
  return (
    <span
      className={`whitespace-nowrap text-xs font-medium ${TOM[selo.tone]} ${className}`}
      title={selo.title}
      data-testid="group-dispatch-badge"
    >
      {selo.text}
      {/* Espaço de verdade (não só margem): o leitor de tela lê "auto 09:12". */}
      {selo.time && (
        <>
          {" "}
          <span className="font-normal tabular-nums text-[#737373]">{selo.time}</span>
        </>
      )}
    </span>
  );
}

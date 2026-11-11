"use client";

import { formatCount, formatSessionShort } from "@/modules/admin/application/orientation-presentation";
import { useOrientationConvocations } from "@/modules/admin/application/use-orientation";
import type { ConvocationProgress } from "@/modules/admin/infrastructure/orientation-api";

function Item({ c }: { c: ConvocationProgress }) {
  const left = c.requestedCount - c.queued;
  const parts = [
    `${formatCount(c.sent)} enviadas`,
    `${formatCount(c.pending)} na fila`,
    `${formatCount(c.skipped)} puladas`,
    ...(c.parked > 0 ? [`${formatCount(c.parked)} a conferir`] : []),
  ];
  return (
    <li className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px]">
      <p className="font-medium text-[#1d1d1b]">
        {c.kind === "NOTIFY_REQUEST" ? "Pedidos de aviso" : "Convocação"} de {formatSessionShort(c.createdAt)}
        {c.requestedByName ? ` · ${c.requestedByName}` : ""}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[#525252]">
        <span>Enviadas: {formatCount(c.sent)}</span>
        <span>Na fila: {formatCount(c.pending)}</span>
        <span>Puladas: {formatCount(c.skipped)}</span>
        {c.parked > 0 && <span>A conferir: {formatCount(c.parked)}</span>}
      </p>
      <p className="mt-1 text-xs text-[#737373]">
        {formatCount(c.queued)} na lista = {parts.join(" + ")}
        {left > 0
          ? `. ${formatCount(c.requestedCount)} pedidas, ${formatCount(left)} ficaram de fora (já estavam na fila ou deixaram de poder receber).`
          : "."}
      </p>
    </li>
  );
}

/** Convocações recentes e o andamento do envio (relê a cada 30 s enquanto houver gente esperando). */
export function ConvocationsProgress() {
  const q = useOrientationConvocations();
  return (
    <section aria-label="Convocações recentes" className="space-y-2">
      <h2 className="text-base font-semibold text-[#1d1d1b]">Convocações recentes</h2>
      {q.isError ? (
        <p className="text-sm text-[#737373]">
          Não consegui carregar as convocações.{" "}
          <button type="button" className="underline" onClick={() => void q.refetch()}>
            Tentar de novo
          </button>
        </p>
      ) : !q.data ? (
        <p className="text-sm text-[#737373]">Carregando…</p>
      ) : q.data.length === 0 ? (
        <p className="text-sm text-[#737373]">Nenhuma convocação ainda.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((c) => (
            <Item key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

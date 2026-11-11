"use client";

import { Button } from "@/components/ui/button";
import { brasiliaDateKey, formatCount, whatsappUrlFromPhone } from "@/modules/admin/application/orientation-presentation";
import type { QueueRow, QueueStatus } from "@/modules/admin/infrastructure/orientation-api";

const STATUS_TEXT: Record<QueueStatus, string> = {
  PENDING: "Pendente",
  BOOKED: "Aula marcada",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

function dayBr(key: string | null): string {
  if (!key) return "—";
  const [y, m, d] = key.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const NO_INVITE = "Sem convite: cadastro antigo";

function place(r: QueueRow): string {
  return [r.city, r.uf].filter(Boolean).join(" - ") || "—";
}

interface Props {
  rows: QueueRow[];
  total: number;
  page: number;
  pageSize: number;
  isFetching: boolean;
  /** Lista ainda trocando (mostrando a anterior): ninguém marca nada até chegar a nova. */
  busy: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onPage: (page: number) => void;
}

/** Pessoas da página atual. Tabela no computador, cartões no celular. Seleção só dentro da página. */
export function QueuePeople({ rows, total, page, pageSize, isFetching, busy, selected, onToggle, onToggleAll, onPage }: Props) {
  const selectable = rows.filter((r) => r.providerGlobalId).map((r) => r.providerGlobalId as string);
  const selectedOnPage = selectable.filter((id) => selected.has(id)).length;
  const allChecked = selectable.length > 0 && selectedOnPage === selectable.length;
  const partial = selectedOnPage > 0 && !allChecked;
  const selectAllOff = busy || selectable.length === 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const name = (r: QueueRow) => r.name?.trim() || "Sem nome";

  const check = (r: QueueRow) => (
    <input
      type="checkbox"
      className="h-5 w-5 md:h-4 md:w-4"
      aria-label={`Selecionar ${name(r)}`}
      disabled={busy || !r.providerGlobalId}
      aria-describedby={r.providerGlobalId ? undefined : `sem-convite-${r.userId}`}
      checked={!!r.providerGlobalId && selected.has(r.providerGlobalId)}
      onChange={() => r.providerGlobalId && onToggle(r.providerGlobalId)}
    />
  );
  const reason = (r: QueueRow) =>
    r.providerGlobalId ? null : (
      <p id={`sem-convite-${r.userId}`} className="text-xs text-[#a16207]">
        {NO_INVITE}
      </p>
    );
  const whats = (r: QueueRow) => {
    const url = whatsappUrlFromPhone(r.phone);
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        {r.phone}
      </a>
    ) : (
      <span>{r.phone ?? "—"}</span>
    );
  };

  return (
    <div className={isFetching ? "opacity-70" : ""}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[#525252]">
        <span>{formatCount(total)} {total === 1 ? "pessoa" : "pessoas"}</span>
        {selected.size > 0 && (
          <span aria-live="polite">
            {selected.size === 1 ? "1 selecionado nesta página" : `${formatCount(selected.size)} selecionados nesta página`}
          </span>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white md:block">
        <table className="w-full text-[13px]">
          <thead className="bg-[#fafafa] text-left text-xs text-[#737373]">
            <tr>
              <th scope="col" className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  ref={(el) => {
                    if (el) el.indeterminate = partial;
                  }}
                  disabled={selectAllOff}
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th scope="col" className="px-3 py-2">Nome</th>
              <th scope="col" className="px-3 py-2">Telefone</th>
              <th scope="col" className="px-3 py-2">Cidade</th>
              <th scope="col" className="px-3 py-2">Funções</th>
              <th scope="col" className="px-3 py-2">Cadastro</th>
              <th scope="col" className="px-3 py-2">Serviços</th>
              <th scope="col" className="px-3 py-2">Último acesso</th>
              <th scope="col" className="px-3 py-2">Faltas</th>
              <th scope="col" className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className="px-3 py-2">{check(r)}</td>
                <td className="px-3 py-2 font-medium text-[#1d1d1b]">{name(r)}{reason(r)}</td>
                <td className="px-3 py-2">{whats(r)}</td>
                <td className="px-3 py-2">{place(r)}</td>
                <td className="px-3 py-2">{r.roles.join(", ") || "—"}</td>
                <td className="px-3 py-2">{dayBr(brasiliaDateKey(r.signedUpAt) || null)}</td>
                <td className="px-3 py-2 tabular-nums">{r.totalCompletedServices}</td>
                <td className="px-3 py-2">{dayBr(r.lastActiveDay)}</td>
                <td className="px-3 py-2 tabular-nums">{r.noShows}</td>
                <td className="px-3 py-2">{STATUS_TEXT[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        <label className="flex min-h-11 items-center gap-2 text-sm text-[#525252]">
          <input
            type="checkbox"
            className="h-5 w-5"
            aria-label="Selecionar todos da página"
            ref={(el) => {
              if (el) el.indeterminate = partial;
            }}
            disabled={selectAllOff}
            checked={allChecked}
            onChange={(e) => onToggleAll(e.target.checked)}
          />
          Selecionar todos da página
        </label>
        {rows.map((r) => (
          <div key={r.userId} className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px]">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-[#1d1d1b]">{name(r)}</p>
              {check(r)}
            </div>
            <div className="mt-1 space-y-0.5 text-[#525252]">
              <p>{place(r)} · {r.roles.join(", ") || "sem função"}</p>
              <p>{whats(r)}</p>
              <p>Serviços: {r.totalCompletedServices} · Faltas: {r.noShows}</p>
              <p>Último acesso: {dayBr(r.lastActiveDay)}</p>
              <p>{STATUS_TEXT[r.status] ?? r.status}</p>
              {reason(r)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Página anterior
        </Button>
        <span className="text-sm text-[#525252]">Página {page} de {pages}</span>
        <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima página
        </Button>
      </div>
    </div>
  );
}

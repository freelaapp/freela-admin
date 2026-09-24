"use client";

import { useId, useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react";

/**
 * Papel da coluna no cartão do celular (abaixo de `md`, spec 2026-09-24 §D).
 * Sem isto: a 1ª coluna é o título; header "Ações" ou vazio vai para o rodapé;
 * o resto vira "Rótulo: valor". `hide` tira a coluna só do cartão.
 */
export type ColumnMobileRole = "title" | "hide" | "actions";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  className?: string;
  mobile?: ColumnMobileRole;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  filters?: React.ReactNode;
  footer?: React.ReactNode;
  defaultSort?: { index: number; direction: "asc" | "desc" };
  controlledSearch?: { value: string; onChange: (v: string) => void };
  isFetching?: boolean;
}

type SortState = { index: number; direction: "asc" | "desc" };

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR");
}

/** Como as colunas se distribuem no cartão do celular. */
export function planMobileCard<T>(columns: Column<T>[]): {
  title: number | null;
  fields: number[];
  actions: number[];
} {
  const isActions = (col: Column<T>) => {
    if (col.mobile) return col.mobile === "actions";
    const header = col.header.trim().toLowerCase();
    return header === "" || header === "ações";
  };
  const visible = columns
    .map((col, index) => ({ col, index }))
    .filter(({ col }) => col.mobile !== "hide");
  const actions = visible.filter(({ col }) => isActions(col)).map(({ index }) => index);
  const content = visible.filter(({ col }) => !isActions(col));
  const title = (content.find(({ col }) => col.mobile === "title") ?? content[0])?.index ?? null;
  const fields = content.map(({ index }) => index).filter((index) => index !== title);
  return { title, fields, actions };
}

function renderCell<T>(col: Column<T>, row: T): React.ReactNode {
  return typeof col.accessor === "function" ? col.accessor(row) : String(row[col.accessor] ?? "");
}

function parseSortValue(value: string): SortState | null {
  const [index, direction] = value.split(":");
  if (!index || (direction !== "asc" && direction !== "desc")) return null;
  return { index: Number(index), direction };
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  searchPlaceholder = "Buscar...",
  searchKey,
  filters,
  footer,
  defaultSort,
  controlledSearch,
  isFetching = false,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(defaultSort ?? null);
  const isControlled = !!controlledSearch;
  const search = isControlled ? controlledSearch.value : internalSearch;
  const setSearch = isControlled ? controlledSearch.onChange : setInternalSearch;

  const filteredData = useMemo(() => {
    if (isControlled || !searchKey) return data;
    const needle = search.toLowerCase();
    return data.filter((row) =>
      String(row[searchKey] ?? "").toLowerCase().includes(needle),
    );
  }, [data, searchKey, search, isControlled]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const col = columns[sort.index];
    if (!col?.sortAccessor) return filteredData;
    const arr = [...filteredData];
    arr.sort((a, b) => {
      const cmp = compareValues(col.sortAccessor!(a), col.sortAccessor!(b));
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredData, sort, columns]);

  const toggleSort = (index: number) => {
    setSort((prev) => {
      if (!prev || prev.index !== index) return { index, direction: "asc" };
      if (prev.direction === "asc") return { index, direction: "desc" };
      return null;
    });
  };

  const sortSelectId = useId();
  const card = planMobileCard(columns);
  const sortOptions = columns
    .map((col, index) => ({ col, index }))
    .filter(({ col }) => col.sortable && col.sortAccessor);
  const rowKey = (row: T, rowIdx: number) => String((row as { id?: string | number }).id ?? rowIdx);

  return (
    <div className="bg-white rounded-xl border border-[#e5e5e5]">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-[#e5e5e5]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
        </div>
        {filters}
      </div>

      {/* Table + cartões compartilham um único overlay/pill de carregamento
          (fix round 1, 2026-09-24): antes ele vivia só dentro do wrapper
          desktop (`hidden md:block`) e nunca aparecia no celular, onde a
          lista vazia dizia "Nenhum resultado encontrado." mesmo durante o
          1º carregamento (financeiro, diálogo de destinatários da campanha,
          seguro). Agora o wrapper relative cobre as duas árvores. */}
      <div className="relative">
        {/* Table */}
        <div className="hidden overflow-x-auto md:block" data-testid="data-table-desktop">
          <table
            className={`w-full text-sm transition-[filter,opacity] duration-200 ${
              isFetching && sortedData.length > 0 ? "blur-[2px] opacity-60 pointer-events-none" : ""
            }`}
          >
            <thead>
              <tr className="border-b border-[#e5e5e5]">
                {columns.map((col, i) => {
                  const isSortable = !!col.sortable && !!col.sortAccessor;
                  const active = sort?.index === i;
                  return (
                    <th
                      key={i}
                      onClick={isSortable ? () => toggleSort(i) : undefined}
                      className={`px-4 py-3 text-left font-medium text-[#737373] ${
                        isSortable
                          ? "cursor-pointer select-none hover:text-[#1d1d1b]"
                          : ""
                      } ${col.className || ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {isSortable &&
                          (active ? (
                            sort!.direction === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#eca826]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#eca826]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 text-[#a3a3a3]" />
                          ))}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr
                  key={rowKey(row, rowIdx)}
                  className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f7f7f7] transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 ${col.className || ""}`}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
              {sortedData.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-[#737373]"
                  >
                    {isFetching ? "Carregando…" : "Nenhum resultado encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Cartões: abaixo de md (spec 2026-09-24 §D) — mesma lista, busca e ordenação. */}
        <div className="md:hidden" data-testid="data-table-cards">
          {sortOptions.length > 0 && (
            <div className="flex items-center gap-2 border-b border-[#e5e5e5] px-4 py-3">
              <label htmlFor={sortSelectId} className="shrink-0 text-xs font-medium text-[#737373]">
                Ordenar por
              </label>
              <select
                id={sortSelectId}
                value={sort ? `${sort.index}:${sort.direction}` : ""}
                onChange={(e) => setSort(parseSortValue(e.target.value))}
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
              >
                <option value="">Padrão</option>
                {sortOptions.flatMap(({ col, index }) => [
                  <option key={`${index}:asc`} value={`${index}:asc`}>
                    {col.header} (crescente)
                  </option>,
                  <option key={`${index}:desc`} value={`${index}:desc`}>
                    {col.header} (decrescente)
                  </option>,
                ])}
              </select>
            </div>
          )}
          {sortedData.length > 0 ? (
            <ul
              className={`flex flex-col gap-2 p-3 transition-[filter,opacity] duration-200 ${
                isFetching ? "blur-[2px] opacity-60 pointer-events-none" : ""
              }`}
            >
              {sortedData.map((row, rowIdx) => (
                <li key={rowKey(row, rowIdx)} className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm">
                  {card.title !== null && (
                    <div className="break-words font-semibold text-[#1d1d1b]">
                      {renderCell(columns[card.title], row)}
                    </div>
                  )}
                  {card.fields.length > 0 && (
                    <dl className="mt-2 space-y-1.5">
                      {card.fields.map((index) => (
                        <div key={index} className="flex items-start justify-between gap-3">
                          <dt className="shrink-0 text-xs text-[#737373]">{columns[index].header}</dt>
                          <dd className="min-w-0 break-words text-right text-[#1d1d1b]">
                            {renderCell(columns[index], row)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {card.actions.length > 0 && (
                    <div
                      data-testid="data-table-card-actions"
                      className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#f2f2f2] pt-2 [&_a]:min-h-10 [&_button]:inline-flex [&_button]:min-h-10 [&_button]:min-w-10 [&_button]:items-center [&_button]:justify-center"
                    >
                      {card.actions.map((index) => (
                        <div key={index}>{renderCell(columns[index], row)}</div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : isFetching ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-[#737373]">
              <Loader2 className="h-4 w-4 animate-spin text-[#eca826]" />
              <span className="text-xs font-medium">Carregando…</span>
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-[#737373]">Nenhum resultado encontrado.</p>
          )}
        </div>
        {isFetching && sortedData.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 border border-[#e5e5e5] shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-[#eca826]" />
              <span className="text-xs font-medium text-[#737373]">Carregando…</span>
            </div>
          </div>
        )}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-[#e5e5e5]">{footer}</div>
      )}
    </div>
  );
}

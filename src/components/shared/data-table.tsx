"use client";

import { useMemo, useState } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortAccessor?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  className?: string;
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

      {/* Table */}
      <div className="relative overflow-x-auto">
        <table
          className={`w-full text-sm transition-[filter,opacity] duration-200 ${
            isFetching ? "blur-[2px] opacity-60 pointer-events-none" : ""
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
                key={String((row as { id?: string | number }).id ?? rowIdx)}
                className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f7f7f7] transition-colors"
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className={`px-4 py-3 ${col.className || ""}`}
                  >
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? "")}
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
                  Nenhum resultado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {isFetching && (
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

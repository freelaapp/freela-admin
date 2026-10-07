"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { contractorListSheets, freelancerListSheets } from "@/modules/admin/application/engagement-export";
import { fichaHref, type FilterEntry } from "@/modules/admin/application/engagement-filters";
import {
  CONTRACTOR_SEGMENTS,
  FREELANCER_SEGMENTS,
  STATUS_BADGE,
  dateBR,
  fileSlug,
  formatValue,
  productsLabel,
  statusLabel,
  type EngagementSide,
} from "@/modules/admin/application/engagement-format";
import { useEngagementPeople, type PeopleRow } from "@/modules/admin/application/use-engagement";
import {
  listEngagementContractors,
  listEngagementFreelancers,
  type EngagementFilters,
  type EngagementListParams,
  type FreelancerListRow,
} from "@/modules/admin/infrastructure/engagement-api";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { Contact } from "./contact";
import { ErrorBox, Spinner } from "./states";
import { useDebounced } from "./use-debounced";

const PAGE_SIZE = 25;
const PAGER_BTN =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e5e5e5] transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-40";

interface PeopleTableProps {
  side: EngagementSide;
  filters: EngagementFilters;
  /** Filtros já descritos, para a aba "Filtros" do Excel. */
  entries: FilterEntry[];
}

function isFreelancerRow(row: PeopleRow): row is FreelancerListRow {
  return "lastCandidacyAt" in row;
}

/** O que muda entre os lados: a última ação e o contador do período. */
function facts(row: PeopleRow) {
  return isFreelancerRow(row)
    ? { lastLabel: "Última candidatura", last: row.lastCandidacyAt, countLabel: "Candidaturas", count: row.candidaciesInPeriod }
    : { lastLabel: "Última vaga", last: row.lastVacancyAt, countLabel: "Vagas", count: row.vacanciesInPeriod };
}

function place(row: PeopleRow): string {
  return [row.city, row.uf].filter(Boolean).join(" - ") || "—";
}

/** Busca a lista inteira (até 20.000) com os mesmos filtros e monta as abas. */
async function buildListExport(
  side: EngagementSide,
  filters: EngagementFilters,
  params: EngagementListParams,
  entries: FilterEntry[],
  segment: string,
) {
  const now = new Date();
  if (side === "freelancer") {
    const res = await listEngagementFreelancers(filters, params);
    return {
      sheets: freelancerListSheets(res, entries, segment, now),
      shown: res.rows.length,
      total: res.total,
      truncated: res.truncated,
    };
  }
  const res = await listEngagementContractors(filters, params);
  return {
    sheets: contractorListSheets(res, entries, segment, now),
    shown: res.rows.length,
    total: res.total,
    truncated: res.truncated,
  };
}

function NameCell({ row, side, filters }: { row: PeopleRow; side: EngagementSide; filters: EngagementFilters }) {
  return (
    <div className="min-w-0">
      <Link
        href={fichaHref(side, row.userId, filters)}
        className="font-medium text-[#1d1d1b] hover:text-[#eca826] hover:underline"
      >
        {row.name}
      </Link>
      {!row.hasAccess && (
        <Badge variant="muted" className="ml-2 align-middle">
          sem acesso
        </Badge>
      )}
      {!isFreelancerRow(row) && row.document && <p className="text-xs text-[#737373]">CNPJ {row.document}</p>}
    </div>
  );
}

export function PeopleTable({ side, filters, entries }: PeopleTableProps) {
  const segments = side === "freelancer" ? FREELANCER_SEGMENTS : CONTRACTOR_SEGMENTS;
  const [segment, setSegment] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [includeNoAccess, setIncludeNoAccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const term = useDebounced(search.trim(), 400);

  // Trocar filtro, segmento ou busca volta à página 1 sem efeito colateral:
  // a página guardada só vale para a combinação em que foi escolhida.
  const listKey = JSON.stringify([filters, segment, term, includeNoAccess]);
  const [pageState, setPageState] = useState({ key: listKey, page: 1 });
  const page = pageState.key === listKey ? pageState.page : 1;
  const goTo = (p: number) => setPageState({ key: listKey, page: p });

  const params: EngagementListParams = {
    segment: segment === "all" ? null : segment,
    search: term,
    includeNoAccess,
    page,
    limit: PAGE_SIZE,
  };
  const query = useEngagementPeople(side, filters, params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const segmentText = segments.find((s) => s.id === segment)?.label ?? segments[0].label;
  const noun = side === "freelancer" ? "freelancers" : "empresas";

  async function exportList() {
    setExporting(true);
    try {
      const out = await buildListExport(side, filters, { ...params, exportAll: true }, entries, segmentText);
      await downloadSheets(`engajamento-${noun}-${fileSlug(segmentText)}`, out.sheets);
      if (out.truncated) {
        toast.warning(
          `A lista tem ${formatValue(out.total)} linhas. O arquivo traz só as primeiras ${formatValue(out.shown)}: use um filtro mais estreito para ver o resto.`,
        );
      } else {
        toast.success(`Lista exportada (${formatValue(out.shown)} linhas).`);
      }
    } catch {
      toast.error("Não foi possível exportar a lista. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          {side === "freelancer" ? "Lista de freelancers" : "Lista de empresas"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={exportList}
          disabled={exporting || total === 0}
          className="self-start sm:self-auto"
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar lista (Excel)
        </Button>
      </div>

      <div role="group" aria-label="Segmento" className="mt-3 flex flex-wrap gap-1.5">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={segment === s.id}
            onClick={() => setSegment(s.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs transition-colors",
              segment === s.id
                ? "border-[#eca826] bg-[#eca826] font-semibold text-[#1d1d1b]"
                : "border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
          <Input
            aria-label="Buscar na lista"
            placeholder={
              side === "freelancer"
                ? "Nome, e-mail, telefone ou CPF"
                : "Nome, razão social, CNPJ, e-mail ou telefone"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#737373]">
          <Switch
            checked={includeNoAccess}
            onCheckedChange={setIncludeNoAccess}
            aria-label="Incluir contas sem acesso"
          />
          Incluir contas sem acesso
        </label>
      </div>

      {query.isError && !query.data ? (
        <div className="mt-4">
          <ErrorBox message="Não foi possível carregar a lista." onRetry={() => query.refetch()} />
        </div>
      ) : query.isLoading ? (
        <Spinner className="h-40" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#737373]">Ninguém neste segmento com esses filtros.</p>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">{side === "freelancer" ? "Nome" : "Empresa"}</th>
                  <th className="py-2 pr-3 font-medium">Cidade</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Última atividade</th>
                  <th className="py-2 pr-3 font-medium">{side === "freelancer" ? "Última candidatura" : "Última vaga"}</th>
                  <th className="py-2 pr-3 text-right font-medium">{side === "freelancer" ? "Candidaturas" : "Vagas"}</th>
                  <th className="py-2 pr-3 text-right font-medium">Concluídos</th>
                  <th className="py-2 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const x = facts(r);
                  return (
                    <tr key={r.userId} className="border-b border-[#f0f0f0] align-top last:border-0">
                      <td className="py-2 pr-3">
                        <NameCell row={r} side={side} filters={filters} />
                      </td>
                      <td className="py-2 pr-3 text-[#1d1d1b]">
                        {place(r)}
                        <p className="text-xs text-[#737373]">{productsLabel(r.products)}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={STATUS_BADGE[r.status]}>{statusLabel(r.status, side)}</Badge>
                      </td>
                      <td className="py-2 pr-3">{dateBR(r.lastSeenAt)}</td>
                      <td className="py-2 pr-3">{dateBR(x.last)}</td>
                      <td className="py-2 pr-3 text-right">{formatValue(x.count)}</td>
                      <td className="py-2 pr-3 text-right">{formatValue(r.completedInPeriod)}</td>
                      <td className="py-2">
                        <Contact phone={r.phone} email={r.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="mt-4 space-y-2 md:hidden">
            {rows.map((r) => {
              const x = facts(r);
              return (
                <li key={r.userId} className="rounded-lg border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <NameCell row={r} side={side} filters={filters} />
                    <Badge variant={STATUS_BADGE[r.status]} className="shrink-0">
                      {statusLabel(r.status, side)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {place(r)} · {productsLabel(r.products)}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Última atividade</dt>
                    <dd className="text-right">{dateBR(r.lastSeenAt)}</dd>
                    <dt className="text-[#737373]">{x.lastLabel}</dt>
                    <dd className="text-right">{dateBR(x.last)}</dd>
                    <dt className="text-[#737373]">{x.countLabel} no período</dt>
                    <dd className="text-right">{formatValue(x.count)}</dd>
                    <dt className="text-[#737373]">Concluídos no período</dt>
                    <dd className="text-right">{formatValue(r.completedInPeriod)}</dd>
                  </dl>
                  <div className="mt-2">
                    <Contact phone={r.phone} email={r.email} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-col items-center justify-between gap-2 text-sm text-[#737373] sm:flex-row">
            <span>{`Mostrando ${from}–${to} de ${formatValue(total)}`}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(Math.max(1, page - 1))}
                disabled={page <= 1 || query.isFetching}
                aria-label="Página anterior"
                title="Página anterior"
                className={PAGER_BTN}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[#1d1d1b]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goTo(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || query.isFetching}
                aria-label="Próxima página"
                title="Próxima página"
                className={PAGER_BTN}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

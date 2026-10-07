"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { contractorDetailSheets } from "@/modules/admin/application/engagement-export";
import { periodText } from "@/modules/admin/application/engagement-filters";
import {
  PRODUCT_LABEL,
  brasiliaDayOf,
  dateBR,
  fileSlug,
  formatValue,
  productsLabel,
  vacancySituation,
  vacancyDayBR,
} from "@/modules/admin/application/engagement-format";
import { CONTRACTOR_DETAIL_NUMBERS } from "@/modules/admin/application/engagement-metrics";
import { useContractorEngagement } from "@/modules/admin/application/use-engagement";
import type { ContractorDetail } from "@/modules/admin/infrastructure/engagement-api";
import { buildContractorReportPdf } from "@/modules/admin/infrastructure/engagement-pdf";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { BackLink, ChannelDaysCard, NumbersGrid, SummaryCard } from "../../_components/detail-parts";
import { FilterBar } from "../../_components/filter-bar";
import { ErrorBox, Spinner } from "../../_components/states";
import { useDetailFilters } from "../../_components/use-detail-filters";

export default function ContractorEngagementPage() {
  const { isChecking, allowed } = useAreaGuard("COMPANIES");
  if (isChecking || !allowed) return <Spinner />;
  return (
    <Suspense fallback={<Spinner />}>
      <ContractorScreen />
    </Suspense>
  );
}

function ContractorScreen() {
  const { id } = useParams<{ id: string }>();
  const { filters, changeFilters, backHref } = useDetailFilters("empresas");
  const query = useContractorEngagement(id, filters);
  const d = query.data;
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const notFound = isAxiosError(query.error) && query.error.response?.status === 404;
  const disabled = !d || exporting !== null || query.isPlaceholderData;

  /** Relatório para enviar à empresa: sem telefone, e-mail ou documento (Task 4). */
  function exportClientPdf() {
    if (!d) return;
    setExporting("pdf");
    try {
      buildContractorReportPdf(d, new Date()).save(
        `relatorio-${fileSlug(d.summary.name)}-${brasiliaDayOf(d.period.start)}.pdf`,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  async function exportXlsx() {
    if (!d) return;
    setExporting("xlsx");
    try {
      await downloadSheets(
        `engajamento-empresa-${fileSlug(d.summary.name)}`,
        contractorDetailSheets(d, [{ label: "Período", value: periodText(filters, d.period) }], new Date()),
      );
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  const place = d ? [d.summary.city, d.summary.uf].filter(Boolean).join(" - ") : "";
  return (
    <div>
      <BackLink href={backHref} />
      <PageHeader
        title={d?.summary.name ?? "Ficha da empresa"}
        description={d ? `Empresa${place ? ` · ${place}` : ""} · ${productsLabel(d.summary.products)}` : undefined}
      />
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={[]}
        periodOnly
        actions={
          <>
            <Button size="sm" onClick={exportClientPdf} disabled={disabled}>
              {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Relatório para o cliente (PDF)
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx} disabled={disabled}>
              {exporting === "xlsx" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Exportar Excel
            </Button>
          </>
        }
      />
      {query.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : notFound ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">Empresa não encontrada.</p>
      ) : query.isError && !d ? (
        <ErrorBox message="Não foi possível carregar a ficha." onRetry={() => query.refetch()} />
      ) : d ? (
        <ContractorBody d={d} />
      ) : null}
    </div>
  );
}

function ContractorBody({ d }: { d: ContractorDetail }) {
  const s = d.summary;
  return (
    <div className="space-y-6">
      <SummaryCard
        side="contractor"
        status={s.status}
        hasAccess={s.hasAccess}
        phone={s.phone}
        email={s.email}
        facts={[
          { label: "CNPJ", value: s.document ?? "—" },
          { label: "Última atividade conhecida", value: dateBR(s.lastSeenAt) },
          { label: "Última vaga", value: dateBR(s.lastVacancyAt) },
          { label: "Cadastro", value: dateBR(s.createdAt) },
        ]}
      />
      <NumbersGrid defs={CONTRACTOR_DETAIL_NUMBERS} detail={d} />
      <ChannelDaysCard days={d.activeDaysByChannel} />
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
        <h3 className="mb-3 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          Vagas do período
        </h3>
        {d.vacancies.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#737373]">Nenhuma vaga publicada no período.</p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">Publicada em</th>
                  <th className="py-2 pr-3 font-medium">Data da vaga</th>
                  <th className="py-2 pr-3 font-medium">Cargo</th>
                  <th className="py-2 pr-3 font-medium">Cidade</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 text-right font-medium">Candidatos</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 font-medium">Quem trabalhou</th>
                </tr>
              </thead>
              <tbody>
                {d.vacancies.map((v) => (
                  <tr key={v.vacancyId} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="py-2 pr-3">{dateBR(v.createdAt)}</td>
                    <td className="py-2 pr-3">{vacancyDayBR(v.vacancyDate)}</td>
                    <td className="py-2 pr-3">{v.title ?? v.serviceType ?? "—"}</td>
                    <td className="py-2 pr-3">{v.city ?? "—"}</td>
                    <td className="py-2 pr-3">{PRODUCT_LABEL[v.module]}</td>
                    <td className="py-2 pr-3 text-right">{formatValue(v.candidates)}</td>
                    <td className="py-2 pr-3">{vacancySituation(v.status, v.jobStatus)}</td>
                    <td className="py-2">{v.workerFirstNames.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {d.vacancies.map((v) => (
                <li key={v.vacancyId} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
                  <p className="font-medium text-[#1d1d1b]">{v.title ?? v.serviceType ?? "—"}</p>
                  <p className="text-xs text-[#737373]">
                    {v.city ?? "—"} · {PRODUCT_LABEL[v.module]}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Data da vaga</dt>
                    <dd className="text-right">{vacancyDayBR(v.vacancyDate)}</dd>
                    <dt className="text-[#737373]">Candidatos</dt>
                    <dd className="text-right">{formatValue(v.candidates)}</dd>
                    <dt className="text-[#737373]">Situação</dt>
                    <dd className="text-right">{vacancySituation(v.status, v.jobStatus)}</dd>
                    <dt className="text-[#737373]">Quem trabalhou</dt>
                    <dd className="text-right">{v.workerFirstNames.join(", ") || "—"}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

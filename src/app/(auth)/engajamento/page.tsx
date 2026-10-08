"use client";

import { Suspense, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/modules/auth/application/use-auth";
import { overviewSheets } from "@/modules/admin/application/engagement-export";
import {
  ENGAGEMENT_TABS,
  describeFilters,
  filterEntries,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFilterReady,
  parseEngagementTab,
  withQuery,
  type EngagementTab,
  DEFAULT_LIST_STATE,
  listStateExtras,
  listStateFromSearchParams,
  type ListState,
} from "@/modules/admin/application/engagement-filters";
import { fileSlug } from "@/modules/admin/application/engagement-format";
import {
  CONTRACTOR_INDICATORS,
  FREELANCER_INDICATORS,
  VACANCY_METRICS,
} from "@/modules/admin/application/engagement-metrics";
import { useEngagementOverview } from "@/modules/admin/application/use-engagement";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";
import { buildOverviewPdf } from "@/modules/admin/infrastructure/engagement-pdf";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { svgToPngDataUrl } from "@/modules/admin/infrastructure/svg-to-png";
import { CityTable } from "./_components/city-table";
import { EntitySearch } from "./_components/entity-search";
import { FilterBar } from "./_components/filter-bar";
import { IndicatorTable } from "./_components/indicator-table";
import { MeasurementNotice } from "./_components/measurement-notice";
import { MetricGrid } from "./_components/metric-grid";
import { PeopleTable } from "./_components/people-table";
import { SeriesChart, SeriesChartForExport } from "./_components/series-chart";
import { ErrorBox, Spinner } from "./_components/states";

export default function EngajamentoPage() {
  // Filtros e aba ficam na URL (link compartilhável): useSearchParams pede Suspense no App Router.
  return (
    <Suspense fallback={<Spinner />}>
      <EngajamentoScreen />
    </Suspense>
  );
}

function NoAccessNote({ area }: { area: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">
      {`A lista com contatos fica para quem tem acesso à área ${area}. Os números acima valem para todo admin.`}
    </p>
  );
}

function EngajamentoScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, isHydrated } = useAuth();
  const canFreelancers = isHydrated && hasPermission("FREELANCERS");
  const canCompanies = isHydrated && hasPermission("COMPANIES");

  // A URL só é lida na entrada; depois o estado manda e a URL acompanha (replace).
  // Assim um personalizado com a data apagada fica "incompleto" na tela, em vez
  // de a URL sem `de` trazer de volta a data padrão.
  const [filters, setFilters] = useState<EngagementFilters>(() => filtersFromSearchParams(searchParams));
  const [tab, setTab] = useState<EngagementTab>(() => parseEngagementTab(searchParams.get("aba")));
  // Ponto da lista (segmento, busca, página) da aba aberta, para voltar da ficha.
  const [initialList] = useState(() => listStateFromSearchParams(searchParams));
  const listRef = useRef<ListState>(initialList);
  const sync = (f: EngagementFilters, t: EngagementTab, list: ListState = listRef.current) => {
    const extras = t === "visao-geral" ? {} : { aba: t, ...(t === tab ? listStateExtras(list) : {}) };
    router.replace(withQuery(pathname, filtersToSearchParams(f, extras)), { scroll: false });
  };
  const changeList = (list: ListState) => {
    listRef.current = list;
    sync(filters, tab, list);
  };
  const changeFilters = (f: EngagementFilters) => {
    setFilters(f);
    sync(f, tab);
  };
  const changeTab = (value: string) => {
    const t = parseEngagementTab(value);
    setTab(t);
    listRef.current = DEFAULT_LIST_STATE;
    sync(filters, t, DEFAULT_LIST_STATE);
  };

  const overview = useEngagementOverview(filters);
  const o = overview.data;
  const ready = isFilterReady(filters);
  const entries = filterEntries(filters, o?.period ?? null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  // Enquanto o filtro novo carrega, a tela ainda mostra os números anteriores:
  // exportar nessa hora misturaria o rótulo novo com o número velho.
  const exportDisabled = !o || !ready || overview.isPlaceholderData || exporting !== null;

  async function exportPdf() {
    if (!o) return;
    setExporting("pdf");
    try {
      const svg = chartRef.current?.querySelector("svg") ?? null;
      const png = await svgToPngDataUrl(svg);
      buildOverviewPdf(o, describeFilters(filters, o.period), png, new Date()).save(
        `engajamento-${fileSlug(o.period.label)}.pdf`,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  async function exportXlsx() {
    if (!o) return;
    setExporting("xlsx");
    try {
      await downloadSheets(`engajamento-${fileSlug(o.period.label)}`, overviewSheets(o, entries, new Date()));
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={exportPdf} disabled={exportDisabled}>
        {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Exportar PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportXlsx} disabled={exportDisabled}>
        {exporting === "xlsx" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Exportar Excel
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Engajamento"
        description="Quem abre o app, quem se candidata e quem publica vaga, por período, cidade e produto."
      />
      <div className="mb-4">
        <EntitySearch filters={filters} canFreelancers={canFreelancers} canCompanies={canCompanies} />
      </div>
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={o?.filterOptions.cities ?? []}
        actions={actions}
      />

      {!ready ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">
          Escolha as datas do período personalizado para ver os números.
        </p>
      ) : overview.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : overview.isError && !o ? (
        <ErrorBox onRetry={() => overview.refetch()} />
      ) : o ? (
        <>
          <MeasurementNotice measuredSince={o.measuredSince} period={o.period} />
          <p className="mb-3 text-xs text-[#737373]">{`${o.period.label} · comparado com ${o.period.previousLabel}`}</p>
          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList className="mb-4 w-full justify-start overflow-x-auto md:w-auto">
              {ENGAGEMENT_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} type="button">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-6">
              <IndicatorTable title="Contratante" defs={CONTRACTOR_INDICATORS} overview={o} />
              <IndicatorTable title="Freelancer" defs={FREELANCER_INDICATORS} overview={o} />
              <SeriesChart series={o.series} />
              <CityTable rows={o.byCity} />
            </TabsContent>

            <TabsContent value="freelancers" className="space-y-6">
              <IndicatorTable title="Freelancer" defs={FREELANCER_INDICATORS} overview={o} />
              {canFreelancers ? (
                <PeopleTable
                  side="freelancer"
                  filters={filters}
                  entries={entries}
                  initialState={tab === "freelancers" ? listRef.current : undefined}
                  onStateChange={changeList}
                />
              ) : (
                <NoAccessNote area="Freelancers" />
              )}
            </TabsContent>

            <TabsContent value="empresas" className="space-y-6">
              <IndicatorTable title="Contratante" defs={CONTRACTOR_INDICATORS} overview={o} />
              {canCompanies ? (
                <PeopleTable
                  side="contractor"
                  filters={filters}
                  entries={entries}
                  initialState={tab === "empresas" ? listRef.current : undefined}
                  onStateChange={changeList}
                />
              ) : (
                <NoAccessNote area="Empresas" />
              )}
            </TabsContent>

            <TabsContent value="vagas" className="space-y-6">
              <MetricGrid overview={o} metrics={VACANCY_METRICS} product={filters.product} />
              <SeriesChart series={o.series} lines={["vacanciesPublished", "vacanciesCompleted", "candidacies"]} />
              <CityTable rows={o.byCity} />
            </TabsContent>
          </Tabs>

          {/* Gráfico fixo fora da tela, só para o PDF (independe da aba e da largura). */}
          <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0">
            <SeriesChartForExport ref={chartRef} series={o.series} />
          </div>
        </>
      ) : null}
    </div>
  );
}

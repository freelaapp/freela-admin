"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { freelancerDetailSheets } from "@/modules/admin/application/engagement-export";
import { periodText } from "@/modules/admin/application/engagement-filters";
import {
  PRODUCT_LABEL,
  candidacyStatusLabel,
  dateBR,
  fileSlug,
  productsLabel,
} from "@/modules/admin/application/engagement-format";
import { FREELANCER_DETAIL_NUMBERS } from "@/modules/admin/application/engagement-metrics";
import { useFreelancerEngagement } from "@/modules/admin/application/use-engagement";
import type { FreelancerDetail } from "@/modules/admin/infrastructure/engagement-api";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { BackLink, ChannelDaysCard, NumbersGrid, SummaryCard } from "../../_components/detail-parts";
import { FilterBar } from "../../_components/filter-bar";
import { ErrorBox, Spinner } from "../../_components/states";
import { useDetailFilters } from "../../_components/use-detail-filters";

export default function FreelancerEngagementPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  if (isChecking || !allowed) return <Spinner />;
  return (
    <Suspense fallback={<Spinner />}>
      <FreelancerScreen />
    </Suspense>
  );
}

function FreelancerScreen() {
  const { id } = useParams<{ id: string }>();
  const { filters, changeFilters, backHref } = useDetailFilters("freelancers");
  const query = useFreelancerEngagement(id, filters);
  const d = query.data;
  const [exporting, setExporting] = useState(false);
  const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

  async function exportXlsx() {
    if (!d) return;
    setExporting(true);
    try {
      await downloadSheets(
        `engajamento-freelancer-${fileSlug(d.summary.name)}`,
        freelancerDetailSheets(d, [{ label: "Período", value: periodText(filters, d.period) }], new Date()),
      );
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }

  const place = d ? [d.summary.city, d.summary.uf].filter(Boolean).join(" - ") : "";
  return (
    <div>
      <BackLink href={backHref} />
      <PageHeader
        title={d?.summary.name ?? "Ficha do freelancer"}
        description={d ? `Freelancer${place ? ` · ${place}` : ""} · ${productsLabel(d.summary.products)}` : undefined}
      />
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={[]}
        periodOnly
        actions={
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!d || exporting || query.isPlaceholderData}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Exportar Excel
          </Button>
        }
      />
      {query.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : notFound ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">Freelancer não encontrado.</p>
      ) : query.isError && !d ? (
        <ErrorBox message="Não foi possível carregar a ficha." onRetry={() => query.refetch()} />
      ) : d ? (
        <FreelancerBody d={d} />
      ) : null}
    </div>
  );
}

function FreelancerBody({ d }: { d: FreelancerDetail }) {
  const s = d.summary;
  return (
    <div className="space-y-6">
      <SummaryCard
        side="freelancer"
        status={s.status}
        hasAccess={s.hasAccess}
        phone={s.phone}
        email={s.email}
        facts={[
          { label: "Última atividade conhecida", value: dateBR(s.lastSeenAt) },
          { label: "Última candidatura", value: dateBR(s.lastCandidacyAt) },
          { label: "Cadastro", value: dateBR(s.createdAt) },
        ]}
      />
      <NumbersGrid defs={FREELANCER_DETAIL_NUMBERS} detail={d} />
      <ChannelDaysCard days={d.activeDaysByChannel} />
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
        <h3 className="mb-3 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          Candidaturas no período
        </h3>
        {d.candidacies.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#737373]">Nenhuma candidatura no período.</p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">Candidatura em</th>
                  <th className="py-2 pr-3 font-medium">Data da vaga</th>
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Cargo</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 font-medium">Concluiu</th>
                </tr>
              </thead>
              <tbody>
                {d.candidacies.map((c) => (
                  <tr key={c.candidacyId} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="py-2 pr-3">{dateBR(c.createdAt)}</td>
                    <td className="py-2 pr-3">{dateBR(c.vacancyDate)}</td>
                    <td className="py-2 pr-3">{c.companyName ?? "—"}</td>
                    <td className="py-2 pr-3">{c.title ?? c.serviceType ?? "—"}</td>
                    <td className="py-2 pr-3">{PRODUCT_LABEL[c.module]}</td>
                    <td className="py-2 pr-3">{candidacyStatusLabel(c.status)}</td>
                    <td className="py-2">{c.completed ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {d.candidacies.map((c) => (
                <li key={c.candidacyId} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
                  <p className="font-medium text-[#1d1d1b]">{c.title ?? c.serviceType ?? "—"}</p>
                  <p className="text-xs text-[#737373]">
                    {c.companyName ?? "—"} · {PRODUCT_LABEL[c.module]}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Candidatura em</dt>
                    <dd className="text-right">{dateBR(c.createdAt)}</dd>
                    <dt className="text-[#737373]">Data da vaga</dt>
                    <dd className="text-right">{dateBR(c.vacancyDate)}</dd>
                    <dt className="text-[#737373]">Situação</dt>
                    <dd className="text-right">{candidacyStatusLabel(c.status)}</dd>
                    <dt className="text-[#737373]">Concluiu</dt>
                    <dd className="text-right">{c.completed ? "Sim" : "Não"}</dd>
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

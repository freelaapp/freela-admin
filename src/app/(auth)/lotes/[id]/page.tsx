"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAdminLot } from "@/modules/admin/application/use-admin-lots";
import {
  attentionReasons,
  companySeesText,
  formatServiceDate,
  isLotNotFound,
  isLotsUnavailable,
  lotCountsLine,
} from "@/modules/admin/application/lots-presentation";
import { formatVacancyTime } from "@/lib/date.utils";
import { LotChoiceDialog } from "@/components/admin/lots/lot-choice-dialog";
import { LotLinesSection } from "@/components/admin/lots/lot-lines-section";
import {
  asksLine,
  exitReasonText,
  unpaidLine,
} from "@/modules/admin/application/lot-choice-presentation";
import { momentLabel } from "@/modules/admin/application/lot-lines-presentation";

function BackLink() {
  return (
    <Link
      href="/lotes"
      className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-[#737373] hover:text-[#1d1d1b]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Voltar para os lotes
    </Link>
  );
}

/**
 * Detalhe do lote (vagas em lote, fatia 1; A3, só leitura): a linha "A empresa vê", as funções com
 * as contagens e as vagas em seleção fora do lote. "Abrir a vaga" leva ao modal da vaga em Vagas.
 * Nenhum valor em reais e nenhum dado pessoal além do nome da empresa. Lote que não existe (404):
 * mensagem simples, sem erro.
 */
export default function LoteDetalhePage() {
  const { isChecking, allowed } = useAreaGuard("JOBS");
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const lot = useAdminLot(id, allowed && !!id);
  // A4: a função aberta no "Escolher pelo lote" (chave + título).
  const [choosing, setChoosing] = useState<{ groupKey: string; title: string } | null>(null);

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (lot.isLoading) {
    return (
      <div aria-busy="true" aria-label="Carregando o lote" className="grid gap-3">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (lot.isError && isLotsUnavailable(lot.error)) {
    return (
      <div>
        <BackLink />
        <p data-testid="lot-not-found" className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          {isLotNotFound(lot.error)
            ? "Não encontramos este lote."
            : "Os lotes ainda não estão ligados."}
        </p>
      </div>
    );
  }

  if (lot.isError || !lot.data) {
    return (
      <div>
        <BackLink />
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Não foi possível carregar o lote.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => lot.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  const data = lot.data;
  const sees = companySeesText(data);
  const reasons = attentionReasons(data);
  const choice = data.choice;
  const asks = asksLine(choice?.asks ?? null);

  return (
    <div>
      <BackLink />
      <PageHeader
        title={`${data.companyName ?? "Empresa"} · ${formatServiceDate(data.serviceDate)}`}
        description={lotCountsLine(data)}
      />

      {reasons.length > 0 && (
        <ul className="mb-4 space-y-1 rounded-lg border border-[#eca826]/40 bg-[#eca826]/10 p-3 text-sm font-medium text-[#c97b0e]">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {sees && (
        <p data-testid="company-sees" className="mb-4 rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#1d1d1b]">
          <span className="text-[#737373]">A empresa vê: </span>
          “{sees}”
        </p>
      )}

      {choice && (
        <div data-testid="lot-choice-day" className="mb-4 space-y-1 rounded-lg border border-[#e5e5e5] bg-white p-3 text-sm">
          <p>{unpaidLine(choice)}</p>
          {asks && <p className="text-[#737373]">{asks}</p>}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {data.groups.map((group) => (
          <article
            key={group.groupKey}
            data-testid="lot-group"
            className="space-y-1.5 rounded-lg border border-[#e5e5e5] bg-white p-4"
          >
            <p className="font-semibold text-[#1d1d1b]">
              {group.title} · {formatVacancyTime(group.startTime)} às {formatVacancyTime(group.endTime)}
            </p>
            <p className="text-sm text-[#737373]">
              {group.vacancies} {group.vacancies === 1 ? "vaga" : "vagas"} · {group.chosen}{" "}
              {group.chosen === 1 ? "escolhida" : "escolhidas"} · {group.paid}{" "}
              {group.paid === 1 ? "paga" : "pagas"} · {group.free}{" "}
              {group.free === 1 ? "livre" : "livres"}
            </p>
            <p className="text-sm text-[#737373]">
              {group.candidatesToChoose}{" "}
              {group.candidatesToChoose === 1 ? "candidato esperando" : "candidatos esperando"}
            </p>
            {choice && !data.past && (
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => setChoosing({ groupKey: group.groupKey, title: group.title })}
              >
                Escolher pelo lote
              </Button>
            )}
            {group.representativeVacancyId && (
              <Link
                href={`/jobs?vaga=${encodeURIComponent(group.representativeVacancyId)}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[#e5e5e5] px-3 text-sm font-semibold text-[#1d1d1b] hover:bg-[#f0f0f0]"
              >
                Abrir a vaga
              </Link>
            )}
          </article>
        ))}
      </div>

      <LotLinesSection lotId={id} enabled />

      {choice && choice.exits.length > 0 && (
        <section className="mt-6 space-y-2" aria-label="Quem saiu">
          <h2 className="text-sm font-semibold text-[#1d1d1b]">Quem estava escolhido e saiu</h2>
          {choice.exits.map((e) => (
            <p key={`${e.candidacyId}-${e.at}`} data-testid="lot-exit" className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
              <span className="font-medium">{e.name ?? "Pessoa"}</span> · {e.title} · {exitReasonText(e.reason)}
              {e.at ? ` às ${momentLabel(e.at, data.serviceDate)}` : ""}
              {e.vacancyPaid ? " · a vaga segue paga" : ""}
              {e.vacancyRefilled ? " · já tem outra pessoa" : ""}
            </p>
          ))}
        </section>
      )}

      {data.inSelection.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold text-[#1d1d1b]">Em seleção, fora do lote</h2>
          {data.inSelection.map((v) => (
            <p
              key={v.vacancyId}
              data-testid="lot-in-selection"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5e5e5] p-3 text-sm"
            >
              <span>
                {v.title} · {formatVacancyTime(v.startTime)} às {formatVacancyTime(v.endTime)}
              </span>
              <Link
                href={`/jobs?vaga=${encodeURIComponent(v.vacancyId)}`}
                className="font-semibold text-[#c97b0e] hover:underline"
              >
                Abrir a vaga
              </Link>
            </p>
          ))}
        </section>
      )}

      {choosing && (
        <LotChoiceDialog
          lotId={id}
          groupKey={choosing.groupKey}
          title={choosing.title}
          onClose={() => setChoosing(null)}
          onGroupGone={() => void lot.refetch()}
        />
      )}
    </div>
  );
}

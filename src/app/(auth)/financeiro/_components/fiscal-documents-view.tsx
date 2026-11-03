"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatInstantBrt } from "@/modules/admin/application/invoice-presentation";
import {
  useAdminFiscalDocuments,
  useReissueFiscalDocument,
} from "@/modules/admin/application/use-admin-fiscal-documents";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  FiscalDocumentItem,
  FiscalDocumentKind,
  FiscalDocumentStatus,
} from "@/modules/admin/infrastructure/fiscal-documents-api";
import { ActionDialog, ReasonField, useReason } from "./invoice-action-dialogs";

/** Períodos do filtro (dias para trás, Brasília). O padrão (14) esconde as recusadas antigas. */
const PERIODS = [
  { days: 14, label: "Últimos 14 dias" },
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
] as const;

const STATUS_CHIPS: ReadonlyArray<{ code: FiscalDocumentStatus | null; label: string }> = [
  { code: null, label: "Todas" },
  { code: "FAILED", label: "Recusadas" },
  { code: "PENDING", label: "Na prefeitura" },
  { code: "ISSUED", label: "Emitidas" },
];

const KIND_OPTIONS: ReadonlyArray<{ code: FiscalDocumentKind | ""; label: string }> = [
  { code: "", label: "Todas as notas" },
  { code: "INVOICE", label: "Da fatura (faturado)" },
  { code: "VACANCY", label: "Da vaga (pré-pago)" },
  { code: "SUBSCRIPTION", label: "Da mensalidade" },
];

const STATUS_STYLE: Record<FiscalDocumentStatus, string> = {
  ISSUED: "bg-green-500/10 text-green-700",
  PENDING: "bg-[#fffbeb] text-[#b45309]",
  FAILED: "bg-[#fef2f2] text-[#b91c1c]",
};

const STATUS_CARD: Record<FiscalDocumentStatus, { icon: React.ElementType; color: string }> = {
  FAILED: { icon: AlertTriangle, color: "text-[#b91c1c]" },
  PENDING: { icon: Clock, color: "text-[#b45309]" },
  ISSUED: { icon: CheckCircle2, color: "text-green-700" },
};

/** Hoje − `days` em Brasília (`AAAA-MM-DD`). */
export function sinceKey(days: number, now: Date = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

function ddmmyyyy(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : key;
}

/**
 * Aba "Notas fiscais" do Financeiro: a situação das NFS-e da fatura, da vaga e
 * da mensalidade numa lista só (número, empresa, valor com a conta, status,
 * motivo da recusa, PDF e a reemissão que vale). Abre nos últimos 14 dias: as
 * recusadas de ago–out são ruído.
 */
export function FiscalDocumentsView() {
  const [days, setDays] = useState<number>(PERIODS[0].days);
  const [status, setStatus] = useState<FiscalDocumentStatus | null>(null);
  const [kind, setKind] = useState<FiscalDocumentKind | "">("");
  const [page, setPage] = useState(1);
  const [reissueOf, setReissueOf] = useState<FiscalDocumentItem | null>(null);
  const since = sinceKey(days);
  const list = useAdminFiscalDocuments({
    since,
    status: status ?? undefined,
    type: kind || undefined,
    page,
  });

  const errorStatus = apiErrorOf(list.error).status;
  if (errorStatus === 404) {
    return (
      <Notice
        title="A lista de notas fiscais ainda não está disponível neste ambiente."
        text="A API ainda não tem esta rota. Enquanto isso, a nota de cada fatura está no detalhe da fatura (aba Faturas) e a de cada vaga, nos documentos da vaga."
      />
    );
  }
  if (errorStatus === 403) {
    return (
      <Notice
        title="Você não tem acesso às notas fiscais."
        text="Peça a um administrador a permissão Financeiro."
      />
    );
  }

  const data = list.data;
  const periodText = `com mudança (pedido, emissão, recusa ou reemissão) desde ${ddmmyyyy(data?.since || since)}`;

  const columns: Column<FiscalDocumentItem>[] = [
    {
      header: "Empresa",
      mobile: "title",
      accessor: (doc) => (
        <span className="font-medium text-[#1d1d1b]" title={doc.company.name ?? undefined}>
          {doc.company.name ?? "Empresa sem nome no cadastro"}
        </span>
      ),
    },
    {
      header: "Nota",
      headerTitle: "Número da NFS-e na prefeitura (só a emitida tem) e de onde ela é.",
      accessor: (doc) => (
        <div className="min-w-0">
          <p className="text-[#1d1d1b]">{doc.number ? `nº ${doc.number}` : "Sem número"}</p>
          <p className="text-xs text-[#737373]">{doc.kindLabel}</p>
        </div>
      ),
    },
    {
      header: "Referente a",
      accessor: (doc) =>
        doc.kind === "INVOICE" && doc.subject.invoiceId ? (
          <Link
            href={`/financeiro/faturas/${encodeURIComponent(doc.subject.invoiceId)}`}
            className="text-[#1d1d1b] underline-offset-2 hover:text-[#eca826] hover:underline"
          >
            {doc.subject.label}
          </Link>
        ) : (
          <span className="text-[#1d1d1b]">{doc.subject.label}</span>
        ),
    },
    {
      header: "Valor da nota",
      headerTitle: "O valor que vai na NFS-e (a taxa da Freela, ou a mensalidade). A conta está em 'ver a conta'.",
      accessor: (doc) => (
        <div className="min-w-0 text-sm">
          <p className="whitespace-nowrap text-[#1d1d1b]">{doc.amount.formatted}</p>
          <SeeCalc calc={doc.amount.calc ?? "a nota não tem a conta gravada (nota antiga)"} source={doc.amount.source} />
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (doc) => (
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_STYLE[doc.status],
            )}
          >
            {doc.statusLabel}
          </span>
          {doc.status === "FAILED" && (
            <p className="mt-1 max-w-[260px] break-words text-xs text-[#b91c1c]">
              {`Motivo: ${doc.failureReason ?? "a emissora não informou"}`}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Última mudança",
      headerTitle: "Quando a nota mudou pela última vez (pedido, emissão, recusa ou reemissão), horário de Brasília.",
      accessor: (doc) => (
        <div className="min-w-0 whitespace-nowrap text-sm">
          <p className="text-[#1d1d1b]">{formatInstantBrt(doc.updatedAt)}</p>
          {doc.issuedAt && <p className="text-xs text-[#737373]">{`emitida ${formatInstantBrt(doc.issuedAt)}`}</p>}
        </div>
      ),
    },
    {
      header: "Ações",
      mobile: "actions",
      accessor: (doc) => (
        <div className="flex flex-wrap items-center gap-2">
          {doc.pdfUrl ? (
            <a
              href={doc.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#e5e5e5] px-2.5 text-xs font-medium text-[#1d1d1b] hover:border-[#eca826] hover:text-[#eca826]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              PDF
            </a>
          ) : null}
          {doc.status === "FAILED" &&
            (doc.reissue.enabled ? (
              <Button variant="outline" size="sm" onClick={() => setReissueOf(doc)}>
                Reemitir nota
              </Button>
            ) : (
              <span className="text-xs text-[#737373]">{doc.reissue.reason}</span>
            ))}
        </div>
      ),
    },
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Chip
              key={p.days}
              active={days === p.days}
              onClick={() => {
                setDays(p.days);
                setPage(1);
              }}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div role="group" aria-label="Status da nota" className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((c) => (
              <Chip
                key={c.label}
                active={status === c.code}
                onClick={() => {
                  setStatus(c.code);
                  setPage(1);
                }}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[#737373] sm:ml-auto">
            De onde é a nota
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as FiscalDocumentKind | "");
                setPage(1);
              }}
              className="h-9 rounded-md border border-[#e5e5e5] bg-white px-2 text-sm text-[#1d1d1b]"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-[#737373]">{`Mostrando as notas ${periodText}.`}</p>
      </div>

      {list.isLoading && !data ? (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : list.isError || !data ? (
        <div className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
          <p>Não conseguimos carregar as notas fiscais.</p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()} className="mt-3">
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <section
            aria-label="Notas por status no período"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div data-testid="fiscal-kpi-total">
              <KpiCard
                className="h-full"
                title={data.summary.total.label}
                value={String(data.summary.total.count)}
                icon={FileText}
                details={{ calc: data.summary.total.calc, source: data.summary.total.source }}
              />
            </div>
            {data.summary.byStatus.map((s) => (
              <div key={s.status} data-testid={`fiscal-kpi-${s.status}`}>
                <KpiCard
                  className="h-full"
                  title={s.label}
                  value={String(s.count)}
                  icon={STATUS_CARD[s.status]?.icon ?? FileText}
                  iconColor={STATUS_CARD[s.status]?.color}
                  details={{ calc: s.calc, source: s.source }}
                />
              </div>
            ))}
          </section>

          {data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e5e5e5] p-6 text-center text-sm text-[#525252]">
              {`Nenhuma nota ${periodText} com estes filtros.`}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data.items}
              caption={`Notas fiscais ${periodText}, da mudança mais recente para a mais antiga`}
              isFetching={list.isFetching}
              footer={
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                  <span>{`Página ${data.page} de ${totalPages} · ${data.total} ${data.total === 1 ? "nota" : "notas"} com estes filtros`}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!data.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              }
            />
          )}
        </>
      )}

      {reissueOf && <ReissueDialog key={reissueOf.id} doc={reissueOf} onClose={() => setReissueOf(null)} />}
    </div>
  );
}

const REISSUE_TEXT =
  "A nota vai de novo para a prefeitura com os dados ATUAIS da empresa (razão social, CNPJ, endereço, telefone e e-mail). Se a recusa foi por dado errado, corrija o cadastro da empresa antes de reemitir.";

/** Reemitir a nota recusada: a da fatura pede o motivo (fica na trilha); a da vaga, não. */
function ReissueDialog({ doc, onClose }: { doc: FiscalDocumentItem; onClose: () => void }) {
  const mutation = useReissueFiscalDocument();
  // Reemitir é ato fiscal: o clique duplo não pode mandar duas notas.
  const submitting = useRef(false);
  const { reason, setReason, valid } = useReason();
  const [error, setError] = useState<string | null>(null);
  const needsReason = doc.reissue.via === "INVOICE";

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ doc, reason: reason.trim() });
      if (result.status === "FAILED") {
        toast.error(`A prefeitura recusou de novo: ${result.failureReason ?? "a emissora não informou o motivo"}`);
      } else if (result.status === "ISSUED") {
        toast.success(result.number ? `Nota emitida: nº ${result.number}.` : "Nota emitida.");
      } else {
        toast.success("Nota enviada à prefeitura. A resposta chega em alguns minutos.");
      }
      onClose();
    } catch (err) {
      setError(apiErrorOf(err).message ?? "Não foi possível reemitir a nota. Tente de novo.");
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Reemitir a nota fiscal: ${doc.subject.label}`}
      description={
        <div className="space-y-3">
          <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2.5">
            <p className="text-xs font-medium text-[#b91c1c]">Motivo da recusa da prefeitura</p>
            <p className="mt-0.5 break-words text-[#1d1d1b]">
              {doc.failureReason ?? "a emissora não informou o motivo"}
            </p>
          </div>
          <p>{`${doc.company.name ?? "Empresa sem nome"} · ${doc.amount.formatted}`}</p>
          <p>{REISSUE_TEXT}</p>
        </div>
      }
      submitLabel="Reemitir nota"
      pendingLabel="Enviando..."
      canSubmit={needsReason ? valid : true}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      {needsReason ? <ReasonField value={reason} onChange={setReason} /> : null}
    </ActionDialog>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-[#eca826] text-white" : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]",
      )}
    >
      {children}
    </button>
  );
}

function SeeCalc({ calc, source }: { calc: string; source: string }) {
  return (
    <details className="mt-0.5 text-xs text-[#525252]">
      <summary className="cursor-pointer select-none text-[#737373]">ver a conta</summary>
      <p className="mt-1">{`Conta: ${calc}`}</p>
      <p className="mt-0.5">{`Fonte: ${source}`}</p>
    </details>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-[#1d1d1b]">{title}</p>
        <p className="text-[#525252]">{text}</p>
      </div>
    </div>
  );
}

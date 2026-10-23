"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  channelText,
  chargeStatusLabel,
  dayLabel,
  ddmm,
  formatInstantBrt,
  instantWithWeekday,
} from "@/modules/admin/application/invoice-presentation";
import { useAdminInvoice, useBillingSummary } from "@/modules/admin/application/use-admin-billing";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import {
  downloadAdminInvoiceChargePdf,
  downloadAdminInvoiceDebitNotePdf,
  downloadAdminInvoicePdf,
  type AdminInvoiceDetail,
  type InvoiceReportItem,
} from "@/modules/admin/infrastructure/billing-api";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { InvoiceActions, NfseReissueAction } from "../../_components/invoice-action-dialogs";
import { InvoiceNfseBlock } from "../../_components/invoice-nfse-block";
import { InvoiceSituationBadge } from "../../_components/invoice-situation-badge";

const BACK_HREF = "/financeiro?aba=faturas";

type InvoicePdfKind = "closing" | "charge" | "debitNote";

/**
 * Documentos da fatura com `INVOICE_DOCUMENTS_V2_ENABLED` (api #629, plano
 * 2026-10-22 §2.16 AD-D): os mesmos PDFs que a empresa recebe. O Fechamento
 * financeiro sai da rota do PDF de hoje.
 */
const INVOICE_PDFS: Record<
  InvoicePdfKind,
  { label: string; filePrefix: string; failure: string; download: (id: string) => Promise<Blob> }
> = {
  closing: {
    label: "Fechamento financeiro",
    filePrefix: "fechamento-financeiro",
    failure: "Não foi possível baixar o Fechamento financeiro.",
    download: downloadAdminInvoicePdf,
  },
  charge: {
    label: "Cobrança",
    filePrefix: "cobranca",
    failure: "Não foi possível baixar a Cobrança.",
    download: downloadAdminInvoiceChargePdf,
  },
  debitNote: {
    label: "Nota de Débito",
    filePrefix: "nota-de-debito",
    failure: "Não foi possível baixar a Nota de Débito.",
    download: downloadAdminInvoiceDebitNotePdf,
  },
};

/**
 * Detalhe de uma fatura no admin (UX 7.5): cabeçalho com as datas, total com a
 * conta e o tomador fotografado, a nota fiscal da fatura (UX 6.10.3) com o
 * "Reemitir nota" da recusada, cobranças Pix, linhas com a conta e a fonte,
 * serviços em conferência, mensagens de cobrança e a trilha das ações. Página
 * (não modal): tem link direto, usado pelo alerta de pagamento em dobro.
 */
export default function InvoiceDetailPage() {
  const { isChecking, allowed } = useAreaGuard("FINANCE");
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const invoice = useAdminInvoice(allowed ? id : "");

  if (isChecking || !allowed) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={BACK_HREF}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] hover:text-[#1d1d1b]"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Faturas
      </Link>
      {invoice.isLoading ? (
        <DetailSkeleton />
      ) : invoice.isError || !invoice.data ? (
        <DetailError error={invoice.error} onRetry={() => invoice.refetch()} />
      ) : (
        <InvoiceDetail detail={invoice.data} />
      )}
    </div>
  );
}

/**
 * A data do bloqueio no cabeçalho. Desligado: diz que está desligado (mesma
 * regra do `blockSentence` da aba Cobrança, D17). Sem saber a chave: só a data.
 */
function blockLine(when: string, blockEnabled: boolean | undefined): string {
  if (blockEnabled === true) return `Bloqueio a partir de ${when}`;
  if (blockEnabled === false) {
    return `Bloqueio por atraso desligado; se ligar, bloquearia a partir de ${when}`;
  }
  return `Data do bloqueio na fatura: ${when}`;
}

function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { status, code } = apiErrorOf(error);
  if (status === 404) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#1d1d1b]">
        Fatura não encontrada.
      </div>
    );
  }
  const message =
    code === "INVOICE_REPORT_UNAVAILABLE"
      ? "Não conseguimos montar o relatório desta fatura."
      : "Não conseguimos carregar a fatura.";
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#1d1d1b]">
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
        Tentar de novo
      </Button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-[#e5e5e5] bg-white p-4"
    >
      <h2 id={headingId} className="mb-3 text-sm font-semibold text-[#1d1d1b]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function InvoiceDetail({ detail }: { detail: AdminInvoiceDetail }) {
  const { invoice, report } = detail;
  // `legacy` = o "Baixar PDF" de hoje (sem os links novos).
  const [downloading, setDownloading] = useState<InvoicePdfKind | "legacy" | null>(null);
  // AD-D: os links da Cobrança e da Nota de Débito só vêm com a chave ligada.
  const pdfKinds: InvoicePdfKind[] = detail.links.chargePdfRoute
    ? detail.links.debitNotePdfRoute
      ? ["closing", "charge", "debitNote"]
      : ["closing", "charge"]
    : [];
  const lines: InvoiceReportItem[] = [
    ...report.services,
    ...report.additionalHours,
    ...report.adjustments,
    ...report.credits,
  ];
  const takerLine = [report.taker.name, report.taker.document, report.taker.address, report.taker.email]
    .filter(Boolean)
    .join(" · ");
  // A chave do bloqueio por atraso vem dos indicadores (em cache se veio da lista).
  const blockEnabled = useBillingSummary().data?.cards.blockedCompanies.blockEnabled;
  const dueLine =
    invoice.status === "ISSUED"
      ? `${report.header.due} · ${blockLine(instantWithWeekday(invoice.blockFrom), blockEnabled)}`
      : report.header.due;

  const downloadPdf = async (kind: InvoicePdfKind | "legacy") => {
    const doc = kind === "legacy" ? null : INVOICE_PDFS[kind];
    setDownloading(kind);
    try {
      const blob = await (doc ? doc.download(invoice.id) : downloadAdminInvoicePdf(invoice.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc ? `${doc.filePrefix}-${invoice.number}.pdf` : `${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Liberar a URL no mesmo tique pode cancelar o download em alguns navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? doc?.failure ?? "Não foi possível baixar o PDF da fatura.");
    } finally {
      setDownloading(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código Pix copiado.");
    } catch {
      toast.error("Não foi possível copiar o código Pix.");
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1
              className="text-xl font-bold text-[#1d1d1b]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {`${invoice.number} · ${invoice.company.name ?? "Sem nome"}`}
            </h1>
            <InvoiceSituationBadge situation={detail.situation} />
          </div>
          {pdfKinds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pdfKinds.map((kind) => (
                <Button
                  key={kind}
                  variant="outline"
                  onClick={() => downloadPdf(kind)}
                  disabled={downloading !== null}
                >
                  {downloading === kind ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {`${INVOICE_PDFS[kind].label} (PDF)`}
                </Button>
              ))}
            </div>
          ) : (
            <Button variant="outline" onClick={() => downloadPdf("legacy")} disabled={downloading !== null}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Baixar PDF
            </Button>
          )}
        </div>
        <p className="text-sm text-[#525252]">
          {`${report.header.mode} · ${report.header.period} · ${report.header.closed}`}
        </p>
        <p className="text-sm text-[#525252]">{dueLine}</p>
        {report.header.closeReason && (
          <p className="text-sm text-[#525252]">{`Fechada fora do ciclo. Motivo: "${report.header.closeReason}"`}</p>
        )}
        {invoice.blockWaiver && invoice.blockWaivedUntil && (
          <p className="text-sm text-[#b45309]">
            {`Bloqueio liberado até ${instantWithWeekday(invoice.blockWaivedUntil)}${
              invoice.blockWaiver.by ? ` por ${invoice.blockWaiver.by}` : ""
            }${invoice.blockWaiver.reason ? `. Motivo: "${invoice.blockWaiver.reason}"` : ""}`}
          </p>
        )}
        {invoice.manualPayment && (
          <p className="text-sm text-[#15803d]">
            {`Baixa manual${invoice.manualPayment.by ? ` por ${invoice.manualPayment.by}` : ""}${
              invoice.manualPayment.reason ? `. Motivo: "${invoice.manualPayment.reason}"` : ""
            }`}
          </p>
        )}
      </header>

      {detail.alerts.map((alert, index) => (
        <div
          key={`${index}-${alert.code}-${alert.at}`}
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{alert.text}</p>
            {alert.note && <p className="mt-0.5">{alert.note}</p>}
          </div>
        </div>
      ))}

      <Section title="Total">
        <p
          className="text-2xl font-bold text-[#1d1d1b]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {report.totals.total}
        </p>
        <p className="mt-1 text-sm text-[#525252]">{`Conta: ${report.totals.calc}`}</p>
        {report.payment.lines.map((line) => (
          <p key={line} className="mt-1 text-sm text-[#525252]">
            {line}
          </p>
        ))}
        <p className="mt-3 text-sm text-[#1d1d1b]">
          {`Tomador (na data do fechamento): ${takerLine || "—"}`}
        </p>
      </Section>

      <Section title="Nota fiscal (NFS-e)">
        <InvoiceNfseBlock
          nfse={detail.nfse ?? null}
          invoiceStatus={invoice.status}
          reissueAvailable={!!detail.actions.nfseReissue}
        />
        <NfseReissueAction detail={detail} />
      </Section>

      <Section title="Ações">
        <InvoiceActions detail={detail} />
      </Section>

      <Section title="Cobranças Pix">
        {detail.charges.length === 0 ? (
          <p className="text-sm text-[#737373]">
            Nenhuma cobrança Pix ainda. O código sai quando a cobrança Pix estiver ligada.
          </p>
        ) : (
          <ul className="space-y-3">
            {detail.charges.map((charge) => (
              <li key={charge.id} className="space-y-2 text-sm">
                <p className="text-[#1d1d1b]">
                  {[
                    `${charge.attempt}ª`,
                    `criada ${formatInstantBrt(charge.createdAt)} por ${charge.createdBy}`,
                    charge.dueDate ? `vencimento ${dayLabel(charge.dueDate)}` : null,
                    charge.expiresAt ? `pagável até ${formatInstantBrt(charge.expiresAt)}` : null,
                    chargeStatusLabel(charge.status),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {charge.brCode && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCode(charge.brCode as string)}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Copiar código Pix
                    </Button>
                  )}
                  {charge.paymentLinkUrl && (
                    <a
                      href={charge.paymentLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-sm font-medium text-[#1d1d1b] hover:bg-[#f7f7f7]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Abrir link de pagamento
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Linhas (${lines.length})`}>
        {lines.length === 0 ? (
          <p className="text-sm text-[#737373]">Nenhuma linha nesta fatura.</p>
        ) : (
          <ul className="divide-y divide-[#f2f2f2]">
            {lines.map((line) => (
              <li key={line.lineId} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="min-w-0 text-[#1d1d1b]">
                    <span className="mr-2 text-xs text-[#737373]">
                      {line.serviceDate ? ddmm(line.serviceDate) : "—"}
                    </span>
                    <span className="font-medium">{line.title}</span>
                  </p>
                  <span className="font-semibold text-[#1d1d1b]">{line.amount}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#525252]">{`Conta: ${line.calc}`}</p>
                {line.feeCalc && <p className="text-xs text-[#525252]">{line.feeCalc}</p>}
                {line.source && <p className="text-xs text-[#737373]">{`Fonte: ${line.source}`}</p>}
              </li>
            ))}
          </ul>
        )}
        {detail.inReview.count > 0 && detail.inReview.text && (
          <p className="mt-3 rounded-lg bg-[#fffbeb] p-2.5 text-sm text-[#b45309]">
            {`Em conferência (${detail.inReview.count}): ${detail.inReview.text}`}
          </p>
        )}
      </Section>

      <Section title="Mensagens de cobrança">
        <MessagesTable history={detail.history} />
      </Section>

      {detail.auditTrail.length > 0 && (
        <Section title="Histórico de ações">
          <ul className="space-y-1.5 text-sm text-[#1d1d1b]">
            {detail.auditTrail.map((entry, index) => (
              <li key={`${index}-${entry.action}-${entry.at}`}>
                {`${entry.label} · ${formatInstantBrt(entry.at)} · ${entry.by} · Motivo: "${entry.reason}"`}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function MessagesTable({ history }: { history: AdminInvoiceDetail["history"] }) {
  if (history.length === 0) {
    return <p className="text-sm text-[#737373]">Nenhuma mensagem enviada ainda.</p>;
  }
  const channel = (channels: Record<string, string> | null, key: string) =>
    channelText(channels?.[key]);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Mensagens de cobrança desta fatura, da mais antiga à mais nova</caption>
          <thead>
            <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
              <th className="py-2 pr-3 font-medium">Passo</th>
              <th className="py-2 pr-3 font-medium">Quando</th>
              <th className="py-2 pr-3 font-medium">Quem</th>
              <th className="py-2 pr-3 font-medium">Push</th>
              <th className="py-2 pr-3 font-medium">E-mail</th>
              <th className="py-2 font-medium">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {history.map((event, index) => (
              <tr key={`${index}-${event.step}-${event.at}`} className="border-b border-[#f2f2f2] align-top last:border-0">
                <td className="py-2 pr-3 text-[#1d1d1b]">
                  {event.label}
                  {event.note && <p className="text-xs text-[#737373]">{`nota: "${event.note}"`}</p>}
                </td>
                <td className="py-2 pr-3">{formatInstantBrt(event.at)}</td>
                <td className="py-2 pr-3">{event.by}</td>
                <td className="py-2 pr-3">{channel(event.channels, "push")}</td>
                <td className="py-2 pr-3">{channel(event.channels, "email")}</td>
                <td className="py-2">{channel(event.channels, "whatsapp")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden" data-testid="messages-cards">
        {history.map((event, index) => (
          <li key={`${index}-${event.step}-${event.at}`} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
            <p className="font-semibold text-[#1d1d1b]">{event.label}</p>
            <p className="text-xs text-[#737373]">{`${formatInstantBrt(event.at)} · ${event.by}`}</p>
            {event.note && <p className="mt-1 text-xs text-[#525252]">{`nota: "${event.note}"`}</p>}
            <dl className="mt-2 space-y-0.5 text-xs">
              {[
                ["Push", "push"],
                ["E-mail", "email"],
                ["WhatsApp", "whatsapp"],
              ].map(([label, key]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-[#737373]">{label}</dt>
                  <dd className="text-right text-[#1d1d1b]">{channel(event.channels, key)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

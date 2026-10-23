import {
  getCompanyDocumentHtml,
  getVacancyDocumentHtml,
  getVacancyNfse,
  type VacancyNfseInvoice,
} from "@/modules/admin/infrastructure/vacancy-documents-api";
import type { DocumentKey } from "./system-health-presentation";

/**
 * Se o painel oferece "Abrir" para o documento no estado informado.
 *
 * Emitido (`OK`) sempre abre. O contrato também abre `PENDING` — falta uma
 * assinatura, mas o documento existe e mostra quem já assinou. Recibo, RPA e
 * NF-e pendentes/falhados/faltando NÃO têm documento: o botão só levaria a um
 * 404.
 */
export function canOpenDocument(key: DocumentKey, state: string | null | undefined): boolean {
  const s = (state ?? "").toUpperCase();
  if (s === "OK") return true;
  return key === "contract" && s === "PENDING";
}

const NO_SCRIPT_POLICY = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`;

/**
 * O documento abre numa aba com a MESMA origem do painel (blob URL), onde o
 * token de admin mora no localStorage. Os templates da API já escapam os dados
 * de usuário; a política sem scripts é a segunda trava, caso algum escape falhe.
 */
export function withNoScriptPolicy(html: string): string {
  const head = /<head[^>]*>/i.exec(html);
  if (!head) return `${NO_SCRIPT_POLICY}${html}`;
  const at = head.index + head[0].length;
  return `${html.slice(0, at)}${NO_SCRIPT_POLICY}${html.slice(at)}`;
}

/**
 * Abre o documento da vaga numa aba nova.
 *
 * A aba é aberta ANTES do `await`: o navegador só permite `window.open` no
 * mesmo tique do clique; depois da resposta ela já seria tratada como pop-up.
 * Em erro a aba é fechada e o erro sobe para quem chamou mostrar o toast.
 */
export async function openVacancyDocument(vacancyId: string, key: DocumentKey): Promise<void> {
  const tab = window.open("", "_blank");
  tab?.document.write(
    '<p style="font-family:Arial,sans-serif;color:#737373;padding:24px">Carregando documento…</p>',
  );

  try {
    if (key === "nfse") {
      const nfse = await getVacancyNfse(vacancyId);
      if (!nfse.pdfUrl) throw new Error("A nota foi emitida, mas a prefeitura não devolveu o link do PDF.");
      if (tab) tab.location.href = nfse.pdfUrl;
      else window.open(nfse.pdfUrl, "_blank", "noopener");
      return;
    }

    const html =
      key === "debitNote" || key === "paymentProof"
        ? await getCompanyDocumentHtml(vacancyId, key)
        : await getVacancyDocumentHtml(vacancyId, key);
    const url = URL.createObjectURL(
      new Blob([withNoScriptPolicy(html)], { type: "text/html;charset=utf-8" }),
    );
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
    // Dá tempo da aba carregar antes de liberar a memória do blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/**
 * Vaga faturada (API-3g): o meio do pagamento é a fatura, ou a API já mandou a
 * fatura da nota. `nfseInvoice: null` NÃO marca faturada: desde 13/10/2026 as
 * listas mandam `null` para TODA vaga (pré-paga inclusive), e tratar `null`
 * como faturada sumia com "Abrir" e "Reemitir" da NFS-e da vaga paga por Pix.
 */
export function isInvoicedVacancy(
  paymentMethod: string | null | undefined,
  nfseInvoice: VacancyNfseInvoice | null | undefined,
): boolean {
  return (paymentMethod ?? "").toUpperCase() === "INVOICE" || nfseInvoice != null;
}

const INVOICE_NUMBER = /\bFAT-\d{4}-\d+\b/;

/**
 * Para onde a NFS-e da vaga faturada leva: o detalhe da fatura, quando a API
 * manda o id dela (`nfseInvoice`). Sem o id, mas com o número no texto da API
 * ("NFS-e na fatura FAT-…"), a aba Faturas. Sem fatura (antes do fechamento, ou
 * vaga que o cupom zerou): nenhum link, só o texto da API.
 */
export function invoicedNfseLink(
  nfseInvoice: VacancyNfseInvoice | null | undefined,
  detailText: string | null | undefined,
): { href: string; number: string } | null {
  if (nfseInvoice?.invoiceId && nfseInvoice.number) {
    return {
      href: `/financeiro/faturas/${encodeURIComponent(nfseInvoice.invoiceId)}`,
      number: nfseInvoice.number,
    };
  }
  const number = detailText?.match(INVOICE_NUMBER)?.[0];
  return number ? { href: "/financeiro?aba=faturas", number } : null;
}

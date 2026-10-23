import axios from "axios";
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Documentos da vaga vivem sob /v1/admins (shared kernel), não sob a base de
// bares-restaurantes do `adminApi` — mesmo esquema do consultants-api.
const adminsRootApi = createAuthedClient("/v1/admins");
// Nota de Débito e comprovante da empresa (api #625/#626): rotas do fiscal, que
// aceitam o admin além da empresa dona da vaga. Não há rota em /v1/admins.
const fiscalApi = createAuthedClient("/v1/fiscal");

/** Documentos que a API devolve como HTML pronto para imprimir. */
export type HtmlVacancyDocument = "contract" | "receipt" | "rpa";

export interface VacancyNfse {
  number: string | null;
  verificationCode: string | null;
  /** Link público do PDF na emissora/prefeitura. */
  pdfUrl: string | null;
  amountInCents: number;
  issuedAt: string | null;
}

/**
 * Vaga faturada (API-3g, plano §17, N10/N11): a NFS-e é UMA por fatura, não da
 * vaga. A célula de documentos aponta para a fatura e não oferece "Reemitir"
 * (a nota da fatura é reemitida no detalhe da fatura, botão "Reemitir nota";
 * a reemissão por vaga responde 404).
 * `null` = vaga faturada que ainda não entrou numa fatura (ou que o cupom zerou).
 */
export interface VacancyNfseInvoice {
  invoiceId: string;
  /** "FAT-2026-000123". */
  number: string;
}

/**
 * HTML do contrato, recibo ou RPA da vaga.
 *
 * Com `responseType: "text"` o corpo de ERRO também chega como string — aqui ele
 * volta a ser objeto para o `getAxiosErrorMessage` achar a mensagem da API
 * ("Recibo não encontrado." etc.) em vez de cair no texto genérico.
 */
export async function getVacancyDocumentHtml(
  vacancyId: string,
  document: HtmlVacancyDocument,
): Promise<string> {
  try {
    const res = await adminsRootApi.get<string>(
      `/vacancies/${vacancyId}/documents/${document}`,
      { responseType: "text" },
    );
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && typeof err.response.data === "string") {
      try {
        err.response.data = JSON.parse(err.response.data);
      } catch {
        // corpo não-JSON: mantém como veio
      }
    }
    throw err;
  }
}

/** Documentos da EMPRESA servidos como HTML pelo fiscal. */
export type CompanyVacancyDocument = "debitNote" | "paymentProof";

const COMPANY_DOCUMENT_PATH: Record<CompanyVacancyDocument, string> = {
  debitNote: "debit-notes",
  paymentProof: "payment-proofs",
};

/**
 * HTML da Nota de Débito ou do comprovante de pagamento da vaga. 404
 * (`DEBIT_NOTE_NOT_FOUND`/`PAYMENT_PROOF_NOT_FOUND`) quando não foi emitido.
 */
export async function getCompanyDocumentHtml(
  vacancyId: string,
  document: CompanyVacancyDocument,
): Promise<string> {
  try {
    const res = await fiscalApi.get<string>(
      `/${COMPANY_DOCUMENT_PATH[document]}/${vacancyId}/html`,
      { responseType: "text" },
    );
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response && typeof err.response.data === "string") {
      try {
        err.response.data = JSON.parse(err.response.data);
      } catch {
        // corpo não-JSON: mantém como veio
      }
    }
    throw err;
  }
}

export async function getVacancyNfse(vacancyId: string): Promise<VacancyNfse> {
  const res = await adminsRootApi.get(`/vacancies/${vacancyId}/documents/nfse`);
  return res.data.data;
}

export interface NfseReissueResult {
  /** PENDING = enviada à prefeitura (responde em minutos); FAILED = recusada de novo. */
  status: "PENDING" | "FAILED" | "ISSUED";
  number: string | null;
  failureReason: string | null;
}

/** Reemite a NF-e RECUSADA da vaga (só status FAILED; exige permissão Financeiro). */
export async function reissueVacancyNfse(vacancyId: string): Promise<NfseReissueResult> {
  const res = await adminsRootApi.post(`/vacancies/${vacancyId}/documents/nfse/reissue`);
  return res.data.data;
}

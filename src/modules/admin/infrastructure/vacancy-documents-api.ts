import axios from "axios";
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Documentos da vaga vivem sob /v1/admins (shared kernel), não sob a base de
// bares-restaurantes do `adminApi` — mesmo esquema do consultants-api.
const adminsRootApi = createAuthedClient("/v1/admins");

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

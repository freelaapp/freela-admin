import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Biblioteca de modelos de marketing da Meta (spec 2026-10-01 campanhas parte 1 §4 e §9).
// Vive sob /v1/admins, como as campanhas.
const adminsRootApi = createAuthedClient("/v1/admins");

export type MarketingTemplateStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "ARCHIVED";

/**
 * Botões do modelo como a API guarda: no máximo 2, um de cada tipo. O "Não quero
 * receber" NÃO vem aqui — a API acrescenta sozinha como último botão.
 */
export type MarketingButton =
  /** `track: true` = "Contar cliques" (parte 2); ausente = link fixo. */
  | { type: "URL"; text: string; url: string; track?: boolean }
  | { type: "PHONE"; text: string; phone: string };

export interface MarketingRuleError {
  code: string;
  message: string;
}

export interface MarketingTemplateView {
  id: string;
  name: string;
  /** `mkt_<slug>_v<n>` — nome do modelo na Meta. */
  metaName: string;
  version: number;
  previousVersionId: string | null;
  /** Texto como o time escreve: `{nome}`, `{primeiro_nome}`, `{cidade}`. */
  body: string;
  paramOrder: string[];
  imageKey: string | null;
  /** URL assinada (1 h) só para a prévia. */
  imageUrl: string | null;
  buttons: MarketingButton[];
  status: MarketingTemplateStatus;
  metaTemplateId: string | null;
  metaCategory: string | null;
  /** A Meta reclassificou (≠ MARKETING): o custo pode mudar. */
  categoryWarning: boolean;
  rejectedReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  statusCheckedAt: string | null;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
  /** Regras quebradas do texto salvo (ex.: o "Sextou" copiado do banco). */
  ruleErrors: MarketingRuleError[];
  usage: { campaigns: number; automatic: number };
}

export interface MarketingTemplateInput {
  name: string;
  body: string;
  imageKey?: string | null;
  buttons?: Array<
    | { type: "URL"; text: string; url: string; track?: boolean }
    | { type: "PHONE"; text: string; phone: string }
  >;
}

export interface MarketingTestResult {
  status: "sent";
  wamid: string | null;
}

/** Sem `status`, a API devolve tudo menos ARCHIVED (`status=""` ela recusa). */
export async function listMarketingTemplates(
  status?: MarketingTemplateStatus,
): Promise<MarketingTemplateView[]> {
  const res = status
    ? await adminsRootApi.get("/marketing-templates", { params: { status } })
    : await adminsRootApi.get("/marketing-templates");
  return res.data.data;
}

export async function getMarketingTemplate(id: string): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.get(`/marketing-templates/${id}`);
  return res.data.data;
}

export async function createMarketingTemplate(
  input: MarketingTemplateInput,
): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.post("/marketing-templates", input);
  return res.data.data;
}

/** Só rascunho ou recusado (409 `MARKETING_TEMPLATE_NOT_EDITABLE` no resto). */
export async function updateMarketingTemplate(
  id: string,
  input: MarketingTemplateInput,
): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.put(`/marketing-templates/${id}`, input);
  return res.data.data;
}

/** Em análise, aprovado, pausado ou desativado: cria a próxima versão como rascunho. */
export async function newMarketingTemplateVersion(id: string): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.post(`/marketing-templates/${id}/version`);
  return res.data.data;
}

export async function archiveMarketingTemplate(id: string): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.patch(`/marketing-templates/${id}/archive`);
  return res.data.data;
}

/**
 * Envia para a Meta. Volta PENDING — ou a NOVA versão (outro `id`) quando a Meta não
 * deixa editar o recusado. Erro da Meta: 502 com a mensagem traduzida.
 */
export async function submitMarketingTemplate(id: string): Promise<MarketingTemplateView> {
  const res = await adminsRootApi.post(`/marketing-templates/${id}/submit`);
  return res.data.data;
}

/** Só modelo aprovado. Sem `phone`, a API manda para o celular do admin logado. */
export async function sendMarketingTemplateTest(
  id: string,
  payload: { phone?: string; campaignId?: string } = {},
): Promise<MarketingTestResult> {
  const res = await adminsRootApi.post(`/marketing-templates/${id}/test`, payload);
  return res.data.data;
}

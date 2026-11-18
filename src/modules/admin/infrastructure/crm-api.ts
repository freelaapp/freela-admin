import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const crmApi = createAuthedClient("/v1/admin/crm");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CrmCompanyStatus = "NOVO" | "EM_CONTATO" | "NEGOCIANDO" | "FECHADO" | "PERDIDO";
export type CrmPriority = "ALTA" | "MEDIA" | "BAIXA";

export interface CrmCompanyCard {
  id: string;
  name: string;
  status: CrmCompanyStatus;
  priority: CrmPriority;
  segment: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  linkedContractorUserId: string | null;
  assignedAdminId: string | null;
  boardOrder: number;
  openTasksCount: number;
  contactsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  companyId: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export interface CrmTask {
  id: string;
  companyId: string | null;
  title: string;
  priority: CrmPriority;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  ownerAdminId: string | null;
  createdAt: string;
  company?: { id: string; name: string } | null;
}

export interface CrmNote {
  id: string;
  companyId: string;
  adminId: string | null;
  body: string;
  createdAt: string;
}

export interface CrmCompanyDetail extends CrmCompanyCard {
  contacts: CrmContact[];
  tasks: CrmTask[];
  crmNotes: CrmNote[];
}

export interface ContractorSearchResult {
  userId: string;
  name: string;
  city: string | null;
  module: string;
}

export interface CreateCompanyInput {
  name: string;
  status?: CrmCompanyStatus;
  priority?: CrmPriority;
  segment?: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
  linkedContractorUserId?: string;
}
export type UpdateCompanyInput = Partial<Omit<CreateCompanyInput, "linkedContractorUserId">>;

export interface CreateTaskInput {
  title: string;
  companyId?: string;
  priority?: CrmPriority;
  dueAt?: string;
}
export interface UpdateTaskInput {
  title?: string;
  priority?: CrmPriority;
  dueAt?: string | null;
  done?: boolean;
}

export interface CreateContactInput {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

// ─── Companies ──────────────────────────────────────────────────────────────

export async function listCrmCompanies(params?: {
  status?: CrmCompanyStatus;
  priority?: CrmPriority;
  q?: string;
}): Promise<CrmCompanyCard[]> {
  const res = await crmApi.get("/companies", { params });
  return res.data.data;
}

export async function getCrmCompany(id: string): Promise<CrmCompanyDetail> {
  const res = await crmApi.get(`/companies/${id}`);
  return res.data.data;
}

export async function createCrmCompany(dto: CreateCompanyInput): Promise<CrmCompanyCard> {
  const res = await crmApi.post("/companies", dto);
  return res.data.data;
}

export async function updateCrmCompany(id: string, dto: UpdateCompanyInput): Promise<CrmCompanyCard> {
  const res = await crmApi.patch(`/companies/${id}`, dto);
  return res.data.data;
}

export async function moveCrmCompany(
  id: string,
  status: CrmCompanyStatus,
  boardOrder?: number,
): Promise<CrmCompanyCard> {
  const res = await crmApi.patch(`/companies/${id}/move`, { status, boardOrder });
  return res.data.data;
}

export async function deleteCrmCompany(id: string): Promise<void> {
  await crmApi.delete(`/companies/${id}`);
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export async function addCrmContact(companyId: string, dto: CreateContactInput): Promise<CrmContact> {
  const res = await crmApi.post(`/companies/${companyId}/contacts`, dto);
  return res.data.data;
}
export async function deleteCrmContact(id: string): Promise<void> {
  await crmApi.delete(`/contacts/${id}`);
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export async function listCrmTasks(params?: {
  done?: boolean;
  priority?: CrmPriority;
  companyId?: string;
}): Promise<CrmTask[]> {
  const res = await crmApi.get("/tasks", { params });
  return res.data.data;
}
export async function createCrmTask(dto: CreateTaskInput): Promise<CrmTask> {
  const res = await crmApi.post("/tasks", dto);
  return res.data.data;
}
export async function updateCrmTask(id: string, dto: UpdateTaskInput): Promise<CrmTask> {
  const res = await crmApi.patch(`/tasks/${id}`, dto);
  return res.data.data;
}
export async function deleteCrmTask(id: string): Promise<void> {
  await crmApi.delete(`/tasks/${id}`);
}

// ─── Notes ────────────────────────────────────────────────────────────────

export async function addCrmNote(companyId: string, body: string): Promise<CrmNote> {
  const res = await crmApi.post(`/companies/${companyId}/notes`, { body });
  return res.data.data;
}
export async function deleteCrmNote(id: string): Promise<void> {
  await crmApi.delete(`/notes/${id}`);
}

// ─── Buscar contratante já cadastrado ─────────────────────────────────────

export async function searchCrmContractors(q: string): Promise<ContractorSearchResult[]> {
  const res = await crmApi.get("/contractors/search", { params: { q } });
  return res.data.data;
}

// ─── Funil de contratantes (kanban da aba Pipeline) ───────────────────────

export type PipelineStage =
  | "CADASTRO_NOVO"
  | "PRIMEIRA_CONTRATACAO"
  | "SEGUNDA_CONTRATACAO"
  | "TERCEIRA_CONTRATACAO"
  | "CLIENTE_FIDELIZADO";

export interface PipelineCard {
  userId: string;
  name: string;
  /** Módulos onde o contratante existe: bars-restaurants e/ou home-services. */
  modules: string[];
  /** Estado (UF). */
  state: string | null;
  city: string | null;
  /** Ramo de atuação. */
  segment: string | null;
  whatsappPhone: string | null;
  hiringsCount: number;
  registeredAt: string;
  /** Quando mandamos a mensagem automática. `null` = ninguém falou com ele ainda. */
  lastMessageSentAt: string | null;
  /** Quantas vezes já mandamos — insistência demais queima o número. */
  messagesSentCount: number;
  // ── Situação da mensagem (aditivo: a API anterior a 16/11/2026 não manda) ──
  /** O que aconteceu com a última mensagem do Pipeline. */
  messageStatus?: PipelineMessageStatus;
  /** Por onde saiu: número oficial (`META`) ou chip de campanha (`LEGACY`). */
  messageChannel?: "META" | "LEGACY" | null;
  /** Por que a última tentativa não chegou (em `FAILED` e `UNCERTAIN`). */
  messageFailureReason?: string | null;
  messageDeliveredAt?: string | null;
  messageReadAt?: string | null;
  /** Resposta do contratante no número oficial, depois do último envio. */
  messageRepliedAt?: string | null;
  messageReplyText?: string | null;
  /** Tocou em "Não quero receber": campanha para ele não sai mais. */
  messageOptedOutAt?: string | null;
  /** Última campanha (fora do Pipeline) que ele recebeu por WhatsApp. */
  lastCampaign?: { name: string; sentAt: string } | null;
  /** Outra conta com o MESMO telefone já recebeu a mensagem do Pipeline. */
  samePhoneSentAt?: string | null;
}

/**
 * `UNCERTAIN` = a Meta não respondeu e a mensagem PODE ter chegado. Não é
 * "não enviada": mandar de novo sem olhar arrisca a mesma mensagem duas vezes.
 */
export type PipelineMessageStatus =
  | "NONE"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "REPLIED"
  | "FAILED"
  | "UNCERTAIN";

export interface PipelineColumn {
  stage: PipelineStage;
  title: string;
  count: number;
  cards: PipelineCard[];
}

export interface PipelineBoard {
  columns: PipelineColumn[];
  totalContractors: number;
}

export interface PipelinePeriodParams {
  /** Início do período de cadastro, `YYYY-MM-DD` inclusivo (dia de Brasília). */
  from?: string;
  /** Fim do período de cadastro, `YYYY-MM-DD` inclusivo. */
  to?: string;
}

export async function getCrmPipeline(params?: PipelinePeriodParams): Promise<PipelineBoard> {
  const res = await crmApi.get("/pipeline", { params });
  return res.data.data;
}

/** De qual aba saiu o clique: os cadastros antigos têm a mensagem da aba. */
export type PipelineSendSource = "FUNNEL" | "OLD_SIGNUPS";

export async function sendPipelineWhatsApp(
  userId: string,
  source?: PipelineSendSource,
): Promise<{
  ok: boolean;
  phone: string;
  sentAt: string;
  channel?: "META" | "LEGACY";
  /** Etapa cuja mensagem saiu; `null` = a mensagem geral (API de 18/11/2026 em diante). */
  stage?: PipelineMessageKey | null;
  messageKind?: "GENERAL" | "TEMPLATE" | "FREE_TEXT";
}> {
  // A API anterior a 18/11/2026 não lê o corpo; mandar a origem é inofensivo para ela.
  const res = await crmApi.post(`/pipeline/${userId}/whatsapp`, source ? { source } : undefined);
  return res.data.data;
}

// ─── Cadastros antigos (aba do Pipeline) ──────────────────────────────────

export interface PipelineOldSignups {
  /** "Cadastrado há mais de N dias". */
  days: number;
  /** Último dia de cadastro incluído, `YYYY-MM-DD` (Brasília, inclusivo). */
  registeredUntil: string;
  total: number;
  cards: PipelineCard[];
}

export async function getCrmOldSignups(days?: number): Promise<PipelineOldSignups> {
  const res = await crmApi.get("/pipeline/old-signups", { params: days ? { days } : undefined });
  return res.data.data;
}

// ─── Mensagem do Pipeline (modelo da Meta + WhatsApp do marketing) ────────

export interface PipelineTemplateOption {
  id: string;
  name: string;
  /** Texto do modelo, com as variáveis como o time escreve (`{primeiro_nome}`). */
  body: string;
  /** Tem botão de link — é por ele que o contratante chega ao marketing. */
  hasLinkButton: boolean;
}

export interface PipelineMarketingWhatsapp {
  whatsappE164: string;
  /** "(11) 97177-7563". */
  display: string;
  whatsappUrl: string;
  /** Ninguém configurou número: está valendo o WhatsApp de suporte. */
  isFallback: boolean;
}

/** As colunas do funil + a aba dos cadastros antigos: cada uma pode ter a sua mensagem. */
export type PipelineMessageKey = PipelineStage | "CADASTROS_ANTIGOS";

export interface PipelineStageMessage {
  key: PipelineMessageKey;
  label: string;
  templateId: string | null;
  /** Nome e situação do modelo da etapa (mesmo que tenha deixado de estar aprovado). */
  template: { id: string; name: string; status: string; statusLabel: string } | null;
  freeText: string | null;
}

export interface PipelineSettings {
  /** `META` = modelo escolhido; `LEGACY` = texto fixo pelo chip de campanha. */
  mode: "META" | "LEGACY";
  template: (PipelineTemplateOption & { status: string; statusLabel: string }) | null;
  /** Modelos aprovados pela Meta, para escolher. */
  availableTemplates: PipelineTemplateOption[];
  marketingWhatsapp: PipelineMarketingWhatsapp;
  /** Texto salvo da resposta automática; `null` = vale o padrão. */
  replyText: string | null;
  defaultReplyText: string;
  /** Como a resposta sai hoje, com o link já no lugar. */
  replyPreview: string;
  replyAlertEmail: string | null;
  /** Link para colocar no botão do modelo (leva ao WhatsApp do marketing). */
  marketingContactUrl: string;
  updatedAt: string | null;
  updatedBy: { id: string; name: string | null } | null;
  // ── Mensagem por etapa (aditivo: a API anterior a 18/11/2026 não manda) ──
  /** Sempre as 6 etapas; etapa sem nada = vale a mensagem geral. */
  stageMessages?: PipelineStageMessage[];
  /** "{primeiro_nome}", "{nome}", "{cidade}", "{link_marketing}". */
  stageFreeTextVariables?: string[];
  stageFreeTextMax?: number;
  serviceWindowHours?: number;
  /** `false` = o texto livre é salvo, mas o botão ainda não o envia. */
  stageFreeTextSends?: boolean;
}

/** Campo ausente = não mexe; vazio ou `null` = limpa. */
export interface UpdatePipelineSettingsInput {
  marketingTemplateId?: string | null;
  marketingWhatsapp?: string | null;
  replyText?: string | null;
  replyAlertEmail?: string | null;
  /** Substitui o mapa inteiro. Só mandar para a API que devolveu `stageMessages` no GET. */
  stageMessages?: Partial<
    Record<PipelineMessageKey, { templateId: string | null; freeText: string | null }>
  >;
}

export async function getCrmPipelineSettings(): Promise<PipelineSettings> {
  const res = await crmApi.get("/pipeline/settings");
  return res.data.data;
}

export async function updateCrmPipelineSettings(
  input: UpdatePipelineSettingsInput,
): Promise<PipelineSettings> {
  const res = await crmApi.put("/pipeline/settings", input);
  return res.data.data;
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Fila do suporte (fluxo de vagas v2, fatia C2; textos do designer, lote 2 §5.3). Rotas de
 * `/v1/bars-restaurants/admin/support-cases`, com a permissão de Vagas (`JOBS`).
 *
 * Com a chave da API desligada (`SUPPORT_QUEUE_ENABLED`), toda rota responde 404
 * `FEATURE_DISABLED`: a página mostra "A fila do suporte ainda não está ligada".
 */
const adminApi = createAuthedClient("/v1/bars-restaurants/admin");

export type SupportCaseFilter = "open" | "mine" | "closed_today";
export type SupportCaseReason =
  | "NO_ONE_AVAILABLE"
  | "ALL_FAILED"
  | "QUEUE_EMPTY"
  | "DAILY_CUTOFF"
  | "NO_SHOW";
export type SupportCaseRisk =
  | "NO_PRINCIPAL"
  | "PRINCIPAL_UNCONFIRMED"
  | "FIRST_ACCEPT_NO_RESERVE"
  | "NO_RESERVE";
export type SupportCaseStatus =
  "OPEN" | "IN_PROGRESS" | "SAVED" | "NOT_SAVED" | "CANCELLED";
export type SupportContactKind = "CONTRACTOR" | "PROVIDER" | "OTHER";
export type SupportContactChannel = "CALL" | "WHATSAPP";
export type SupportContactResult =
  "WILL_GO" | "WONT_GO" | "NO_ANSWER" | "THINKING" | "OTHER";
export type SupportCaseCloseOutcome =
  "SAVED" | "NOT_SAVED" | "CONTRACTOR_CANCELLED" | "SYSTEM_RESOLVED";

export interface SupportCaseItem {
  id: string;
  vacancyId: string;
  reason: SupportCaseReason;
  risk: SupportCaseRisk | null;
  status: SupportCaseStatus;
  startTime: string;
  openedAt: string;
  /** Quando saiu o alerta ao time (e o aviso à empresa, nos motivos em que ela é avisada). */
  notifiedAt: string | null;
  /** Relógio do caso: até quando dar notícia à empresa (só quando ela foi avisada). */
  newsDueAt: string | null;
  assignedTo: { adminId: string; name: string | null } | null;
  assignedAt: string | null;
  closedAt: string | null;
  /** SUPPORT_FOUND | SYSTEM_RESOLVED | NO_ONE_FOUND | CONTRACTOR_CANCELLED | VACANCY_CANCELLED | VACANCY_STARTED */
  closeReason: string | null;
  closeNote: string | null;
  closedBy: {
    kind: "ADMIN" | "SYSTEM";
    adminId: string | null;
    name: string | null;
  } | null;
  vacancy: {
    title: string;
    companyName: string | null;
    neighborhood: string | null;
    city: string | null;
    /** "sáb 07/11", "18h" e "23h": os formatos das mensagens. */
    dayLabel: string;
    startLabel: string;
    endLabel: string;
  };
  contractor: { contactName: string | null; phone: string | null };
  contactsCount: number;
}

export interface SupportCaseContact {
  id: string;
  kind: SupportContactKind;
  candidacyId: string | null;
  name: string | null;
  channel: SupportContactChannel;
  result: SupportContactResult;
  note: string | null;
  contactedAt: string;
  recordedBy: { adminId: string; name: string | null };
}

export interface SupportCasePerson {
  candidacyId: string;
  name: string | null;
  phone: string | null;
  role: "PRINCIPAL" | "RESERVE";
  position: number | null;
  confirmed: boolean;
}

export interface SupportCaseDetail extends SupportCaseItem {
  contacts: SupportCaseContact[];
  people: SupportCasePerson[];
  /** O que o freelancer recebe ("137,28"), para a mensagem E. */
  payLabel: string | null;
  /** Link da vaga para o freelancer (mensagem E). */
  vacancyUrl: string;
}

export interface SupportCaseList {
  items: SupportCaseItem[];
  counts: { open: number; mine: number; closedToday: number };
  supportHours: {
    open: boolean;
    /** "seg a sáb, 8h às 18h" (da configuração da API). */
    label: string;
    nextOpeningAt: string | null;
    /** "seg 09/11 às 8h". */
    nextOpeningLabel: string | null;
  };
  /** "16h30" (da configuração). */
  cutoffLabel: string;
  firstNewsMinutes: number;
}

export async function listSupportCases(
  filter: SupportCaseFilter,
): Promise<SupportCaseList> {
  const res = await adminApi.get("/support-cases", {
    params: { status: filter },
  });
  return res.data.data;
}

export async function getSupportCase(id: string): Promise<SupportCaseDetail> {
  const res = await adminApi.get(`/support-cases/${id}`);
  return res.data.data;
}

export async function assumeSupportCase(
  id: string,
): Promise<SupportCaseDetail> {
  const res = await adminApi.post(`/support-cases/${id}/assume`);
  return res.data.data;
}

export async function recordSupportContact(
  id: string,
  body: {
    kind: SupportContactKind;
    candidacyId?: string;
    name?: string;
    channel: SupportContactChannel;
    result: SupportContactResult;
    note?: string;
  },
): Promise<SupportCaseDetail> {
  const res = await adminApi.post(`/support-cases/${id}/contacts`, body);
  return res.data.data;
}

export async function closeSupportCase(
  id: string,
  body: { outcome: SupportCaseCloseOutcome; note?: string },
): Promise<SupportCaseDetail> {
  const res = await adminApi.post(`/support-cases/${id}/close`, body);
  return res.data.data;
}

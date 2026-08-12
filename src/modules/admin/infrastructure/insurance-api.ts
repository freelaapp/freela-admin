import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const insuranceApi = createAuthedClient("/v1/admins/insurance");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type IzaEnvironment = "PRODUCTION" | "HOMOLOGATION" | "DISABLED";
export type HealthStepStatus = "ok" | "falha" | "alerta" | "pulado";
export type CoverageStatus =
  | "PENDING_OPEN"
  | "OPEN"
  | "CLOSED"
  | "CANCELLED"
  | "FAILED"
  | "UNINSURABLE";
export type InsuranceModule = "bars-restaurants" | "home-services";

export interface HealthStep {
  key: "credencial" | "ambiente" | "organizacao" | "apolice";
  label: string;
  status: HealthStepStatus;
  detail: string;
}

export interface HealthCheck {
  id: string;
  checkedAt: string;
  source: "SCHEDULED" | "MANUAL";
  ok: boolean;
  environment: IzaEnvironment;
  baseUrl: string;
  latencyMs: number | null;
  httpStatus: number | null;
  organization: string | null;
  steps: HealthStep[];
  error: string | null;
}

export interface InsuranceConfig {
  enabled: boolean;
  openEnabled: boolean;
  environment: IzaEnvironment;
  baseUrl: string;
  tokenConfigured: boolean;
  tokenLength: number;
  travelPreMinutes: number;
  alertEmail: string | null;
  expectedOrganization: string;
}

export interface InsuranceAlert {
  key: string;
  label: string;
  total: number;
  severity: "critico" | "atencao" | "info";
  detail: string;
}

export interface InsuranceStatus {
  config: InsuranceConfig;
  ultimoTeste: HealthCheck | null;
  /** Início da operação real. O que veio antes rodou contra a homologação e não
   * entra em conta nenhuma — as apólices daquele período não eram de verdade. */
  contandoDesde: string;
  janelas: {
    hoje: Record<string, number>;
    seteDias: Record<string, number>;
    trintaDias: Record<string, number>;
  };
  cadastros: Record<string, number>;
  alertas: InsuranceAlert[];
}

export interface CoverageVacancy {
  id: string;
  module: InsuranceModule;
  title: string | null;
  serviceType: string | null;
  date: string | null;
  status: string | null;
  contractorName: string | null;
  local: string | null;
}

export interface Coverage {
  id: string;
  module: InsuranceModule;
  jobId: string;
  vacancyId: string;
  userId: string;
  providerName: string | null;
  document: string | null;
  status: CoverageStatus;
  uninsurableReason: string | null;
  izaPeriodId: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  sentStartedAt: string | null;
  sentFinishedAt: string | null;
  checkoutAt: string | null;
  duracaoMinutos: number | null;
  /** Fechou em menos de 5 min: o serviço aconteceu praticamente descoberto,
   * apesar de a linha estar em CLOSED como qualquer outra. */
  apoliceCurta: boolean;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
  vacancy: CoverageVacancy | null;
}

export interface IzaPeriodView {
  id: string;
  tipo: string | null;
  tipoLabel: string;
  status: string | null;
  statusLabel: string;
  /** Texto cru da IZA. Vem com sufixo `Z` mas o valor é hora LOCAL — não
   * converter fuso aqui, ou o horário anda 3 h. */
  inicio: string | null;
  fim: string | null;
}

export interface CoverageDetail extends Coverage {
  cadastro: {
    state: string;
    izaPersonId: string | null;
    izaContractId: string | null;
    lastError: string | null;
    updatedAt: string;
  } | null;
  trajeto: { sentAt: string } | null;
  iza: {
    consultadoEm: string;
    erro: string | null;
    pessoa: {
      id: string | null;
      nome: string | null;
      nascimento: string | null;
      contratos: {
        id: string;
        nome: string | null;
        tipo: string | null;
        status: string | null;
        inicio: string | null;
        fim: string | null;
      }[];
    } | null;
    periodos: IzaPeriodView[];
  };
}

export interface CoverageFilters {
  status?: string;
  module?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ─── Chamadas ───────────────────────────────────────────────────────────────

export async function getInsuranceStatus(): Promise<InsuranceStatus> {
  const res = await insuranceApi.get("/status");
  return res.data.data;
}

export async function runInsuranceHealthCheck(): Promise<HealthCheck> {
  const res = await insuranceApi.post("/health-check");
  return res.data.data;
}

export async function getInsuranceHealthChecks(limit = 30): Promise<HealthCheck[]> {
  const res = await insuranceApi.get("/health-checks", { params: { limit } });
  return res.data.data;
}

export async function getInsuranceCoverages(
  filters: CoverageFilters,
): Promise<{ items: Coverage[]; total: number; page: number; pageSize: number }> {
  // Campo vazio não vira filtro: `status=` string vazia seria recusada pelo
  // enum do DTO e derrubaria a tela inteira com 400.
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  }

  const res = await insuranceApi.get("/coverages", { params });
  return {
    items: res.data.data,
    total: res.data.meta?.total ?? 0,
    page: res.data.meta?.page ?? 1,
    pageSize: res.data.meta?.pageSize ?? 20,
  };
}

export async function getInsuranceCoverage(id: string): Promise<CoverageDetail> {
  const res = await insuranceApi.get(`/coverages/${id}`);
  return res.data.data;
}

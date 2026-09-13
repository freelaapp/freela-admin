import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Vagas Fixas (FixedJobPost) — listagem admin sob /v1/fixed-jobs/admin.
const fixedJobsAdminApi = createAuthedClient("/v1/fixed-jobs/admin");

export interface FixedJobItem {
  id: string;
  contractorUserId: string;
  title: string;
  role: string;
  category: string | null;
  companyName: string;
  location: string;
  status: string;
  salaryMinInCents: number | null;
  salaryMaxInCents: number | null;
  /** Proposta salarial única — o campo que os fluxos de criação realmente
   * preenchem (min/max ficam nulos). Opcional durante deploy da API. */
  salaryProposalInCents?: number | null;
  closeReason: string | null;
  closedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  applicationCount: number;
  /** Consultor que indicou o contratante desta vaga (null quando não indicado). */
  referringConsultant?: { id: string; name: string; code: string } | null;
}

export async function getAdminFixedJobs(consultantId?: string): Promise<FixedJobItem[]> {
  const res = await fixedJobsAdminApi.get("/posts", {
    params: consultantId ? { consultantId } : undefined,
  });
  return res.data.data;
}

/** Um dia de jornada da vaga fixa (dia da semana + horário início/fim). */
export interface FixedJobWorkScheduleSlot {
  day: string;
  start: string;
  end: string;
}

/**
 * Payload para o admin criar uma vaga fixa/CLT em nome de um contratante.
 * Espelha o formulário do contratante no site + `contractorUserId` (o dono da vaga).
 * Enviado para `POST /v1/fixed-jobs/admin/posts`.
 */
export interface CreateAdminFixedJobPayload {
  contractorUserId: string;
  title: string;
  role: string;
  category?: string;
  companyName: string;
  description: string;
  location: string;
  salaryProposalInCents?: number;
  workSchedule?: string;
  workScheduleSlots?: FixedJobWorkScheduleSlot[];
  benefits?: string;
  contactEmail?: string;
  contactPhone?: string;
  applicationInstructions?: string;
}

export async function createAdminFixedJob(
  payload: CreateAdminFixedJobPayload,
): Promise<FixedJobItem> {
  const res = await fixedJobsAdminApi.post("/posts", payload);
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Candidaturas de vagas fixas (viewer de candidatos no admin)
// ---------------------------------------------------------------------------

/** Status de uma candidatura de vaga fixa. `ACTIVE` = em consideração; `REJECTED` = negada. */
export type FixedJobApplicationStatus = "ACTIVE" | "REJECTED";

/**
 * Currículo profissional preenchido pelo freelancer (JSON livre). Espelha o
 * shape lido pelo `FreelancerCurriculumReadonly` do web. Todos os campos são
 * opcionais — o renderer ignora entradas vazias.
 */
export interface FixedJobProfessionalCurriculum {
  experiences?: Array<{ workplace?: string; role?: string; durationLabel?: string }>;
  courses?: Array<{ title?: string; durationLabel?: string; completionYear?: number | string }>;
  skills?: string;
  competitiveEdge?: string;
}

/** Perfil global do provider anexado à candidatura (null quando `providerGlobalId` é null). */
export interface FixedJobApplicationProvider {
  avatarUrl: string | null;
  presentationVideoUrl: string | null;
  professionalCurriculum: FixedJobProfessionalCurriculum | null;
}

/** Uma candidatura a uma vaga fixa, na visão do admin. */
export interface FixedJobAdminApplication {
  id: string;
  fixedJobPostId: string;
  providerUserId: string;
  providerGlobalId: string | null;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  message: string | null;
  curriculumSnapshot: FixedJobProfessionalCurriculum | null;
  curriculumPdfUrl: string | null;
  curriculumPdfName: string | null;
  status: FixedJobApplicationStatus;
  rejectedAt: string | null;
  createdAt: string;
  provider: FixedJobApplicationProvider | null;
}

/** Candidaturas de uma vaga fixa (ordenadas por `createdAt` desc). */
export async function getFixedJobApplications(
  postId: string,
): Promise<FixedJobAdminApplication[]> {
  const res = await fixedJobsAdminApi.get(`/posts/${postId}/applications`);
  return res.data.data;
}

/** Atualiza o status de uma candidatura (ACTIVE ⇄ REJECTED). */
export async function setFixedJobApplicationStatus(
  applicationId: string,
  status: FixedJobApplicationStatus,
): Promise<FixedJobAdminApplication> {
  const res = await fixedJobsAdminApi.patch(`/applications/${applicationId}/status`, {
    status,
  });
  return res.data.data;
}

// ---------------------------------------------------------------------------
// Kanban de seleção da vaga fixa (Candidatos → ... → Selecionado)
// ---------------------------------------------------------------------------

/** Colunas do kanban de seleção, na ordem do funil (mesma enum da API). */
export type FixedJobKanbanStage =
  | "CANDIDATE"
  | "PRE_SELECTED"
  | "SELECTED"
  | "INTERVIEW"
  | "TEST"
  | "FINAL_SELECTED";

/**
 * Eixos do score de compatibilidade determinístico — substituiu a triagem por
 * IA (que nunca chegou a rodar em produção).
 */
export type FixedJobMatchAxis = "experience" | "distance" | "profile" | "availability" | "keywords";

/**
 * Resultado de um eixo do score. `applicable: false` quer dizer que o eixo
 * **não foi avaliado** (ex.: falta endereço para calcular distância) — é
 * ausência de dado, não uma nota zero. `detail` já vem em português, pronto
 * para exibir.
 */
export interface FixedJobMatchAxisResult {
  score: number;
  weight: number;
  applicable: boolean;
  detail: string;
}

/**
 * Decomposição v1/v2 do score — o "porquê" da nota por EIXO. Não tem `version`
 * (só o v3 carrega). É o shape gravado até a fase 3 do Match e o que a API
 * devolve enquanto `MATCH_V3_ENABLED` está desligada.
 */
export interface FixedJobMatchBreakdownV2 {
  /** null = pontuado, mas nenhum eixo da vaga se aplicou (só sobrava o perfil). */
  total: number | null;
  // Partial, não Record cheio: card pontuado antes de 10/08/2026 foi gravado
  // sem o eixo `keywords`, e prometer a chave faria a tela ler undefined como
  // se fosse objeto.
  weights: Partial<Record<FixedJobMatchAxis, number>>;
  axes: Partial<Record<FixedJobMatchAxis, FixedJobMatchAxisResult>>;
}

// --- Match v3 (spec 2026-09-11/13, atrás de MATCH_V3_ENABLED) --------------
// Modelo de 4 critérios (Currículo 50 / Distância 20 / Disponibilidade 20 /
// Avaliação 10). A API só emite este shape quando a flag está ligada; o card
// só o lê quando `version === 3`. Espelha `MatchV3Breakdown` do backend.

/** Chaves dos 4 critérios do v3, na ordem de exibição. */
export type FixedJobMatchV3CriterionKey =
  | "curriculum"
  | "distance"
  | "availability"
  | "rating";

/** Motivo do BLOQUEIO (fase 3): currículo ilegível/ausente ou disponibilidade não cadastrada. */
export type FixedJobMatchV3BlockedReason = "CURRICULUM" | "AVAILABILITY";

/** Um dos 4 critérios do v3. `score: 'NA'` = sem dado para comparar (sai da média). */
export interface FixedJobMatchV3Criterion {
  key: FixedJobMatchV3CriterionKey;
  /** Rótulo em PT pronto para exibir (ex.: "Currículo"). */
  label: string;
  /** Peso do critério (0–1). */
  weight: number;
  /** 0–100, ou 'NA' quando não há dado para comparar. */
  score: number | "NA";
  /** Frase curta e objetiva do porquê da nota. */
  justification: string;
}

/** Composição interna da nota de currículo (transparência no painel). */
export interface FixedJobMatchV3CurriculumSubscores {
  experience: number;
  skills: number;
  education: number;
  overall: number;
}

/** Decomposição v3 do score — 4 critérios + estado (SCORED/BLOCKED). */
export interface FixedJobMatchBreakdownV3 {
  /** Discriminador de versão (v1/v2 não têm). */
  version: 3;
  /** 'BLOCKED' (fase 3) = match não pontua mesmo havendo critérios avaliáveis. */
  status: "SCORED" | "BLOCKED";
  /** Motivos do bloqueio; `[]` quando SCORED. */
  blockedReasons: FixedJobMatchV3BlockedReason[];
  /** 0–100, ou null quando nada pôde ser comparado OU o match está BLOQUEADO. */
  total: number | null;
  /** Palavra da faixa ("Excelente" …); null se total null. */
  classification: string | null;
  /** Frase da faixa ("Excelente aderência" …); null se total null. */
  classificationLabel: string | null;
  /** Sempre os 4 critérios, na ordem currículo/distância/disp./avaliação — mesmo BLOQUEADO. */
  criteria: FixedJobMatchV3Criterion[];
  /** Composição do critério de currículo (ou null). */
  curriculumSubscores: FixedJobMatchV3CurriculumSubscores | null;
}

/**
 * Decomposição do score — v1/v2 (por eixo) OU v3 (4 critérios). É união
 * porque a mesma vaga pode ter cards gravados antes e depois de ligar o v3.
 * Use `isMatchBreakdownV3` para discriminar.
 */
export type FixedJobMatchBreakdown = FixedJobMatchBreakdownV2 | FixedJobMatchBreakdownV3;

/** Discrimina o breakdown v3 (4 critérios) do v1/v2 (por eixo). */
export function isMatchBreakdownV3(
  breakdown: FixedJobMatchBreakdown | null | undefined,
): breakdown is FixedJobMatchBreakdownV3 {
  return !!breakdown && "version" in breakdown && breakdown.version === 3;
}

/** Card do kanban: a candidatura + estágio + resultado do score de compatibilidade. */
export interface FixedJobKanbanCard extends FixedJobAdminApplication {
  kanbanStage: FixedJobKanbanStage;
  kanbanStageAt: string | null;
  /** Compatibilidade 0–100 do cálculo determinístico (null = nunca calculado). */
  matchScore: number | null;
  matchBreakdown: FixedJobMatchBreakdown | null;
  matchedAt: string | null;
  /**
   * `true` quando o cálculo não teve confiança para promover automaticamente
   * (ex.: currículo só em PDF, sem os campos estruturados — ~56% da base).
   * O candidato continua pontuado e visível; só não é promovido sozinho —
   * a decisão fica para revisão manual.
   */
  needsManualReview: boolean;
}

export interface FixedJobKanbanColumn {
  stage: FixedJobKanbanStage;
  /** Título em PT vindo da API ("Candidatos", "Pré-selecionados", ...). */
  title: string;
  count: number;
  cards: FixedJobKanbanCard[];
}

export interface FixedJobKanbanBoard {
  post: {
    id: string;
    title: string;
    role: string;
    category: string | null;
    companyName: string;
    location: string;
    status: string;
    createdAt: string;
  };
  columns: FixedJobKanbanColumn[];
  totalApplications: number;
  /** Candidaturas recusadas ficam fora das colunas — contadas aqui. */
  rejectedCount: number;
  /** Precisam de olho humano (ex.: currículo só em PDF) — somem dentro de "Candidatos" sem este contador. */
  needsManualReviewCount: number;
}

export async function getFixedJobKanban(postId: string): Promise<FixedJobKanbanBoard> {
  const res = await fixedJobsAdminApi.get(`/posts/${postId}/kanban`);
  return res.data.data;
}

/** Move o card de coluna (seletor "mover para →"). Movimento livre entre estágios. */
export async function setFixedJobApplicationStage(
  applicationId: string,
  stage: FixedJobKanbanStage,
): Promise<FixedJobKanbanCard> {
  const res = await fixedJobsAdminApi.patch(`/applications/${applicationId}/stage`, { stage });
  return res.data.data;
}

/** Um resultado individual de uma rodada de cálculo de compatibilidade. */
export interface FixedJobMatchScoreResultItem {
  applicationId?: string;
  applicantName?: string;
  score?: number | null;
  needsManualReview?: boolean;
  promoted?: boolean;
  error?: string;
}

/** Relatório de uma rodada do cálculo de compatibilidade determinístico. */
export interface FixedJobMatchScoreReport {
  /** Corte (%): score >= corte foi promovido para "Pré-selecionados" (quando sem `needsManualReview`). */
  threshold: number;
  weights: Record<FixedJobMatchAxis, number>;
  evaluated: number;
  promoted: number;
  /** Pontuados mas não promovidos automaticamente — precisam de revisão manual. */
  needsManualReview: number;
  skipped: number;
  results: FixedJobMatchScoreResultItem[];
}

/**
 * Calcula a compatibilidade (score determinístico) dos candidatos em
 * "Candidatos": quem passa do corte é promovido para "Pré-selecionados",
 * exceto quem precisa de revisão manual — esses ficam pontuados, mas no
 * lugar em que estavam, até uma decisão humana. `force` recalcula também
 * quem já tem score.
 */
export async function runFixedJobMatchScore(
  postId: string,
  force = false,
): Promise<FixedJobMatchScoreReport> {
  const res = await fixedJobsAdminApi.post(`/posts/${postId}/match-score`, { force });
  return res.data.data;
}

/**
 * Diagnóstico de alcance da vaga fixa.
 *
 * Responde "essa vaga está aparecendo para alguém?" — a pergunta que ficou sem
 * resposta enquanto 3 vagas do Grupo Trigo passavam 4 dias com zero candidatos
 * por serem invisíveis (sem coordenada, medidas a partir da matriz em SP).
 */
export interface FixedJobReach {
  city: string | null;
  uf: string | null;
  /** Sem coordenada o alcance cai para quem tem o NOME da cidade batendo. */
  semCoordenada: boolean;
  alcance: number;
  doCargo: number;
}

export async function getFixedJobReach(postId: string): Promise<FixedJobReach> {
  const res = await fixedJobsAdminApi.get(`/posts/${postId}/reach`);
  return res.data.data;
}

/** Reanuncia no grupo de WhatsApp da cidade da vaga. */
export async function resendFixedJobGroupMessage(postId: string): Promise<void> {
  await fixedJobsAdminApi.post(`/posts/${postId}/resend-group-message`);
}

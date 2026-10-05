import type {
  ReferralItem,
  ReferralPendingReason,
  ReferredAccountKind,
  ReferredStage,
} from "@/modules/admin/infrastructure/referrals-api";

/**
 * Textos da tela de Indicações. A API devolve códigos; aqui eles viram a frase
 * que o suporte lê para o freelancer que pergunta "por que não ganhei?".
 */

export type Tone = "ok" | "progress" | "warn" | "dead";

export const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  progress: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  dead: "bg-neutral-200 text-neutral-700",
};

export const ACCOUNT_KIND: Record<ReferredAccountKind, { label: string; className: string }> = {
  EMPRESA: { label: "Empresa", className: "bg-emerald-100 text-emerald-800" },
  CASA: { label: "Em Casa", className: "bg-amber-100 text-amber-800" },
  FREELANCER: { label: "Freelancer", className: "bg-blue-100 text-blue-700" },
  SEM_PERFIL: { label: "Só criou o login", className: "bg-neutral-200 text-neutral-700" },
};

export const ACCOUNT_KIND_FILTER: Array<{ value: ReferredAccountKind | ""; label: string }> = [
  { value: "", label: "Todos os tipos de conta" },
  { value: "EMPRESA", label: "Empresa" },
  { value: "SEM_PERFIL", label: "Só criou o login" },
  { value: "FREELANCER", label: "Freelancer" },
  { value: "CASA", label: "Em Casa" },
];

export const STAGE_LABEL: Record<ReferredStage, string> = {
  CONTA_EXCLUIDA: "Conta excluída",
  SO_LOGIN: "Parou no 1º passo (só criou o login)",
  PERFIL_FREELANCER: "Fez cadastro de freelancer",
  PERFIL_CASA: "Fez cadastro Em Casa",
  PERFIL_EMPRESA: "Cadastro de empresa completo, sem vaga",
  PUBLICOU_VAGA: "Publicou vaga, ainda sem contratação",
  CONTRATOU: "Contratou, serviço não concluído",
  CONCLUIU: "Concluiu serviço",
};

/** Caminho da empresa até a recompensa — o indicador de etapas da tabela. */
export const EMPRESA_STEPS = ["Login", "Empresa", "Vaga", "Contratou", "Concluiu"] as const;

/**
 * Posição da etapa no caminho da empresa (0 = só login). `null` para quem saiu
 * do caminho: freelancer, Em Casa e conta excluída não chegam à recompensa.
 */
export function empresaStepIndex(stage: ReferredStage): number | null {
  switch (stage) {
    case "SO_LOGIN":
      return 0;
    case "PERFIL_EMPRESA":
      return 1;
    case "PUBLICOU_VAGA":
      return 2;
    case "CONTRATOU":
      return 3;
    case "CONCLUIU":
      return 4;
    default:
      return null;
  }
}

export const PENDING_REASON: Record<
  ReferralPendingReason,
  { label: string; detail: string; tone: Tone }
> = {
  CONTA_EXCLUIDA: {
    label: "Conta excluída",
    detail: "O indicado excluiu a conta. Essa indicação não gera mais recompensa.",
    tone: "dead",
  },
  NAO_E_EMPRESA: {
    label: "Não é empresa — não conta",
    detail:
      "A conta virou freelancer ou contratante Em Casa. O programa só paga quando quem chega é empresa (bar/restaurante).",
    tone: "dead",
  },
  PRAZO_ENCERRADO: {
    label: "Prazo de 30 dias encerrado",
    detail:
      "O indicado não concluiu um serviço em até 30 dias do cadastro. Essa indicação não gera mais recompensa.",
    tone: "dead",
  },
  SO_LOGIN: {
    label: "Parou no 1º passo do cadastro",
    detail:
      "Criou o login, mas não completou o cadastro de empresa. Por isso não aparece em Empresas nem em Freelancers — só em Usuários.",
    tone: "warn",
  },
  SEM_VAGA: {
    label: "Ainda não publicou vaga",
    detail: "Cadastro de empresa completo. Falta publicar a primeira vaga.",
    tone: "progress",
  },
  SEM_CONTRATACAO: {
    label: "Publicou vaga, ainda não contratou",
    detail: "Já publicou vaga. Falta contratar um freelancer e concluir o serviço.",
    tone: "progress",
  },
  SERVICO_NAO_CONCLUIDO: {
    label: "Contratou — falta concluir",
    detail: "Já contratou. A recompensa nasce quando o serviço for concluído.",
    tone: "progress",
  },
  VAGA_ABAIXO_DO_MINIMO: {
    label: "Vaga abaixo de R$ 80",
    detail:
      "Concluiu serviço, mas o valor pago ao freelancer ficou abaixo do mínimo de R$ 80 que vale recompensa (trava antifraude). Uma próxima vaga de R$ 80 ou mais, dentro do prazo, ainda qualifica.",
    tone: "warn",
  },
  CONCLUIU_FORA_DO_PRAZO: {
    label: "Concluiu depois dos 30 dias",
    detail:
      "O serviço foi concluído depois do prazo de 30 dias contados do cadastro do indicado.",
    tone: "dead",
  },
  AGUARDANDO_PROCESSAMENTO: {
    label: "Concluiu — recompensa em processamento",
    detail:
      "O serviço passa em todas as regras. A conferência diária (06h20) cria a recompensa se a conclusão não tiver avisado o programa.",
    tone: "ok",
  },
};

/** Ordem do quadro "por que ainda não ganhou": o que dá para destravar primeiro. */
export const PENDING_REASON_ORDER: ReferralPendingReason[] = [
  "AGUARDANDO_PROCESSAMENTO",
  "SERVICO_NAO_CONCLUIDO",
  "SEM_CONTRATACAO",
  "SEM_VAGA",
  "SO_LOGIN",
  "VAGA_ABAIXO_DO_MINIMO",
  "NAO_E_EMPRESA",
  "CONCLUIU_FORA_DO_PRAZO",
  "PRAZO_ENCERRADO",
  "CONTA_EXCLUIDA",
];

const REJECTION_LABEL: Record<string, string> = {
  AUTO_INDICACAO: "Indicou a si mesmo",
  TELEFONE_IGUAL_AO_DO_INDICADOR: "Mesmo telefone de quem indicou",
  EMAIL_IGUAL_AO_DO_INDICADOR: "Mesmo e-mail de quem indicou",
  CPF_IGUAL_AO_DO_INDICADOR: "Mesmo CPF/CNPJ de quem indicou",
  INDICADO_NAO_E_CONTRATANTE_EMPRESA: "Indicado não é empresa",
  INDICADOR_NAO_E_FREELANCER: "Quem indicou não era freelancer (regra antiga)",
  INDICADOR_SEM_CADASTRO_DE_FREELANCER_NEM_CONTRATANTE:
    "Quem indicou não tem cadastro de freelancer nem de contratante",
};

export function rejectionLabel(reason: string | null | undefined): string {
  if (!reason) return "Rejeitada";
  return REJECTION_LABEL[reason] ?? reason;
}

/** Situação da indicação em uma frase, com cor e explicação. */
export function describeSituation(item: ReferralItem): {
  label: string;
  tone: Tone;
  detail: string | null;
} {
  if (item.status === "QUALIFIED") {
    return {
      label: "Qualificou",
      tone: "ok",
      detail: "Concluiu a primeira vaga dentro das regras. A recompensa está na aba Recompensas.",
    };
  }
  if (item.status === "REJECTED") {
    if (item.rejectedByPersonaBug) {
      const eraEmpresa = item.referredAccount?.kind === "EMPRESA";
      return {
        label: eraEmpresa ? "Rejeitada por erro (era empresa)" : "Rejeitada por erro do sistema",
        tone: "dead",
        detail:
          "Até 28/09/2026 um erro recusava TODA indicação como \"não é empresa\". O erro foi corrigido e as recusas antigas não foram reabertas.",
      };
    }
    return { label: rejectionLabel(item.rejectionReason), tone: "dead", detail: null };
  }
  const reason = item.referredAccount?.pendingReason;
  if (!reason) return { label: "Cadastrou", tone: "dead", detail: null };
  const { label, detail, tone } = PENDING_REASON[reason];
  return { label, detail, tone };
}

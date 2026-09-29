/**
 * Texto da confirmação de exclusão de uma conta da plataforma, a partir da
 * PRÉVIA da API. Regra do dono (29/09/2026): conta com histórico nunca é apagada
 * de vez — é desativada e anonimizada; o admin precisa saber qual dos dois vai
 * acontecer ANTES de confirmar. Funções puras.
 */
import type {
  UserDeletionPreview,
  UserHistoryCounts,
} from "@/modules/admin/infrastructure/admin-api";

export const DELETE_REASON_MIN = 20;
export const DELETE_CONFIRM_WORD = "EXCLUIR";

export interface UserDeletionDescription {
  tone: "danger" | "warning" | "blocked" | "neutral";
  title: string;
  lines: string[];
  confirmLabel: string;
  canConfirm: boolean;
}

const HISTORY_LABELS: Array<[keyof UserHistoryCounts, string, string]> = [
  ["vacancies", "vaga publicada", "vagas publicadas"],
  ["candidacies", "candidatura", "candidaturas"],
  ["fixedJobs", "vaga fixa ou candidatura a vaga fixa", "vagas fixas ou candidaturas a vaga fixa"],
  ["repasses", "repasse", "repasses"],
  ["walletEntries", "movimentação na carteira", "movimentações na carteira"],
  ["referralsMade", "indicação feita", "indicações feitas"],
  ["referralRewards", "prêmio de indicação", "prêmios de indicação"],
  ["paidSubscriptionCharges", "cobrança de plano paga", "cobranças de plano pagas"],
];

/** "3 vagas publicadas", "1 candidatura"… só o que existe. */
export function historyLines(history: UserHistoryCounts): string[] {
  return HISTORY_LABELS.filter(([key]) => (history[key] ?? 0) > 0).map(([key, one, many]) => {
    const n = history[key];
    return `${n} ${n === 1 ? one : many}`;
  });
}

export function describeUserDeletion(
  preview: UserDeletionPreview | undefined,
  loading: boolean,
): UserDeletionDescription {
  if (loading) {
    return {
      tone: "neutral",
      title: "Verificando o histórico da conta…",
      lines: [],
      confirmLabel: "Excluir",
      canConfirm: false,
    };
  }
  if (!preview) {
    return {
      tone: "neutral",
      title: "Não foi possível verificar o histórico da conta.",
      lines: ["Feche e tente de novo. Sem a verificação, a exclusão fica bloqueada."],
      confirmLabel: "Excluir",
      canConfirm: false,
    };
  }

  switch (preview.mode) {
    case "HARD":
      return {
        tone: "danger",
        title: "Sem histórico — a conta será apagada de vez",
        lines: [
          "Não há vagas, candidaturas, pagamentos nem indicações nesta conta.",
          "O cadastro e os perfis são removidos do banco. Não dá para desfazer.",
        ],
        confirmLabel: "Excluir definitivamente",
        canConfirm: true,
      };
    case "SOFT":
      return {
        tone: "warning",
        title: "Esta conta tem histórico — será desativada e anonimizada, não apagada",
        lines: [
          `Histórico: ${historyLines(preview.history).join(", ")}.`,
          "A pessoa não consegue mais entrar e some das listas. Nome, e-mail, telefone, endereço e chaves PIX são apagados; CPF e PIS do freelancer ficam guardados para as obrigações fiscais.",
          "Vagas, serviços, pagamentos e notas continuam para a contabilidade e o suporte.",
          "Vagas abertas são canceladas e candidaturas pendentes, retiradas.",
        ],
        confirmLabel: "Desativar e anonimizar",
        canConfirm: true,
      };
    case "BLOCKED":
      return {
        tone: "blocked",
        title: "Não dá para excluir agora",
        lines: preview.blockers,
        confirmLabel: "Excluir",
        canConfirm: false,
      };
    case "ALREADY_DELETED":
    default:
      return {
        tone: "neutral",
        title: "Esta conta já foi excluída.",
        lines: [],
        confirmLabel: "Excluir",
        canConfirm: false,
      };
  }
}

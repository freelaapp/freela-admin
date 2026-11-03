import { apiErrorOf } from "../infrastructure/api-error";

/** Estado da recarga em português, com a cor do selo. */
export const TOPUP_STATUS_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  SKIPPED: { label: "Não foi feita", tone: "neutral" },
  CREDITING: { label: "Em andamento", tone: "warn" },
  CREDITED: { label: "Em andamento", tone: "warn" },
  SENT: { label: "Pix enviado, aguardando a Asaas", tone: "warn" },
  COMPLETED: { label: "Concluída", tone: "ok" },
  FAILED: { label: "Não chegou", tone: "bad" },
  UNKNOWN: { label: "Sem desfecho: precisa conferir", tone: "bad" },
};

export function topupStatusOf(status: string) {
  return TOPUP_STATUS_LABELS[status] ?? { label: status, tone: "neutral" as const };
}

export const TRIGGER_LABELS: Record<string, string> = {
  SCHEDULE: "Conferência de hora em hora",
  NFSE_REFUSED: "Nota fiscal recusada por falta de saldo",
};

export const SKIP_REASON_LABELS: Record<string, string> = {
  CONFIG_INVALID: "A configuração da recarga está errada",
  UNRESOLVED_TOPUP: "Há uma recarga anterior sem desfecho",
  ASAAS_BALANCE_UNREADABLE: "Não conseguimos ler o saldo da Asaas",
  CAP_REACHED: "O valor passaria do teto do dia ou do mês",
  ASAAS_KEYS_UNREADABLE: "Não conseguimos ler as chaves Pix da Asaas",
  PIX_KEY_NOT_CONFIGURED: "A chave Pix da Asaas não está configurada",
  PIX_KEY_NOT_IN_ASAAS: "A chave Pix configurada não é uma chave ativa da Asaas",
  WOOVI_BALANCE_UNREADABLE: "Não conseguimos ler o saldo da Woovi",
  WOOVI_FREE_BALANCE_LOW: "A Woovi não tem saldo livre suficiente",
  WOOVI_SUBACCOUNT_UNREADABLE: "Não conseguimos ler a subconta da recarga na Woovi",
  WOOVI_SUBACCOUNT_KEY_MISMATCH: "A subconta da recarga na Woovi está com outra chave",
  WOOVI_SUBACCOUNT_HAS_BALANCE: "Sobrou dinheiro parado na subconta de uma tentativa anterior",
};

export function triggerLabel(trigger: string): string {
  return TRIGGER_LABELS[trigger] ?? trigger;
}

export function skipReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  return SKIP_REASON_LABELS[reason] ?? reason;
}

/** Erro do "Resolver" em português, dizendo o que aconteceu com a recarga. */
export function resolveTopupErrorOf(err: unknown): { text: string } {
  const { status, code } = apiErrorOf(err);
  switch (code) {
    case "REASON_REQUIRED":
      return { text: "Escreva o motivo (pelo menos 5 letras): o que você conferiu na Woovi e na Asaas." };
    case "TOPUP_NOT_UNKNOWN":
      return { text: "Esta recarga já não está sem desfecho. Nada foi alterado. A lista foi atualizada." };
    case "TOPUP_STATUS_CHANGED":
      return { text: "A recarga mudou de estado enquanto isso. Nada foi alterado. A lista foi atualizada." };
    case "TOPUP_NOT_FOUND":
      return { text: "Não achamos esta recarga. Nada foi alterado." };
  }
  if (status === 403) return { text: "Só quem tem acesso ao Financeiro pode resolver a recarga." };
  if (status !== null && status >= 400 && status < 500) {
    return { text: "Não foi possível resolver. Nada foi alterado. Recarregue a tela e tente de novo." };
  }
  return { text: "Não conseguimos confirmar se a recarga foi resolvida. Recarregue a tela antes de tentar de novo." };
}

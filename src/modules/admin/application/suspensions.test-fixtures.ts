import type { SuspensionItem, SuspensionList } from "../infrastructure/suspensions-api";

/** Falta sem aviso de Ana na vaga de Garçom (sáb 07/11, 18h): volta sáb 14/11, depois da conversa. */
export function suspensionItem(extra: Partial<SuspensionItem> = {}): SuspensionItem {
  return {
    id: "susp-1",
    person: { providerGlobalId: "g-ana", name: "Ana Souza", email: "ana@x.test", phone: "5511988887777" },
    reasonKey: "NO_SHOW",
    occurrencePhrase: "uma falta sem aviso",
    manualReason: null,
    startsAt: "2026-11-07T21:00:00.000Z",
    endsAt: "2026-11-14T03:00:00.000Z",
    requiresConversation: true,
    conversationAt: null,
    conversationBy: null,
    conversationNote: null,
    state: "DATED_AND_CONVERSATION",
    vacancy: {
      id: "v1",
      title: "Garçom",
      date: "2026-11-07T00:00:00.000Z",
      startTime: "2026-11-07T21:00:00.000Z",
    },
    source: {
      infractionId: "inf-1",
      status: "PENDING",
      type: "NO_SHOW",
      createdAt: "2026-11-07T21:00:00.000Z",
      contestedAt: null,
      justification: null,
      contestReason: null,
      contest: { status: "OPEN", until: "2026-11-10T21:00:00.000Z" },
    },
    createdByKind: "SYSTEM",
    createdByAdminId: null,
    liftedAt: null,
    liftedBy: null,
    liftedReason: null,
    liftedNote: null,
    ...extra,
  };
}

export function suspensionList(items: SuspensionItem[] = [suspensionItem()]): SuspensionList {
  return {
    items,
    legalNotice:
      "A chave PENALTY_LADDER_V2_ENABLED não pode ser ligada antes do OK do jurídico (Q6): a regra tira acesso e precisa estar nos termos de uso.",
  };
}

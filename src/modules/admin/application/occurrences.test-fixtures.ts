import type {
  OccurrenceDecisionRecord,
  OccurrenceDetail,
  OccurrenceItem,
  OccurrenceList,
} from "../infrastructure/occurrences-api";

/** Fixtures da fila de ocorrências (D5, fatia C2). Datas fixas em Brasília (UTC−3). */
export function occurrenceItem(over: Partial<OccurrenceItem> = {}): OccurrenceItem {
  return {
    infractionId: "inf-1",
    status: "PENDING",
    createdBy: "attendance_v2",
    createdAt: "2026-11-19T21:40:00.000Z", // qui 19/11 18h40
    eventAt: "2026-11-19T21:00:00.000Z",
    pointsLost: 5,
    reputationBefore: 100,
    reputationAfter: 95,
    person: {
      providerGlobalId: "pg-1",
      name: "Maria Souza",
      email: "maria@exemplo.com",
      phone: "11999990000",
    },
    vacancy: {
      id: "vac-1",
      title: "Garçom",
      date: "2026-11-19T00:00:00.000Z",
      startTime: "2026-11-19T21:00:00.000Z", // qui 19/11 18h
      jobId: "job-1",
      company: { userId: "c-1", name: "Coco Bambu" },
      city: "Osasco",
      uf: "SP",
    },
    applied: {
      suspensionId: "auto-1",
      reasonKey: "NO_SHOW",
      startsAt: "2026-11-19T21:40:00.000Z",
      endsAt: "2026-11-26T03:00:00.000Z", // qui 26/11
      requiresConversation: true,
      conversationAt: null,
      liftedAt: null,
      liftedReason: null,
      state: "DATED_AND_CONVERSATION",
    },
    contest: {
      status: "OPEN",
      contestedAt: null,
      until: "2026-11-22T21:40:00.000Z",
      reason: null,
      justification: null,
    },
    needsContestAnswer: false,
    resolution: null,
    decision: null,
    ...over,
  };
}

export function occurrenceList(over: Partial<OccurrenceList> = {}): OccurrenceList {
  return {
    since: "2026-11-19T03:00:00.000Z",
    releaseDefault: "NONE",
    suspensionDays: [7, 30],
    noticesEnabled: false,
    tab: "open",
    total: 1,
    openCount: 1,
    items: [occurrenceItem()],
    ...over,
  };
}

export function decisionRecord(over: Partial<OccurrenceDecisionRecord> = {}): OccurrenceDecisionRecord {
  return {
    id: "dec-1",
    infractionId: "inf-1",
    decision: "SUSPEND",
    suspensionDays: 30,
    createdSuspensionId: "manual-1",
    liftedSuspensionId: "auto-1",
    contestAnswer: null,
    whatHappened: "A empresa disse que ela não apareceu.",
    contactResult: "CALL",
    providerSaid: null,
    decidedByAdminId: "admin-ana",
    decidedByName: "Ana",
    decidedAt: "2026-11-20T13:05:00.000Z", // sex 20/11 10h05
    revokedAt: null,
    revokedBy: null,
    revokedByName: null,
    revokedReason: null,
    revokedKind: null,
    suspensionEndsAt: "2026-12-19T03:00:00.000Z", // sáb 19/12
    suspensionLiftedAt: null,
    ...over,
  };
}

export function occurrenceDetail(over: Partial<OccurrenceDetail> = {}): OccurrenceDetail {
  return {
    since: "2026-11-19T03:00:00.000Z",
    releaseDefault: "NONE",
    suspensionDays: [7, 30],
    noticesEnabled: false,
    item: occurrenceItem(),
    decisions: [],
    history: { days: 90, noShows: 2, lateWithdrawals: 1, suspensions: 1 },
    options: {
      canDecide: true,
      needsContestAnswer: false,
      contestOnly: false,
      canKeep: true,
      canRelease: true,
      canSuspend: true,
      canAnnul: true,
      suspensionDays: [7, 30],
    },
    ...over,
  };
}

import type {
  SupportCaseDetail,
  SupportCaseItem,
  SupportCaseList,
} from "../infrastructure/support-cases-api";

/** Dados de teste da fila do suporte. Brasília = UTC−3; 07/11/2026 é sábado. */
export const brt = (iso: string) => new Date(`${iso}-03:00`);

export function supportCaseItem(
  over: Partial<SupportCaseItem> = {},
): SupportCaseItem {
  return {
    id: "case-1",
    vacancyId: "vac-1",
    reason: "ALL_FAILED",
    risk: null,
    status: "OPEN",
    startTime: brt("2026-11-07T18:00:00").toISOString(),
    openedAt: brt("2026-11-07T13:55:00").toISOString(),
    notifiedAt: brt("2026-11-07T14:00:00").toISOString(),
    newsDueAt: brt("2026-11-07T14:30:00").toISOString(),
    assignedTo: null,
    assignedAt: null,
    closedAt: null,
    closeReason: null,
    closeNote: null,
    closedBy: null,
    vacancy: {
      title: "Garçom",
      companyName: "Bar do Zé",
      neighborhood: "Pinheiros",
      city: "São Paulo",
      dayLabel: "sáb 07/11",
      startLabel: "18h",
      endLabel: "23h",
    },
    contractor: { contactName: "Carla Souza", phone: "5511988887777" },
    contactsCount: 0,
    ...over,
  };
}

export function supportCaseDetail(
  over: Partial<SupportCaseDetail> = {},
): SupportCaseDetail {
  return {
    ...supportCaseItem(),
    contacts: [],
    people: [],
    payLabel: "137,28",
    vacancyUrl: "https://www.freelaservicos.com.br/freelancer/vagas/vac-1",
    ...over,
  };
}

export function supportCaseList(
  over: Partial<SupportCaseList> = {},
): SupportCaseList {
  return {
    items: [supportCaseItem()],
    counts: { open: 1, mine: 0, closedToday: 0 },
    supportHours: {
      open: true,
      label: "seg a sáb, 8h às 18h",
      nextOpeningAt: null,
      nextOpeningLabel: null,
    },
    cutoffLabel: "16h30",
    firstNewsMinutes: 30,
    ...over,
  };
}

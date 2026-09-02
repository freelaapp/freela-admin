/**
 * Agenda legível de um template de campanha automática — a única lógica
 * não-trivial da página de lista (`../page.tsx`). Função pura: não toca
 * DOM, rede ou estado, então dá para testar isolada
 * (`describe-schedule.test.ts`).
 */
import type { CampaignScheduleKind } from "@/modules/admin/infrastructure/campaign-templates-api";

/** 0=domingo..6=sábado — mesma convenção da API e do `TemplateDialog`. */
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Só os campos de agenda importam aqui — `CampaignTemplate` satisfaz isso estruturalmente. */
export interface ScheduleDescribable {
  scheduleKind: CampaignScheduleKind;
  weekdays?: number[];
  sendHour?: number;
  targetMonth?: number;
  targetDay?: number;
  targetYear?: number | null;
  leadDays?: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function describeWeekly(template: ScheduleDescribable): string {
  const days = template.weekdays ?? [];
  if (days.length === 0) return "Sem dia definido";
  const hour = pad2(template.sendHour ?? 0);
  const dayLabels = days.map((day) => WEEKDAY_LABELS[day] ?? "?").join(", ");
  // Um dia só lê melhor como "Todo Sáb"; vários dias já deixam claro que é
  // recorrente sem precisar do prefixo ("Sáb, Dom às 09:00").
  const prefix = days.length === 1 ? "Todo " : "";
  return `${prefix}${dayLabels} às ${hour}:00`;
}

function describeDated(template: ScheduleDescribable): string {
  const { targetMonth, targetDay } = template;
  if (!targetMonth || !targetDay) return "Sem data definida";

  const dateLabel = template.targetYear
    ? `${pad2(targetDay)}/${pad2(targetMonth)}/${template.targetYear}`
    : `${pad2(targetDay)}/${pad2(targetMonth)}`;

  const leadDays = template.leadDays ?? 0;
  const leadLabel = leadDays > 0 ? ` − ${leadDays} dia${leadDays === 1 ? "" : "s"} antes` : "";
  // Sem ano gravado = repete todo ano (mesma convenção do `TemplateDialog`:
  // "repetir todo ano" desmarcado é o único jeito de gravar targetYear).
  const annualLabel = template.targetYear ? "" : " · todo ano";

  return `${dateLabel}${leadLabel}${annualLabel}`;
}

/** WEEKLY → dias da semana + hora. DATED → data + lead + se repete todo ano. */
export function describeSchedule(template: ScheduleDescribable): string {
  return template.scheduleKind === "WEEKLY" ? describeWeekly(template) : describeDated(template);
}

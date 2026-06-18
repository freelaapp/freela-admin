import { Inbox, Phone, Handshake, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import type { CrmCompanyStatus, CrmPriority } from "@/modules/admin/infrastructure/crm-api";

export const STATUS_COLUMNS: { status: CrmCompanyStatus; label: string; icon: LucideIcon }[] = [
  { status: "NOVO", label: "Novo", icon: Inbox },
  { status: "EM_CONTATO", label: "Em contato", icon: Phone },
  { status: "NEGOCIANDO", label: "Negociando", icon: Handshake },
  { status: "FECHADO", label: "Fechado", icon: CheckCircle2 },
  { status: "PERDIDO", label: "Perdido", icon: XCircle },
];

export const STATUS_LABEL: Record<CrmCompanyStatus, string> = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  NEGOCIANDO: "Negociando",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export const PRIORITY_META: Record<CrmPriority, { label: string; variant: BadgeVariant }> = {
  ALTA: { label: "Alta", variant: "destructive" },
  MEDIA: { label: "Média", variant: "warning" },
  BAIXA: { label: "Baixa", variant: "secondary" },
};

export const PRIORITY_OPTIONS: CrmPriority[] = ["ALTA", "MEDIA", "BAIXA"];
export const STATUS_OPTIONS: CrmCompanyStatus[] = [
  "NOVO",
  "EM_CONTATO",
  "NEGOCIANDO",
  "FECHADO",
  "PERDIDO",
];

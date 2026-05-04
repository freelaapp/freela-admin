import { Badge } from "@/components/ui/badge";

type StatusVariant =
  | "ativo"
  | "inativo"
  | "pendente"
  | "aprovado"
  | "reprovado"
  | "cancelado"
  | "concluido"
  | "em-andamento"
  | "urgente"
  | "open"
  | "active"
  | "inactive"
  | "blocked"
  | "recruiting"
  | "filled"
  | "executing"
  | "finished"
  | "pending-deletion"
  | "deletion-suspended"
  | "deleted";

interface StatusBadgeProps {
  status: StatusVariant | string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }> = {
  ativo: { label: "Ativo", variant: "success" },
  inativo: { label: "Inativo", variant: "secondary" },
  pendente: { label: "Pendente", variant: "warning" },
  aprovado: { label: "Aprovado", variant: "success" },
  reprovado: { label: "Reprovado", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  concluido: { label: "Concluído", variant: "success" },
  "em-andamento": { label: "Em Andamento", variant: "default" },
  urgente: { label: "Urgente", variant: "destructive" },
  open: { label: "Aberto", variant: "default" },
  active: { label: "Ativo", variant: "success" },
  inactive: { label: "Inativo", variant: "secondary" },
  blocked: { label: "Bloqueado", variant: "destructive" },
  recruiting: { label: "Recrutando", variant: "warning" },
  filled: { label: "Preenchido", variant: "success" },
  executing: { label: "Executando", variant: "default" },
  finished: { label: "Finalizado", variant: "success" },
  "pending-deletion": { label: "Exclusão Pendente", variant: "warning" },
  "deletion-suspended": { label: "Exclusão Suspensa", variant: "destructive" },
  deleted: { label: "Excluído", variant: "destructive" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s/g, "-");
  const config = statusMap[normalized] || { label: status, variant: "outline" as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

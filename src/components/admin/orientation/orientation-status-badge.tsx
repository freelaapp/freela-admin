import { Badge } from "@/components/ui/badge";
import { orientationStatusLabel } from "@/modules/admin/application/orientation-presentation";
import type { OrientationStatus } from "@/modules/admin/infrastructure/orientation-api";

const VARIANT = { APPROVED: "success", REJECTED: "destructive", PENDING: "warning" } as const;

/**
 * Selo da situação na aula obrigatória. `null` = freelancer sem identidade global
 * (cadastro antigo, conta como pendente); `undefined` = a API não mandou o campo.
 */
export function OrientationStatusBadge({ status }: { status: OrientationStatus | null | undefined }) {
  if (status === undefined) return <span className="text-[#a3a3a3]">—</span>;
  if (status === null) {
    return (
      <Badge variant="warning" title="Sem identidade global (cadastro antigo)">
        {orientationStatusLabel(null)}
      </Badge>
    );
  }
  return <Badge variant={VARIANT[status]}>{orientationStatusLabel(status)}</Badge>;
}

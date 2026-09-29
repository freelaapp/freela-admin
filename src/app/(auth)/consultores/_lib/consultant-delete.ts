/**
 * Texto da confirmação de exclusão de consultor. Pedido do dono (29/09/2026):
 * dá para excluir TODOS; quem tem cadastros indicados vira exclusão lógica (as
 * indicações não podem sumir). A API decide do mesmo jeito — aqui só dizemos
 * antes, com o número que a lista já tem.
 */
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";

export interface ConsultantDeleteCopy {
  mode: "HARD" | "SOFT";
  title: string;
  bullets: string[];
  confirmLabel: string;
}

export function isConsultantDeleted(c: Pick<ConsultantItem, "deletedAt">): boolean {
  return !!c.deletedAt;
}

export function consultantDeleteCopy(
  c: Pick<ConsultantItem, "name" | "code" | "referralsCount">,
): ConsultantDeleteCopy {
  const linkBullet = `O link de indicação ${c.code} para de atribuir novos cadastros e o acesso ao painel do consultor é cortado na hora.`;

  if (c.referralsCount === 0) {
    return {
      mode: "HARD",
      title: "Excluir consultor definitivamente",
      bullets: [
        "Ele não tem nenhum cadastro indicado: o cadastro do consultor é apagado.",
        linkBullet,
        "Não dá para desfazer.",
      ],
      confirmLabel: "Excluir definitivamente",
    };
  }

  const n = c.referralsCount;
  const indicados = n === 1 ? "1 cadastro indicado continua" : `${n} cadastros indicados continuam`;
  return {
    mode: "SOFT",
    title: "Excluir consultor (exclusão lógica)",
    bullets: [
      `${indicados} com o histórico — na origem segue aparecendo "Consultor: ${c.name}".`,
      linkBullet,
      'Ele some da lista. Dá para desfazer em "Mostrar excluídos" → Restaurar.',
    ],
    confirmLabel: "Excluir (manter histórico)",
  };
}

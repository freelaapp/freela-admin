/**
 * Texto da confirmação de exclusão de consultor. Pedido do dono (29/09/2026):
 * dá para excluir TODOS; quem tem histórico vira exclusão lógica (as
 * indicações e a comissão não podem sumir). A API decide — aqui só dizemos
 * antes, com os números que a lista já tem.
 *
 * A API só apaga de vez quando NÃO há indicações, lançamentos de comissão nem
 * pagamentos (`consultants-admin.service.ts#remove`). A lista traz as
 * indicações e o saldo a pagar (`openBalanceInCents` = soma dos lançamentos
 * ainda sem pagamento); lançamento já pago ou pagamento antigo não aparece
 * nela, então "sem indicações e sem saldo" avisa que ainda pode virar lógica.
 */
import { formatCents } from "@/lib/money";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";

export interface ConsultantDeleteCopy {
  /** UNCERTAIN: sem indicações e sem o saldo conferido — a API decide entre HARD e SOFT. */
  mode: "HARD" | "SOFT" | "UNCERTAIN";
  title: string;
  bullets: string[];
  confirmLabel: string;
}

export function isConsultantDeleted(c: Pick<ConsultantItem, "deletedAt">): boolean {
  return !!c.deletedAt;
}

export function consultantDeleteCopy(
  c: Pick<ConsultantItem, "name" | "code" | "referralsCount" | "openBalanceInCents">,
  options: {
    /** O saldo de comissão não pôde ser conferido (extrato falhou): nada de "definitivo". */
    balanceUnavailable?: boolean;
  } = {},
): ConsultantDeleteCopy {
  const linkBullet = `O link de indicação ${c.code} para de atribuir novos cadastros e o acesso ao painel do consultor é cortado na hora.`;
  const openBalance = c.openBalanceInCents ?? 0;
  const unavailableBullet =
    'Não foi possível conferir o saldo de comissão dele agora. Confira em "Extrato e pagamentos" se há valor a pagar antes de excluir.';

  if (options.balanceUnavailable && c.referralsCount === 0) {
    return {
      mode: "UNCERTAIN",
      title: "Excluir consultor",
      bullets: [
        unavailableBullet,
        "Ele não tem cadastro indicado. Se nunca teve comissão lançada nem paga, o cadastro do consultor é apagado; se teve, a exclusão é lógica e o histórico fica. O aviso depois de confirmar diz qual foi.",
        linkBullet,
      ],
      confirmLabel: "Excluir",
    };
  }

  if (!options.balanceUnavailable && c.referralsCount === 0 && openBalance === 0) {
    return {
      mode: "HARD",
      title: "Excluir consultor definitivamente",
      bullets: [
        "Ele não tem nenhum cadastro indicado nem comissão a pagar: o cadastro do consultor é apagado.",
        "Se ele já teve comissão lançada ou paga, a exclusão vira lógica para guardar esse histórico — o aviso depois de confirmar diz qual foi.",
        linkBullet,
        "Não dá para desfazer.",
      ],
      confirmLabel: "Excluir definitivamente",
    };
  }

  const bullets: string[] = options.balanceUnavailable ? [unavailableBullet] : [];
  const n = c.referralsCount;
  if (n > 0) {
    const indicados = n === 1 ? "1 cadastro indicado continua" : `${n} cadastros indicados continuam`;
    bullets.push(`${indicados} com o histórico — na origem segue aparecendo "Consultor: ${c.name}".`);
  }
  if (openBalance !== 0) {
    bullets.push(
      openBalance > 0
        ? `Ele tem ${formatCents(openBalance)} de comissão a pagar (soma dos lançamentos ainda sem pagamento, desde o início — coluna "A pagar" da lista). Excluir não paga nem apaga esse valor: registre o pagamento em "Extrato e pagamentos" antes, se for o caso.`
        : `O saldo de comissão dele está negativo em ${formatCents(-openBalance)} (soma dos lançamentos ainda sem pagamento, desde o início). O livro de comissão fica guardado.`,
    );
  }
  bullets.push(linkBullet, 'Ele some da lista. Dá para desfazer em "Mostrar excluídos" → Restaurar.');

  return {
    mode: "SOFT",
    title: "Excluir consultor (exclusão lógica)",
    bullets,
    confirmLabel: "Excluir (manter histórico)",
  };
}

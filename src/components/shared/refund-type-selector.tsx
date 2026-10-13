"use client";

import type { RefundType } from "@/modules/admin/infrastructure/admin-api";

type RefundOption = { key: RefundType; label: string; hint: string };

const REFUND_OPTIONS: RefundOption[] = [
  { key: "FULL", label: "Integral", hint: "Devolve tudo" },
  { key: "PARTIAL_50", label: "50%", hint: "Metade" },
  { key: "NONE", label: "Nenhum", hint: "Sem estorno" },
];

/**
 * Vaga faturada (Fase 3): nada foi pago por Pix, então não há dinheiro a
 * devolver. A escolha decide o que a FATURA cobra (§0.4 do plano; D12: "Nenhum"
 * cobra 100%, como o pré-pago, que fica com tudo).
 */
const INVOICED_OPTIONS: RefundOption[] = [
  { key: "FULL", label: "Integral", hint: "Não entra na fatura" },
  { key: "PARTIAL_50", label: "50%", hint: "Cobra 50% na fatura" },
  { key: "NONE", label: "Nenhum", hint: "Cobra 100% na fatura" },
];

/**
 * Seletor do tipo de estorno ao cancelar uma vaga (admin). O admin escolhe
 * explicitamente o estorno — Integral / 50% / Nenhum — em vez da regra por tempo.
 * Usado nas telas de vagas de BR e Casa. Default esperado: `FULL`. Com
 * `invoiced`, os textos dizem o efeito na fatura da empresa.
 */
export function RefundTypeSelector({
  value,
  onChange,
  disabled,
  invoiced = false,
}: {
  value: RefundType;
  onChange: (v: RefundType) => void;
  disabled?: boolean;
  /** Vaga paga pelo faturado (`paymentMethod === "INVOICE"`). */
  invoiced?: boolean;
}) {
  const options = invoiced ? INVOICED_OPTIONS : REFUND_OPTIONS;
  return (
    <div>
      <label className="block text-sm font-medium text-[#1d1d1b] mb-1.5">
        {invoiced ? "Efeito na fatura da empresa" : "Estorno ao contratante"}{" "}
        <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            disabled={disabled}
            aria-pressed={value === opt.key}
            className={`flex flex-col items-center rounded-lg border px-2 py-2 text-center transition-colors disabled:opacity-50 ${
              value === opt.key
                ? "border-[#eca826] bg-[#eca826]/10 text-[#1d1d1b]"
                : "border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f7f7f7]"
            }`}
          >
            <span className="text-sm font-semibold">{opt.label}</span>
            <span className="text-[10px] leading-tight">{opt.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[#737373] mt-1.5" data-testid="refund-note">
        {invoiced
          ? "Vaga faturada: nada foi pago por Pix. Integral: não entra na fatura. 50%: cobra 50% na fatura. Nenhum: cobra 100% na fatura. Se o freelancer já recebeu o repasse, nada é estornado e a fatura cobra o valor cheio."
          : "Integral: devolve tudo (menos a taxa Pix). 50%: metade. Nenhum: sem estorno."}
      </p>
    </div>
  );
}

/** O efeito de cada escolha na fatura, curto, para o aviso neutro. */
const INVOICE_EFFECT: Record<RefundType, string> = {
  FULL: "não entra",
  PARTIAL_50: "cobra 50%",
  NONE: "cobra 100%",
};

/**
 * Aviso depois de cancelar. No faturado não há dinheiro devolvido: diz o efeito
 * na fatura. Sem estorno (`NONE`), a API só cobra quando havia pagamento
 * faturado liquidado (freelancer confirmado): sem essa certeza, o texto é neutro.
 */
export function cancelResultMessage(
  result: { refundAmount: number; refundType: RefundType },
  invoiced: boolean,
  context: {
    /** O que o admin escolheu (a API pode não estornar se o repasse já saiu). */
    requested?: RefundType;
    /** A linha tem freelancer aceito (logo, pagamento faturado liquidado). */
    confirmedFreelancer?: boolean;
  } = {},
): string {
  if (invoiced) {
    if (result.refundType === "FULL") return "Vaga cancelada. O serviço não entra na fatura.";
    if (result.refundType === "PARTIAL_50") return "Vaga cancelada. A fatura cobra 50% do serviço.";
    if (context.confirmedFreelancer) {
      return context.requested && context.requested !== "NONE"
        ? "Vaga cancelada sem estorno: o freelancer já recebeu o repasse. A fatura cobra o valor cheio do serviço."
        : "Vaga cancelada. A fatura cobra o valor cheio do serviço.";
    }
    const effect = INVOICE_EFFECT[context.requested ?? "NONE"];
    return `Vaga cancelada. A fatura reflete a escolha: ${effect}, se a vaga já tinha freelancer confirmado.`;
  }
  // Vaga sem pagamento confirmado (ex.: nenhum freelancer aceito) cancela sem
  // estorno — não fala de pagamento. Só mostra o estorno quando houve devolução.
  if (result.refundAmount <= 0) return "Vaga cancelada com sucesso.";
  const valor = (result.refundAmount / 100).toFixed(2).replace(".", ",");
  const tipo = result.refundType === "FULL" ? "integral" : "parcial (50%)";
  return `Vaga cancelada. Estorno ${tipo} de R$ ${valor} processado.`;
}

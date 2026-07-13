"use client";

import type { RefundType } from "@/modules/admin/infrastructure/admin-api";

const REFUND_OPTIONS: { key: RefundType; label: string; hint: string }[] = [
  { key: "FULL", label: "Integral", hint: "Devolve tudo" },
  { key: "PARTIAL_50", label: "50%", hint: "Metade" },
  { key: "NONE", label: "Nenhum", hint: "Sem estorno" },
];

/**
 * Seletor do tipo de estorno ao cancelar uma vaga (admin). O admin escolhe
 * explicitamente o estorno — Integral / 50% / Nenhum — em vez da regra por tempo.
 * Usado nas telas de vagas de BR e Casa. Default esperado: `FULL`.
 */
export function RefundTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: RefundType;
  onChange: (v: RefundType) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1d1d1b] mb-1.5">
        Estorno ao contratante <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {REFUND_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            disabled={disabled}
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
      <p className="text-xs text-[#737373] mt-1.5">
        Integral: devolve tudo (menos a taxa Pix). 50%: metade. Nenhum: sem estorno.
      </p>
    </div>
  );
}

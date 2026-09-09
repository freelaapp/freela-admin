"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChoicePillOption<T extends string> = { value: T; label: string };

interface ChoicePillsProps<T extends string> {
  options: ChoicePillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Rótulo acessível do grupo (radiogroup). */
  "aria-label"?: string;
  className?: string;
}

/**
 * Escolha única entre poucas opções, renderizada como pílulas no PRÓPRIO DOM.
 *
 * Substitui o `<select>` nativo onde o popup do sistema não é confiável: em
 * alguns ambientes (Chrome no Linux/Wayland, por exemplo) a lista do select
 * abre e fecha na hora — foi o relato das Assinaturas em 09/09/2026. Pílulas
 * são só botões: nada de janela externa, nada para o sistema fechar.
 */
export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: ChoicePillsProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => {
              if (!selected) onChange(opt.value);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-[#1d1d1b] bg-[#1d1d1b] text-white"
                : "border-[#e5e5e5] bg-white text-[#1d1d1b] hover:border-[#1d1d1b]/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

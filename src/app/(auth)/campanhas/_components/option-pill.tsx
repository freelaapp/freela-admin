import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

/** Escolha em pílula (filtros, canais, dias), com alvo de 44 px para o celular. */
export function OptionPill({
  selected,
  onClick,
  children,
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "bg-[#eca826] text-white"
          : "bg-neutral-100 text-neutral-700 hover:bg-[#eca826]/10",
      )}
    >
      {children}
    </button>
  );
}

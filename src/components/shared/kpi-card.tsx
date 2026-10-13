import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor?: string;
  meta?: string;
  metaColor?: string;
  progress?: number;
  className?: string;
  /** Explicação em linguagem simples, exibida no hover do ícone ⓘ. */
  help?: string;
  /** "Abre" o card: quebra o valor principal em fatias (ex.: freelancers ×
   * contratantes). Entra logo abaixo do número grande, antes da meta. */
  breakdown?: { label: string; value: string }[];
  /**
   * A conta inteira e a fonte do número (regra: todo número diz o que é, a
   * conta e de onde veio). Fica num "Ver a conta" que abre com um toque — o
   * `help` só aparece no hover, que não existe no celular.
   */
  details?: { calc: string; source: string };
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-[#eca826]",
  meta,
  metaColor,
  progress,
  className,
  help,
  breakdown,
  details,
}: KpiCardProps) {
  return (
    <Card className={cn("p-4 flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
        <span className="text-xs font-medium text-[#737373]">{title}</span>
        {help && (
          <span
            title={help}
            aria-label={`Sobre: ${title}`}
            className="ml-auto shrink-0 cursor-help text-[#a3a3a3] hover:text-[#737373]"
          >
            <Info className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <p
        className="text-2xl font-bold text-[#1d1d1b] mt-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {breakdown.map((b) => (
            <span key={b.label} className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-[#1d1d1b]">{b.value}</span>
              <span className="text-[11px] text-[#737373]">{b.label}</span>
            </span>
          ))}
        </div>
      )}
      {meta && (
        <p className={cn("text-xs font-medium", metaColor || "text-[#737373]")}>
          {meta}
        </p>
      )}
      {details && (
        <details className="mt-1 text-xs text-[#525252]">
          <summary className="cursor-pointer select-none font-medium text-[#737373] hover:text-[#1d1d1b]">
            Ver a conta
          </summary>
          <p className="mt-1">{`Conta: ${details.calc}`}</p>
          <p className="mt-0.5">{`Fonte: ${details.source}`}</p>
        </details>
      )}
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-[#e5e5e5] rounded-full mt-1">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}

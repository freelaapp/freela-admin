"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

import { PRIORIDADE_ROTULO, formatarTempoRestante, type SupportPriority } from "./support-actions";

/**
 * Banner vermelho das ações críticas em aberto.
 *
 * Fica no TOPO do painel, acima das colunas, porque é a única coisa da tela que
 * não pode depender de alguém rolar até a coluna certa: a vaga que está para
 * ser cancelada por falta de pagamento não pode esperar o olho chegar nela.
 *
 * Mostra vaga por vaga, e não um número só: "12 ações críticas" não diz a quem
 * ligar. O banner existe para virar trabalho num clique.
 */

export interface AlertaDeVaga {
  id: string;
  cargo: string;
  empresa: string;
  prioridade: SupportPriority;
  horasAteInicio: number | null;
  /** Rótulos das ações críticas ainda não ticadas, na ordem de execução. */
  criticas: string[];
}

/** Quantas vagas o banner lista antes de virar "e mais N". Cinco cabe na tela
 *  sem empurrar as colunas para baixo da dobra, que é onde o painel vive. */
const MAX_LINHAS = 5;

export function SupportAlertBanner({
  alertas,
  onAbrir,
}: {
  /** Já ordenados por urgência — o banner não reordena. */
  alertas: AlertaDeVaga[];
  onAbrir: (vacancyId: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  if (alertas.length === 0) return null;

  const totalAcoes = alertas.reduce((soma, a) => soma + a.criticas.length, 0);
  const visiveis = expandido ? alertas : alertas.slice(0, MAX_LINHAS);
  const escondidas = alertas.length - visiveis.length;

  return (
    <section
      // `alert` e não `status`: o leitor de tela precisa interromper, não
      // esperar a próxima pausa — é o mesmo motivo de o banner ser vermelho.
      role="alert"
      className="mb-4 overflow-hidden rounded-xl border border-[#FCA5A5] bg-[#FEF2F2]"
    >
      <div className="flex items-center gap-2.5 border-b border-[#FECACA] bg-[#DC2626] px-4 py-2.5 text-white">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="flex-1 text-[13.5px] font-bold leading-tight">
          {totalAcoes} ação(ões) crítica(s) pendente(s) em {alertas.length} vaga(s)
        </p>
        {alertas.length > MAX_LINHAS ? (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-white/25"
          >
            {expandido ? (
              <>
                <ChevronUp className="h-3 w-3" aria-hidden />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" aria-hidden />
                Ver todas
              </>
            )}
          </button>
        ) : null}
      </div>

      <ul className="divide-y divide-[#FECACA]">
        {visiveis.map((alerta) => (
          <li key={alerta.id}>
            <button
              type="button"
              onClick={() => onAbrir(alerta.id)}
              className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FEE2E2]"
            >
              <span className="mt-px w-[86px] shrink-0 text-[11px] font-bold uppercase tracking-wide text-[#DC2626]">
                {PRIORIDADE_ROTULO[alerta.prioridade]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[#0F172A]">
                  {alerta.cargo} · {alerta.empresa}
                </span>
                {/* As ações em si, não só a contagem: é a lista que diz o que
                    fazer quando a pessoa abre a gaveta. */}
                <span className="block truncate text-[11.5px] text-[#991B1B]">
                  {alerta.criticas.join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-[#B91C1C]">
                {formatarTempoRestante(alerta.horasAteInicio)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {escondidas > 0 ? (
        <p className="border-t border-[#FECACA] px-4 py-2 text-[11.5px] font-semibold text-[#991B1B]">
          e mais {escondidas} vaga(s) com ação crítica pendente.
        </p>
      ) : null}
    </section>
  );
}

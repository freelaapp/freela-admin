"use client";

import { UserCheck } from "lucide-react";

import { useProvidersCompleteness } from "@/modules/admin/application/use-admin-providers";

/**
 * Percentual de cadastros de freelancer completos.
 *
 * "Completo" = tem os cinco campos que bloqueiam alguma coisa de verdade:
 * função (sem ela não vê vaga no feed), telefone, CEP, currículo e chave PIX
 * (sem ela o repasse trava). Vídeo e avatar ficam fora — são opcionais, e
 * incluí-los derrubaria o número sem apontar nada acionável.
 *
 * O número sozinho engana: em 29/07/2026 dava 6,2%, e olhar só isso sugere
 * "o cadastro é ruim em tudo". A quebra por campo mostra o contrário — 97,7%
 * têm telefone e só 9,2% têm função. A alavanca é UMA. Por isso a barra por
 * campo vem junto, ordenada do mais ausente para o menos.
 */
const CAMPOS = [
  { key: "services", label: "Função" },
  { key: "curriculum", label: "Currículo" },
  { key: "pixKey", label: "Chave PIX" },
  { key: "cep", label: "CEP" },
  { key: "phone", label: "Telefone" },
] as const;

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function CompletenessCard() {
  const { data, isLoading, isError } = useProvidersCompleteness();

  if (isError) return null;

  if (isLoading || !data) {
    return (
      <div className="mb-6 h-[132px] animate-pulse rounded-xl border border-[#e5e5e5] bg-[#fafafa]" />
    );
  }

  const linhas = CAMPOS.map((campo) => ({
    ...campo,
    total: data.filled[campo.key],
    percent: pct(data.filled[campo.key], data.total),
  })).sort((a, b) => a.percent - b.percent);

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eca826]/10">
            <UserCheck className="h-5 w-5 text-[#eca826]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#737373]">Cadastros completos</p>
            <p className="text-[26px] font-bold leading-tight text-[#1d1d1b]">
              {data.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
            </p>
            <p className="text-[12px] text-[#737373]">
              {data.complete.toLocaleString("pt-BR")} de {data.total.toLocaleString("pt-BR")}{" "}
              freelancers
            </p>
          </div>
        </div>

        <div className="min-w-[260px] flex-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
            Quem tem cada campo
          </p>
          <div className="space-y-1.5">
            {linhas.map((linha) => (
              <div key={linha.key} className="flex items-center gap-2">
                <span className="w-[68px] shrink-0 text-[12px] text-[#525252]">{linha.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div
                    className="h-full rounded-full bg-[#eca826]"
                    style={{ width: `${linha.percent}%` }}
                  />
                </div>
                <span className="w-[46px] shrink-0 text-right text-[12px] tabular-nums text-[#737373]">
                  {linha.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 border-t border-[#f0f0f0] pt-2.5 text-[11px] leading-relaxed text-[#a3a3a3]">
        Completo = função, telefone, CEP, currículo e chave PIX. São os campos
        que travam alguma coisa: sem função o freelancer não vê vaga no feed;
        sem chave PIX o repasse não sai. Vídeo e foto são opcionais e não contam.
      </p>
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useCampaignResults } from "@/modules/admin/application/use-admin-referrals";
import { barWidth, formatCost, funnelSteps } from "../_lib/campaign-results";

interface Props {
  campaignId: string;
  /** Campanha disparando: os números são pedidos de novo a cada minuto. */
  running?: boolean;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-xs font-medium text-[#737373]">{label}</span>
      <span className="text-xl font-bold tabular-nums text-[#1d1d1b]">
        {value}
      </span>
      {hint && <span className="text-xs text-[#737373]">{hint}</span>}
    </Card>
  );
}

/**
 * Aba "Resultados" do detalhe (spec 2026-10-01 parte 2 §8.3): funil enviados, entregues,
 * lidos e clicaram com %, saídas, respostas e custo estimado, "Depois da campanha" e
 * "Não receberam". "Depois" é janela de tempo, não causa (spec §14). No celular, uma coluna.
 */
export function CampaignResultsPanel({ campaignId, running = false }: Props) {
  const results = useCampaignResults(campaignId, { autoRefresh: running });

  if (results.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2
          className="h-5 w-5 animate-spin text-neutral-400"
          aria-label="Carregando resultados"
        />
      </div>
    );
  }
  if (results.isError || !results.data) {
    return (
      <p
        role="alert"
        className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {getAxiosErrorMessage(
          results.error,
          "Não foi possível carregar os resultados.",
        )}
      </p>
    );
  }

  const data = results.data;
  return (
    <div className="space-y-5" data-testid="results-panel">
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="results-funnel"
      >
        {funnelSteps(data).map((step) => (
          <Card
            key={step.key}
            className="flex min-w-0 flex-col gap-1 p-3"
            data-testid={`funnel-${step.key}`}
          >
            <span className="text-xs font-medium text-[#737373]">
              {step.label}
            </span>
            <span className="text-2xl font-bold tabular-nums text-[#1d1d1b]">
              {step.value ?? "—"}
            </span>
            <span className="text-xs text-[#737373]">
              {step.percent ? `${step.percent} ${step.hint}` : step.hint}
            </span>
            <div className="h-1.5 w-full rounded bg-neutral-100" aria-hidden>
              <div
                className="h-1.5 rounded bg-[#eca826]"
                style={{
                  width: `${
                    step.key === "sent"
                      ? data.sent > 0
                        ? 100
                        : 0
                      : barWidth(step.value, data.sent)
                  }%`,
                }}
              />
            </div>
          </Card>
        ))}
      </div>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        data-testid="results-other"
      >
        <Stat
          label="Saíram"
          value={data.optedOut}
          hint='tocaram em "Não quero receber"'
        />
        <Stat
          label="Responderam"
          value={data.replied}
          hint="escreveram de volta"
        />
        <Stat
          label="Custo estimado"
          value={formatCost(data.costBrl)}
          hint={`${data.billable} cobradas × ${formatCost(data.pricePerMessageBrl)}`}
        />
      </div>

      <section className="space-y-2" data-testid="results-after">
        <h3 className="text-sm font-semibold text-[#1d1d1b]">
          Depois da campanha
        </h3>
        <p className="text-xs text-[#737373]">
          Conta o que as pessoas que receberam fizeram nos dias seguintes ao
          envio.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat
            label="Cadastros"
            value={data.signups}
            hint="de quem veio pela campanha"
          />
          <Stat
            label="Vagas publicadas"
            value={data.publishedVacancy}
            hint="em até 14 dias"
          />
          <Stat label="Contratações" value={data.hired} hint="em até 30 dias" />
        </div>
      </section>

      <section className="space-y-2" data-testid="results-not-received">
        <h3 className="text-sm font-semibold text-[#1d1d1b]">Não receberam</h3>
        {data.notReceived.length === 0 ? (
          <p className="text-sm text-[#737373]">Ninguém ficou de fora.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {data.notReceived.map((item) => (
              <li
                key={item.reason}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 break-words">{item.reason}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {item.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

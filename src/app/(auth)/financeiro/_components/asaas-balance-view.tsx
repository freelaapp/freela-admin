"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/modules/admin/application/invoice-presentation";
import {
  resolveTopupErrorOf,
  skipReasonLabel,
  topupStatusOf,
  triggerLabel,
} from "@/modules/admin/application/asaas-balance-presentation";
import { useAsaasBalance, useResolveAsaasTopup } from "@/modules/admin/application/use-asaas-balance";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  AsaasBalanceOverview,
  AsaasTopup,
  ResolveOutcome,
} from "@/modules/admin/infrastructure/asaas-balance-api";
import { formatInstantDateTime } from "@/lib/date.utils";
import { cn } from "@/lib/utils";
import { ActionDialog, ReasonField, useReason } from "./invoice-action-dialogs";

/** Valor negativo com o sinal de menos de verdade ("−R$ 10,29"). */
function formatSigned(cents: number): string {
  return cents < 0 ? `−${formatBrl(Math.abs(cents))}` : formatBrl(cents);
}

/** "2026-11-03" → "03/11". */
function dayLabel(day: string): string {
  const [, month, d] = day.split("-");
  return month && d ? `${d}/${month}` : day;
}

/** "2026-11-03" → "11/2026". */
function monthLabel(day: string): string {
  const [year, month] = day.split("-");
  return year && month ? `${month}/${year}` : day;
}

const NFSE_FEE_IN_CENTS = 49;

const OUTCOMES: { value: ResolveOutcome; title: string; hint: string }[] = [
  {
    value: "COMPLETED",
    title: "O Pix chegou na Asaas",
    hint: "Marca a recarga como concluída e manda emitir de novo as notas recusadas por falta de saldo.",
  },
  {
    value: "FAILED",
    title: "O Pix não chegou",
    hint: "Marca como não chegou. Se sobrou dinheiro na subconta da Woovi, ele continua travando novas recargas até ser devolvido.",
  },
];

function ResolveDialog({ topup, onClose }: { topup: AsaasTopup; onClose: () => void }) {
  const mutation = useResolveAsaasTopup();
  const { reason, setReason, valid } = useReason();
  const [outcome, setOutcome] = useState<ResolveOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const value = formatBrl(topup.amountInCents);

  const submit = async () => {
    if (!valid || !outcome || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ topupId: topup.id, outcome, reason: reason.trim() });
      toast.success(
        outcome === "COMPLETED"
          ? `Recarga de ${value} marcada como concluída. A recarga automática está liberada.`
          : `Recarga de ${value} marcada como não chegou. A recarga automática está liberada.`,
      );
      onClose();
    } catch (err) {
      setError(resolveTopupErrorOf(err).text);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Resolver a recarga de ${value}?`}
      description={
        <p>
          {`Recarga de ${formatInstantDateTime(topup.createdAt)}. A Woovi não deu resposta clara, então não sabemos se o Pix chegou na Asaas.`}
        </p>
      }
      submitLabel="Resolver recarga"
      pendingLabel="Salvando…"
      canSubmit={valid && outcome !== null}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="max-h-[55vh] space-y-4 overflow-y-auto">
        <div className="rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#525252]">
          <p className="font-medium text-[#1d1d1b]">Antes de resolver, confira:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>{`Na Woovi, no extrato da subconta, procure a descrição "asaas-topup:${topup.id}".`}</li>
            <li>Na Asaas, no extrato, procure o Pix recebido.</li>
          </ul>
          <p className="mt-2">
            O sistema não repete esta recarga sozinho. Ao resolver, ele volta a recarregar automaticamente quando o
            saldo ficar baixo. Fica registrado no histórico com o seu nome.
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[#1d1d1b]">O que você encontrou? (obrigatório)</legend>
          {OUTCOMES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                outcome === option.value ? "border-[#eca826] bg-[#fffbeb]" : "border-[#e5e5e5]",
              )}
            >
              <input
                type="radio"
                name="asaas-topup-outcome"
                value={option.value}
                checked={outcome === option.value}
                onChange={() => setOutcome(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-[#1d1d1b]">{option.title}</span>
                <span className="block text-xs text-[#737373]">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ReasonField
          value={reason}
          onChange={setReason}
          label="O que você conferiu? (obrigatório)"
          savedHint="Fica no histórico desta recarga, com o seu nome."
        />
      </div>
    </ActionDialog>
  );
}

const TONE_CLASSES = {
  ok: "bg-[#ecfdf5] text-[#047857]",
  warn: "bg-[#fffbeb] text-[#b45309]",
  bad: "bg-[#fef2f2] text-[#b91c1c]",
  neutral: "bg-[#f7f7f7] text-[#525252]",
} as const;

function TopupCard({ topup, onResolve }: { topup: AsaasTopup; onResolve: (t: AsaasTopup) => void }) {
  const status = topupStatusOf(topup.status);
  const skip = skipReasonLabel(topup.skipReason);
  const isSkipped = topup.status === "SKIPPED";
  return (
    <li className="space-y-2 rounded-lg border border-[#e5e5e5] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1d1d1b]">{formatInstantDateTime(topup.createdAt)}</p>
          <p className="text-xs text-[#737373]">{triggerLabel(topup.trigger)}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE_CLASSES[status.tone])}>
          {status.label}
        </span>
      </div>
      <p className="text-sm text-[#1d1d1b]">
        {isSkipped ? "Valor que seria depositado: " : "Valor da recarga: "}
        <span className="font-semibold">{formatBrl(topup.amountInCents)}</span>
      </p>
      {skip && <p className="text-sm text-[#b45309]">{`Por que não foi feita: ${skip}.`}</p>}
      {topup.calculation && (
        <p className="text-xs text-[#525252]">{`Conta: ${topup.calculation}`}</p>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-[#737373] sm:grid-cols-3">
        {topup.asaasBalanceBeforeInCents !== null && (
          <div>
            <dt className="inline">Saldo na Asaas antes: </dt>
            <dd className="inline font-medium text-[#525252]">{formatSigned(topup.asaasBalanceBeforeInCents)}</dd>
          </div>
        )}
        {topup.asaasBalanceAfterInCents !== null && (
          <div>
            <dt className="inline">Saldo na Asaas depois: </dt>
            <dd className="inline font-medium text-[#525252]">{formatSigned(topup.asaasBalanceAfterInCents)}</dd>
          </div>
        )}
        {topup.wooviFreeBalanceInCents !== null && (
          <div>
            <dt className="inline">Saldo livre da Woovi na hora: </dt>
            <dd className="inline font-medium text-[#525252]">{formatSigned(topup.wooviFreeBalanceInCents)}</dd>
          </div>
        )}
      </dl>
      {topup.error && <p className="text-xs text-[#b91c1c]">{`Erro registrado: ${topup.error}`}</p>}
      {topup.status === "UNKNOWN" && (
        <Button
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          aria-label={`Resolver recarga de ${formatBrl(topup.amountInCents)}`}
          onClick={() => onResolve(topup)}
        >
          Resolver
        </Button>
      )}
    </li>
  );
}

function UsageBar({ label, used, cap, explain }: { label: string; used: number; cap: number; explain: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div className="space-y-1">
      <p className="text-sm text-[#1d1d1b]">
        {label}: <span className="font-semibold">{formatBrl(used)}</span> de {formatBrl(cap)}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={Math.min(used, cap)}
        className="h-2 overflow-hidden rounded-full bg-[#f0f0f0]"
      >
        <div className={cn("h-full", pct >= 100 ? "bg-[#b91c1c]" : "bg-[#eca826]")} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[#737373]">{explain}</p>
    </div>
  );
}

function BalanceSection({ data, readAt }: { data: AsaasBalanceOverview; readAt: number }) {
  const balance = data.asaasBalanceInCents;
  const notes = balance > 0 ? Math.floor(balance / NFSE_FEE_IN_CENTS) : 0;
  const readAtLabel = readAt
    ? new Date(readAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : null;
  const { config, usage } = data;
  return (
    <section aria-label="Saldo na Asaas" className="space-y-3 rounded-lg border border-[#e5e5e5] bg-white p-4">
      <div>
        <p className="text-sm text-[#737373]">
          {`Saldo na Asaas agora${readAtLabel ? ` — lido da Asaas às ${readAtLabel}` : ""}`}
        </p>
        <p className={cn("text-3xl font-bold", balance < 0 ? "text-[#b91c1c]" : "text-[#1d1d1b]")}>
          {formatSigned(balance)}
        </p>
        <p className="mt-1 text-xs text-[#737373]">
          {balance < 0
            ? `Saldo negativo: a Asaas recusa as notas fiscais até ele voltar a ficar positivo (cada nota autorizada custa ${formatBrl(NFSE_FEE_IN_CENTS)}).`
            : `Cada nota fiscal autorizada custa ${formatBrl(NFSE_FEE_IN_CENTS)}. Conta: ${formatBrl(balance)} ÷ ${formatBrl(NFSE_FEE_IN_CENTS)} = cerca de ${notes} notas.`}
        </p>
      </div>

      <div className="border-t border-[#f0f0f0] pt-3">
        <p className="text-sm font-semibold text-[#1d1d1b]">
          Recarga automática:{" "}
          <span className={data.autoTopupEnabled ? "text-[#047857]" : "text-[#b45309]"}>
            {data.autoTopupEnabled ? "ligada" : "desligada"}
          </span>
        </p>
        {config.valid ? (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#525252]">
            <li>{`Confere o saldo de hora em hora e também quando uma nota é recusada por falta de saldo.`}</li>
            <li>{`Recarrega quando o saldo fica abaixo de ${formatBrl(config.minBalanceInCents)}.`}</li>
            <li>{`Cada recarga é de ${formatBrl(config.amountInCents)}, mais o que faltar para zerar um saldo negativo.`}</li>
            <li>Usa só o saldo livre da Woovi (o que sobra depois de reservar o dinheiro dos freelancers e das carteiras).</li>
            {config.pixKeyMasked && <li>{`O Pix vai para a chave ${config.pixKeyMasked} da Asaas.`}</li>}
          </ul>
        ) : (
          <p role="alert" className="mt-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2.5 text-sm text-[#b91c1c]">
            {`A configuração da recarga está errada, então nenhuma recarga é feita: ${config.error}`}
          </p>
        )}
        {!data.autoTopupEnabled && (
          <p className="mt-1 text-xs text-[#b45309]">Com a recarga desligada, o saldo só sobe se alguém depositar na Asaas.</p>
        )}
      </div>

      {config.valid && (
        <div className="space-y-3 border-t border-[#f0f0f0] pt-3">
          <p className="text-sm font-semibold text-[#1d1d1b]">Quanto já saiu da Woovi para recargas</p>
          <UsageBar
            label={`Hoje (${dayLabel(usage.brasiliaDay)})`}
            used={usage.todayInCents}
            cap={config.maxPerDayInCents}
            explain={`Teto de ${formatBrl(config.maxPerDayInCents)} por dia. Conta: soma das recargas de hoje que podem ter saído da Woovi.`}
          />
          <UsageBar
            label={`Neste mês (${monthLabel(usage.brasiliaDay)})`}
            used={usage.monthInCents}
            cap={config.maxPerMonthInCents}
            explain={`Teto de ${formatBrl(config.maxPerMonthInCents)} por mês. Mesma conta, desde o dia 1.`}
          />
          {usage.countedStatuses && (
            <p className="text-xs text-[#737373]">{`Entra na soma: ${usage.countedStatuses}.`}</p>
          )}
        </div>
      )}
    </section>
  );
}

function errorMessage(error: unknown): string {
  const { status } = apiErrorOf(error);
  if (status === 403) return "Só quem tem acesso ao Financeiro pode ver o saldo da Asaas.";
  if (status === 404) return "O saldo da Asaas ainda não está disponível neste ambiente.";
  return "Não conseguimos ler o saldo da Asaas agora.";
}

/** Aba "Saldo Asaas" do Financeiro: saldo, regra da recarga automática, tetos e as últimas tentativas. */
export function AsaasBalanceView() {
  const query = useAsaasBalance();
  const [resolving, setResolving] = useState<AsaasTopup | null>(null);

  if (query.isLoading) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white p-4 text-sm text-[#737373]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Lendo o saldo na Asaas…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
        <p className="text-sm text-[#b91c1c]">{errorMessage(query.error)}</p>
        <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => query.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    );
  }

  const data = query.data;
  const unknown = data.lastTopups.filter((t) => t.status === "UNKNOWN");

  return (
    <div className="space-y-4">
      <BalanceSection data={data} readAt={query.dataUpdatedAt} />

      {unknown.length > 0 && (
        <section aria-label="Recarga sem desfecho" className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b45309]" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1b]">
                {unknown.length === 1 ? "1 recarga sem desfecho" : `${unknown.length} recargas sem desfecho`}
              </h2>
              <p className="text-sm text-[#525252]">
                Não sabemos se o Pix chegou na Asaas. Enquanto ninguém resolver, nenhuma nova recarga automática é feita.
                Confira na Woovi e na Asaas e use o botão Resolver na lista abaixo.
              </p>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Últimas recargas" className="space-y-2">
        <h2 className="text-base font-semibold text-[#1d1d1b]">Últimas recargas automáticas</h2>
        <p className="text-xs text-[#737373]">As 20 tentativas mais recentes, incluindo as que não foram feitas, com o motivo.</p>
        {data.lastTopups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#e5e5e5] p-4 text-sm text-[#737373]">
            Ainda não houve nenhuma tentativa de recarga. Quando o saldo ficar abaixo do mínimo, ela aparece aqui.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.lastTopups.map((topup) => (
              <TopupCard key={topup.id} topup={topup} onResolve={setResolving} />
            ))}
          </ul>
        )}
      </section>

      {resolving && <ResolveDialog key={resolving.id} topup={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}

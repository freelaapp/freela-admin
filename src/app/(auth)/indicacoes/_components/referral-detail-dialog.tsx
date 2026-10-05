"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInstantDate } from "@/lib/date.utils";
import type {
  ReferralItem,
  ReferralPendingReason,
} from "@/modules/admin/infrastructure/referrals-api";
import {
  ACCOUNT_KIND,
  STAGE_LABEL,
  TONE_CLASS,
  describeSituation,
  empresaStepIndex,
} from "../_lib/referral-labels";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Piso antifraude da vaga que qualifica — espelho de MIN_QUALIFYING_VACANCY_CENTS
 * da API (`referral-fraud-rules.ts`). Só rotula a linha; quem decide é a API.
 */
const MIN_VACANCY_CENTS = 8_000;

type CheckState = "ok" | "no" | "pending";

function CheckIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="sim" />;
  if (state === "no") return <X className="h-4 w-4 shrink-0 text-red-600" aria-label="não" />;
  return <Minus className="h-4 w-4 shrink-0 text-neutral-400" aria-label="ainda não" />;
}

function Row({ state, title, detail }: { state: CheckState; title: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <CheckIcon state={state} />
      <div className="min-w-0">
        <p className="text-sm text-[#1d1d1b]">{title}</p>
        {detail && <p className="text-xs text-neutral-500 break-words">{detail}</p>}
      </div>
    </li>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-sm text-[#1d1d1b] break-words">{value || "—"}</dd>
    </div>
  );
}

/**
 * As regras saem do motivo calculado pela API, que olha TODOS os serviços
 * concluídos — o "primeiro serviço" mostrado no caminho pode ter ficado abaixo
 * do piso enquanto um segundo, dentro das regras, já qualifica.
 */
function valueRule(reason: ReferralPendingReason | null): CheckState {
  if (reason === "VAGA_ABAIXO_DO_MINIMO") return "no";
  if (reason === "AGUARDANDO_PROCESSAMENTO" || reason === "CONCLUIU_FORA_DO_PRAZO") return "ok";
  return "pending";
}

function deadlineRule(reason: ReferralPendingReason | null): CheckState {
  if (reason === "CONCLUIU_FORA_DO_PRAZO" || reason === "PRAZO_ENCERRADO") return "no";
  if (reason === "AGUARDANDO_PROCESSAMENTO") return "ok";
  return "pending";
}

/** Link para a lista de Usuários já filtrada — a única que mostra todo cadastro. */
function usersHref(item: ReferralItem): string | null {
  const term = item.referred?.email ?? item.referred?.phone;
  return term ? `/usuarios?busca=${encodeURIComponent(term)}` : null;
}

export function ReferralDetailDialog({
  item,
  onClose,
}: {
  item: ReferralItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const account = item.referredAccount ?? null;
  const situation = describeSituation(item);
  const step = account ? empresaStepIndex(account.stage) : null;
  const first = account?.firstCompletedJob ?? null;
  const href = usersHref(item);

  // Etapas do caminho da empresa até a recompensa. Para quem saiu do caminho
  // (freelancer, Em Casa) a lista mostra onde parou e por que não conta.
  const reached = (index: number): CheckState =>
    step == null ? "pending" : step >= index ? "ok" : "pending";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} className="max-w-2xl">
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.referred?.profile?.name ?? "Indicado sem nome"}</DialogTitle>
          <DialogDescription>
            Indicado por {item.referrer?.profile?.name ?? "—"} com o código{" "}
            <span className="font-mono">{item.code?.code ?? "—"}</span> em{" "}
            {formatInstantDate(item.createdAt)}.
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-lg p-3 ${TONE_CLASS[situation.tone]}`}>
          <p className="text-sm font-semibold">{situation.label}</p>
          {situation.detail && <p className="mt-1 text-xs">{situation.detail}</p>}
        </div>

        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Conta criada</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Tipo de conta"
              value={
                account ? (
                  <span className="flex flex-wrap gap-1">
                    {account.profiles.empresa && <KindBadge kind="EMPRESA" />}
                    {account.profiles.casa && <KindBadge kind="CASA" />}
                    {account.profiles.freelancer && <KindBadge kind="FREELANCER" />}
                    {account.kind === "SEM_PERFIL" && <KindBadge kind="SEM_PERFIL" />}
                  </span>
                ) : null
              }
            />
            <Field label="Etapa" value={account ? STAGE_LABEL[account.stage] : null} />
            <Field
              label="E-mail"
              value={
                item.referred?.email ? (
                  <>
                    {item.referred.email}
                    {item.referred.emailConfirmed === false && (
                      <span className="ml-1 text-xs text-amber-700">(não confirmado)</span>
                    )}
                  </>
                ) : null
              }
            />
            <Field label="Telefone" value={item.referred?.phone} />
            {account?.company && (
              <Field
                label="Empresa"
                value={[account.company.name, account.company.city].filter(Boolean).join(" · ")}
              />
            )}
            {item.referred?.status === "DELETED" && <Field label="Situação da conta" value="Excluída" />}
          </dl>
        </section>

        {account && (
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-[#1d1d1b]">Caminho até a recompensa</h3>
            <ul className="divide-y divide-neutral-100">
              <Row state="ok" title="Criou o login" detail={formatInstantDate(item.createdAt)} />
              <Row
                state={account.profiles.empresa ? "ok" : account.kind === "SEM_PERFIL" ? "pending" : "no"}
                title="Completou o cadastro de empresa"
                detail={
                  account.profiles.empresa
                    ? undefined
                    : account.kind === "SEM_PERFIL"
                      ? "Parou no primeiro passo."
                      : `Fez cadastro de ${ACCOUNT_KIND[account.kind].label.toLowerCase()} — não conta para o programa.`
                }
              />
              <Row
                state={reached(2)}
                title="Publicou vaga"
                detail={
                  account.vacancies > 0
                    ? `${account.vacancies} vaga(s)${account.lastVacancyAt ? ` · última em ${formatInstantDate(account.lastVacancyAt)}` : ""}`
                    : undefined
                }
              />
              <Row
                state={reached(3)}
                title="Contratou freelancer"
                detail={account.hires > 0 ? `${account.hires} contratação(ões)` : undefined}
              />
              <Row
                state={reached(4)}
                title="Concluiu serviço"
                detail={
                  first
                    ? `${first.title} · ${first.amountInCents != null ? brl(first.amountInCents) : "valor desconhecido"}${first.endedAt ? ` · ${formatInstantDate(first.endedAt)}` : ""}${account.completedJobs > 1 ? ` (+${account.completedJobs - 1})` : ""}`
                    : undefined
                }
              />
            </ul>
          </section>
        )}

        {account && item.status === "REGISTERED" && (
          <section className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-[#1d1d1b]">Regras da recompensa</h3>
            <ul className="divide-y divide-neutral-100">
              <Row
                state={account.profiles.empresa ? "ok" : account.kind === "SEM_PERFIL" ? "pending" : "no"}
                title="Indicado é empresa (bar/restaurante)"
              />
              <Row
                state={valueRule(account.pendingReason)}
                title={`Vaga concluída de ${brl(MIN_VACANCY_CENTS)} ou mais (pago ao freelancer)`}
              />
              <Row
                state={deadlineRule(account.pendingReason)}
                title="Serviço concluído em até 30 dias do cadastro"
                detail={`Prazo até ${formatInstantDate(account.deadline)}`}
              />
            </ul>
          </section>
        )}

        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Quem indicou</h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome" value={item.referrer?.profile?.name} />
            <Field label="Código" value={item.code?.code} />
            <Field label="E-mail" value={item.referrer?.email} />
            <Field label="Telefone" value={item.referrer?.phone} />
          </dl>
        </section>

        <DialogFooter className="mt-4 flex-wrap gap-2">
          {href && (
            <Button asChild variant="outline">
              <Link href={href}>Abrir em Usuários</Link>
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KindBadge({ kind }: { kind: keyof typeof ACCOUNT_KIND }) {
  const { label, className } = ACCOUNT_KIND[kind];
  return (
    <span
      className={`inline-block rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

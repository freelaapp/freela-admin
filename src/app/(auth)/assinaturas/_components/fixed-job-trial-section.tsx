"use client";

import { useState } from "react";
import { Briefcase, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionMutations } from "@/modules/admin/application/use-admin-subscriptions";
import {
  TRIAL_STATUS_LABEL,
  toSaoPauloDateInput,
  todaySaoPauloDateInput,
  trialEditCheck,
  trialUsageLabel,
  type FixedJobTrialAdmin,
  type FixedJobTrialStatus,
} from "@/modules/admin/domain/fixed-job-trial";
import type { PlanCode } from "@/modules/admin/infrastructure/subscriptions-api";

const STATUS_VARIANT: Record<FixedJobTrialStatus, "success" | "warning" | "outline" | "secondary"> = {
  ACTIVE: "success",
  EXHAUSTED: "warning",
  EXPIRED: "outline",
  REVOKED: "secondary",
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

/**
 * Teste de vaga fixa (CLT): a empresa fora do plano Vip publica N vagas fixas
 * até uma data. O teste libera SÓ a publicação — kanban, currículos e entrevistas
 * das vagas publicadas continuam funcionando depois que ele acaba.
 *
 * Três estados na tela:
 * - sem teste, ou o último encerrado → só "Liberar teste";
 * - teste ativo → situação + alterar + encerrar;
 * - esgotado ou vencido → situação + alterar (reativa) + liberar um novo.
 *
 * Vencido só reativa com data nova: o "Salvar" fica travado até a data andar.
 * Encerrar pede confirmação — não tem desfazer (reabrir é liberar outro teste).
 */
export function FixedJobTrialSection({
  storeId,
  planCode,
  trial,
}: {
  storeId: string;
  planCode: PlanCode;
  trial: FixedJobTrialAdmin | null | undefined;
}) {
  const { trialGrant, trialUpdate, trialRevoke } = useSubscriptionMutations(storeId);
  const busy = trialGrant.isPending || trialUpdate.isPending || trialRevoke.isPending;

  const [grantQuota, setGrantQuota] = useState("1");
  const [grantDays, setGrantDays] = useState("14");
  const [grantNote, setGrantNote] = useState("");
  // `null` = segue o valor do teste atual; vira string quando o admin mexe.
  const [editQuota, setEditQuota] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const editable = !!trial && trial.status !== "REVOKED";
  const canGrant = !trial || trial.status !== "ACTIVE";
  const planIncludesFixedJobs = planCode === "VIP" || planCode === "ENTERPRISE";

  const quotaValue = editQuota ?? (trial ? String(trial.quota) : "");
  const dateValue = editDate ?? (trial ? toSaoPauloDateInput(trial.expiresAt) : "");
  const quotaChanged = !!trial && editQuota !== null && Number(editQuota) !== trial.quota;
  const dateChanged =
    !!trial && editDate !== null && editDate !== toSaoPauloDateInput(trial.expiresAt);
  const editCheck = trial
    ? trialEditCheck({
        status: trial.status,
        quotaChanged,
        dateChanged,
        newDate: dateValue,
        today: todaySaoPauloDateInput(),
      })
    : { canSave: false, hint: null };

  const saveEdit = () => {
    trialUpdate.mutate(
      {
        storeId,
        ...(quotaChanged ? { quota: Number(editQuota) } : {}),
        ...(dateChanged ? { expiresOn: editDate! } : {}),
      },
      {
        onSuccess: () => {
          setEditQuota(null);
          setEditDate(null);
        },
      },
    );
  };

  return (
    <section className="space-y-3 border-t border-neutral-200 pt-5">
      <h3 className="font-medium flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-[#eca826]" />
        Teste de vaga fixa (CLT)
      </h3>
      <p className="text-sm text-neutral-600">
        Libera a publicação de vagas fixas para quem está no Grátis ou no Básico, com quantidade e
        prazo. Quando acaba, volta a regra do plano — as vagas já publicadas continuam funcionando.
      </p>
      {planIncludesFixedJobs && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">
          O plano atual já inclui vagas fixas: o teste só passa a valer se a empresa descer de plano.
        </p>
      )}

      {trial && (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[trial.status]}>{TRIAL_STATUS_LABEL[trial.status]}</Badge>
            <span className="font-medium tabular-nums">{trialUsageLabel(trial)}</span>
            <span className="text-sm text-neutral-600">até {fmtDate(trial.expiresAt)}</span>
          </div>
          <p className="text-xs text-neutral-500">
            Liberado em {fmtDate(trial.grantedAt)}
            {trial.grantedByEmail ? ` por ${trial.grantedByEmail}` : ""}
            {trial.note ? ` · ${trial.note}` : ""}
            {trial.revokedAt
              ? ` · encerrado em ${fmtDate(trial.revokedAt)}${
                  trial.revokedByEmail ? ` por ${trial.revokedByEmail}` : ""
                }`
              : ""}
          </p>

          {editable && (
            <div className="grid grid-cols-1 sm:grid-cols-[120px_180px_auto] gap-3 items-end">
              <div>
                <Label htmlFor="t-edit-quota">Total de vagas</Label>
                <Input
                  id="t-edit-quota"
                  type="number"
                  min={Math.max(1, trial.used)}
                  max={20}
                  value={quotaValue}
                  onChange={(e) => setEditQuota(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="t-edit-date">Vale até</Label>
                <Input
                  id="t-edit-date"
                  type="date"
                  value={dateValue}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || !editCheck.canSave || !Number(quotaValue)}
                  onClick={saveEdit}
                >
                  {trialUpdate.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Salvar alteração
                </Button>
                {trial.status === "ACTIVE" && (
                  <Button variant="outline" disabled={busy} onClick={() => setConfirmingRevoke(true)}>
                    <X className="w-4 h-4 mr-1" />
                    Encerrar teste
                  </Button>
                )}
              </div>
            </div>
          )}
          {editable && editCheck.hint && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">{editCheck.hint}</p>
          )}
        </div>
      )}

      {trial && (
        <Dialog
          open={confirmingRevoke}
          onOpenChange={(open) => !trialRevoke.isPending && setConfirmingRevoke(open)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Encerrar o teste de vaga fixa?</DialogTitle>
              <DialogDescription>
                {`Encerra agora, com ${trialUsageLabel(trial)}. A empresa volta à regra do plano; as vagas já publicadas continuam funcionando.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={trialRevoke.isPending}
                onClick={() => setConfirmingRevoke(false)}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={trialRevoke.isPending}
                onClick={() =>
                  trialRevoke.mutate({ storeId }, { onSuccess: () => setConfirmingRevoke(false) })
                }
              >
                {trialRevoke.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Sim, encerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canGrant && (
        <div className="space-y-3">
          {trial && <p className="text-sm font-medium">Liberar um novo teste</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="t-quota">Vagas fixas</Label>
              <Input
                id="t-quota"
                type="number"
                min={1}
                max={20}
                value={grantQuota}
                onChange={(e) => setGrantQuota(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-days">Dias</Label>
              <Input
                id="t-days"
                type="number"
                min={1}
                max={90}
                value={grantDays}
                onChange={(e) => setGrantDays(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="t-note">Motivo</Label>
              <Input
                id="t-note"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="Ex.: fechamento"
              />
            </div>
          </div>
          <Button
            disabled={busy || !Number(grantQuota) || !Number(grantDays)}
            onClick={() =>
              trialGrant.mutate(
                {
                  storeId,
                  quota: Number(grantQuota),
                  days: Number(grantDays),
                  ...(grantNote.trim() ? { note: grantNote.trim() } : {}),
                },
                { onSuccess: () => setGrantNote("") },
              )
            }
          >
            {trialGrant.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Briefcase className="w-4 h-4 mr-1" />
            )}
            Liberar teste
          </Button>
        </div>
      )}
    </section>
  );
}

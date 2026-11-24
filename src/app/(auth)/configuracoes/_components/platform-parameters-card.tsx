"use client";

import { useState } from "react";
import { History, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import {
  PARAMETER_REASON_MAX,
  type PlatformParameter,
} from "@/modules/admin/infrastructure/platform-parameters-api";
import {
  useParameterChanges,
  usePlatformParameters,
  useUpdatePlatformParameter,
} from "@/modules/admin/application/use-platform-parameters";
import {
  capSeatsLabel,
  changeLine,
  formatParameterValue,
  lastChangeLabel,
  stateLabel,
  validateParameterInput,
} from "@/modules/admin/application/platform-parameters-presentation";
import { useAuth } from "@/modules/auth/application/use-auth";
import { SUPER_ADMIN_ONLY_HINT } from "./super-admin-hint";

const CAP_KEY = "ranking.worked_here_cap_pct";

const TEXTAREA_CLASS =
  "mt-1 flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] shadow-sm placeholder:text-[#a3a3a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eca826] disabled:cursor-not-allowed disabled:opacity-50";

function fieldMessage(error: ReturnType<typeof apiErrorOf>, field: "value" | "reason"): string | null {
  const fields = error.extra.fields;
  if (fields && typeof fields === "object") {
    const text = (fields as Record<string, unknown>)[field];
    if (typeof text === "string" && text) return text;
  }
  return null;
}

function EditDialog({
  paramKey,
  params,
  onClose,
}: {
  paramKey: string;
  params: PlatformParameter[];
  onClose: () => void;
}) {
  const param = params.find((p) => p.key === paramKey);
  const update = useUpdatePlatformParameter();
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [serverErrors, setServerErrors] = useState<{ value?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!param) return null;

  const touchedValue = value.trim() !== "";
  const touchedReason = reason.trim() !== "";
  const local = validateParameterInput(param, value, reason);
  const valid = !local.value && !local.reason;
  const valueError = serverErrors.value ?? (touchedValue ? local.value : null);
  const reasonError = serverErrors.reason ?? (touchedReason ? local.reason : null);
  const today = formatParameterValue(param.value, param.unit);

  const handleSave = async () => {
    if (!valid) return;
    setServerErrors({});
    setFormError(null);
    const next = Number(value.trim());
    try {
      await update.mutateAsync({
        key: param.key,
        value: next,
        reason: reason.trim(),
        expectedVersion: param.version,
      });
      toast.success(
        `${param.label} salvo: ${formatParameterValue(next, param.unit)}. Vale para as próximas vagas.`,
      );
      onClose();
    } catch (error) {
      const e = apiErrorOf(error);
      if (e.status === 409) {
        setFormError("Alguém mudou este valor agora há pouco. Atualizamos a tela: confira e salve de novo.");
      } else if (e.status === 422 || e.status === 400) {
        const v = fieldMessage(e, "value");
        const r = fieldMessage(e, "reason");
        if (v || r) setServerErrors({ ...(v ? { value: v } : {}), ...(r ? { reason: r } : {}) });
        else setFormError(e.message ?? "Não foi possível salvar. O que você digitou continua aqui. Tente de novo.");
      } else {
        setFormError(
          e.status === 403
            ? SUPER_ADMIN_ONLY_HINT
            : "Não foi possível salvar. O que você digitou continua aqui. Tente de novo.",
        );
      }
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !update.isPending && !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby="parameter-dialog-title">
        <DialogHeader>
          <DialogTitle id="parameter-dialog-title">Alterar: {param.label}</DialogTitle>
          <DialogDescription>Hoje: {today}</DialogDescription>
        </DialogHeader>
        <div data-testid="parameter-dialog-body" className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {param.help && <p className="text-xs text-[#737373]">{param.help}</p>}
          <div className="space-y-1">
            <Label htmlFor="parameter-value">Novo valor</Label>
            <div className="flex items-center gap-2">
              <Input
                id="parameter-value"
                type="number"
                inputMode="numeric"
                min={param.min}
                max={param.max}
                step={1}
                autoComplete="off"
                value={value}
                aria-describedby="parameter-value-hint"
                aria-invalid={!!valueError}
                onChange={(event) => {
                  setValue(event.target.value);
                  setServerErrors((s) => ({ ...s, value: undefined }));
                }}
              />
              {param.unit && <span className="text-sm text-[#737373]">{param.unit}</span>}
            </div>
            <p id="parameter-value-hint" className="text-xs text-[#737373]">
              {valueError ? <span className="text-red-600">{valueError}</span> : `Entre ${param.min} e ${param.max}.`}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="parameter-reason">Motivo (obrigatório)</Label>
            <textarea
              id="parameter-reason"
              rows={3}
              maxLength={PARAMETER_REASON_MAX}
              value={reason}
              aria-describedby="parameter-reason-hint"
              aria-invalid={!!reasonError}
              onChange={(event) => {
                setReason(event.target.value);
                setServerErrors((s) => ({ ...s, reason: undefined }));
              }}
              className={TEXTAREA_CLASS}
            />
            <p id="parameter-reason-hint" className="text-xs text-red-600">
              {reasonError}
            </p>
          </div>
          <p className="text-xs text-[#737373]">
            Vale para as próximas vagas abertas. As vagas já abertas continuam com {today}.
          </p>
        </div>
        {formError && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Voltar
          </Button>
          <Button onClick={handleSave} disabled={!valid || update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {valid ? `Salvar ${formatParameterValue(Number(value.trim()), param.unit)}` : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ param, onClose }: { param: PlatformParameter; onClose: () => void }) {
  const changes = useParameterChanges(param.key, true);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby="parameter-history-title">
        <DialogHeader>
          <DialogTitle id="parameter-history-title">Histórico: {param.label}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto text-sm">
          {changes.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          ) : changes.isError ? (
            <p className="text-xs text-red-600">Não foi possível atualizar agora.</p>
          ) : (changes.data ?? []).length === 0 ? (
            <p className="text-xs text-[#737373]">
              Nenhuma mudança ainda. Valor inicial: {formatParameterValue(param.defaultValue, param.unit)}.
            </p>
          ) : (
            <ol className="space-y-2">
              {(changes.data ?? []).map((change, index) => (
                <li key={`${change.createdAt}-${index}`} className="rounded-md bg-[#f7f7f7] px-2.5 py-2 text-xs text-[#1d1d1b]">
                  {changeLine(change, param.unit)}
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Parâmetros das regras: números que o suporte ajusta sem versão nova do site ou do app. Qualquer
 * admin vê; só super-admin altera (a API também recusa). Mudar pede motivo e vale para as próximas
 * vagas abertas.
 */
export function PlatformParametersCard() {
  const { isSuperAdmin } = useAuth();
  const query = usePlatformParameters();
  const [editing, setEditing] = useState<string | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const params = query.data ?? [];
  const historyParam = params.find((p) => p.key === history);

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eca826]/10">
          <Scale className="h-5 w-5 text-[#eca826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1d1d1b]">Parâmetros das regras</h3>
          <p className="mt-1 text-xs text-[#737373]">
            Valem para as próximas vagas abertas. Mudar pede motivo.
          </p>

          {query.isLoading ? (
            <Loader2 className="mt-3 h-4 w-4 animate-spin text-neutral-400" />
          ) : query.isError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-red-600">Não foi possível atualizar agora.</span>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {params.map((param) => (
                <section key={param.key} aria-label={param.label} className="border-t border-[#f0f0f0] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                    {param.key === CAP_KEY ? "Ordem da sugestão" : "Regra"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-[#1d1d1b]">{param.label}</span>
                    <span className="text-lg font-bold text-[#1d1d1b]">
                      {formatParameterValue(param.value, param.unit)}
                    </span>
                    {param.key === CAP_KEY && (
                      <span className="text-xs text-[#737373]">({capSeatsLabel(param.value)})</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        param.inEffect ? "bg-green-50 text-green-700" : "bg-[#f7f7f7] text-[#737373]"
                      }`}
                    >
                      {stateLabel(param)}
                    </span>
                  </div>
                  {param.help && <p className="mt-1 text-xs text-[#737373]">{param.help}</p>}
                  <p className="mt-1 text-xs text-[#737373]">
                    Padrão: {formatParameterValue(param.defaultValue, param.unit)} · Faixa: {param.min} a {param.max}
                  </p>
                  <p className="text-xs text-[#737373]">{lastChangeLabel(param)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isSuperAdmin && (
                      <Button size="sm" className="min-h-11 sm:min-h-0" onClick={() => setEditing(param.key)}>
                        Alterar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-0"
                      onClick={() => setHistory(param.key)}
                    >
                      <History className="mr-1 h-3.5 w-3.5" />
                      Histórico
                    </Button>
                  </div>
                </section>
              ))}
              {!isSuperAdmin && (
                <p className="text-xs text-[#737373]">Só leitura. {SUPER_ADMIN_ONLY_HINT}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && <EditDialog paramKey={editing} params={params} onClose={() => setEditing(null)} />}
      {historyParam && <HistoryDialog param={historyParam} onClose={() => setHistory(null)} />}
    </div>
  );
}

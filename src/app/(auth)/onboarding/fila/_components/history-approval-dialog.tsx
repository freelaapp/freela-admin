"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount } from "@/modules/admin/application/orientation-presentation";
import {
  formatRating,
  historyErrorMessage,
  historyPreviewLines,
} from "@/modules/admin/application/orientation-virada-presentation";
import { useApplyHistoryApproval, useHistoryPreview } from "@/modules/admin/application/use-orientation";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type { HistoryCriteria, HistoryPreview } from "@/modules/admin/infrastructure/orientation-api";
import { DEFAULT_HISTORY_FORM, buildHistoryCriteria, type HistoryForm } from "../_lib/history-form";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** A prévia vale para os critérios com que foi pedida: o botão manda exatamente esses. */
interface Shown {
  criteria: HistoryCriteria;
  data: HistoryPreview;
}

const REASON_MAX = 500;

function Inner({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<HistoryForm>(DEFAULT_HISTORY_FORM);
  const [shown, setShown] = useState<Shown | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ approved: number; skipped: number } | null>(null);
  const previewMutation = useHistoryPreview();
  const applyMutation = useApplyHistoryApproval();
  const applying = useRef(false);

  const busy = applyMutation.isPending;

  const change = (patch: Partial<HistoryForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setShown(null);
    setError(null);
  };

  const loadPreview = () => {
    setError(null);
    setShown(null);
    const built = buildHistoryCriteria(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    previewMutation.mutate(built.payload, {
      onSuccess: (data) => setShown({ criteria: built.payload, data }),
      onError: (err) => setError(historyErrorMessage(err, "Não consegui calcular a prévia. Tente de novo.")),
    });
  };

  const eligible = shown?.data.eligible ?? 0;
  const canApprove = !!shown && eligible > 0 && reason.trim().length > 0 && !busy && !done;

  const approve = async () => {
    if (!shown || !canApprove || applying.current) return;
    applying.current = true;
    setError(null);
    try {
      const res = await applyMutation.mutateAsync({
        ...shown.criteria,
        reason: reason.trim(),
        confirmCount: shown.data.eligible,
      });
      setDone({ approved: res.approved, skipped: res.skipped });
      setShown(null);
    } catch (err) {
      const code = apiErrorOf(err).code;
      setError(historyErrorMessage(err, "Não consegui aprovar. Tente de novo."));
      // A contagem que o dono viu não vale mais (ou o lote parou no meio): pede a prévia de novo.
      if (code === "HISTORY_COUNT_MISMATCH" || code === "HISTORY_EMPTY" || code === "HISTORY_APPLY_FAILED") {
        setShown(null);
      }
    } finally {
      applying.current = false;
    }
  };

  const lines = shown ? historyPreviewLines(shown.data, shown.criteria) : [];
  const sampleRest = shown ? shown.data.eligible - shown.data.sample.length : 0;
  const label = `Aprovar ${formatCount(eligible)} ${eligible === 1 ? "pessoa" : "pessoas"}`;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} className="max-w-lg">
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="historico-titulo"
        className="max-h-[55vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="historico-titulo">Aprovar por histórico</DialogTitle>
          <DialogDescription>
            Aprova, sem aula, quem já fez serviços e tem boa nota. Veja quantos são antes de aprovar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-[#1d1d1b]">
          {!done && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="hist-servicos">Serviços concluídos, no mínimo</Label>
                <Input
                  id="hist-servicos"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.minServices}
                  onChange={(e) => change({ minServices: e.target.value })}
                  disabled={busy}
                  className="h-11 md:h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hist-nota">Nota, no mínimo</Label>
                <Input
                  id="hist-nota"
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.minRating}
                  onChange={(e) => change({ minRating: e.target.value })}
                  disabled={busy}
                  className="h-11 md:h-9"
                />
              </div>
            </div>
          )}

          {!done && (
            <Button
              variant="outline"
              className="min-h-11 w-full md:w-auto"
              onClick={loadPreview}
              disabled={previewMutation.isPending || busy}
            >
              {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Ver quantos
            </Button>
          )}

          {shown && (
            <>
              <ul className="space-y-1">
                {lines.map((l) => (
                  <li key={l.label}>
                    <span className="font-medium">
                      {l.label}: {formatCount(l.value)}
                    </span>{" "}
                    <span className="text-[#737373]">({l.how})</span>
                  </li>
                ))}
              </ul>
              {shown.criteria.minRating > 0 && (
                <p role="note" className="rounded-lg border border-[#eca826] bg-[#fff8e6] p-3">
                  Quem tem serviço mas nenhuma avaliação fica de fora (nota 0). São {formatCount(shown.data.noRatings)}{" "}
                  pessoas.
                </p>
              )}
              {shown.data.sample.length > 0 && (
                <div>
                  <p className="font-medium">Amostra de quem seria aprovado</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[#525252]">
                    {shown.data.sample.map((s) => (
                      <li key={s.providerGlobalId}>
                        <span className="text-[#1d1d1b]">{s.name ?? "Sem nome"}</span>
                        {" · "}
                        {[s.city, s.uf].filter(Boolean).join("/") || "sem cidade"}
                        {" · "}
                        {formatCount(s.totalCompletedServices)} {s.totalCompletedServices === 1 ? "serviço" : "serviços"}
                        {" · nota "}
                        {formatRating(s.averageRating)}
                      </li>
                    ))}
                  </ul>
                  {sampleRest > 0 && <p className="mt-1 text-[#737373]">e mais {formatCount(sampleRest)} pessoas.</p>}
                </div>
              )}
              {eligible === 0 ? (
                <p role="status" className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                  Ninguém com esses critérios.
                </p>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="hist-motivo">Motivo</Label>
                  <Input
                    id="hist-motivo"
                    autoComplete="off"
                    maxLength={REASON_MAX}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    className="h-11 md:h-9"
                  />
                </div>
              )}
            </>
          )}

          {done && (
            <p role="status" className="rounded-lg border border-[#16a34a] bg-[#f0fdf4] p-3 font-medium">
              {formatCount(done.approved)} {done.approved === 1 ? "aprovada" : "aprovadas"}
              {done.skipped > 0 &&
                `, ${formatCount(done.skipped)} ${done.skipped === 1 ? "pulada" : "puladas"} porque mudaram de situação`}
              . Ninguém recebe mensagem por esta aprovação.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-[#dc2626] bg-[#fef2f2] p-3 text-[#991b1b]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {done ? "Fechar" : "Cancelar"}
          </Button>
          {shown && eligible > 0 && (
            <Button className="min-h-11" onClick={() => void approve()} disabled={!canApprove}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Aprovar por histórico (só super-admin; quem mostra o botão é a Fila). Remonta a cada abertura. */
export function HistoryApprovalDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <Inner onClose={onClose} />;
}

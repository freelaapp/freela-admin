"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoicePills } from "@/components/ui/choice-pills";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDecideOccurrence } from "@/modules/admin/application/use-occurrences";
import {
  CONTACT_OPTIONS,
  CONTEST_OPTIONS,
  RELEASE_MODE_OPTIONS,
  annulHint,
  buildDecideBody,
  confirmationOf,
  contestDeniedHint,
  contestQuestion,
  decideErrorOf,
  effectiveChoice,
  firstName,
  initialFormState,
  keepHint,
  releaseHint,
  submitLabel,
  successText,
  suspendHint,
  validateDecideForm,
  warningHint,
  type DecideErrors,
  type DecideFormState,
} from "@/modules/admin/application/occurrences-presentation";
import type {
  OccurrenceChoice,
  OccurrenceContactResult,
  OccurrenceContestAnswer,
  OccurrenceDetail,
} from "@/modules/admin/infrastructure/occurrences-api";

const FIELD =
  "w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30";
const LABEL = "mb-1.5 block text-xs font-semibold text-[#1d1d1b]";
const ERROR = "mt-1 text-xs font-medium text-red-700";
const HINT = "mt-2 text-xs text-[#737373]";

/**
 * "Decidir o caso" (D5 §C.3). Estado local, como os diálogos de Suspensões. O texto escrito fica
 * no formulário em qualquer erro (409, rede); o admin escolhe a mensagem pelo código.
 */
export function DecideForm({
  detail,
  onReload,
}: {
  detail: OccurrenceDetail;
  onReload: () => void;
}) {
  const { item, options } = detail;
  const n = firstName(item);
  const decide = useDecideOccurrence();
  const [form, setForm] = useState<DecideFormState>(() => initialFormState(detail));
  const [errors, setErrors] = useState<DecideErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ReturnType<typeof decideErrorOf> | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const now = new Date();
  const set = <K extends keyof DecideFormState>(key: K, value: DecideFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const choice = effectiveChoice(form, options);
  const contestAccepted = options.needsContestAnswer && form.contestAnswer === "ACCEPTED";
  const showChoices = !contestAccepted && !(options.contestOnly && form.contestAnswer === "DENIED");
  const choiceOptions: Array<{ value: OccurrenceChoice; label: string }> = [
    ...(options.canKeep ? [{ value: "KEEP" as const, label: "Manter o que o sistema aplicou" }] : []),
    ...(options.canRelease ? [{ value: "RELEASE" as const, label: "Liberar agora" }] : []),
    ...(options.canSuspend ? [{ value: "SUSPEND" as const, label: "Suspender por…" }] : []),
    // Sem contestação: "Não foi falta". Contestada: anular é "Aceitar".
    ...(options.canAnnul && !options.needsContestAnswer
      ? [{ value: "ANNUL" as const, label: "Não foi falta (anular)" }]
      : []),
  ];

  async function send() {
    setConfirming(false);
    setFailure(null);
    try {
      const result = await decide.mutateAsync({
        infractionId: item.infractionId,
        body: buildDecideBody(form, options),
      });
      const text = successText(result, item);
      toast.success(text);
      setDone(text);
    } catch (err) {
      setFailure(decideErrorOf(err, item));
    }
  }

  function submit() {
    const found = validateDecideForm(form, options, item, now);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (confirmationOf(form, options, item, now)) setConfirming(true);
    else void send();
  }

  if (done) {
    return (
      <section aria-label="Decisão registrada" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-900">{done}</p>
        <div className="mt-3 flex gap-2">
          <Link href="/ocorrencias" className="text-sm font-semibold text-[#b9770e] underline">
            Próximo caso
          </Link>
        </div>
      </section>
    );
  }

  const confirmation = confirming ? confirmationOf(form, options, item, now) : null;

  return (
    <section aria-label="Decidir o caso" className="rounded-lg border border-[#e5e5e5] p-4">
      <h2 className="mb-3 text-base font-semibold text-[#1d1d1b]">Decidir o caso</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="oc-what" className={LABEL}>
            O que aconteceu
          </label>
          <textarea
            id="oc-what"
            rows={3}
            maxLength={2000}
            value={form.whatHappened}
            onChange={(e) => set("whatHappened", e.target.value)}
            aria-invalid={Boolean(errors.whatHappened) || undefined}
            className={FIELD}
          />
          <p className={HINT}>Resuma o que a empresa e {n} contaram. Fica só no histórico interno.</p>
          {errors.whatHappened && <p className={ERROR}>{errors.whatHappened}</p>}
        </div>

        <div>
          <p className={LABEL}>Falou com {n}?</p>
          <ChoicePills<OccurrenceContactResult | "">
            aria-label={`Falou com ${n}?`}
            options={CONTACT_OPTIONS}
            value={form.contact}
            onChange={(v) => set("contact", v)}
          />
          {errors.contact && <p className={ERROR}>{errors.contact}</p>}
        </div>

        <div>
          <label htmlFor="oc-said" className={LABEL}>
            O que {n} disse (opcional)
          </label>
          <textarea
            id="oc-said"
            rows={2}
            maxLength={2000}
            value={form.providerSaid}
            onChange={(e) => set("providerSaid", e.target.value)}
            className={FIELD}
          />
        </div>

        {options.needsContestAnswer && (
          <div>
            <p className={LABEL}>{contestQuestion(item)}</p>
            <ChoicePills<OccurrenceContestAnswer | "">
              aria-label="Você aceita a contestação?"
              options={CONTEST_OPTIONS}
              value={form.contestAnswer}
              onChange={(v) => set("contestAnswer", v)}
            />
            {form.contestAnswer === "DENIED" && <p className={HINT}>{contestDeniedHint(item)}</p>}
            {form.contestAnswer === "ACCEPTED" && <p className={HINT}>{annulHint(item)}</p>}
            {options.contestOnly && form.contestAnswer === "DENIED" && (
              <p className={HINT}>A decisão que já vale continua. Para trocá-la, desfaça a decisão antes.</p>
            )}
            {errors.contestAnswer && <p className={ERROR}>{errors.contestAnswer}</p>}
          </div>
        )}

        {showChoices && (
          <div>
            <p className={LABEL}>O que fazer agora</p>
            <ChoicePills<OccurrenceChoice | "">
              aria-label="O que fazer agora"
              options={choiceOptions}
              value={form.choice}
              onChange={(v) => set("choice", v)}
            />
            {form.choice === "KEEP" && <p className={HINT}>{keepHint(item, form.contact, now)}</p>}
            {form.choice === "RELEASE" && (
              <div className="mt-2 space-y-2">
                <p className={HINT}>{releaseHint(item, detail.repeatWindowDays)}</p>
                <ChoicePills
                  aria-label="Como liberar"
                  options={RELEASE_MODE_OPTIONS}
                  value={form.releaseMode}
                  onChange={(v) => set("releaseMode", v)}
                />
                {form.releaseMode === "WARNING" && (
                  <p className={HINT}>{warningHint(item, detail.noticesEnabled)}</p>
                )}
              </div>
            )}
            {form.choice === "SUSPEND" && (
              <div className="mt-2 space-y-2">
                <ChoicePills<string>
                  aria-label="Por quantos dias"
                  options={options.suspensionDays.map((d) => ({ value: String(d), label: `${d} dias` }))}
                  value={form.days ? String(form.days) : ""}
                  onChange={(v) => set("days", Number(v))}
                />
                {form.days && <p className={HINT}>{suspendHint(item, form.days, now)}</p>}
                {errors.days && <p className={ERROR}>{errors.days}</p>}
              </div>
            )}
            {form.choice === "ANNUL" && <p className={HINT}>{annulHint(item)}</p>}
            {errors.choice && <p className={ERROR}>{errors.choice}</p>}
          </div>
        )}

        {failure && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <p>{failure.text}</p>
            {failure.action === "reload" && (
              <Button className="mt-2" size="sm" variant="outline" onClick={onReload}>
                Ver o caso de novo
              </Button>
            )}
            {failure.action === "retry" && (
              <Button className="mt-2" size="sm" variant="outline" onClick={() => void send()}>
                Tentar de novo
              </Button>
            )}
          </div>
        )}

        <Button variant="secondary" onClick={submit} disabled={decide.isPending || !choice}>
          {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitLabel(form, options, item, now)}
        </Button>
      </div>

      {confirmation && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent role="dialog" aria-label={confirmation.title}>
            <DialogClose onClick={() => setConfirming(false)} />
            <DialogHeader>
              <DialogTitle>{confirmation.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[#737373]">{confirmation.body}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Voltar
              </Button>
              <Button variant="secondary" onClick={() => void send()} disabled={decide.isPending}>
                {confirmation.action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChooseTeam } from "@/modules/admin/application/use-selection-round";
import {
  chooseBillingLine,
  chooseConfirmLabel,
  chooseErrorMessage,
  chooseSuccessText,
  isTransientError,
  type PayWay,
} from "@/modules/admin/application/selection-round-presentation";

/**
 * Confirmação do "Escolher titular e suplentes" (UX de 05/11 noite §4.3): mostra os 3 nomes e o que
 * acontece, com o texto de fatura ou de Pix. Monte só com o diálogo aberto. Erro: a mensagem
 * fica aqui dentro, o diálogo não fecha e a marcação continua. Sucesso: avisa e chama `onDone`.
 */
export function ChooseConfirmDialog({
  vacancyId,
  subtitle,
  company,
  valueLabel,
  way,
  principal,
  reserves,
  maxReserves,
  autoFill,
  othersCount,
  roundInProgress,
  onClose,
  onDone,
}: {
  vacancyId: string;
  /** "Atendente · sex 06/11, das 17h". */
  subtitle: string;
  company: string;
  /** O valor da vaga, já formatado (o mesmo do resumo do modal). */
  valueLabel: string;
  way: PayWay;
  principal: { id: string; name: string };
  /** Os suplentes marcados, na ordem de chamada (sem lugares vazios). */
  reserves: { id: string; name: string }[];
  maxReserves: number;
  autoFill: boolean;
  /** Os outros candidatos pendentes, que passam a "Não selecionado". */
  othersCount: number;
  /** A rodada está perguntando ou com as opções na empresa. */
  roundInProgress: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const choose = useChooseTeam(vacancyId);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const busy = choose.isPending;
  const first = principal.name.split(" ")[0] ?? principal.name;
  const missing = Math.max(0, maxReserves - reserves.length);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const confirm = async () => {
    setError(null);
    try {
      const result = await choose.mutateAsync({
        principalCandidacyId: principal.id,
        reserveCandidacyIds: reserves.map((r) => r.id),
      });
      toast.success(
        chooseSuccessText({
          principalName: principal.name,
          reserveNames: reserves.map((r) => r.name),
          billing: result.billing,
          autoFill,
        }),
      );
      onDone();
    } catch (err) {
      setError(chooseErrorMessage(err));
      setRetry(isTransientError(err));
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && close()} className="max-w-lg">
      <DialogContent
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`escolher-titulo-${vacancyId}`}
        className="p-4 sm:p-6"
      >
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>
            <span id={`escolher-titulo-${vacancyId}`}>Aprovar {principal.name} para trabalhar?</span>
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm text-[#1d1d1b]">
          <dl className="space-y-1">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-[#737373]">Titular (vai trabalhar)</dt>
              <dd className="font-semibold">{principal.name}</dd>
            </div>
            {Array.from({ length: maxReserves }, (_, i) => (
              <div key={i} className="flex flex-wrap gap-x-2">
                <dt className="text-[#737373]">Suplente {i + 1}</dt>
                <dd className="font-semibold">{reserves[i]?.name ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="mb-1 font-medium">Ao aprovar:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{chooseBillingLine(way, company, valueLabel, principal.name)}</li>
              <li>
                {first} recebe o aviso de que foi escolhido(a) e confirma a presença pelo link, como sempre.
              </li>
              {reserves.length > 0 && (
                <li>
                  {reserves.map((r) => r.name.split(" ")[0]).join(" e ")} não{" "}
                  {reserves.length > 1 ? "recebem" : "recebe"} mensagem: só se forem chamados para substituir.
                </li>
              )}
              {othersCount > 0 && (
                <li>
                  Os outros {othersCount} candidato{othersCount === 1 ? "" : "s"} passam a &quot;Não
                  selecionado&quot;{way === "PIX" ? " (se a aprovação provisória estiver ligada, só depois do pagamento)" : ""}.
                </li>
              )}
              {missing > 0 && autoFill && (
                <li>
                  {missing === 1 ? "O suplente que falta" : `Os ${missing} suplentes que faltam`} o sistema escolhe
                  sozinho depois do pagamento, na ordem do Freela.
                </li>
              )}
              {missing > 0 && !autoFill && (
                <li>
                  {reserves.length === 0 ? "A vaga fica sem suplentes." : `A vaga fica com ${reserves.length} suplente${reserves.length === 1 ? "" : "s"}.`}
                </li>
              )}
              <li>
                A seleção desta vaga termina.
                {roundInProgress ? " Quem confirmou e não ficou entre os escolhidos recebe o aviso de sempre." : ""}
              </li>
              <li>Fica registrado que foi o suporte.</li>
            </ul>
          </div>

          <p className="text-xs text-[#737373]">
            Os suplentes dá para trocar depois, na seção Suplentes. Para tirar {first}, só pelo Desvincular da
            vaga.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={close}
            disabled={busy}
            className="min-h-11 w-full border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7] sm:w-auto"
          >
            Voltar
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={busy}
            className="min-h-11 w-full bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] disabled:opacity-50 sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aprovando...
              </>
            ) : retry && error ? (
              "Tentar de novo"
            ) : (
              chooseConfirmLabel(way)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRef, useState, type KeyboardEvent } from "react";
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
import { useHurrySelection } from "@/modules/admin/application/use-selection-round";
import {
  clockLabel,
  defaultHurryMinutes,
  hourLabel,
  hurryErrorMessage,
  hurryOptionDisabledText,
  isTransientError,
} from "@/modules/admin/application/selection-round-presentation";
import {
  HURRY_NOTE_MAX,
  type AdminSelectionHurry,
  type HurryMinutes,
} from "@/modules/admin/infrastructure/selection-round-api";

const NOTE_SHORTCUTS = ["A empresa ligou com pressa", "Já tem candidatos suficientes"];

/**
 * "Selecionar agora" (UX de 05/11 noite §3.2): escolhe 10, 20 ou 45 min para os freelancers
 * responderem. Quais tempos valem, a hora nova e o motivo de cada tempo desligado vêm prontos do
 * servidor (`hurry`); aqui só se mostra. Monte este componente só com o diálogo aberto: o estado
 * (tempo marcado, motivo, erro) nasce limpo a cada abertura. Erro: a mensagem fica dentro do
 * diálogo, sem fechar.
 */
export function HurrySelectionDialog({
  vacancyId,
  hurry,
  subtitle,
  onClose,
}: {
  vacancyId: string;
  hurry: AdminSelectionHurry;
  /** "Atendente · sex 06/11, das 17h". */
  subtitle: string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<HurryMinutes | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const hurryNow = useHurrySelection(vacancyId);
  const radios = useRef<Record<number, HTMLButtonElement | null>>({});

  // O tempo marcado só vale se o servidor ainda o permite (a leitura é refeita com o diálogo aberto).
  const selected =
    picked !== null && hurry.options.find((o) => o.minutes === picked)?.allowed
      ? picked
      : defaultHurryMinutes(hurry.options);
  const option = hurry.options.find((o) => o.minutes === selected) ?? null;
  const busy = hurryNow.isPending;
  const noteTooLong = note.trim().length > HURRY_NOTE_MAX;

  const close = () => {
    if (busy) return;
    onClose();
  };

  const confirm = async () => {
    if (!option || noteTooLong) return;
    setError(null);
    try {
      const result = await hurryNow.mutateAsync({ minutes: option.minutes, note });
      const asked = result.hurried.asked;
      toast.success(
        `Perguntamos a ${asked} freelancer${asked === 1 ? "" : "s"}. Respostas até ${hourLabel(result.hurried.answersBy)}; a empresa recebe as opções até ${hourLabel(result.hurried.optionsBy)}.`,
      );
      onClose();
    } catch (err) {
      setError(hurryErrorMessage(err));
      setRetry(isTransientError(err));
    }
  };

  const move = (event: KeyboardEvent, from: number, step: 1 | -1) => {
    event.preventDefault();
    const list = hurry.options;
    for (let i = 1; i <= list.length; i += 1) {
      const next = list[(from + step * i + list.length * 2) % list.length];
      if (next.allowed) {
        setPicked(next.minutes);
        radios.current[next.minutes]?.focus();
        return;
      }
    }
  };

  const everyone = hurry.pendingCount <= hurry.askUpTo;
  const slack = option
    ? Math.round((new Date(option.optionsBy).getTime() - new Date(option.answersBy).getTime()) / 60_000)
    : 0;

  return (
    <Dialog open onOpenChange={(next) => !next && close()} className="max-w-lg">
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={`adiantar-titulo-${vacancyId}`}
        className="p-4 sm:p-6"
      >
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>
            <span id={`adiantar-titulo-${vacancyId}`}>Selecionar agora?</span>
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm text-[#1d1d1b]">
          <p>
            {everyone
              ? `Fechamos a janela agora e perguntamos pelo WhatsApp aos ${hurry.pendingCount} candidatos se ainda podem ir nesse horário.`
              : `Fechamos a janela agora e perguntamos pelo WhatsApp a até ${hurry.askUpTo} dos ${hurry.pendingCount} candidatos, os mais bem colocados que podem ir nesse horário.`}{" "}
            Os 3 mais bem colocados que confirmarem viram as opções da empresa.
          </p>

          <div>
            <p id={`adiantar-tempos-${vacancyId}`} className="mb-2 font-medium">
              Tempo para os freelancers responderem
            </p>
            <div
              role="radiogroup"
              aria-labelledby={`adiantar-tempos-${vacancyId}`}
              className="grid grid-cols-3 gap-2"
            >
              {hurry.options.map((o, index) => {
                const checked = o.minutes === selected;
                return (
                  <button
                    key={o.minutes}
                    ref={(el) => {
                      radios.current[o.minutes] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-disabled={!o.allowed || busy ? true : undefined}
                    aria-label={
                      o.allowed
                        ? `${o.minutes} minutos, opções às ${hourLabel(o.optionsBy)}`
                        : `${o.minutes} minutos, indisponível: ${hurryOptionDisabledText(o, hurry)}`
                    }
                    tabIndex={checked ? 0 : -1}
                    onClick={() => o.allowed && !busy && setPicked(o.minutes)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowDown") move(e, index, 1);
                      if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(e, index, -1);
                    }}
                    className={`min-h-11 rounded-lg border px-1 py-2 text-center ${
                      checked
                        ? "border-[#eca826] bg-amber-50"
                        : o.allowed
                          ? "border-[#e5e5e5] bg-white hover:bg-[#fafafa]"
                          : "border-[#e5e5e5] bg-[#f7f7f7] opacity-60"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{o.minutes} min</span>
                    <span className="mt-0.5 block text-xs text-[#737373]">
                      {o.allowed ? `opções às ${hourLabel(o.optionsBy)}` : "indisponível"}
                    </span>
                  </button>
                );
              })}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-[#737373]">
              {hurry.options
                .filter((o) => !o.allowed)
                .map((o) => (
                  <li key={o.minutes}>
                    {o.minutes} min: {hurryOptionDisabledText(o, hurry)}
                  </li>
                ))}
            </ul>
            {hurry.normalMinutes && (
              <p className="mt-2 text-xs text-[#737373]">
                Nesta vaga o normal seria {hurry.normalMinutes} min.
              </p>
            )}
          </div>

          {option && (
            <div className="rounded-md bg-[#f7f7f7] p-3 text-xs">
              <p className="font-medium text-[#1d1d1b]">A empresa vai ver</p>
              {hurry.listHidden ? (
                <p>
                  &quot;Você recebe até 3 opções até {clockLabel(option.optionsBy)}&quot;
                  {hurry.currentOptionsBy ? ` (antes: ${clockLabel(hurry.currentOptionsBy)})` : ""}.
                </p>
              ) : (
                <p>
                  A empresa continua vendo a lista e recebe as opções até {clockLabel(option.optionsBy)}.
                </p>
              )}
              <p className="mt-1 text-[#737373]">
                Conta: agora, {hourLabel(hurry.computedAt)} + {option.minutes} min para responder + {slack} min de
                folga do sistema. A hora é conferida de novo ao confirmar.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor={`adiantar-nota-${vacancyId}`} className="block font-medium">
              Motivo (opcional, fica na vaga)
            </label>
            <div className="flex flex-wrap gap-2">
              {NOTE_SHORTCUTS.map((text) => (
                <button
                  key={text}
                  type="button"
                  disabled={busy}
                  onClick={() => setNote(text)}
                  className="min-h-8 rounded-full border border-[#e5e5e5] bg-white px-3 text-xs text-[#1d1d1b] hover:bg-[#f7f7f7] disabled:opacity-60"
                >
                  {text}
                </button>
              ))}
            </div>
            <textarea
              id={`adiantar-nota-${vacancyId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              disabled={busy}
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/40"
            />
            {noteTooLong && (
              <p className="text-xs text-red-600">O motivo passa de {HURRY_NOTE_MAX} caracteres.</p>
            )}
          </div>

          <p className="text-xs text-[#737373]">A pergunta sai na hora e não dá para desfazer.</p>
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
            disabled={busy || !option || noteTooLong}
            className="min-h-11 w-full bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] disabled:opacity-50 sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Selecionando...
              </>
            ) : retry && error ? (
              "Tentar de novo"
            ) : (
              `Selecionar agora (${option?.minutes ?? "—"} min)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

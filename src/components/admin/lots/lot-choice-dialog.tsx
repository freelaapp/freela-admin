"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { useAdminLotCandidates, useAdminLotChoose } from "@/modules/admin/application/use-lot-day";
import {
  CHOICE_NO_ASK_NOTICE,
  CHOICE_NOTICE,
  canSelect,
  choiceErrorMessage,
  confirmLines,
  isChoiceDisabled,
  isGroupGone,
  isItemOk,
  isRetryable,
  itemAskText,
  itemStatusLabel,
  resultPayLine,
  resultSummaryText,
  toggleSelection,
  whyNotChoosable,
} from "@/modules/admin/application/lot-choice-presentation";
import { askText } from "@/modules/admin/application/lot-lines-presentation";
import type { LotChoiceResult } from "@/modules/admin/infrastructure/lot-choice-api";

/**
 * A4: "Escolher pelo lote". O admin marca quem entra numa função e confirma. Ação de escrita:
 * sempre com o diálogo de confirmação; o autor é o admin logado (a API registra). O resultado
 * vem por pessoa, cada uma com a mensagem da API: uma recusada não esconde as outras. Recurso
 * desligado na API (404): o diálogo mostra "recurso desligado". Monte só com o diálogo aberto.
 */
export function LotChoiceDialog({
  lotId,
  groupKey,
  title,
  onClose,
  onGroupGone,
}: {
  lotId: string;
  groupKey: string;
  title: string;
  onClose: () => void;
  /** A função mudou (a chave deixou de valer): o pai relê o lote. */
  onGroupGone: () => void;
}) {
  const candidates = useAdminLotCandidates(lotId, groupKey);
  const choose = useAdminLotChoose(lotId);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(false);
  const [result, setResult] = useState<LotChoiceResult | null>(null);
  // Trava síncrona: dois cliques no mesmo tick passam antes de `isPending` virar true.
  const inFlight = useRef(false);

  const view = candidates.data;
  const max = view?.choiceMax || 50;
  const names = new Map(
    (view?.candidates ?? []).map((c) => [c.provider.providerGlobalId ?? "", c.provider.name]),
  );
  const busy = choose.isPending;

  const close = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    if (inFlight.current || busy || selected.length === 0) return;
    inFlight.current = true;
    setError(null);
    try {
      const res = await choose.mutateAsync({ groupKey, providerGlobalIds: selected });
      setResult(res);
      setConfirming(false);
      // Quem entrou sai da marcação; quem foi recusado continua marcado para o admin decidir.
      const done = new Set(res.items.filter((i) => isItemOk(i.status)).map((i) => i.providerGlobalId));
      setSelected((prev) => prev.filter((id) => !done.has(id)));
    } catch (err) {
      setError(choiceErrorMessage(err));
      setRetry(isRetryable(err));
      if (isGroupGone(err)) {
        setConfirming(false);
        onGroupGone();
      }
    } finally {
      inFlight.current = false;
    }
  };

  const disabled = candidates.isError && isChoiceDisabled(candidates.error);
  const gone = candidates.isError && isGroupGone(candidates.error);
  const rows = view?.candidates ?? [];

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && close()} className="max-w-2xl">
        <DialogContent
          role="dialog"
          aria-modal="true"
          aria-labelledby="lot-choice-title"
          className="p-4 sm:p-6"
        >
          <DialogClose onClick={close} />
          <DialogHeader>
            <DialogTitle>
              <span id="lot-choice-title">Escolher pelo lote: {title}</span>
            </DialogTitle>
            <DialogDescription>{CHOICE_NOTICE}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm text-[#1d1d1b]">
            <p data-testid="lot-choice-no-ask" className="rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#737373]">
              {CHOICE_NO_ASK_NOTICE}
            </p>

            {candidates.isLoading && (
              <p aria-busy="true" className="flex items-center gap-2 text-[#737373]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando os candidatos...
              </p>
            )}

            {disabled && (
              <p data-testid="lot-choice-off" className="rounded-lg bg-[#f7f7f7] p-3 text-[#737373]">
                Escolher pelo lote: recurso desligado na API.
              </p>
            )}

            {gone && (
              <div role="alert" className="rounded-lg border border-[#eca826]/40 bg-[#eca826]/10 p-3 text-[#8a5a00]">
                <p>Esta função mudou. Feche e atualize o lote.</p>
              </div>
            )}

            {candidates.isError && !disabled && !gone && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                <p>Não foi possível carregar os candidatos.</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => candidates.refetch()}>
                  Tentar de novo
                </Button>
              </div>
            )}

            {view && (
              <>
                <p data-testid="lot-choice-counts" className="text-xs text-[#737373]">
                  {view.vacancies} {view.vacancies === 1 ? "vaga" : "vagas"} = {view.chosen.length}{" "}
                  {view.chosen.length === 1 ? "escolhida" : "escolhidas"} + {view.free}{" "}
                  {view.free === 1 ? "livre" : "livres"} · {view.total}{" "}
                  {view.total === 1 ? "candidato esperando" : "candidatos esperando"} · no máximo {max} por vez
                </p>

                {view.chosen.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Já escolhidos nesta função</p>
                    <ul className="space-y-1">
                      {view.chosen.map((c) => (
                        <li key={c.candidacyId} data-testid="lot-chosen" className="rounded border border-[#e5e5e5] p-2">
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-[#737373]">
                            {c.paid ? "pago" : "falta pagar"}
                            {c.ask
                              ? ` · ${
                                  askText(
                                    {
                                      ...c.ask,
                                      scheduledFor: c.ask.askAt,
                                      askedForVacancyId: null,
                                      answeredVia: null,
                                      closedAt: null,
                                    },
                                    { serviceDate: view.serviceDate, vacancyId: c.vacancyId },
                                  ).text
                                }`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-1 font-medium">Candidatos</p>
                  {rows.length === 0 ? (
                    <p className="text-[#737373]">Ninguém aguardando esta função.</p>
                  ) : (
                    <ul className="space-y-1">
                      {rows.map((c) => {
                        const gid = c.provider.providerGlobalId ?? "";
                        const order = selected.indexOf(gid);
                        const why = whyNotChoosable(c);
                        return (
                          <li key={c.id} data-testid="lot-candidate" className="rounded border border-[#e5e5e5] p-2">
                            <label className="flex min-h-9 items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={order >= 0}
                                disabled={!canSelect(c) || busy || (order < 0 && selected.length >= max)}
                                onChange={() => setSelected((prev) => toggleSelection(prev, gid, max))}
                                aria-label={`Escolher ${c.provider.name}`}
                              />
                              <span className="min-w-0">
                                <span className="font-medium">{c.provider.name}</span>
                                {order >= 0 && (
                                  <span className="ml-2 text-xs font-semibold text-[#c97b0e]">{order + 1}º a escolher</span>
                                )}
                                <span className="block text-xs text-[#737373]">
                                  {c.provider.completedServices} serviços
                                  {c.provider.averageRating !== null ? ` · nota ${c.provider.averageRating.toFixed(1)}` : ""}
                                  {c.lastAskOutcome === "NO_ANSWER" ? " · não respondeu antes" : ""}
                                </span>
                                {why && <span className="block text-xs text-[#8a5a00]">{why}</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}

            {result && (
              <div data-testid="lot-choice-result" className="space-y-2 rounded-lg border border-[#e5e5e5] p-3">
                <p className="font-medium">Resultado</p>
                <p className="text-xs text-[#737373]">{resultSummaryText(result.summary)}</p>
                <ul className="space-y-1">
                  {result.items.map((item) => (
                    <li
                      key={item.providerGlobalId}
                      data-testid="lot-choice-item"
                      className={`rounded p-2 ${isItemOk(item.status) ? "bg-[#f0f9f0]" : "bg-red-50"}`}
                    >
                      <span className="font-medium">{names.get(item.providerGlobalId) || "Pessoa"}</span>
                      <span className="ml-2 text-xs font-semibold">{itemStatusLabel(item.status)}</span>
                      <span className="block text-xs text-[#1d1d1b]">{item.message}</span>
                      {itemAskText(item.ask) && (
                        <span className="block text-xs text-[#737373]">{itemAskText(item.ask)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {resultPayLine(result.summary) && (
                  <p className="text-xs text-[#737373]">{resultPayLine(result.summary)}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button variant="outline" onClick={close} disabled={busy} className="min-h-11 w-full sm:w-auto">
              Fechar
            </Button>
            {view && view.free < selected.length && selected.length > 0 && (
              <p className="text-xs text-[#8a5a00] sm:mr-auto sm:self-center">
                Há {view.free} {view.free === 1 ? "vaga livre" : "vagas livres"}: as primeiras marcadas ficam, as outras voltam recusadas.
              </p>
            )}
            <Button
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={selected.length === 0 || busy || !view}
              className="min-h-11 w-full bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] disabled:opacity-50 sm:w-auto"
            >
              {selected.length === 0 ? "Escolher" : `Escolher ${selected.length} ${selected.length === 1 ? "pessoa" : "pessoas"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirming && view && (
        <Dialog open onOpenChange={(next) => !next && !busy && setConfirming(false)} className="max-w-lg">
          <DialogContent
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lot-choice-confirm-title"
            className="p-4 sm:p-6"
          >
            <DialogClose onClick={() => !busy && setConfirming(false)} />
            <DialogHeader>
              <DialogTitle>
                <span id="lot-choice-confirm-title">
                  Escolher {selected.length} {selected.length === 1 ? "pessoa" : "pessoas"} no lugar da empresa?
                </span>
              </DialogTitle>
              <DialogDescription>{title}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto text-sm text-[#1d1d1b]">
              <ol className="list-decimal space-y-0.5 pl-5">
                {selected.map((gid) => (
                  <li key={gid}>{names.get(gid) || "Pessoa"}</li>
                ))}
              </ol>
              <ul className="list-disc space-y-1 pl-5">
                {confirmLines({
                  count: selected.length,
                  billing: view.billing,
                  askPlanned: !!view.askPlan,
                }).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="min-h-11 w-full sm:w-auto"
              >
                Voltar
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={busy}
                className="min-h-11 w-full bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] sm:w-auto"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Escolhendo...
                  </>
                ) : retry && error ? (
                  "Tentar de novo"
                ) : (
                  "Confirmar escolha"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


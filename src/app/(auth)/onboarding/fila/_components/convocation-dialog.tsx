"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount, orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import { type ConvocationAudience, convocationSummary } from "@/modules/admin/application/orientation-queue-presentation";
import {
  useCreateConvocation,
  useOrientationSettings,
  usePreviewConvocation,
} from "@/modules/admin/application/use-orientation";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type { ConvocationPreview, OrientationQueueFilter } from "@/modules/admin/infrastructure/orientation-api";

/** Quem entra: as pessoas marcadas na lista, ou o grupo que o filtro mostra (com teto opcional). */
export type ConvocationTarget =
  | { kind: "picked"; ids: string[] }
  | { kind: "filtered"; limit?: number; /** Total que a lista mostrava ao abrir (a conta "X na lista"). */ listTotal?: number };

interface Props {
  target: ConvocationTarget;
  filter: OrientationQueueFilter;
  /** Criada ao abrir o diálogo e mantida nos reenvios dele (clique duplo não cria duas vezes). */
  requestKey: string;
  onClose: () => void;
  /** Chamado quando a convocação foi gravada (a tela limpa a seleção). */
  onSent: () => void;
}

function placeLabel(filter: OrientationQueueFilter, p: ConvocationPreview | null): string {
  if (filter.city && filter.uf) return `${filter.city}/${filter.uf}`;
  if (filter.uf) return filter.uf;
  const places = (p?.places ?? []).map((x) => [x.city, x.uf].filter(Boolean).join("/")).filter(Boolean);
  if (places.length === 0) return "todas as cidades";
  return places.length > 3 ? `${places.slice(0, 3).join(", ")} e outras` : places.join(", ");
}

export function ConvocationDialog({ target, filter, requestKey, onClose, onSent }: Props) {
  const [preview, setPreview] = useState<ConvocationPreview | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<number | null>(null);
  const previewMutation = usePreviewConvocation();
  const createMutation = useCreateConvocation();
  const sending = useRef(false);
  const settings = useOrientationSettings();

  // Mandar para uma lista escolhida à mão não pode perder gente pelo padrão de 30 dias (a API cruza a lista com o filtro).
  // `filter` e `target` são o retrato de quando o diálogo abriu (a tela os congela): prévia e envio
  // valem para o mesmo público, mesmo que a URL mude com o diálogo aberto.
  const input =
    target.kind === "picked"
      ? { filter: { ...filter, activeWithinDays: 0 }, providerGlobalIds: target.ids }
      : { filter, ...(target.limit ? { limit: target.limit } : {}) };

  const loadPreview = () => {
    setPreview(null);
    setError(null);
    previewMutation.mutate(input, {
      onSuccess: (p) => setPreview(p),
      onError: (err) => setError(orientationErrorMessage(err, "Não consegui calcular a prévia. Tente de novo.")),
    });
  };

  useEffect(() => {
    loadPreview();
    // Só ao abrir: o diálogo é remontado a cada abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const place = placeLabel(filter, preview);
  const blocked = preview?.plan.blocked === "NO_SEATS";
  const off = preview ? !preview.channels.messagesEnabled : false;
  const needTyped = preview?.plan.requiresTypedCount === true;
  const typedNumber = /^[\d.]+$/.test(typed.trim()) ? Number(typed.trim().replace(/\./g, "")) : NaN;
  const typedOk = !needTyped || typedNumber === preview?.people;
  const sent = queued !== null;
  const busy = createMutation.isPending;
  const canSend = !!preview && preview.people > 0 && !blocked && !off && typedOk && !busy && !sent;
  const people = preview?.people ?? 0;
  const label = `Convocar ${formatCount(people)} ${people === 1 ? "pessoa" : "pessoas"}`;

  const send = async () => {
    if (!preview || !canSend || sending.current) return;
    sending.current = true;
    setError(null);
    try {
      const res = await createMutation.mutateAsync({
        ...input,
        requestKey,
        ...(needTyped ? { confirmCount: typedNumber } : {}),
      });
      setQueued(res.queued);
      onSent();
    } catch (err) {
      const msg = orientationErrorMessage(err, "Não consegui convocar. Tente de novo.");
      if (apiErrorOf(err).code === "CONVOCATION_COUNT_MISMATCH") {
        setTyped("");
        loadPreview();
      }
      setError(msg);
    } finally {
      sending.current = false;
    }
  };

  const audience: ConvocationAudience =
    target.kind === "picked"
      ? { kind: "picked", picked: target.ids.length, minDays: settings.data?.convocationMinDays }
      : { kind: "filtered", listTotal: target.listTotal, limit: target.limit };
  const lines = preview ? convocationSummary(preview, place, audience) : [];
  // Com 0 lugares o aviso de bloqueio abaixo já diz o que fazer; não repete a linha dos lugares.
  const summary = blocked ? lines.filter((_, i) => i !== 1) : lines;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()} className="max-w-lg">
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby="convocar-titulo"
        className="max-h-[55vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle id="convocar-titulo">Convocar para a aula</DialogTitle>
          <DialogDescription>
            Convocar grava a lista; o envio sai aos poucos, dentro do teto diário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-[#1d1d1b]">
          {!preview && !error && (
            <p role="status" className="flex items-center gap-2 text-[#737373]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Calculando a prévia…
            </p>
          )}

          {preview && !sent && (
            <>
              <ul className="list-disc space-y-1 pl-5">
                {summary.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {blocked && (
                <p role="alert" className="rounded-lg border border-[#dc2626] bg-[#fef2f2] p-3 font-medium">
                  Crie turmas para {place} antes de convocar.
                </p>
              )}
              {!blocked && preview.plan.overbooked && (
                <p role="status" className="rounded-lg border border-[#eca826] bg-[#fff8e6] p-3">
                  Mais de 3 convocados por lugar: nem todos vão conseguir vaga na aula. Considere convocar menos gente
                  ou criar mais turmas.
                </p>
              )}
              {off && (
                <p role="status" className="rounded-lg border border-[#eca826] bg-[#fff8e6] p-3">
                  As mensagens da aula ainda estão desligadas. A prévia vale, mas nada é enviado.
                </p>
              )}
              {!off && !preview.channels.whatsapp && (
                <p role="status" className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                  Só sai o aviso no app; o WhatsApp entra quando a Meta aprovar o modelo.
                </p>
              )}
              {needTyped && (
                <div className="space-y-1">
                  <Label htmlFor="convocar-numero">Digite {formatCount(preview.people)} para confirmar</Label>
                  <Input
                    id="convocar-numero"
                    inputMode="numeric"
                    autoComplete="off"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={busy}
                    className="h-11 md:h-9"
                  />
                </div>
              )}
            </>
          )}

          {sent && (
            <p role="status" className="rounded-lg border border-[#16a34a] bg-[#f0fdf4] p-3 font-medium">
              {formatCount(queued)} {queued === 1 ? "pessoa" : "pessoas"} na fila de envio
            </p>
          )}

          {!preview && error && !sent && (
            <Button variant="outline" className="min-h-11" onClick={loadPreview} disabled={previewMutation.isPending}>
              Tentar de novo
            </Button>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-[#dc2626] bg-[#fef2f2] p-3 text-[#991b1b]">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {sent ? "Fechar" : "Voltar"}
          </Button>
          {!sent && (
            <Button className="min-h-11" onClick={() => void send()} disabled={!canSend}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

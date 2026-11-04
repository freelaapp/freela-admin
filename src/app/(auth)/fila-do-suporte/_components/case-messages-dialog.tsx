"use client";

import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSupportCase } from "@/modules/admin/application/use-support-cases";
import { readyMessages } from "@/modules/admin/application/support-queue-presentation";

/**
 * Mensagens prontas A a E do Guia, com os colchetes preenchidos pelo caso (sugestão; o dono
 * revê). Conteúdo longo: o diálogo do admin não limita a altura, então a lista rola.
 */
export function CaseMessagesDialog({
  caseId,
  myName,
  firstNewsMinutes,
  onClose,
}: {
  caseId: string;
  myName: string | null;
  firstNewsMinutes: number;
  onClose: () => void;
}) {
  const detail = useSupportCase(caseId);
  const messages = detail.data
    ? readyMessages({
        detail: detail.data,
        myName,
        now: new Date(),
        firstNewsMinutes,
      })
    : [];

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie à mão.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      className="max-w-2xl"
    >
      <DialogContent role="dialog" aria-label="Mensagens prontas">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Mensagens prontas</DialogTitle>
          <DialogDescription>
            Do Guia do suporte, já com os dados do caso. Confira antes de
            mandar.
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading && (
          <p className="flex items-center gap-2 text-sm text-[#737373]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando…
          </p>
        )}
        {detail.isError && (
          <p role="alert" className="text-sm text-red-600">
            Não foi possível carregar o caso. Feche e tente de novo.
          </p>
        )}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => (
            <section
              key={m.key}
              className="rounded-lg border border-[#e5e5e5] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#737373]">
                  {m.key} · {m.title}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(m.text)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copiar {m.key}
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-[#1d1d1b]">
                {m.text}
              </p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

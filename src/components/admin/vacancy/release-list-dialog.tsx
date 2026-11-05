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
import { useReleaseCandidateList } from "@/modules/admin/application/use-selection-round";
import {
  releaseErrorMessage,
  releaseNoteProblem,
} from "@/modules/admin/application/selection-round-presentation";
import { RELEASE_NOTE_MAX } from "@/modules/admin/infrastructure/selection-round-api";

/**
 * "Liberar a lista agora" (pré-seleção curada; UX §5.3): confirma antes e exige o motivo (até 500
 * caracteres), que fica no registro da vaga. O corpo rola por dentro (`max-h-[55vh]`) para caber
 * na altura do celular. Erro: a mensagem fica no diálogo (400/409/404), sem fechar.
 */
export function ReleaseListDialog({
  vacancyId,
  open,
  onClose,
}: {
  vacancyId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const release = useReleaseCandidateList(vacancyId);

  const close = () => {
    if (release.isPending) return;
    setNote("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    const problem = releaseNoteProblem(note, RELEASE_NOTE_MAX);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await release.mutateAsync(note.trim());
      toast.success("Lista liberada. A empresa já vê os candidatos.");
      setNote("");
      setError(null);
      onClose();
    } catch (err) {
      setError(releaseErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={`liberar-titulo-${vacancyId}`}>
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>
            <span id={`liberar-titulo-${vacancyId}`}>Liberar a lista agora?</span>
          </DialogTitle>
          <DialogDescription>
            A empresa passa a ver a lista de candidatos desta vaga e pode escolher direto. Quem já
            confirmou continua em primeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          <label htmlFor={`liberar-nota-${vacancyId}`} className="block text-sm font-medium text-[#1d1d1b]">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`liberar-nota-${vacancyId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={RELEASE_NOTE_MAX + 50}
            placeholder="Ex.: a empresa ligou com pressa; o dono pediu a lista."
            disabled={release.isPending}
            className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/40"
          />
          <p className="text-xs text-[#737373]">
            {note.trim().length} de {RELEASE_NOTE_MAX} caracteres. Fica registrado na vaga.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={close}
            disabled={release.isPending}
            className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Voltar
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={release.isPending || note.trim().length === 0}
            className="bg-[#eca826] text-[#1d1d1b] hover:bg-[#d99a20] disabled:opacity-50"
          >
            {release.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Liberando...
              </>
            ) : (
              "Liberar a lista"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

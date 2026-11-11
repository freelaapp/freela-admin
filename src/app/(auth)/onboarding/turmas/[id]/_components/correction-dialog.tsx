"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReasonPrompt } from "@/components/admin/orientation/reason-prompt";
import { orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import { useOrientationProviderAction } from "@/modules/admin/application/use-orientation";
import type { OrientationEnrollee } from "@/modules/admin/infrastructure/orientation-api";

export type CorrectionKind = "correct-result" | "allow-new-class";

interface Props {
  kind: CorrectionKind;
  enrollee: OrientationEnrollee;
  onClose: () => void;
}

const TEXTS: Record<CorrectionKind, { title: string; consequence: string; confirm: string; done: string }> = {
  "correct-result": {
    title: "Corrigir resultado",
    consequence:
      "A pessoa deixa de estar aprovada: quando a trava de vagas estiver ligada, ela não vê vagas até fazer a aula de novo. Ninguém é avisado. Fica registrado quem corrigiu e o motivo.",
    confirm: "Corrigir resultado",
    done: "Resultado corrigido.",
  },
  "allow-new-class": {
    title: "Permitir nova aula",
    consequence:
      "A pessoa deixa de estar reprovada e pode marcar outra aula. Ninguém é avisado; avise pelo WhatsApp se precisar. Fica registrado quem permitiu e o motivo.",
    confirm: "Permitir nova aula",
    done: "Pronto: a pessoa pode marcar outra aula.",
  },
};

export function CorrectionDialog({ kind, enrollee, onClose }: Props) {
  const action = useOrientationProviderAction();
  const t = TEXTS[kind];
  const name = enrollee.name ?? "Sem nome";

  const confirm = (reason: string) => {
    if (action.isPending) return;
    action.mutate(
      { kind, providerGlobalId: enrollee.providerGlobalId, reason },
      {
        onSuccess: () => {
          toast.success(t.done);
          onClose();
        },
        onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível salvar. Tente de novo.")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !action.isPending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Mexer no resultado de uma pessoa da chamada.</DialogDescription>
        </DialogHeader>
        <ReasonPrompt
          title={t.title}
          consequence={t.consequence}
          confirmLabel={t.confirm}
          pending={action.isPending}
          onConfirm={confirm}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

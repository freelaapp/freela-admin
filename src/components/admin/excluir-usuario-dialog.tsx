"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminDeleteUser,
  useUserDeletionPreview,
} from "@/modules/admin/application/use-admin-user-deletion";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type { HardDeleteAccountType } from "@/modules/admin/infrastructure/admin-api";
import {
  DELETE_CONFIRM_WORD,
  DELETE_REASON_MIN,
  describeUserDeletion,
} from "./user-deletion-copy";

interface ExcluirUsuarioPanelProps {
  userId: string;
  displayName: string;
  /** Muda só a redação do e-mail avisando a pessoa (empresa vs freelancer). */
  accountType?: HardDeleteAccountType;
  /** Aviso extra da tela (ex.: Casa — a exclusão é da PESSOA, não do módulo). */
  extraNotice?: ReactNode;
  onCancel: () => void;
  onDeleted?: (mode: "HARD" | "SOFT") => void;
}

const TONE_CLASSES = {
  danger: "bg-red-50 border-red-100 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  blocked: "bg-[#f7f7f7] border-[#e5e5e5] text-[#1d1d1b]",
  neutral: "bg-[#f7f7f7] border-[#e5e5e5] text-[#525252]",
} as const;

/**
 * Conteúdo (cabeçalho, corpo e rodapé) da exclusão de uma conta da plataforma,
 * para caber dentro de um Dialog que a tela já tem. A API decide — sem
 * histórico apaga, com histórico desativa e anonimiza — e a PRÉVIA mostra qual
 * dos dois vai acontecer antes de confirmar (regra do dono, 29/09/2026).
 */
export function ExcluirUsuarioPanel({
  userId,
  displayName,
  accountType,
  extraNotice,
  onCancel,
  onDeleted,
}: ExcluirUsuarioPanelProps) {
  const [reason, setReason] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const previewQuery = useUserDeletionPreview(userId);
  const mutation = useAdminDeleteUser();

  const description = describeUserDeletion(previewQuery.data, previewQuery.isLoading);
  const previewError = previewQuery.isError
    ? getAxiosErrorMessage(previewQuery.error, "Não foi possível verificar o histórico da conta.")
    : null;
  const canConfirm =
    description.canConfirm &&
    reason.trim().length >= DELETE_REASON_MIN &&
    confirmWord.trim().toUpperCase() === DELETE_CONFIRM_WORD &&
    !mutation.isPending;

  async function handleDelete() {
    try {
      const { mode } = await mutation.mutateAsync({ userId, reason: reason.trim(), accountType });
      toast.success(
        mode === "HARD"
          ? `${displayName} foi excluído permanentemente.`
          : `${displayName} foi desativado e anonimizado (histórico mantido).`,
      );
      onDeleted?.(mode);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir a conta."));
      // A situação pode ter mudado (ex.: serviço começou): refaz a prévia.
      void previewQuery.refetch();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <span className="text-red-600">Excluir conta</span>
        </DialogTitle>
        <DialogDescription>
          <strong className="text-[#1d1d1b]">{displayName}</strong>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 p-3 rounded-lg border ${TONE_CLASSES[description.tone]}`}
          role="status"
        >
          {previewQuery.isLoading ? (
            <Loader2 className="w-5 h-5 mt-0.5 shrink-0 animate-spin" />
          ) : description.tone === "warning" ? (
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          )}
          <div className="text-sm">
            <p className="font-medium">{description.title}</p>
            {(previewError ? [previewError] : description.lines).map((line) => (
              <p key={line} className="mt-1">
                {line}
              </p>
            ))}
          </div>
        </div>

        {extraNotice}

        {description.canConfirm && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="excluir-usuario-motivo">
                Motivo da exclusão (mín. {DELETE_REASON_MIN} caracteres)
              </Label>
              <textarea
                id="excluir-usuario-motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ex.: conta duplicada, confirmada com o titular por WhatsApp em 29/09"
                className="w-full rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"
              />
              <p className="text-xs text-[#a3a3a3]">
                {reason.trim().length}/{DELETE_REASON_MIN} — vai no e-mail que avisa a pessoa.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="excluir-usuario-confirmacao">
                Digite <span className="font-bold text-red-600">{DELETE_CONFIRM_WORD}</span> para
                confirmar
              </Label>
              <Input
                id="excluir-usuario-confirmacao"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                placeholder={DELETE_CONFIRM_WORD}
                autoComplete="off"
              />
            </div>
          </>
        )}
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
        >
          {description.canConfirm ? "Cancelar" : "Fechar"}
        </Button>
        {description.canConfirm && (
          <Button
            onClick={handleDelete}
            disabled={!canConfirm}
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {description.confirmLabel}
              </>
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

interface ExcluirUsuarioDialogProps extends Omit<ExcluirUsuarioPanelProps, "userId" | "onCancel"> {
  /** `null` = fechado. */
  userId: string | null;
  onClose: () => void;
}

/** Diálogo completo de exclusão (para telas que não têm um Dialog próprio). */
export function ExcluirUsuarioDialog({ userId, onClose, onDeleted, ...rest }: ExcluirUsuarioDialogProps) {
  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogClose onClick={onClose} />
        {userId && (
          <ExcluirUsuarioPanel
            key={userId}
            userId={userId}
            onCancel={onClose}
            onDeleted={(mode) => {
              onDeleted?.(mode);
              onClose();
            }}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

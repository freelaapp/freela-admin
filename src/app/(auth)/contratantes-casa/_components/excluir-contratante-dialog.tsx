"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import { useAdminHardDeleteCasaContractor } from "@/modules/admin/application/use-admin-casa-contractors";
import type { CasaContractorItem } from "@/modules/admin/infrastructure/casa-contractors-api";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";

const CONFIRMACAO = "EXCLUIR";

/**
 * Exclusão DEFINITIVA de um contratante do Casa.
 *
 * ⚠️ A rota é global: apaga a PESSOA, não o cadastro de um módulo. Excluir aqui
 * remove também o cadastro de Empresa da mesma pessoa — o oposto da edição, que
 * é por módulo. Está escrito na tela porque a assimetria não é adivinhável.
 *
 * Exige motivo e a palavra digitada: é irreversível e não tem desfazer. O padrão
 * é o mesmo da tela de Empresas.
 */
export function ExcluirContratanteDialog({
  contratante,
  onClose,
}: {
  contratante: CasaContractorItem | null;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const mutation = useAdminHardDeleteCasaContractor();

  useEffect(() => {
    setMotivo("");
    setConfirmacao("");
  }, [contratante]);

  const nome = contratante?.companyName ?? contratante?.name ?? "este contratante";
  const podeExcluir =
    !!contratante?.userId && motivo.trim().length >= 5 && confirmacao.trim() === CONFIRMACAO;

  async function excluir() {
    if (!contratante?.userId) {
      toast.error("Usuário deste contratante não encontrado.");
      return;
    }
    try {
      await mutation.mutateAsync({ userId: contratante.userId, reason: motivo.trim() });
      toast.success(`${nome} foi excluído permanentemente.`);
      onClose();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o contratante."));
    }
  }

  return (
    <Dialog
      open={!!contratante}
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
    >
      <DialogContent>
        <DialogClose onClick={() => !mutation.isPending && onClose()} />
        <DialogHeader>
          <DialogTitle>Excluir definitivamente</DialogTitle>
          <DialogDescription>
            Apaga <strong>{nome}</strong> e a conta da pessoa. Não há desfazer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-tight text-amber-900">
            A exclusão é da <strong>pessoa</strong>, não do módulo: o cadastro de Empresa
            desta mesma pessoa também some. Para corrigir dados, use{" "}
            <strong>Editar cadastro</strong>.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="casa-del-motivo">Motivo (mínimo 5 caracteres)</Label>
            <Input
              id="casa-del-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: pedido do titular por e-mail em 17/08"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="casa-del-confirm">
              Digite <span className="font-mono">{CONFIRMACAO}</span> para confirmar
            </Label>
            <Input
              id="casa-del-confirm"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={excluir}
            disabled={!podeExcluir || mutation.isPending}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

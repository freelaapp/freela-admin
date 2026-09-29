"use client";

import { AlertTriangle } from "lucide-react";
import { ExcluirUsuarioDialog } from "@/components/admin/excluir-usuario-dialog";
import type { CasaContractorItem } from "@/modules/admin/infrastructure/casa-contractors-api";

/**
 * Exclusão de um contratante do Casa — usa o diálogo comum de exclusão de conta:
 * a API apaga quem não tem histórico e desativa + anonimiza quem tem, e a prévia
 * diz qual dos dois antes de confirmar.
 *
 * ⚠️ A exclusão é da PESSOA, não do módulo: o cadastro de Empresa da mesma pessoa
 * também sai. Está escrito na tela porque a assimetria com a edição (que é por
 * módulo) não é adivinhável.
 */
export function ExcluirContratanteDialog({
  contratante,
  onClose,
}: {
  contratante: CasaContractorItem | null;
  onClose: () => void;
}) {
  const nome = contratante?.companyName ?? contratante?.name ?? "este contratante";

  return (
    <ExcluirUsuarioDialog
      userId={contratante?.userId ?? null}
      displayName={nome}
      accountType="contractor"
      onClose={onClose}
      extraNotice={
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-tight text-amber-900">
            A exclusão é da <strong>pessoa</strong>, não do módulo: o cadastro de Empresa desta
            mesma pessoa também sai. Para corrigir dados, use <strong>Editar cadastro</strong>.
          </p>
        </div>
      }
    />
  );
}

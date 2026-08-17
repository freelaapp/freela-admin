"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useAdminUpdateCasaContractor } from "@/modules/admin/application/use-admin-casa-contractors";
import type { CasaContractorItem } from "@/modules/admin/infrastructure/casa-contractors-api";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";

/**
 * Edita o cadastro de um contratante do Freela em Casa.
 *
 * NÃO reaproveita o formulário de `/empresas` de propósito: `casa_contractors`
 * não tem `segment` nem `contact_name/phone/email`, então metade daquele
 * formulário seria campo que não grava. Onde os dois lados mostram a MESMA
 * coisa — candidatos, avaliações — o componente é compartilhado; aqui os
 * conjuntos de campos são genuinamente diferentes, e fingir o contrário
 * enganaria quem edita.
 *
 * Latitude/longitude não entram: a API regeocodifica a partir do endereço. Era
 * o que fazia a vaga aparecer para quem está perto da matriz e não de quem está
 * perto do serviço.
 */
const CAMPOS = [
  { chave: "companyName", rotulo: "Nome fantasia" },
  { chave: "name", rotulo: "Nome do responsável" },
  { chave: "document", rotulo: "Documento (CPF/CNPJ)" },
  { chave: "cep", rotulo: "CEP" },
  { chave: "street", rotulo: "Rua" },
  { chave: "number", rotulo: "Número" },
  { chave: "complement", rotulo: "Complemento" },
  { chave: "neighborhood", rotulo: "Bairro" },
  { chave: "city", rotulo: "Cidade" },
  { chave: "uf", rotulo: "UF" },
] as const;

type Chave = (typeof CAMPOS)[number]["chave"];
type Formulario = Record<Chave, string>;

function doContratante(c: CasaContractorItem): Formulario {
  return {
    companyName: c.companyName ?? "",
    name: c.name ?? "",
    document: c.document ?? "",
    cep: c.cep ?? "",
    street: c.street ?? "",
    number: c.number ?? "",
    complement: c.complement ?? "",
    neighborhood: c.neighborhood ?? "",
    city: c.city ?? "",
    uf: c.uf ?? "",
  };
}

export function EditarContratanteDialog({
  contratante,
  onClose,
}: {
  contratante: CasaContractorItem | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Formulario | null>(null);
  const mutation = useAdminUpdateCasaContractor();

  useEffect(() => {
    setForm(contratante ? doContratante(contratante) : null);
  }, [contratante]);

  async function salvar() {
    if (!contratante || !form) return;

    // Manda só o que MUDOU. O backend trata `undefined` como "não mexer", então
    // enviar o formulário inteiro reescreveria campos que ninguém tocou — e
    // apagaria os que estavam vazios na tela por não existirem no cadastro.
    const original = doContratante(contratante);
    const patch = Object.fromEntries(
      (Object.keys(form) as Chave[])
        .filter((k) => form[k].trim() !== original[k].trim())
        .map((k) => [k, form[k].trim()]),
    );

    if (Object.keys(patch).length === 0) {
      toast.info("Nada mudou.");
      onClose();
      return;
    }

    try {
      await mutation.mutateAsync({ id: contratante.id, payload: patch });
      toast.success("Cadastro atualizado.");
      onClose();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível salvar."));
    }
  }

  return (
    <Dialog
      open={!!contratante}
      onOpenChange={(open) => !open && !mutation.isPending && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogClose onClick={() => !mutation.isPending && onClose()} />
        <DialogHeader>
          <DialogTitle>Editar contratante</DialogTitle>
          <DialogDescription>
            Cadastro do Freela em Casa. O endereço é regeocodificado ao salvar — é ele que
            decide quem enxerga as vagas desta empresa.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAMPOS.map(({ chave, rotulo }) => (
              <div key={chave} className="space-y-1">
                <Label htmlFor={`casa-${chave}`}>{rotulo}</Label>
                <Input
                  id={`casa-${chave}`}
                  value={form[chave]}
                  onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-[#737373]">
          O cadastro de Empresa desta mesma companhia é separado e não muda aqui.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

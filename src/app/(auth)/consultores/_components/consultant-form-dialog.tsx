"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useCreateAdminConsultant,
  useUpdateAdminConsultant,
} from "@/modules/admin/application/use-admin-consultants";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import {
  EMPTY_CONSULTANT_FORM,
  buildCreateConsultantPayload,
  buildUpdateConsultantPayload,
  consultantToFormValues,
  type ConsultantFormValues,
} from "../_lib/consultant-form";

interface ConsultantFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Com consultor → modo edição (código só leitura); sem → cadastro novo. */
  consultant?: ConsultantItem | null;
}

export function ConsultantFormDialog({ open, onOpenChange, consultant }: ConsultantFormDialogProps) {
  const isEdit = !!consultant;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar consultor" : "Novo Consultor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? (
              <>
                O código de indicação não muda: links{" "}
                <span className="font-mono">/cadastro?ref=CÓDIGO</span> já enviados continuam
                funcionando.
              </>
            ) : (
              <>
                O código de indicação é gerado automaticamente a partir do nome se não for
                informado. Compartilhe o link <span className="font-mono">/cadastro?ref=CÓDIGO</span>{" "}
                para vincular novos cadastros a este consultor.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {/* O corpo só monta com o diálogo aberto (o Dialog não renderiza fechado), então o
            estado inicial do formulário sempre reflete o consultor atual. */}
        <ConsultantFormBody consultant={consultant ?? null} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ConsultantFormBody({
  consultant,
  onDone,
}: {
  consultant: ConsultantItem | null;
  onDone: () => void;
}) {
  const createMutation = useCreateAdminConsultant();
  const updateMutation = useUpdateAdminConsultant();
  const [form, setForm] = useState<ConsultantFormValues>(() =>
    consultant ? consultantToFormValues(consultant) : { ...EMPTY_CONSULTANT_FORM },
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (consultant) {
      const result = buildUpdateConsultantPayload(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await updateMutation.mutateAsync({ id: consultant.id, payload: result.payload });
        toast.success("Consultor atualizado.");
        onDone();
      } catch (err) {
        toast.error(getAxiosErrorMessage(err, "Erro ao atualizar consultor"));
      }
      return;
    }

    const result = buildCreateConsultantPayload(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      const created = await createMutation.mutateAsync(result.payload);
      toast.success(`Consultor criado! Código: ${created.code}`);
      onDone();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao criar consultor"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex.: André Consultor"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="code">{consultant ? "Código" : "Código (opcional)"}</Label>
          {consultant ? (
            <Input
              id="code"
              value={form.code}
              readOnly
              disabled
              title="O código não pode ser alterado depois de criado"
              className="font-mono bg-[#f7f7f7]"
            />
          ) : (
            <Input
              id="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="Gerado se vazio"
              className="font-mono"
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commissionRate">Comissão (%)</Label>
          <Input
            id="commissionRate"
            inputMode="decimal"
            value={form.commissionRate}
            onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            placeholder="Ex.: 10"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Ex.: Fortaleza"
          />
        </div>
        <div className="space-y-1.5 w-20">
          <Label htmlFor="uf">UF</Label>
          <Input
            id="uf"
            maxLength={2}
            value={form.uf}
            onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
            placeholder="CE"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="(85) 99999-9999"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email (login do consultor) *</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="andre@exemplo.com"
        />
        {consultant && (
          <p className="text-xs text-[#737373]">
            Trocar o e-mail muda o login do consultor (a senha continua a mesma).
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Input
          id="notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Anotações internas (opcional)"
        />
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={isPending}
          className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {consultant ? "Salvando..." : "Cadastrando..."}
            </>
          ) : consultant ? (
            "Salvar alterações"
          ) : (
            "Cadastrar consultor"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

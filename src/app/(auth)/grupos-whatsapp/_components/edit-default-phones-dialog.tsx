"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatPhoneBr } from "@/lib/utils";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useUpdateGroupSettings } from "@/modules/admin/application/use-admin-whatsapp-groups";
import { parsePhonesInput } from "@/modules/admin/application/whatsapp-groups-presentation";

/** Montado só enquanto aberto; começa com a lista atual, um número por linha. */
export function EditDefaultPhonesDialog({ current, onClose }: { current: string[]; onClose: () => void }) {
  const update = useUpdateGroupSettings();
  const [value, setValue] = useState(() => current.map((p) => formatPhoneBr(p)).join("\n"));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      const saved = await update.mutateAsync(parsePhonesInput(value));
      toast.success(
        saved.defaultPhones.length === 0
          ? "Números padrão removidos."
          : `${saved.defaultPhones.length} ${saved.defaultPhones.length === 1 ? "número padrão salvo" : "números padrão salvos"}.`,
      );
      onClose();
    } catch (err) {
      // A API cita o número inválido — fica visível no modal, não só num toast.
      setError(getAxiosErrorMessage(err, "Não foi possível salvar os números padrão."));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !update.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Números padrão</DialogTitle>
          <DialogDescription>
            Entram em todo grupo criado pelo painel (cidades, dedicados e VIP). Até 20 números com DDD, separados por
            vírgula ou um por linha.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="default-phones">Telefones</Label>
          <textarea
            id="default-phones"
            rows={6}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={"(11) 91537-5766\n(21) 99999-0000"}
            className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
          {error && (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={update.isPending} className="bg-[#eca826] text-white hover:bg-[#d8961f]">
            {update.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAddGroupParticipants } from "@/modules/admin/application/use-admin-whatsapp-groups";
import { parsePhonesInput } from "@/modules/admin/application/whatsapp-groups-presentation";

/** Montado só enquanto aberto (estado limpo a cada abertura). */
export function AddMembersDialog({
  target,
  onClose,
}: {
  target: { groupJid: string; name: string };
  onClose: () => void;
}) {
  const addMembers = useAddGroupParticipants();
  const [phones, setPhones] = useState("");

  const submit = async () => {
    const parsed = parsePhonesInput(phones);
    if (parsed.length === 0) {
      toast.error("Informe ao menos um telefone (com DDD).");
      return;
    }
    try {
      const res = await addMembers.mutateAsync({ groupId: target.groupJid, participants: parsed });
      toast.success(
        `${res.requested} ${res.requested === 1 ? "número enviado" : "números enviados"} para "${target.name}".`,
      );
      onClose();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível adicionar. Verifique se o bot é admin do grupo e se os números têm WhatsApp."),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !addMembers.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar membros</DialogTitle>
          <DialogDescription>
            Adiciona telefones ao grupo &quot;{target.name}&quot;. O bot precisa ser admin do grupo; quem não puder ser
            adicionado direto recebe um convite.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="add-participants">Telefones (com DDD)</Label>
          <Input
            id="add-participants"
            value={phones}
            onChange={(e) => setPhones(e.target.value)}
            placeholder="11999999999, 11988888888"
          />
          <p className="text-xs text-[#737373]">Separe por vírgula. Os números precisam ter WhatsApp.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={addMembers.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={addMembers.isPending} className="bg-[#eca826] text-white hover:bg-[#d8961f]">
            {addMembers.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adicionando...
              </>
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

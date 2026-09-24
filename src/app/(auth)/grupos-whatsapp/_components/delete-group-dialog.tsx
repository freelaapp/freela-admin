"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useDeleteAdminGroup } from "@/modules/admin/application/use-admin-whatsapp-groups";
import { deleteGroupEffect } from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupView } from "@/modules/admin/infrastructure/whatsapp-groups-api";

export function DeleteGroupDialog({ group, onClose }: { group: AdminGroupView; onClose: () => void }) {
  const del = useDeleteAdminGroup();

  const submit = async () => {
    try {
      const res = await del.mutateAsync(group.id);
      toast.success(
        res.leftGroup ? `O bot saiu de "${group.name}" e o grupo saiu da lista.` : `"${group.name}" saiu da lista.`,
      );
      onClose();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o grupo."));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !del.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir grupo</DialogTitle>
          <DialogDescription>&quot;{group.name}&quot;</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-[#525252]">{deleteGroupEffect(group.botInGroup)}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={del.isPending}>
            {del.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Excluindo...
              </>
            ) : (
              "Excluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

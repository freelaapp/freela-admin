"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useEnsureVipGroupFor } from "@/modules/admin/application/use-vip-groups";
import { vipEnsureResultMessage } from "@/modules/admin/application/vip-groups-presentation";
import {
  NO_VIP_STORE_WITHOUT_GROUP,
  vipStoresWithoutGroup,
} from "@/modules/admin/application/whatsapp-groups-presentation";
import type { VipStoreSummary } from "@/modules/admin/infrastructure/vip-groups-api";

/**
 * "Criar grupo VIP" da aba VIP (spec 2026-09-24 §E): escolhe uma loja Grandes Redes
 * SEM grupo e chama o `ensure` (idempotente; usa os números padrão). Fecha em
 * qualquer 2xx — se o WhatsApp falhou, a loja passa a aparecer na aba VIP como
 * "Falhou", com o botão de tentar de novo. 422 (fora do plano) fica aberto.
 */
export function CreateVipGroupDialog({
  stores,
  isLoading,
  onClose,
}: {
  stores: VipStoreSummary[];
  isLoading: boolean;
  onClose: () => void;
}) {
  const ensure = useEnsureVipGroupFor();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const semGrupo = vipStoresWithoutGroup(stores, "");
  const candidates = vipStoresWithoutGroup(stores, search);

  const handleCreate = async () => {
    if (!selected) return;
    try {
      const group = await ensure.mutateAsync(selected);
      const msg = vipEnsureResultMessage(group);
      if (msg.ok) toast.success(msg.text);
      else toast.error(msg.text);
      onClose();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível criar o grupo VIP."));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !ensure.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grupo VIP</DialogTitle>
          <DialogDescription>
            Escolha a loja Grandes Redes. O grupo é criado com os números padrão; os VIPs da loja entram pela
            aba VIP.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" aria-hidden />
          </div>
        ) : semGrupo.length === 0 ? (
          <p className="text-sm text-[#737373]">{NO_VIP_STORE_WITHOUT_GROUP}</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cvg-search">Buscar loja</Label>
              <Input id="cvg-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: Coco Bambu" />
            </div>
            <ul role="radiogroup" aria-label="Lojas sem grupo" className="max-h-[40vh] space-y-1 overflow-y-auto">
              {candidates.map((s) => (
                <li key={s.contractorUserId}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected === s.contractorUserId}
                    onClick={() => setSelected(s.contractorUserId)}
                    className={`min-h-10 w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selected === s.contractorUserId
                        ? "border-[#eca826] bg-[#eca826]/10 font-semibold text-[#1d1d1b]"
                        : "border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7]"
                    }`}
                  >
                    {s.storeName}
                  </button>
                </li>
              ))}
              {candidates.length === 0 && <li className="text-sm text-[#737373]">Nenhuma loja com esse nome.</li>}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={ensure.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selected || ensure.isPending}
            className="bg-[#eca826] text-white hover:bg-[#d8961f]"
          >
            {ensure.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Criando...
              </>
            ) : (
              "Criar grupo VIP"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

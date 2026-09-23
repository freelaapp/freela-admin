"use client";

import { useDeferredValue, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipGroupMutations, useVipProviderSearch } from "@/modules/admin/application/use-vip-groups";
import { QueryError } from "./query-error";

/** Busca um freela por nome/telefone e coloca na lista VIP da loja (origem: equipe). */
export function AddVipDialog({
  open,
  contractorUserId,
  onClose,
}: {
  open: boolean;
  contractorUserId: string;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const deferredTerm = useDeferredValue(term);
  const { data: results = [], isFetching, isError, refetch } = useVipProviderSearch(deferredTerm, open);
  const { add } = useVipGroupMutations(contractorUserId);

  const close = () => {
    setTerm("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar VIP</DialogTitle>
          <DialogDescription>
            Busque o freela por nome ou telefone. Ele entra na lista VIP desta loja e, se o grupo estiver ativo, no grupo do WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vip-provider-search">Nome ou telefone</Label>
          <Input
            id="vip-provider-search"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ex.: Ana Souza ou 11 91234"
          />
          <div className="max-h-[60vh] overflow-y-auto">
            {term.trim().length < 2 ? (
              <p className="py-3 text-[12.5px] text-[#94A3B8]">Digite ao menos 2 letras ou 4 números.</p>
            ) : isFetching ? (
              <div className="flex justify-center py-6 text-[#94A3B8]">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </div>
            ) : isError ? (
              <QueryError compact message="Não foi possível buscar os freelas." onRetry={() => refetch()} />
            ) : results.length === 0 ? (
              <p className="py-3 text-[12.5px] text-[#94A3B8]">Nenhum freela encontrado.</p>
            ) : (
              <ul className="divide-y divide-[#F1F5F9]">
                {results.map((p) => (
                  <li key={p.providerGlobalId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                    <div className="min-w-0">
                      <p className="font-medium text-[#0F172A]">{p.name ?? "Freela sem nome"}</p>
                      <p className="text-[12px] text-[#64748B]">
                        {p.city ?? "—"} · {p.phoneMasked ?? "sem telefone"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={add.isPending}
                      onClick={() => add.mutate(p.providerGlobalId, { onSuccess: close })}
                    >
                      <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                      Adicionar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

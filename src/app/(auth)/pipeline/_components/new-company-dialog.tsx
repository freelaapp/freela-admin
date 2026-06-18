"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, Link2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCrmContractorSearch, useCrmMutations } from "@/modules/admin/application/use-admin-crm";
import type { CrmCompanyStatus, CrmPriority } from "@/modules/admin/infrastructure/crm-api";
import { PRIORITY_META, PRIORITY_OPTIONS } from "./crm-constants";

export function NewCompanyDialog({
  open,
  onOpenChange,
  defaultStatus = "NOVO",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultStatus?: CrmCompanyStatus;
}) {
  const { createCompany } = useCrmMutations();

  const [name, setName] = useState("");
  const [priority, setPriority] = useState<CrmPriority>("MEDIA");
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const { data: matches = [], isFetching } = useCrmContractorSearch(searchTerm);

  function reset() {
    setName("");
    setPriority("MEDIA");
    setSegment("");
    setCity("");
    setPhone("");
    setEmail("");
    setLinkedUserId(null);
    setSearchTerm("");
  }

  function close(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    try {
      await createCompany.mutateAsync({
        name: name.trim(),
        status: defaultStatus,
        priority,
        segment: segment.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        linkedContractorUserId: linkedUserId ?? undefined,
      });
      toast.success("Empresa adicionada ao pipeline.");
      close(false);
    } catch {
      toast.error("Não foi possível adicionar a empresa.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
          <DialogDescription>
            Cadastre um lead manualmente ou vincule a um contratante já cadastrado no app.
          </DialogDescription>
        </DialogHeader>

        {/* Buscar contratante existente */}
        <div className="space-y-1.5">
          <Label>Vincular contratante já cadastrado (opcional)</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#737373]" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome da empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {linkedUserId && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-md px-2 py-1">
              <Link2 className="w-3.5 h-3.5" /> Vinculado a um contratante existente
              <button type="button" onClick={() => setLinkedUserId(null)} className="ml-auto text-[#737373] hover:text-[#1d1d1b]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {searchTerm.trim().length >= 2 && !linkedUserId && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-[#e5e5e5] divide-y divide-[#f0f0f0]">
              {isFetching && <p className="px-3 py-2 text-xs text-[#737373]">Buscando…</p>}
              {!isFetching && matches.length === 0 && (
                <p className="px-3 py-2 text-xs text-[#737373]">Nenhum contratante encontrado.</p>
              )}
              {matches.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => {
                    setLinkedUserId(c.userId);
                    setName((n) => n || c.name);
                    setCity((v) => v || c.city || "");
                    setSearchTerm("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#f7f7f7] text-sm"
                >
                  <span className="font-medium text-[#1d1d1b]">{c.name}</span>
                  {c.city && <span className="text-xs text-[#737373]"> · {c.city}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome da empresa *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bar do Zé" />
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as CrmPriority)}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Bar, Restaurante…" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-[#eca826] text-white hover:bg-[#d4951e]"
            onClick={submit}
            disabled={createCompany.isPending}
          >
            {createCompany.isPending ? "Salvando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

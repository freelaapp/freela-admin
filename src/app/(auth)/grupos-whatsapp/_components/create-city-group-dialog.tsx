"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useCreateWhatsappGroup } from "@/modules/admin/application/use-admin-whatsapp-groups";
import {
  NO_PARTICIPANTS_MESSAGE,
  alsoJoinText,
  parsePhonesInput,
} from "@/modules/admin/application/whatsapp-groups-presentation";

/**
 * Montado só enquanto aberto. Com números padrão, os participantes viram opcionais.
 *
 * `defaultPhonesLoaded=false` (config ainda carregando ou falhou) NÃO é o mesmo que
 * "sem números padrão": o backend sempre funde os participantes digitados com os
 * números padrão reais no momento da criação (independente do que este diálogo sabe),
 * então enquanto não sabemos se existem defaults não exigimos participantes aqui — só
 * o backend valida de verdade (e devolve o mesmo aviso se realmente não houver nenhum).
 */
export function CreateCityGroupDialog({
  defaultPhones,
  defaultPhonesLoaded,
  onClose,
}: {
  defaultPhones: string[];
  defaultPhonesLoaded: boolean;
  onClose: () => void;
}) {
  const createGroup = useCreateWhatsappGroup();
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  // Grupo 2, 3… da mesma cidade (o 1º encheu — WhatsApp limita 1024 membros).
  const [sequence, setSequence] = useState("");
  const [participants, setParticipants] = useState("");

  const alsoJoin = defaultPhonesLoaded ? alsoJoinText(defaultPhones) : null;
  const knownEmptyDefaults = defaultPhonesLoaded && defaultPhones.length === 0;
  const sequenceNumber = /^\d+$/.test(sequence.trim()) ? Number(sequence.trim()) : null;
  const previewName =
    city.trim() && uf.trim()
      ? `Vagas Freela ${city.trim()} ${uf.trim().toUpperCase()}${sequenceNumber && sequenceNumber >= 2 ? ` #${sequenceNumber}` : ""}`
      : null;

  const handleCreate = async () => {
    const cleanCity = city.trim();
    const cleanUf = uf.trim().toUpperCase();
    if (cleanCity.length < 2) {
      toast.error("Informe a cidade.");
      return;
    }
    if (!/^[A-Z]{2}$/.test(cleanUf)) {
      toast.error("UF inválida (use 2 letras, ex: SP).");
      return;
    }
    const parsed = parsePhonesInput(participants);
    if (parsed.length === 0 && knownEmptyDefaults) {
      toast.error(NO_PARTICIPANTS_MESSAGE);
      return;
    }
    try {
      const group = await createGroup.mutateAsync({
        city: cleanCity,
        uf: cleanUf,
        participants: parsed,
        ...(sequenceNumber && sequenceNumber >= 2 ? { sequence: sequenceNumber } : {}),
      });
      toast.success(`Grupo "${group.name}" criado.`);
      onClose();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível criar o grupo. Verifique a conexão da instância e os participantes."),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !createGroup.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grupo de WhatsApp</DialogTitle>
          <DialogDescription>
            O nome é montado no padrão para o grupo receber vagas automaticamente. A instância (bot) entra como admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wpp-city">Cidade</Label>
              <Input id="wpp-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex: Jundiaí" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wpp-uf">UF</Label>
              <Input
                id="wpp-uf"
                value={uf}
                maxLength={2}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wpp-sequence">Nº do grupo (opcional)</Label>
              <Input
                id="wpp-sequence"
                value={sequence}
                inputMode="numeric"
                maxLength={2}
                onChange={(e) => setSequence(e.target.value.replace(/\D/g, ""))}
                placeholder="2"
              />
              <p className="text-[11px] text-slate-500">
                Use 2, 3… quando o grupo 1 da cidade encher: a vaga vai para todos os grupos da cidade.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wpp-participants">
              {defaultPhonesLoaded && defaultPhones.length > 0
                ? "Participantes (opcional)"
                : "Participantes (telefones com DDD)"}
            </Label>
            <Input
              id="wpp-participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="11999999999, 11988888888"
            />
            {alsoJoin ? (
              <p className="text-xs text-[#525252]">{alsoJoin}</p>
            ) : (
              <p className="text-xs text-[#737373]">
                Separe por vírgula. O grupo precisa de ao menos um membro inicial.
              </p>
            )}
          </div>
          {previewName && (
            <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
              Nome do grupo: <span className="font-semibold">{previewName}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createGroup.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createGroup.isPending}
            className="bg-[#eca826] text-white hover:bg-[#d8961f]"
          >
            {createGroup.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Criando...
              </>
            ) : (
              "Criar grupo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCreateDedicatedGroup,
  useCreateDedicatedWhatsappGroup,
} from "@/modules/admin/application/use-admin-dedicated-groups";
import {
  NO_PARTICIPANTS_MESSAGE,
  alsoJoinText,
  dedicatedGroupFailedText,
  dedicatedGroupName,
  parsePhonesInput,
} from "@/modules/admin/application/whatsapp-groups-presentation";

/**
 * "Criar grupo dedicado" da aba Dedicados (spec 2026-09-24 §E): regra + grupo real
 * em dois passos no cliente, com os endpoints que já existem. Se a regra sai e o
 * grupo não, o diálogo FECHA (repetir aqui criaria uma segunda regra) e o toast
 * manda usar o botão da regra. "Nova regra" da seção de regras continua para quem
 * só quer a regra.
 */
export function CreateDedicatedGroupDialog({
  defaultPhones,
  defaultPhonesLoaded,
  onClose,
}: {
  defaultPhones: string[];
  defaultPhonesLoaded: boolean;
  onClose: () => void;
}) {
  const createRule = useCreateDedicatedGroup();
  const createWppGroup = useCreateDedicatedWhatsappGroup();
  const [label, setLabel] = useState("");
  const [companyMatch, setCompanyMatch] = useState("");
  const [cityMatch, setCityMatch] = useState("");
  const [participants, setParticipants] = useState("");

  const busy = createRule.isPending || createWppGroup.isPending;
  const alsoJoin = defaultPhonesLoaded ? alsoJoinText(defaultPhones) : null;
  const knownEmptyDefaults = defaultPhonesLoaded && defaultPhones.length === 0;
  const previewName = dedicatedGroupName(label);

  const handleCreate = async () => {
    const l = label.trim();
    const c = companyMatch.trim();
    const city = cityMatch.trim();
    if (l.length < 2) {
      toast.error("Informe o rótulo (ex.: Coco Bambu Jundiaí).");
      return;
    }
    if (c.length < 2) {
      toast.error("Informe o termo da empresa (ex.: coco bambu).");
      return;
    }
    const parsed = parsePhonesInput(participants);
    if (parsed.length === 0 && knownEmptyDefaults) {
      toast.error(NO_PARTICIPANTS_MESSAGE);
      return;
    }

    let ruleId: string;
    try {
      const rule = await createRule.mutateAsync({ label: l, companyMatch: c, cityMatch: city || null });
      ruleId = rule.id;
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível criar a regra."));
      return;
    }
    try {
      const group = await createWppGroup.mutateAsync({ id: ruleId, participants: parsed });
      toast.success(`Grupo "${group.name}" criado.`);
    } catch (err) {
      toast.error(dedicatedGroupFailedText(getAxiosErrorMessage(err, "erro no WhatsApp")));
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar grupo dedicado</DialogTitle>
          <DialogDescription>
            As vagas de um contratante cujo nome contém o termo da empresa (e a cidade, se informada) vão
            TAMBÉM para este grupo, além do grupo da cidade.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cdg-label">Rótulo (empresa + cidade)</Label>
            <Input id="cdg-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Coco Bambu Jundiaí" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cdg-company">Termo da empresa</Label>
              <Input id="cdg-company" value={companyMatch} onChange={(e) => setCompanyMatch(e.target.value)} placeholder="coco bambu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdg-city">Termo da cidade (opcional)</Label>
              <Input id="cdg-city" value={cityMatch} onChange={(e) => setCityMatch(e.target.value)} placeholder="jundia" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdg-participants">
              {defaultPhonesLoaded && defaultPhones.length > 0 ? "Participantes (opcional)" : "Participantes (telefones com DDD)"}
            </Label>
            <Input
              id="cdg-participants"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="11999999999, 11988888888"
            />
            {alsoJoin ? (
              <p className="text-xs text-[#525252]">{alsoJoin}</p>
            ) : (
              <p className="text-xs text-[#737373]">Separe por vírgula. O grupo precisa de ao menos um membro inicial.</p>
            )}
          </div>
          {previewName && (
            <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
              Nome do grupo: <span className="font-semibold">{previewName}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={busy} className="bg-[#eca826] text-white hover:bg-[#d8961f]">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Criando...
              </>
            ) : (
              "Criar grupo dedicado"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

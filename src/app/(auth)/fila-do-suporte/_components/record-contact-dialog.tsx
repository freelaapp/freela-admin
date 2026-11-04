"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoicePills } from "@/components/ui/choice-pills";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import {
  useRecordSupportContact,
  useSupportCase,
} from "@/modules/admin/application/use-support-cases";
import {
  CONTACT_CHANNEL_OPTIONS,
  CONTACT_RESULT_OPTIONS,
} from "@/modules/admin/application/support-queue-presentation";
import type {
  SupportContactChannel,
  SupportContactResult,
} from "@/modules/admin/infrastructure/support-cases-api";

const COMPANY = "company";
const OTHER = "other";

/**
 * "Registrar contato" (designer §5.3): com quem (a empresa, alguém da lista da vaga ou outra
 * pessoa), como, o resultado e uma observação. A API grava quem registrou e quando.
 */
export function RecordContactDialog({
  caseId,
  onClose,
}: {
  caseId: string;
  onClose: () => void;
}) {
  const detail = useSupportCase(caseId);
  const record = useRecordSupportContact();
  const [target, setTarget] = useState<string>(COMPANY);
  const [otherName, setOtherName] = useState("");
  const [channel, setChannel] = useState<SupportContactChannel>("CALL");
  const [result, setResult] = useState<SupportContactResult>("NO_ANSWER");
  const [note, setNote] = useState("");

  const people = detail.data?.people ?? [];
  const targets = [
    { value: COMPANY, label: "Empresa" },
    ...people.map((p) => ({
      value: p.candidacyId,
      label: `${p.name?.trim() || "Sem nome"}${p.role === "PRINCIPAL" ? " (escolhido)" : ` (suplente ${p.position ?? ""})`}`,
    })),
    { value: OTHER, label: "Outra pessoa" },
  ];
  const missingName = target === OTHER && !otherName.trim();

  async function submit() {
    if (missingName) return;
    try {
      await record.mutateAsync({
        id: caseId,
        body: {
          kind:
            target === COMPANY
              ? "CONTRACTOR"
              : target === OTHER
                ? "OTHER"
                : "PROVIDER",
          ...(target !== COMPANY && target !== OTHER
            ? { candidacyId: target }
            : {}),
          ...(target === OTHER ? { name: otherName.trim() } : {}),
          channel,
          result,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      toast.success("Contato registrado.");
      onClose();
    } catch (err) {
      toast.error(
        apiErrorOf(err).message ?? "Não foi possível registrar o contato.",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Registrar contato">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">
              Com quem?
            </p>
            <ChoicePills
              aria-label="Com quem?"
              options={targets}
              value={target}
              onChange={setTarget}
            />
            {target === OTHER && (
              <Input
                className="mt-2"
                aria-label="Nome de quem atendeu"
                placeholder="Nome de quem atendeu"
                maxLength={120}
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
              />
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">Como?</p>
            <ChoicePills
              aria-label="Como?"
              options={CONTACT_CHANNEL_OPTIONS}
              value={channel}
              onChange={setChannel}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">
              Resultado
            </p>
            <ChoicePills
              aria-label="Resultado"
              options={CONTACT_RESULT_OPTIONS}
              value={result}
              onChange={setResult}
            />
          </div>
          <div>
            <label
              htmlFor="contact-note"
              className="mb-1.5 block text-xs font-semibold text-[#1d1d1b]"
            >
              Observação (opcional)
            </label>
            <textarea
              id="contact-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={record.isPending || missingName}>
            {record.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Registrar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

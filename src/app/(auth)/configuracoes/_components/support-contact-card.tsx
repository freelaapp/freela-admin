"use client";

import { useState } from "react";
import axios from "axios";
import { ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInstantDateTime } from "@/lib/date.utils";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useSupportContact,
  useUpdateSupportContact,
} from "@/modules/admin/application/use-support-contact";
import {
  formatSupportWhatsappInput,
  normalizeSupportWhatsapp,
  whatsappTestUrl,
} from "@/modules/admin/application/support-whatsapp";
import { SUPPORT_EMAIL_ERROR, normalizeSupportEmail } from "@/modules/admin/application/support-email";

type Field = "whatsapp" | "email";

function apiErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? error.response?.data?.error?.code : undefined;
}

/**
 * Contato de suporte (WhatsApp e e-mail) que site, app e mensagens mostram. Troca aqui vale em
 * até 5 minutos em todo lugar — sem deploy e sem versão nova do app.
 */
export function SupportContactCard() {
  const current = useSupportContact();
  const save = useUpdateSupportContact();
  const [value, setValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [confirming, setConfirming] = useState<Field | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const e164 = normalizeSupportWhatsapp(value);
  const typed = value.trim().length > 0;
  const unchanged = !!e164 && e164 === current.data?.whatsappE164;

  const email = normalizeSupportEmail(emailValue);
  const emailTyped = emailValue.trim().length > 0;
  const emailUnchanged = !!email && email === current.data?.email;

  const handleSave = async () => {
    const field = confirming;
    if (!field) return;
    const patch = field === "whatsapp" ? { whatsapp: e164 ?? undefined } : { email: email ?? undefined };
    if (!Object.values(patch)[0]) return;
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    try {
      await save.mutateAsync(patch);
      toast.success(
        field === "whatsapp"
          ? "WhatsApp de suporte atualizado. Site, app e mensagens mudam em até 5 minutos."
          : "E-mail de suporte atualizado. Site, app e e-mails mudam em até 5 minutos.",
      );
      setConfirming(null);
      if (field === "whatsapp") setValue("");
      else setEmailValue("");
    } catch (error) {
      const code = apiErrorCode(error);
      const fieldCode = field === "whatsapp" ? "INVALID_SUPPORT_WHATSAPP" : "INVALID_SUPPORT_EMAIL";
      if (code === fieldCode) {
        setErrors((prev) => ({ ...prev, [field]: getAxiosErrorMessage(error, "Valor inválido.") }));
        setConfirming(null);
      } else {
        toast.error(
          getAxiosErrorMessage(
            error,
            field === "whatsapp" ? "Não foi possível salvar o número." : "Não foi possível salvar o e-mail.",
          ),
        );
      }
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eca826]/10">
          <MessageCircle className="h-5 w-5 text-[#eca826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1d1d1b]">Contato de suporte</h3>
          <p className="mt-1 text-xs text-[#737373]">
            WhatsApp e e-mail que aparecem no site, no app e nas mensagens (e-mails e avisos). A troca vale em até 5 minutos.
          </p>

          <div className="mt-3 text-sm">
            {current.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            ) : current.data ? (
              <>
                <p className="text-lg font-bold text-[#1d1d1b]">{current.data.display}</p>
                <p className="text-xs text-[#737373]">
                  {current.data.isDefault
                    ? "Número padrão do sistema (ninguém alterou ainda)."
                    : `Alterado por ${current.data.updatedBy?.name ?? "um admin"} em ${
                        current.data.updatedAt ? formatInstantDateTime(current.data.updatedAt) : "—"
                      }.`}
                </p>
              </>
            ) : (
              <p className="text-xs text-red-600">Não consegui carregar o número atual.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label htmlFor="support-whatsapp">Novo número (celular com DDD)</Label>
              <Input
                id="support-whatsapp"
                inputMode="tel"
                autoComplete="off"
                placeholder="(11) 97177-7563"
                value={formatSupportWhatsappInput(value)}
                onChange={(event) => {
                  setValue(event.target.value);
                  setErrors((prev) => ({ ...prev, whatsapp: undefined }));
                }}
              />
              {typed && !e164 && (
                <p className="text-xs text-red-600">Informe um celular com DDD, ex.: (11) 97177-7563.</p>
              )}
              {errors.whatsapp && <p className="text-xs text-red-600">{errors.whatsapp}</p>}
            </div>
            {e164 && (
              <a
                href={whatsappTestUrl(e164)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 text-sm text-[#c97b0e] hover:underline"
              >
                Testar no WhatsApp <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button onClick={() => setConfirming("whatsapp")} disabled={!e164 || unchanged || save.isPending}>
              Salvar WhatsApp
            </Button>
          </div>

          <div className="mt-6 border-t border-[#e5e5e5] pt-4 text-sm">
            {current.data && (
              <>
                <p className="text-xs font-medium text-[#737373]">E-mail de suporte</p>
                <p className="text-lg font-bold text-[#1d1d1b]">{current.data.email}</p>
                {current.data.emailIsDefault && (
                  <p className="text-xs text-[#737373]">E-mail padrão do sistema (ninguém alterou ainda).</p>
                )}
              </>
            )}
            <p className="mt-1 text-xs text-[#737373]">Aparece no site, no app e nos e-mails do Freela.</p>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label htmlFor="support-email">Novo e-mail de suporte</Label>
              <Input
                id="support-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="contato@freelaservicos.com.br"
                value={emailValue}
                onChange={(event) => {
                  setEmailValue(event.target.value);
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
              />
              {emailTyped && !email && <p className="text-xs text-red-600">{SUPPORT_EMAIL_ERROR}</p>}
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>
            <Button
              onClick={() => setConfirming("email")}
              disabled={!email || emailUnchanged || save.isPending}
            >
              Salvar e-mail
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirming !== null} onOpenChange={(open) => !save.isPending && !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming === "email" ? "Trocar o e-mail de suporte?" : "Trocar o WhatsApp de suporte?"}
            </DialogTitle>
            <DialogDescription>
              Site, app e mensagens passam a usar{" "}
              {confirming === "email" ? email : formatSupportWhatsappInput(value)}. Pode levar até 5 minutos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={save.isPending}>
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

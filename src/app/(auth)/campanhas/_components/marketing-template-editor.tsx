"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, Link2, Loader2, Phone, Plus, Send, Trash2 } from "lucide-react";
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
import { ImageUploadField } from "@/app/(auth)/campanhas-automaticas/_components/image-upload-field";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCreateMarketingTemplate,
  useSubmitMarketingTemplate,
  useUpdateMarketingTemplate,
} from "@/modules/admin/application/use-marketing-templates";
import type {
  MarketingTemplateInput,
  MarketingTemplateStatus,
  MarketingTemplateView,
} from "@/modules/admin/infrastructure/marketing-templates-api";
import {
  MARKETING_BODY_MAX,
  MARKETING_IMAGE_TYPES,
  MARKETING_MAX_BUTTONS,
  MARKETING_NAME_MAX,
  MARKETING_NAME_MIN,
  OPT_OUT_BUTTON_TEXT,
  VARIABLE_CHIPS,
  codePointLength,
  fromApiButtons,
  imageFileNameForMime,
  insertAt,
  marketingImageErrors,
  previewButtons,
  renderMarketingText,
  toApiButtons,
  toPositional,
  validateMarketingBody,
  validateMarketingButtons,
  type DraftButton,
  type MarketingVariable,
} from "../_lib/marketing-template-rules";
import { MarketingStatusBadge } from "./marketing-status-badge";
import { WhatsAppPreview } from "./whatsapp-preview";

/** Só rascunho e recusado se editam na própria linha (spec §4.2); o resto vira "Nova versão". */
const EDITABLE: ReadonlySet<MarketingTemplateStatus> = new Set([
  "DRAFT",
  "REJECTED",
]);

interface Props {
  open: boolean;
  /** `null` = modelo novo. */
  template: MarketingTemplateView | null;
  onOpenChange: (open: boolean) => void;
  /** Modelo salvo (rascunho) ou enviado (em análise / nova versão) — o passo 2 da campanha escolhe ele. */
  onSaved?: (template: MarketingTemplateView) => void;
}

/**
 * Editor de modelo de marketing (spec 2026-10-01 campanhas parte 1 §8.1): à esquerda
 * nome, imagem, texto com chips de variável, contador e botões; à direita a prévia
 * igual ao WhatsApp com os dados de exemplo (Maria, Campinas). As regras rodam a cada
 * tecla (espelho das da API); com regra quebrada nada é salvo nem enviado.
 */
export function MarketingTemplateEditor({
  open,
  template,
  onOpenChange,
  onSaved,
}: Props) {
  const create = useCreateMarketingTemplate();
  const update = useUpdateMarketingTemplate();
  const submit = useSubmitMarketingTemplate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [imageKey, setImageKey] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [buttons, setButtons] = useState<DraftButton[]>([]);
  // Depois do 1º salvamento, tudo edita a MESMA linha: reenviar não cria outro rascunho.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Reabrir (novo OU outro modelo) parte do modelo recebido: o diálogo pode ficar montado.
  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setBody(template?.body ?? "");
    setImageKey(template?.imageKey ?? "");
    setImagePreviewUrl(template?.imageUrl ?? "");
    setButtons(template ? fromApiButtons(template.buttons) : []);
    setSavedId(template?.id ?? null);
    setMetaError(null);
  }, [open, template]);

  const editable = !template || EDITABLE.has(template.status);
  const length = useMemo(
    () => codePointLength(toPositional(body).text),
    [body],
  );
  const bodyErrors = useMemo(() => validateMarketingBody(body), [body]);
  const buttonErrors = useMemo(
    () => validateMarketingButtons(buttons),
    [buttons],
  );
  const nameLength = codePointLength(name.trim());
  const nameError =
    nameLength === 0
      ? "Dê um nome ao modelo."
      : nameLength < MARKETING_NAME_MIN
        ? `O nome do modelo precisa ter pelo menos ${MARKETING_NAME_MIN} caracteres.`
        : null;
  const imageErrors = useMemo(() => marketingImageErrors(imageKey), [imageKey]);
  const blocked =
    !editable ||
    nameError !== null ||
    bodyErrors.length > 0 ||
    buttonErrors.length > 0 ||
    imageErrors.length > 0;
  const busy = create.isPending || update.isPending || submit.isPending;
  const hasType = (type: DraftButton["type"]) =>
    buttons.some((b) => b.type === type);
  const canAddButton = editable && buttons.length < MARKETING_MAX_BUTTONS;

  function insertVariable(variable: MarketingVariable) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = insertAt(body, start, end, `{${variable}}`);
    setBody(next.body);
    // Cursor logo depois da variável: dá para seguir digitando.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function addButton(type: DraftButton["type"]) {
    // Link novo já conta cliques (spec 2026-10-01 parte 2 §5): é o padrão de modelo novo.
    setButtons((current) => [
      ...current,
      { type, text: "", value: "", ...(type === "URL" ? { track: true } : {}) },
    ]);
  }

  function changeButton(index: number, patch: Partial<DraftButton>) {
    setButtons((current) =>
      current.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function removeButton(index: number) {
    setButtons((current) => current.filter((_, i) => i !== index));
  }

  function payload(): MarketingTemplateInput {
    return {
      name: name.trim(),
      body: body.trim(),
      imageKey: imageKey || null,
      buttons: toApiButtons(buttons),
    };
  }

  async function save(): Promise<MarketingTemplateView> {
    const input = payload();
    const saved = savedId
      ? await update.mutateAsync({ id: savedId, input })
      : await create.mutateAsync(input);
    setSavedId(saved.id);
    return saved;
  }

  async function handleSaveDraft() {
    try {
      const saved = await save();
      toast.success("Rascunho salvo.");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível salvar o modelo."),
      );
    }
  }

  async function handleSubmit() {
    setMetaError(null);
    let saved: MarketingTemplateView;
    try {
      saved = await save();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível salvar o modelo."),
      );
      return;
    }
    try {
      const sent = await submit.mutateAsync(saved.id);
      toast.success(
        "Modelo enviado para aprovação da Meta. A situação muda sozinha quando a Meta responder.",
      );
      onSaved?.(sent);
      onOpenChange(false);
    } catch (err) {
      // O rascunho ficou salvo; a mensagem da Meta fica na tela para corrigir e reenviar.
      const message = getAxiosErrorMessage(
        err,
        "A Meta não recebeu o modelo. Tente de novo.",
      );
      setMetaError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-5xl">
      <DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar modelo" : "Novo modelo"}
          </DialogTitle>
          <DialogDescription>
            À esquerda você escreve; à direita vê como chega no WhatsApp, com
            dados de exemplo (Maria, Campinas).
          </DialogDescription>
        </DialogHeader>

        {template && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <MarketingStatusBadge status={template.status} />
            {template.status === "REJECTED" && template.rejectedReason && (
              <span className="text-red-700">
                A Meta recusou: {template.rejectedReason}
              </span>
            )}
          </div>
        )}
        {!editable && (
          <p
            role="status"
            className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          >
            Este modelo já foi para a Meta. Para mudar o texto, use &quot;Nova
            versão&quot; na lista de modelos.
          </p>
        )}

        <div
          data-testid="editor-layout"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <div className="min-w-0 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="mkt-name">Nome interno</Label>
              <Input
                id="mkt-name"
                className="min-h-11"
                value={name}
                maxLength={MARKETING_NAME_MAX}
                disabled={!editable}
                onChange={(event) => setName(event.target.value)}
                placeholder="Apresentação Freela — Rebeca"
              />
              {nameError && <p className="text-xs text-red-700">{nameError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Imagem no topo (opcional)</Label>
              <ImageUploadField
                imageKey={imageKey}
                previewUrl={imagePreviewUrl}
                onChange={({ imageKey: key, previewUrl }) => {
                  setImageKey(key);
                  setImagePreviewUrl(previewUrl);
                }}
                disabled={!editable || busy}
                allowedTypes={MARKETING_IMAGE_TYPES}
                fileNameForType={(mime) => imageFileNameForMime(mime)}
                hint="PNG ou JPEG, até 5 MB. A Meta não aceita WebP no topo do modelo."
              />
              {imageErrors.map((error) => (
                <p key={error.code} className="text-xs text-red-700">
                  {error.message}
                </p>
              ))}
              {imageKey && editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => {
                    setImageKey("");
                    setImagePreviewUrl("");
                  }}
                >
                  Remover imagem
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mkt-body">Texto</Label>
              <div className="flex flex-wrap items-center gap-2">
                {VARIABLE_CHIPS.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    disabled={!editable}
                    onClick={() => insertVariable(variable)}
                    className="min-h-11 rounded-full border border-neutral-300 px-3 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    + {`{${variable}}`}
                  </button>
                ))}
                <span className="text-xs text-neutral-500">
                  negrito: *texto*
                </span>
              </div>
              <textarea
                id="mkt-body"
                ref={textareaRef}
                rows={10}
                value={body}
                disabled={!editable}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Oi, {primeiro_nome}! Tudo bem?"
                className="w-full rounded-md border border-[#e5e5e5] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]"
              />
              <p
                data-testid="body-counter"
                className={`text-xs ${length > MARKETING_BODY_MAX ? "text-red-700" : "text-neutral-500"}`}
              >
                {length} / {MARKETING_BODY_MAX} caracteres · Não pode começar
                nem terminar com variável
              </p>
              {bodyErrors.map((error) => (
                <p key={error.code} className="text-xs text-red-700">
                  {error.message}
                </p>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Botões (até 2 + o de sair)</Label>
              {buttons.map((button, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-md border border-dashed border-neutral-300 p-2"
                >
                  <div className="flex items-center justify-between gap-2 text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {button.type === "URL" ? (
                        <Link2 className="h-4 w-4" aria-hidden />
                      ) : (
                        <Phone className="h-4 w-4" aria-hidden />
                      )}
                      {button.type === "URL" ? "Link" : "Ligar"}
                    </span>
                    {editable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => removeButton(index)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden /> Remover
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      aria-label={`Texto do botão ${index + 1}`}
                      className="min-h-11"
                      value={button.text}
                      disabled={!editable}
                      onChange={(event) =>
                        changeButton(index, { text: event.target.value })
                      }
                      placeholder={
                        button.type === "URL"
                          ? "Cadastrar meu negócio"
                          : "Falar com a Rebeca"
                      }
                    />
                    <Input
                      aria-label={
                        button.type === "URL"
                          ? `Link do botão ${index + 1}`
                          : `Telefone do botão ${index + 1}`
                      }
                      className="min-h-11"
                      inputMode={button.type === "URL" ? "url" : "tel"}
                      value={button.value}
                      disabled={!editable}
                      onChange={(event) =>
                        changeButton(index, { value: event.target.value })
                      }
                      placeholder={
                        button.type === "URL"
                          ? "https://www.freelaservicos.com.br"
                          : "(11) 95090-3219"
                      }
                    />
                  </div>
                  {button.type === "URL" && (
                    <label className="flex min-h-11 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0"
                        checked={button.track === true}
                        disabled={!editable}
                        onChange={(event) =>
                          changeButton(index, { track: event.target.checked })
                        }
                      />
                      <span>
                        <span className="font-medium text-[#1d1d1b]">
                          Contar cliques
                        </span>
                        <span className="block text-xs text-neutral-500">
                          o link passa por um endereço da Freela para contar
                          quem clicou
                        </span>
                      </span>
                    </label>
                  )}
                </div>
              ))}
              {canAddButton && (
                <div className="flex flex-wrap gap-2">
                  {!hasType("URL") && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => addButton("URL")}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Link
                    </Button>
                  )}
                  {!hasType("PHONE") && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => addButton("PHONE")}
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Ligar
                    </Button>
                  )}
                </div>
              )}
              <div className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-2 text-sm text-neutral-600">
                <Ban className="h-4 w-4 shrink-0" aria-hidden />
                <span>&quot;{OPT_OUT_BUTTON_TEXT}&quot; (sempre incluído)</span>
              </div>
              {buttonErrors.map((error, index) => (
                <p
                  key={`${error.code}-${index}`}
                  className="text-xs text-red-700"
                >
                  {error.message}
                </p>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-[#1d1d1b]">
              Prévia no WhatsApp (com dados de exemplo: Maria, Campinas)
            </p>
            <WhatsAppPreview
              imageUrl={imagePreviewUrl || null}
              hasImage={Boolean(imageKey)}
              text={renderMarketingText(body)}
              buttons={previewButtons(buttons)}
            />
          </div>
        </div>

        {metaError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {metaError}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={blocked || busy}
            onClick={handleSaveDraft}
          >
            {(create.isPending || update.isPending) && !submit.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Salvar rascunho
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={blocked || busy}
            onClick={handleSubmit}
          >
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Enviar para aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "@/app/(auth)/campanhas-automaticas/_components/image-upload-field";
import type { CampaignChannel } from "@/modules/admin/infrastructure/campaign-templates-api";
import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import {
  REPLY_TEXT_MAX,
  type WizardKind,
  type WizardState,
} from "../_lib/campaign-wizard";
import {
  codePointLength,
  previewButtons,
  renderMarketingText,
} from "../_lib/marketing-template-rules";
import { MarketingStatusBadge } from "./marketing-status-badge";
import { MarketingTemplateEditor } from "./marketing-template-editor";
import { OptionPill } from "./option-pill";
import { WhatsAppPreview } from "./whatsapp-preview";

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  WHATSAPP: "WhatsApp",
  PUSH: "Push",
};

interface Props {
  kind: WizardKind;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  /** Biblioteca sem arquivados. */
  templates: MarketingTemplateView[];
  /** Modelo escolhido (pode não estar aprovado: recém-escrito ou de um rascunho). */
  selectedTemplate: MarketingTemplateView | null;
  /** Modelo escrito agora no editor (o assistente mostra antes de a lista recarregar). */
  onTemplateCreated: (template: MarketingTemplateView) => void;
  templatesLoading?: boolean;
}

/**
 * Passo 2 — Mensagem (spec 2026-10-01 campanhas parte 1 §8.2): modelo APPROVED da
 * biblioteca ou "Escrever mensagem nova" (o editor; a campanha fica salva como rascunho
 * esperando a aprovação), "Resposta automática" e "E-mail que recebe as respostas".
 * Na automática, os canais: WhatsApp (modelo) e/ou push (título, corpo, imagem, link).
 */
export function WizardMessageStep({
  kind,
  state,
  onChange,
  templates,
  selectedTemplate,
  onTemplateCreated,
  templatesLoading = false,
}: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [pushImagePreview, setPushImagePreview] = useState("");
  const whatsapp = kind === "avulsa" || state.channels.includes("WHATSAPP");
  const push = kind === "automatica" && state.channels.includes("PUSH");
  const approved = templates.filter((t) => t.status === "APPROVED");
  const replyLength = codePointLength(state.replyText.trim());

  function toggleChannel(channel: CampaignChannel) {
    onChange({
      channels: state.channels.includes(channel)
        ? state.channels.filter((c) => c !== channel)
        : [...state.channels, channel],
    });
  }

  return (
    <div className="space-y-6">
      {kind === "automatica" && (
        <div className="space-y-1.5">
          <Label>Canais</Label>
          <div className="flex flex-wrap gap-2">
            {(["WHATSAPP", "PUSH"] as const).map((channel) => (
              <OptionPill
                key={channel}
                selected={state.channels.includes(channel)}
                onClick={() => toggleChannel(channel)}
              >
                {CHANNEL_LABELS[channel]}
              </OptionPill>
            ))}
          </div>
        </div>
      )}

      {whatsapp && (
        <section className="space-y-5">
          <div className="space-y-2">
            <Label>Modelo da mensagem</Label>
            <p className="text-xs text-neutral-500">
              Só modelo aprovado pela Meta pode ser disparado. Variáveis viram o
              nome e a cidade de cada pessoa.
            </p>
            {templatesLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                Carregando modelos…
              </div>
            ) : approved.length === 0 ? (
              <p className="text-sm text-neutral-600">
                Nenhum modelo aprovado ainda.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label="Modelos aprovados"
                className="flex flex-col gap-2"
              >
                {approved.map((template) => (
                  <label
                    key={template.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-2 text-sm",
                      state.marketingTemplateId === template.id
                        ? "border-[#eca826] bg-[#eca826]/5"
                        : "border-neutral-200",
                    )}
                  >
                    <input
                      type="radio"
                      name="wz-template"
                      className="h-5 w-5 shrink-0"
                      checked={state.marketingTemplateId === template.id}
                      onChange={() =>
                        onChange({ marketingTemplateId: template.id })
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {template.name}
                    </span>
                    <MarketingStatusBadge status={template.status} />
                  </label>
                ))}
              </div>
            )}

            {state.modelNotice && !state.marketingTemplateId && (
              <div
                role="alert"
                data-testid="model-notice"
                className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
              >
                {state.modelNotice}
              </div>
            )}

            {selectedTemplate && selectedTemplate.status !== "APPROVED" && (
              <div
                role="status"
                className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <strong className="break-words">
                    {selectedTemplate.name}
                  </strong>
                  <MarketingStatusBadge status={selectedTemplate.status} />
                </p>
                <p className="mt-1">
                  Esse modelo ainda não foi aprovado pela Meta. A campanha fica
                  salva como rascunho esperando a aprovação; disparar, agendar
                  ou ligar só depois.
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setEditorOpen(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden /> Escrever mensagem nova
            </Button>
          </div>

          {selectedTemplate && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[#1d1d1b]">
                Prévia (Maria, Campinas)
              </p>
              <WhatsAppPreview
                imageUrl={selectedTemplate.imageUrl}
                hasImage={Boolean(selectedTemplate.imageKey)}
                text={renderMarketingText(selectedTemplate.body)}
                buttons={previewButtons(selectedTemplate.buttons)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wz-reply">Resposta automática</Label>
            <textarea
              id="wz-reply"
              rows={3}
              value={state.replyText}
              onChange={(event) => onChange({ replyText: event.target.value })}
              placeholder="Obrigado! A Rebeca vai falar com você pelo (11) 95090-3219."
              className="w-full rounded-md border border-[#e5e5e5] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]"
            />
            <p
              className={`text-xs ${replyLength > REPLY_TEXT_MAX ? "text-red-700" : "text-neutral-500"}`}
            >
              Vai uma vez para quem responder a campanha. Em branco, ninguém
              recebe resposta. {replyLength} / {REPLY_TEXT_MAX}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wz-reply-email">
              E-mail que recebe as respostas
            </Label>
            <Input
              id="wz-reply-email"
              type="email"
              className="min-h-11"
              value={state.replyAlertEmail}
              onChange={(event) =>
                onChange({ replyAlertEmail: event.target.value })
              }
              placeholder="comercial@freelaservicos.com.br"
            />
          </div>
        </section>
      )}

      {push && (
        <section className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wz-push-title">Título do push</Label>
            <Input
              id="wz-push-title"
              className="min-h-11"
              value={state.pushTitle}
              onChange={(event) => onChange({ pushTitle: event.target.value })}
              placeholder="Ex.: Bora publicar a vaga de amanhã?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wz-push-body">Corpo do push</Label>
            <textarea
              id="wz-push-body"
              rows={3}
              value={state.pushBody}
              onChange={(event) => onChange({ pushBody: event.target.value })}
              className="w-full rounded-md border border-[#e5e5e5] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Imagem do push (opcional)</Label>
            <ImageUploadField
              imageKey={state.imageKey}
              previewUrl={pushImagePreview}
              onChange={({ imageKey, previewUrl }) => {
                onChange({ imageKey });
                setPushImagePreview(previewUrl);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wz-deep-link">Deep-link (opcional)</Label>
            <Input
              id="wz-deep-link"
              className="min-h-11"
              value={state.deepLink}
              onChange={(event) => onChange({ deepLink: event.target.value })}
              placeholder="contractor/vagas/nova"
            />
          </div>
        </section>
      )}

      <MarketingTemplateEditor
        open={editorOpen}
        template={null}
        onOpenChange={setEditorOpen}
        onSaved={(template) => {
          onTemplateCreated(template);
          onChange({ marketingTemplateId: template.id });
        }}
      />
    </div>
  );
}

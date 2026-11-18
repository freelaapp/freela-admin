"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useUpdateCrmPipelineSettings } from "@/modules/admin/application/use-admin-crm";
import {
  formatSupportWhatsappInput,
  normalizeSupportWhatsapp,
  whatsappTestUrl,
} from "@/modules/admin/application/support-whatsapp";
import type { PipelineMessageKey, PipelineSettings } from "@/modules/admin/infrastructure/crm-api";
import { StageMessagesSection } from "./stage-messages-section";
import {
  draftsFrom,
  hasStageMessages,
  stageMessagesPayload,
  type StageDraft,
  type StageDrafts,
} from "./stage-messages";

const REPLY_MAX = 400;
const LINK_TOKEN = "{link_marketing}";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PipelineSettings;
}

/**
 * Configuração da mensagem do Pipeline: por onde sai (modelo aprovado da Meta ou
 * o texto fixo pelo chip), para qual WhatsApp o contratante é levado e o que
 * responder a quem escreve no número oficial — que ninguém atende.
 */
export function MessageSettingsDialog({ open, onOpenChange, settings }: Props) {
  const save = useUpdateCrmPipelineSettings();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      className="max-w-2xl"
    >
      {/* O Dialog fechado não monta os filhos: o formulário nasce de novo a cada
          abertura, com o que está salvo. Cancelar não deixa rascunho para trás. */}
      <SettingsForm
        settings={settings}
        save={save}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

function SettingsForm({
  settings,
  save,
  onClose,
}: {
  settings: PipelineSettings;
  save: ReturnType<typeof useUpdateCrmPipelineSettings>;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(settings.template?.id ?? "");
  const [whatsapp, setWhatsapp] = useState(
    settings.marketingWhatsapp.isFallback
      ? ""
      : settings.marketingWhatsapp.whatsappE164,
  );
  const [replyText, setReplyText] = useState(settings.replyText ?? "");
  const [alertEmail, setAlertEmail] = useState(settings.replyAlertEmail ?? "");
  // Mensagem por etapa: só existe com a API de 18/11/2026 em diante. Sem ela, nem aparece
  // nem vai no PUT (a API antiga recusaria o campo desconhecido e o "Salvar" quebraria).
  const stages = hasStageMessages(settings) ? settings.stageMessages : null;
  const [stageDrafts, setStageDrafts] = useState<StageDrafts>(() =>
    stages ? draftsFrom(stages) : {},
  );
  const setStageDraft = (key: PipelineMessageKey, next: StageDraft) =>
    setStageDrafts((current) => ({ ...current, [key]: next }));

  // O modelo escolhido pode ter deixado de estar aprovado: continua na lista, com a situação.
  const current = settings.template;
  const options = [
    ...settings.availableTemplates,
    ...(current && !settings.availableTemplates.some((t) => t.id === current.id)
      ? [current]
      : []),
  ];
  const chosen = options.find((t) => t.id === templateId) ?? null;
  const chosenNotApproved =
    !!chosen && chosen.id === current?.id && current.status !== "APPROVED"
      ? current.statusLabel
      : null;

  const whatsappTyped = whatsapp.trim().length > 0;
  const e164 = normalizeSupportWhatsapp(whatsapp);
  const whatsappInvalid = whatsappTyped && !e164;
  const replyTooLong = replyText.trim().length > REPLY_MAX;
  const emailInvalid =
    alertEmail.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(alertEmail.trim());

  // Prévia local da resposta automática, com o número que está no formulário.
  const destinoUrl = e164
    ? whatsappTestUrl(e164)
    : settings.marketingWhatsapp.whatsappUrl;
  const usingSupport = !e164;
  const replyPreview = (replyText.trim() || settings.defaultReplyText)
    .split(LINK_TOKEN)
    .join(destinoUrl);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        marketingTemplateId: templateId || null,
        marketingWhatsapp: e164 ?? "",
        replyText: replyText.trim() || null,
        replyAlertEmail: alertEmail.trim() || null,
        ...(stages ? { stageMessages: stageMessagesPayload(stages, stageDrafts) } : {}),
      });
      toast.success("Mensagem do Pipeline atualizada.");
      onClose();
    } catch (error) {
      toast.error(
        getAxiosErrorMessage(error, "Não foi possível salvar a configuração."),
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(settings.marketingContactUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o link e copie à mão.");
    }
  };

  return (
    <DialogContent role="dialog" aria-label="Configurar a mensagem do Pipeline">
      <DialogHeader>
        <DialogTitle>Configurar a mensagem do Pipeline</DialogTitle>
        <DialogDescription>
          Vale para o botão de enviar no funil e nos cadastros antigos.
        </DialogDescription>
      </DialogHeader>

      {/* O Dialog do admin não limita a altura: sem isto, em tela baixa o rodapé some. */}
      <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
        {/* ── Por onde sai ── */}
        <section className="space-y-2">
          <Label htmlFor="pipeline-template">Mensagem enviada</Label>
          <NativeSelect
            id="pipeline-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">
              Texto fixo pelo chip de campanha (sem o WhatsApp oficial)
            </option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id === current?.id && current.status !== "APPROVED"
                  ? `${t.name} (${current.statusLabel})`
                  : t.name}
              </option>
            ))}
          </NativeSelect>

          {settings.availableTemplates.length === 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#525252]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#737373]" />
              <span>
                Nenhum modelo aprovado pela Meta ainda. Em{" "}
                <Link
                  href="/campanhas"
                  className="font-medium text-[#c97b0e] hover:underline"
                >
                  Campanhas › Modelos
                </Link>{" "}
                há o rascunho “Boas-vindas do Pipeline”: revise o texto e envie
                para aprovação. Quando a Meta aprovar, ele aparece aqui.
              </span>
            </p>
          )}

          {chosen ? (
            <>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#1d1d1b]">
                {chosen.body}
              </p>
              {chosenNotApproved && (
                <p className="flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Este modelo está {chosenNotApproved}: os envios são recusados
                  até você escolher outro.
                </p>
              )}
              {!chosen.hasLinkButton && (
                <p className="flex items-start gap-2 text-xs text-[#b45309]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Este modelo não tem botão de link: o contratante só chega ao
                  marketing se responder a mensagem (pela resposta automática
                  abaixo).
                </p>
              )}
              <p className="text-xs text-[#737373]">
                Sai pelo número oficial da Meta. Cada envio é cobrado pela Meta
                como mensagem de marketing.
              </p>
            </>
          ) : (
            <p className="text-xs text-[#737373]">
              Continua como antes: o texto fixo sai pelo chip de campanha, sem
              confirmação de entrega.
            </p>
          )}
        </section>

        {/* ── Para quem o contratante é levado ── */}
        <section className="space-y-2">
          <Label htmlFor="pipeline-marketing-whatsapp">
            WhatsApp do marketing (celular com DDD)
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="pipeline-marketing-whatsapp"
              className="min-w-[200px] flex-1"
              inputMode="tel"
              autoComplete="off"
              placeholder="(11) 97177-7563"
              value={formatSupportWhatsappInput(whatsapp)}
              onChange={(event) => setWhatsapp(event.target.value)}
            />
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
          </div>
          {whatsappInvalid ? (
            <p className="text-xs text-red-600">
              Informe um celular com DDD, ex.: (11) 97177-7563.
            </p>
          ) : (
            <p className="text-xs text-[#737373]">
              É para este número que o contratante vai ao tocar no botão do
              modelo ou ao responder a mensagem. O número oficial não é atendido
              por pessoas.
              {usingSupport &&
                ` Em branco, vale o WhatsApp de suporte${
                  settings.marketingWhatsapp.isFallback
                    ? ` (${settings.marketingWhatsapp.display})`
                    : ""
                }.`}
            </p>
          )}
        </section>

        {/* ── Quem responde no número oficial ── */}
        <section className="space-y-2">
          <Label htmlFor="pipeline-reply-text">
            Resposta automática para quem responder
          </Label>
          <textarea
            id="pipeline-reply-text"
            rows={3}
            maxLength={REPLY_MAX + 100}
            placeholder={settings.defaultReplyText}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
          <p
            className={`text-xs ${replyTooLong ? "text-red-600" : "text-[#737373]"}`}
          >
            {replyText.trim().length} de {REPLY_MAX} caracteres. Use{" "}
            {LINK_TOKEN} onde o link do WhatsApp do marketing deve aparecer. Em
            branco, vale o texto padrão. Cada pessoa recebe uma vez por mensagem
            enviada.
          </p>
          <div className="rounded-lg bg-[#f7f7f7] p-3">
            <p className="mb-1 text-[11px] font-medium text-[#737373]">
              Como a pessoa recebe
            </p>
            <p className="whitespace-pre-wrap break-words text-xs text-[#1d1d1b]">
              {replyPreview}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <Label htmlFor="pipeline-reply-email">
            E-mail de aviso quando alguém responder
          </Label>
          <Input
            id="pipeline-reply-email"
            type="email"
            autoComplete="off"
            placeholder="marketing@empresa.com.br"
            value={alertEmail}
            onChange={(event) => setAlertEmail(event.target.value)}
          />
          {emailInvalid ? (
            <p className="text-xs text-red-600">Informe um e-mail válido.</p>
          ) : (
            <p className="text-xs text-[#737373]">
              Recebe o nome, o telefone e o texto de quem respondeu. Em branco,
              ninguém é avisado (a resposta aparece só no cartão).
            </p>
          )}
        </section>

        {stages && (
          <StageMessagesSection
            settings={settings}
            stages={stages}
            drafts={stageDrafts}
            onChange={setStageDraft}
          />
        )}

        {/* ── Link para o botão do modelo ── */}
        <section className="space-y-2">
          <Label htmlFor="pipeline-contact-url">
            Link para o botão do modelo
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="pipeline-contact-url"
              readOnly
              className="min-w-[200px] flex-1 text-xs"
              value={settings.marketingContactUrl}
              onFocus={(event) => event.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLink}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-[#737373]">
            Ao criar um modelo em Campanhas › Modelos, use este link no botão
            (com “Contar cliques” ligado). Ele abre a conversa com o WhatsApp do
            marketing configurado acima — trocar o número aqui não exige aprovar
            outro modelo.
          </p>
        </section>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            save.isPending || whatsappInvalid || replyTooLong || emailInvalid
          }
        >
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import {
  useAudienceOptions,
  usePreviewAudience,
} from "@/modules/admin/application/use-admin-referrals";
import {
  useCreateCampaignTemplate,
  useUpdateCampaignTemplate,
} from "@/modules/admin/application/use-campaign-templates";
import type { CampaignAudience } from "@/modules/admin/infrastructure/referrals-api";
import type {
  CampaignChannel,
  CampaignTemplate,
  CampaignTemplateAudience,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import {
  DEFAULT_TEMPLATE_FORM_VALUES,
  TEMPLATE_AUDIENCES,
  TEMPLATE_MODULES,
  templateFormSchema,
  type TemplateFormValues,
} from "../_lib/template-schema";
import {
  buildAudienceFilters,
  buildTemplatePayload,
  previewVariant,
  templateToFormValues,
} from "../_lib/template-form";
import { ImageUploadField } from "./image-upload-field";

/** Os 4 recortes legados de `(auth)/campanhas` + os 2 novos só de template. */
const AUDIENCE_LABELS: Record<CampaignTemplateAudience, string> = {
  CONTRACTORS_NEVER_PUBLISHED: "Contratantes que nunca publicaram vaga",
  CONTRACTORS_DORMANT_90D: "Contratantes sem publicar há mais de 90 dias",
  PROVIDERS_NEVER_APPLIED: "Freelancers que nunca se candidataram",
  PROVIDERS_DORMANT_90D: "Freelancers sem se candidatar há mais de 90 dias",
  CONTRACTORS_ALL: "Todos os contratantes",
  CONTRACTORS_ACTIVE: "Contratantes ativos (já usam a plataforma)",
};

const MODULE_LABELS: Record<(typeof TEMPLATE_MODULES)[number], string> = {
  "bars-restaurants": "Empresa (bares e restaurantes)",
  "home-services": "Em casa (serviços domésticos)",
};

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  PUSH: "Push",
  WHATSAPP: "WhatsApp",
};

/** 0=domingo..6=sábado — mesma convenção da API. */
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-red-600">{children}</p>;
}

interface Props {
  open: boolean;
  /** Ausente = criar; presente = editar este template. */
  template?: CampaignTemplate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Diálogo criar/editar de template de campanha automática (recorrente):
 * agenda (WEEKLY/DATED) + público (recorte igual a `(auth)/campanhas`) +
 * canais + mensagem (WhatsApp 3 variantes / push) + imagem + ritmo.
 *
 * Reusa, sem reescrever: os controles de recorte de público e o botão
 * "Contar" (`useAudienceOptions`/`usePreviewAudience`, de
 * `use-admin-referrals.ts`) e o preview de variante do WhatsApp
 * (`renderPreview`/`normalizeTemplatePlaceholders`, via `previewVariant` em
 * `_lib/template-form.ts`) — mesma lógica do editor de `(auth)/campanhas`.
 * O upload de imagem segue a UX do `AdDialog` de `(auth)/propagandas`, mas
 * grava `imageKey` via `uploadCampaignTemplateImage` (Task 1).
 */
export function TemplateDialog({ open, template, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(template);
  const createTemplate = useCreateCampaignTemplate();
  const updateTemplate = useUpdateCampaignTemplate();
  const previewAudience = usePreviewAudience();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: DEFAULT_TEMPLATE_FORM_VALUES,
  });

  // Reabrir (criar OU editar outro template) tem que partir de valores
  // limpos — o diálogo fica montado o tempo todo na página de lista
  // (Task 3), então o estado do RHF sobrevive a fechar/abrir sozinho.
  useEffect(() => {
    if (!open) return;
    reset(template ? templateToFormValues(template) : DEFAULT_TEMPLATE_FORM_VALUES);
  }, [open, template, reset]);

  // Só ephemeral de UI (não é campo do formulário nem é gravado): o backend
  // não devolve URL de preview na listagem/detalhe do template, só na
  // resposta do upload — então em edição sem upload novo fica vazia.
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  useEffect(() => {
    if (open) setImagePreviewUrl("");
  }, [open, template]);

  // Idem: resultado do botão "Contar" é feedback de tela, não dado
  // submetido — não faz sentido virar campo do formulário.
  const [contagem, setContagem] = useState<{
    total: number;
    whatsapp: number;
    semCoordenada: number;
  } | null>(null);

  const scheduleKind = watch("scheduleKind");
  const channels = watch("channels");
  const audience = watch("audience");
  const raioCidade = watch("raioCidade");
  const cities = watch("cities");
  const selectedModules = watch("modules");
  const raioKm = watch("raioKm");
  const repeatsAnnually = watch("repeatsAnnually");
  const messagesPerHour = watch("messagesPerHour");

  // Só busca as cidades com o diálogo aberto: a chamada monta a audiência
  // inteira no backend, então não vale disparar sem necessidade.
  const audienceOptions = useAudienceOptions(open ? (audience as CampaignAudience) : null);

  useEffect(() => {
    setContagem(null);
  }, [audience, cities, selectedModules, raioCidade, raioKm]);

  /** Freelancer não separa por módulo — o toggle só faz sentido pra contratante. */
  const mostraTipoDeConta = audience.startsWith("CONTRACTORS_");

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  async function handleCount() {
    try {
      const filters = buildAudienceFilters({
        cities,
        modules: selectedModules,
        raioCidade,
        raioKm,
      });
      const res = await previewAudience.mutateAsync({
        audience: audience as CampaignAudience,
        filters,
      });
      setContagem({
        total: res.total,
        whatsapp: res.byChannel.WHATSAPP,
        semCoordenada: res.semCoordenada ?? 0,
      });
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  }

  const onSubmit: SubmitHandler<TemplateFormValues> = async (values) => {
    try {
      const payload = buildTemplatePayload(values);
      if (isEdit && template) {
        await updateTemplate.mutateAsync({ id: template.id, payload });
        toast.success("Campanha automática atualizada.");
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success("Campanha automática criada.");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  // Sem isso, um erro de validação num campo fora da área visível do
  // diálogo (ele tem scroll) faz o botão "parecer" não fazer nada — o
  // toast garante que sempre há algum feedback ao clicar em Criar/Salvar.
  function onInvalid() {
    toast.error("Confira os campos destacados antes de salvar.");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} className="max-w-2xl">
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar campanha automática" : "Nova campanha automática"}</DialogTitle>
          <DialogDescription>
            Roda sozinha pelo agendador: semanal dispara nos dias escolhidos, por data dispara uma
            vez (com opção de repetir todo ano).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input
              id="tpl-name"
              {...register("name")}
              placeholder="Reengajamento contratantes — toda sexta"
            />
            {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
          </div>

          {/* ── Agenda ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label>Agenda</Label>
            <Controller
              control={control}
              name="scheduleKind"
              render={({ field }) => (
                <div className="flex gap-2">
                  {(["WEEKLY", "DATED"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => field.onChange(kind)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                        field.value === kind
                          ? "bg-[#eca826] text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-[#eca826]/10"
                      }`}
                    >
                      {kind === "WEEKLY" ? "Toda semana" : "Data específica"}
                    </button>
                  ))}
                </div>
              )}
            />

            {scheduleKind === "WEEKLY" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Dias da semana</Label>
                  <Controller
                    control={control}
                    name="weekdays"
                    render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((label, day) => {
                          const on = field.value.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() =>
                                field.onChange(
                                  on
                                    ? field.value.filter((d) => d !== day)
                                    : [...field.value, day].sort((a, b) => a - b),
                                )
                              }
                              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                on
                                  ? "bg-[#eca826] text-white"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-[#eca826]/10"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.weekdays && <ErrorText>{errors.weekdays.message}</ErrorText>}
                </div>
                <div className="w-40 space-y-1.5">
                  <Label htmlFor="tpl-sendHour">Hora (BRT)</Label>
                  <Input
                    id="tpl-sendHour"
                    type="number"
                    min={0}
                    max={23}
                    {...register("sendHour", { valueAsNumber: true })}
                  />
                  {errors.sendHour && <ErrorText>{errors.sendHour.message}</ErrorText>}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-targetMonth">Mês</Label>
                    <Controller
                      control={control}
                      name="targetMonth"
                      render={({ field }) => (
                        <Input
                          id="tpl-targetMonth"
                          type="number"
                          min={1}
                          max={12}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                          }
                        />
                      )}
                    />
                    {errors.targetMonth && <ErrorText>{errors.targetMonth.message}</ErrorText>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-targetDay">Dia</Label>
                    <Controller
                      control={control}
                      name="targetDay"
                      render={({ field }) => (
                        <Input
                          id="tpl-targetDay"
                          type="number"
                          min={1}
                          max={31}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                          }
                        />
                      )}
                    />
                    {errors.targetDay && <ErrorText>{errors.targetDay.message}</ErrorText>}
                  </div>
                </div>
                <div className="w-40 space-y-1.5">
                  <Label htmlFor="tpl-leadDays">Dias antes da data</Label>
                  <Input
                    id="tpl-leadDays"
                    type="number"
                    min={0}
                    max={60}
                    {...register("leadDays", { valueAsNumber: true })}
                  />
                  {errors.leadDays && <ErrorText>{errors.leadDays.message}</ErrorText>}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("repeatsAnnually")} />
                  Repetir todo ano
                </label>
                {!repeatsAnnually && (
                  <div className="w-40 space-y-1.5">
                    <Label htmlFor="tpl-targetYear">Ano</Label>
                    <Controller
                      control={control}
                      name="targetYear"
                      render={({ field }) => (
                        <Input
                          id="tpl-targetYear"
                          type="number"
                          min={2020}
                          max={2100}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                          }
                        />
                      )}
                    />
                    {errors.targetYear && <ErrorText>{errors.targetYear.message}</ErrorText>}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Público ────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-audience">Quem recebe</Label>
              <Controller
                control={control}
                name="audience"
                render={({ field }) => (
                  <NativeSelect
                    id="tpl-audience"
                    value={field.value}
                    onChange={(e) => {
                      const next = e.target.value as CampaignTemplateAudience;
                      field.onChange(next);
                      // Cidade/raio da audiência antiga podem nem existir na
                      // nova; tipo de conta some pra freelancer.
                      setValue("cities", []);
                      setValue("raioCidade", "");
                      if (!next.startsWith("CONTRACTORS_")) setValue("modules", []);
                    }}
                  >
                    {TEMPLATE_AUDIENCES.map((key) => (
                      <option key={key} value={key}>
                        {AUDIENCE_LABELS[key]}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              />
            </div>

            {mostraTipoDeConta && (
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Controller
                  control={control}
                  name="modules"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_MODULES.map((mod) => {
                        const on = field.value.includes(mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                on ? field.value.filter((m) => m !== mod) : [...field.value, mod],
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                              on
                                ? "bg-[#eca826] text-white"
                                : "bg-neutral-100 text-neutral-600 hover:bg-[#eca826]/10"
                            }`}
                          >
                            {MODULE_LABELS[mod]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                <p className="text-xs text-neutral-500">Nenhum marcado = os dois.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Raio a partir de uma cidade</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Controller
                  control={control}
                  name="raioCidade"
                  render={({ field }) => (
                    <NativeSelect
                      className="min-w-52 flex-1"
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        setValue("cities", []);
                      }}
                    >
                      <option value="">Sem raio (usar a lista de cidades)</option>
                      {(audienceOptions.data?.cities ?? []).map((opt) => (
                        <option key={`${opt.city}-${opt.uf ?? ""}`} value={opt.city}>
                          {opt.city}
                          {opt.uf ? ` · ${opt.uf}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                />
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={2000}
                    className="w-24"
                    disabled={!raioCidade}
                    {...register("raioKm", { valueAsNumber: true })}
                  />
                  <span className="text-sm text-neutral-600">km</span>
                </div>
              </div>
              {errors.raioKm && <ErrorText>{errors.raioKm.message}</ErrorText>}
            </div>

            {!raioCidade && (
              <div className="space-y-1.5">
                <Label>
                  Cidades{" "}
                  <span className="font-normal text-neutral-500">
                    {cities.length
                      ? `(${cities.length} escolhida${cities.length === 1 ? "" : "s"})`
                      : "(nenhuma = todas)"}
                  </span>
                </Label>
                {audienceOptions.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Levantando as cidades desta
                    audiência…
                  </div>
                ) : (
                  <Controller
                    control={control}
                    name="cities"
                    render={({ field }) => (
                      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-neutral-200 p-2">
                        {(audienceOptions.data?.cities ?? []).length === 0 ? (
                          <p className="text-sm text-neutral-500">Nenhuma cidade nesta audiência.</p>
                        ) : (
                          audienceOptions.data!.cities.map((opt) => {
                            const on = field.value.includes(opt.city);
                            return (
                              <button
                                key={`${opt.city}-${opt.uf ?? ""}`}
                                type="button"
                                onClick={() =>
                                  field.onChange(
                                    on
                                      ? field.value.filter((c) => c !== opt.city)
                                      : [...field.value, opt.city],
                                  )
                                }
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                  on
                                    ? "bg-[#eca826] text-white"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-[#eca826]/10"
                                }`}
                              >
                                {opt.city}
                                {opt.uf ? ` · ${opt.uf}` : ""}{" "}
                                <span className={on ? "text-white/80" : "text-neutral-400"}>
                                  {opt.total}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  />
                )}
              </div>
            )}

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  {contagem ? (
                    <>
                      <span className="font-semibold text-neutral-900">
                        {contagem.total} pessoa{contagem.total === 1 ? "" : "s"}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {contagem.whatsapp} por WhatsApp · {contagem.total - contagem.whatsapp} por
                        e-mail
                      </span>
                      {contagem.semCoordenada > 0 && (
                        <span className="mt-1 block text-xs text-amber-700">
                          {contagem.semCoordenada} ficaram de fora do raio por não ter endereço
                          com coordenada.
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-neutral-600">Confira quantos entram a cada execução.</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewAudience.isPending}
                  onClick={handleCount}
                >
                  {previewAudience.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Contar"
                  )}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Canais ─────────────────────────────────────────────── */}
          <section className="space-y-1.5">
            <Label>Canais</Label>
            <Controller
              control={control}
              name="channels"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CHANNEL_LABELS) as CampaignChannel[]).map((ch) => {
                    const on = field.value.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          field.onChange(on ? field.value.filter((c) => c !== ch) : [...field.value, ch])
                        }
                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                          on
                            ? "bg-[#eca826] text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-[#eca826]/10"
                        }`}
                      >
                        {CHANNEL_LABELS[ch]}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.channels && <ErrorText>{errors.channels.message}</ErrorText>}
          </section>

          {/* ── Mensagem ───────────────────────────────────────────── */}
          {channels.includes("WHATSAPP") && (
            <section className="space-y-2">
              <Label>Mensagem do WhatsApp</Label>
              <p className="text-xs text-neutral-500">
                Três variantes rodam alternadas, personalizadas com nome e cidade — mensagens
                idênticas em série é o que caracteriza spam. Use <code>{"{nome}"}</code>,{" "}
                <code>{"{primeiro_nome}"}</code> ou <code>{"{cidade}"}</code>.
              </p>
              <Controller
                control={control}
                name="whatsappVariants"
                render={({ field }) => (
                  <div className="space-y-3">
                    {field.value.map((text, index) => (
                      <div key={index} className="space-y-1">
                        <span className="text-xs font-medium text-neutral-600">
                          Variante {index + 1}
                        </span>
                        <textarea
                          className="min-h-32 w-full rounded-md border border-neutral-300 p-2 text-xs"
                          value={text}
                          onChange={(e) => {
                            const next = [...field.value] as [string, string, string];
                            next[index] = e.target.value;
                            field.onChange(next);
                          }}
                        />
                        <pre className="whitespace-pre-wrap rounded-md bg-neutral-100 p-2 text-[11px] text-neutral-600">
                          {previewVariant(text) || "(vazia — não será usada)"}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              />
              {errors.whatsappVariants && <ErrorText>{errors.whatsappVariants.message}</ErrorText>}
            </section>
          )}

          {channels.includes("PUSH") && (
            <section className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-pushTitle">Título do push</Label>
                <Input
                  id="tpl-pushTitle"
                  {...register("pushTitle")}
                  placeholder="Ex.: Bora publicar a vaga de amanhã?"
                />
                {errors.pushTitle && <ErrorText>{errors.pushTitle.message}</ErrorText>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-pushBody">Corpo do push</Label>
                <textarea
                  id="tpl-pushBody"
                  className="min-h-20 w-full rounded-md border border-neutral-300 p-2 text-sm"
                  {...register("pushBody")}
                />
                {errors.pushBody && <ErrorText>{errors.pushBody.message}</ErrorText>}
              </div>
            </section>
          )}

          {/* ── Imagem ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label>Imagem (opcional)</Label>
              <Controller
                control={control}
                name="imageKey"
                render={({ field }) => (
                  <ImageUploadField
                    imageKey={field.value}
                    previewUrl={imagePreviewUrl}
                    onChange={({ imageKey, previewUrl }) => {
                      field.onChange(imageKey);
                      setImagePreviewUrl(previewUrl);
                    }}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-deepLink">Deep-link (opcional)</Label>
              <Input id="tpl-deepLink" {...register("deepLink")} placeholder="contractor/vagas/nova" />
            </div>
          </section>

          {/* ── Ritmo ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label>Ritmo</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-messagesPerHour">Mensagens por hora</Label>
                <Input
                  id="tpl-messagesPerHour"
                  type="number"
                  min={1}
                  max={60}
                  {...register("messagesPerHour", { valueAsNumber: true })}
                />
                {errors.messagesPerHour && <ErrorText>{errors.messagesPerHour.message}</ErrorText>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-dailyCap">Teto por dia</Label>
                <Input
                  id="tpl-dailyCap"
                  type="number"
                  min={1}
                  max={1000}
                  {...register("dailyCap", { valueAsNumber: true })}
                />
                {errors.dailyCap && <ErrorText>{errors.dailyCap.message}</ErrorText>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-windowStartHour">Começa às (BRT)</Label>
                <Input
                  id="tpl-windowStartHour"
                  type="number"
                  min={0}
                  max={23}
                  {...register("windowStartHour", { valueAsNumber: true })}
                />
                {errors.windowStartHour && <ErrorText>{errors.windowStartHour.message}</ErrorText>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-windowEndHour">Termina às (BRT)</Label>
                <Input
                  id="tpl-windowEndHour"
                  type="number"
                  min={1}
                  max={24}
                  {...register("windowEndHour", { valueAsNumber: true })}
                />
                {errors.windowEndHour && <ErrorText>{errors.windowEndHour.message}</ErrorText>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("weekdaysOnly")} />
              Só em dias úteis
            </label>

            <div className="w-56 space-y-1.5">
              <Label htmlFor="tpl-maxPerRun">Máximo por execução (opcional)</Label>
              <Controller
                control={control}
                name="maxPerRun"
                render={({ field }) => (
                  <Input
                    id="tpl-maxPerRun"
                    type="number"
                    min={1}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                  />
                )}
              />
              {errors.maxPerRun && <ErrorText>{errors.maxPerRun.message}</ErrorText>}
              <p className="text-xs text-neutral-500">Vazio = sem limite além do ritmo acima.</p>
            </div>

            {messagesPerHour > 30 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Acima de 30 por hora o risco de o número ser banido cresce muito — e é o mesmo
                  número da confirmação de vaga, do código de check-in e do suporte.
                </span>
              </div>
            )}
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar campanha automática"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

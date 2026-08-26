"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
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
import { AlertTriangle, FileSpreadsheet, Loader2, Pause, Play, Plus, Square } from "lucide-react";
import { toast } from "sonner";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import {
  useCampaignPreview,
  useCampaigns,
  useAudienceOptions,
  useCreateCampaign,
  usePreviewAudience,
  useSetCampaignState,
} from "@/modules/admin/application/use-admin-referrals";
import type {
  AudienceFilters,
  Campaign,
  CampaignAudience,
} from "@/modules/admin/infrastructure/referrals-api";
import { CampaignStatusBadge } from "./_components/campaign-status-badge";
import { ExternalListDialog } from "./_components/external-list-dialog";
import { CampaignDetailDialog } from "./_components/campaign-detail-dialog";

/** Os quatro recortes que a API monta. Freelancer estava só no backend. */
const AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  CONTRACTORS_NEVER_PUBLISHED: "Contratantes que nunca publicaram vaga",
  CONTRACTORS_DORMANT_90D: "Contratantes sem publicar há mais de 90 dias",
  PROVIDERS_NEVER_APPLIED: "Freelancers que nunca se candidataram",
  PROVIDERS_DORMANT_90D: "Freelancers sem se candidatar há mais de 90 dias",
};

/** Rótulo curto da origem para a lista (planilha ou recorte da base). */
function audienceShortLabel(row: Campaign): string {
  if (row.audience === "EXTERNAL_LIST") return `Planilha${row.listFileName ? ` · ${row.listFileName}` : ""}`;
  return AUDIENCE_LABELS[row.audience as CampaignAudience] ?? row.audience;
}

const MODULE_LABELS: Record<"bars-restaurants" | "home-services", string> = {
  "bars-restaurants": "Empresa (bares e restaurantes)",
  "home-services": "Em casa (serviços domésticos)",
};

/**
 * Monta o recorte a partir do formulário. Devolve `undefined` quando não há
 * nenhum — objeto de listas vazias gravaria "filtrado por nada", que é
 * diferente de "sem filtro" e some da auditoria depois.
 *
 * Raio e lista de cidades são alternativas: com raio, a lista é ignorada (a
 * tela esconde uma quando a outra está em uso).
 */
function montarFiltros(f: {
  cities: string[];
  modules: Array<"bars-restaurants" | "home-services">;
  raioCidade: string;
  raioKm: number;
}): AudienceFilters | undefined {
  const raio = f.raioCidade.trim() && f.raioKm > 0
    ? { city: f.raioCidade.trim(), km: f.raioKm }
    : undefined;
  const cities = raio ? [] : f.cities;
  if (!cities.length && !f.modules.length && !raio) return undefined;
  return {
    ...(cities.length ? { cities } : {}),
    ...(f.modules.length ? { modules: f.modules } : {}),
    ...(raio ? { radius: raio } : {}),
  };
}

const DEFAULT_FORM = {
  name: "",
  audience: "CONTRACTORS_NEVER_PUBLISHED" as CampaignAudience,
  cities: [] as string[],
  modules: [] as Array<"bars-restaurants" | "home-services">,
  raioCidade: "",
  raioKm: 50,
  messagesPerHour: 20,
  dailyCap: 120,
  windowStartHour: 9,
  windowEndHour: 18,
  weekdaysOnly: true,
};

export default function CampanhasPage() {
  const { allowed, isChecking } = useAreaGuard("REFERRALS");
  const campaigns = useCampaigns();
  const createCampaign = useCreateCampaign();
  const setState = useSetCampaignState();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [creatingFromSheet, setCreatingFromSheet] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  // Só busca as cidades com o formulário aberto: a chamada monta a audiência
  // inteira no backend.
  const audienceOptions = useAudienceOptions(creating ? form.audience : null);
  const previewAudience = usePreviewAudience();
  const [contagem, setContagem] = useState<{
    total: number;
    whatsapp: number;
    semCoordenada: number;
  } | null>(null);
  /** Freelancer existe nos dois módulos por padrão — filtrar por tipo de conta
   *  ali não separa ninguém e só confunde. Vale para contratante. */
  const mostraTipoDeConta = form.audience.startsWith("CONTRACTORS_");
  const preview = useCampaignPreview("José da Silva", "Jundiaí");

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const { cities, modules, raioCidade, raioKm, ...rest } = form;
      const filtros = montarFiltros({ cities, modules, raioCidade, raioKm });
      const created = await createCampaign.mutateAsync({
        ...rest,
        // Só manda o recorte se houver algum: objeto de listas vazias gravaria
        // "filtrado por nada", que é diferente de "sem filtro".
        ...(filtros ? { audienceFilters: filtros } : {}),
      });
      toast.success(
        `Campanha criada com ${created.stats.PENDING} destinatários — ${created.estimate.days} dia(s) úteis no ritmo escolhido.`,
      );
      setCreating(false);
      setForm(DEFAULT_FORM);
      setContagem(null);
      setSelectedId(created.campaign.id);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const handleState = async (id: string, action: "start" | "pause" | "cancel") => {
    try {
      await setState.mutateAsync({ id, action });
      toast.success(
        action === "start" ? "Disparo iniciado." : action === "pause" ? "Pausada." : "Cancelada.",
      );
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const columns = [
    {
      header: "Campanha",
      accessor: (row: Campaign) => (
        <div className="flex flex-col gap-0.5">
          <button
            className="text-left font-medium underline"
            onClick={() => setSelectedId(row.id)}
            data-testid={`open-campaign-${row.id}`}
          >
            {row.name}
          </button>
          <span className="text-[11px] text-[#737373]">
            {audienceShortLabel(row)}
            {row.createdBy?.name && ` · por ${row.createdBy.name}`}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (row: Campaign) => <CampaignStatusBadge status={row.status} />,
    },
    { header: "Destinatários", accessor: (row: Campaign) => row._count?.recipients ?? 0 },
    {
      header: "Enviados",
      accessor: (row: Campaign) => {
        const stats = row.stats;
        if (!stats) return "—";
        // "Processados" = tudo que a fila já tentou. É o denominador honesto da
        // taxa: dividir o sucesso pelo total de destinatários faria uma campanha
        // no meio do caminho parecer fracassada.
        const processados = stats.SENT + stats.FAILED;
        const taxa = processados > 0 ? Math.round((stats.SENT / processados) * 100) : null;
        return (
          <div className="flex flex-col gap-0.5 text-xs tabular-nums">
            <span>
              <strong className="text-[#1d1d1b]">{stats.SENT}</strong> efetivos
              {taxa !== null && <span className="text-[#737373]"> ({taxa}%)</span>}
            </span>
            <span className="text-[#737373]">
              {stats.FAILED > 0 ? (
                <span className="text-red-600">{stats.FAILED} falharam</span>
              ) : (
                "0 falharam"
              )}
              {/* Pulado ≠ falhado: é quem a campanha nem tentou (sem telefone,
                  sem e-mail, opt-out). Somar os dois esconderia uma audiência
                  que nunca teve como ser alcançada. */}
              {stats.SKIPPED > 0 && ` · ${stats.SKIPPED} pulados`}
              {stats.PENDING > 0 && ` · ${stats.PENDING} na fila`}
            </span>
          </div>
        );
      },
    },
    {
      header: "Ritmo",
      accessor: (row: Campaign) => (
        <span className="text-xs">
          {row.messagesPerHour}/h · teto {row.dailyCap}/dia · {row.windowStartHour}h–
          {row.windowEndHour}h{row.weekdaysOnly ? " · dias úteis" : ""}
        </span>
      ),
    },
    {
      header: "Próximo envio",
      accessor: (row: Campaign) => (row.nextSendAt ? formatInstantDate(row.nextSendAt) : "—"),
    },
    {
      header: "Ações",
      accessor: (row: Campaign) => (
        <div className="flex gap-2">
          {(row.status === "DRAFT" || row.status === "PAUSED") && (
            <Button size="sm" onClick={() => handleState(row.id, "start")}>
              <Play className="mr-1 h-3.5 w-3.5" /> Disparar
            </Button>
          )}
          {row.status === "RUNNING" && (
            <Button size="sm" variant="outline" onClick={() => handleState(row.id, "pause")}>
              <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
            </Button>
          )}
          {row.status !== "COMPLETED" && row.status !== "CANCELLED" && (
            <Button size="sm" variant="outline" onClick={() => handleState(row.id, "cancel")}>
              <Square className="mr-1 h-3.5 w-3.5" /> Encerrar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Campanhas de ativação"
        description="Disparo para contratantes parados — WhatsApp com ritmo controlado, e-mail para quem não tem telefone."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCreatingFromSheet(true)}
              data-testid="new-sheet-campaign"
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Nova campanha por planilha
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nova campanha
            </Button>
          </div>
        }
      />

      {/* Sem esse aviso, uma campanha "Disparando" sem nada saindo vira uma hora
          de investigação até alguém lembrar da env. */}
      {campaigns.data && !campaigns.data.schedulerEnabled && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O agendador está <strong>desligado</strong> (<code>ACTIVATION_CAMPAIGNS_ENABLED</code>{" "}
            não está como <code>true</code> em produção). Você pode criar e iniciar campanhas, mas
            nenhuma mensagem vai sair.
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={campaigns.data?.data ?? []}
        isFetching={campaigns.isFetching}
        searchPlaceholder="Buscar campanha…"
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
            <DialogDescription>
              A audiência é congelada agora. A campanha nasce parada — nada dispara até você mandar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Reativação contratantes — ago/2026"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Quem recebe</Label>
              <select
                id="audience"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={form.audience}
                onChange={(event) => {
                  const audience = event.target.value as CampaignAudience;
                  // Trocar a audiência invalida cidade, raio e contagem: as
                  // cidades da lista antiga podem nem existir na nova. E o tipo
                  // de conta some da tela para freelancer — sem limpar, ficaria
                  // um filtro invisível recortando a audiência.
                  setForm({
                    ...form,
                    audience,
                    cities: [],
                    raioCidade: "",
                    modules: audience.startsWith("CONTRACTORS_") ? form.modules : [],
                  });
                  setContagem(null);
                }}
              >
                {(Object.keys(AUDIENCE_LABELS) as CampaignAudience[]).map((key) => (
                  <option key={key} value={key}>
                    {AUDIENCE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            {mostraTipoDeConta && (
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MODULE_LABELS) as Array<keyof typeof MODULE_LABELS>).map((mod) => {
                    const on = form.modules.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            modules: on
                              ? form.modules.filter((m) => m !== mod)
                              : [...form.modules, mod],
                          });
                          setContagem(null);
                        }}
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
                <p className="text-xs text-neutral-500">Nenhum marcado = os dois.</p>
              </div>
            )}

            {/* Raio a partir de uma cidade. Alternativa à lista: quem mora na
                cidade vizinha é a mesma praça para efeito de deslocamento. */}
            <div className="space-y-2">
              <Label>Raio a partir de uma cidade</Label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-52 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  value={form.raioCidade}
                  onChange={(event) => {
                    setForm({ ...form, raioCidade: event.target.value, cities: [] });
                    setContagem(null);
                  }}
                >
                  <option value="">Sem raio (usar a lista de cidades)</option>
                  {(audienceOptions.data?.cities ?? []).map((opt) => (
                    <option key={`${opt.city}-${opt.uf ?? ""}`} value={opt.city}>
                      {opt.city}
                      {opt.uf ? ` · ${opt.uf}` : ""}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={2000}
                    className="w-24"
                    value={form.raioKm}
                    disabled={!form.raioCidade}
                    onChange={(event) => {
                      setForm({ ...form, raioKm: Number(event.target.value) });
                      setContagem(null);
                    }}
                  />
                  <span className="text-sm text-neutral-600">km</span>
                </div>
              </div>
              {form.raioCidade && (
                <p className="text-xs text-neutral-500">
                  O centro é calculado pelos cadastros da própria cidade. Quem não tem
                  endereço com coordenada fica de fora — o botão Contar mostra quantos são.
                </p>
              )}
            </div>

            {!form.raioCidade && (
            <div className="space-y-2">
              <Label>
                Cidades{" "}
                <span className="font-normal text-neutral-500">
                  {form.cities.length ? `(${form.cities.length} escolhida${form.cities.length === 1 ? "" : "s"})` : "(nenhuma = todas)"}
                </span>
              </Label>
              {audienceOptions.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Levantando as cidades desta
                  audiência…
                </div>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-neutral-200 p-2">
                  {(audienceOptions.data?.cities ?? []).length === 0 ? (
                    <p className="text-sm text-neutral-500">Nenhuma cidade nesta audiência.</p>
                  ) : (
                    audienceOptions.data!.cities.map((opt) => {
                      const on = form.cities.includes(opt.city);
                      return (
                        <button
                          key={`${opt.city}-${opt.uf ?? ""}`}
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              cities: on
                                ? form.cities.filter((c) => c !== opt.city)
                                : [...form.cities, opt.city],
                            });
                            setContagem(null);
                          }}
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
            </div>
            )}

            {/* Contar ANTES de criar: a audiência é congelada na criação, então
                errar o recorte significa apagar a campanha e refazer. */}
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
                    <span className="text-neutral-600">
                      Confira quantos entram antes de criar.
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewAudience.isPending}
                  onClick={async () => {
                    try {
                      const res = await previewAudience.mutateAsync({
                        audience: form.audience,
                        filters: montarFiltros(form),
                      });
                      setContagem({
                        total: res.total,
                        whatsapp: res.byChannel.WHATSAPP,
                        semCoordenada: res.semCoordenada ?? 0,
                      });
                    } catch (error) {
                      toast.error(getAxiosErrorMessage(error));
                    }
                  }}
                >
                  {previewAudience.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Contar"
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rate">Mensagens por hora</Label>
                <Input
                  id="rate"
                  type="number"
                  min={1}
                  max={60}
                  value={form.messagesPerHour}
                  onChange={(event) =>
                    setForm({ ...form, messagesPerHour: Number(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap">Teto por dia</Label>
                <Input
                  id="cap"
                  type="number"
                  min={1}
                  max={1000}
                  value={form.dailyCap}
                  onChange={(event) => setForm({ ...form, dailyCap: Number(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Começa às (BRT)</Label>
                <Input
                  id="start"
                  type="number"
                  min={0}
                  max={23}
                  value={form.windowStartHour}
                  onChange={(event) =>
                    setForm({ ...form, windowStartHour: Number(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Termina às (BRT)</Label>
                <Input
                  id="end"
                  type="number"
                  min={1}
                  max={24}
                  value={form.windowEndHour}
                  onChange={(event) =>
                    setForm({ ...form, windowEndHour: Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.weekdaysOnly}
                onChange={(event) => setForm({ ...form, weekdaysOnly: event.target.checked })}
              />
              Só em dias úteis
            </label>

            {form.messagesPerHour > 30 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Acima de 30 por hora o risco de o número ser banido cresce muito — e é o mesmo
                  número da confirmação de vaga, do código de check-in e do suporte.
                </span>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">O que vai ser enviado</p>
              <p className="mb-2 text-xs text-neutral-500">
                Três variantes rodam alternadas, personalizadas com nome e cidade — mensagens
                idênticas em série é o que caracteriza spam.
              </p>
              <div className="space-y-2">
                {(preview.data ?? []).map((message, index) => (
                  <pre
                    key={index}
                    className="whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs"
                  >
                    {message}
                  </pre>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Voltar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || createCampaign.isPending}
            >
              {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar (sem disparar)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExternalListDialog
        open={creatingFromSheet}
        onOpenChange={setCreatingFromSheet}
        onCreated={(created) => {
          toast.success(
            `Campanha criada com ${created.stats.PENDING} destinatários — ${created.estimate.days} dia(s) úteis no ritmo escolhido.`,
          );
          setCreatingFromSheet(false);
          setSelectedId(created.campaign.id);
        }}
      />

      <CampaignDetailDialog campaignId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

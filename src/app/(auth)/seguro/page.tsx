"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { FinanceiroCard } from "./_components/financeiro-card";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate, formatInstantDateTime } from "@/lib/date.utils";
import {
  useInsuranceCoverage,
  useInsuranceCoverages,
  useInsuranceHealthChecks,
  useInsuranceStatus,
  useRunHealthCheck,
} from "@/modules/admin/application/use-admin-insurance";
import type {
  Coverage,
  CoverageStatus,
  HealthCheck,
  HealthStep,
  HealthStepStatus,
  IzaEnvironment,
} from "@/modules/admin/infrastructure/insurance-api";

const STATUS_LABEL: Record<CoverageStatus, string> = {
  PENDING_OPEN: "Abrindo",
  OPEN: "Coberto agora",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
  UNINSURABLE: "Não segurável",
};

const STATUS_VARIANT: Record<CoverageStatus, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  PENDING_OPEN: "warning",
  OPEN: "success",
  CLOSED: "outline",
  CANCELLED: "secondary",
  FAILED: "destructive",
  UNINSURABLE: "secondary",
};

const MOTIVO_LABEL: Record<string, string> = {
  NO_CPF: "sem CPF no cadastro",
  BAD_CPF: "CPF recusado pela IZA",
  AGE: "idade fora da apólice",
  WINDOW: "fora da janela permitida",
  CANCELLED_BEFORE_OPEN: "vaga cancelada antes de abrir",
};

const MODULE_LABEL: Record<string, string> = {
  "bars-restaurants": "Empresa",
  "home-services": "Em Casa",
};

/**
 * A IZA devolve os horários com sufixo `Z`, mas o valor é hora LOCAL de Brasília
 * — `12:00:06Z` na resposta dela quer dizer meio-dia aqui. Passar isso por
 * `new Date()` subtrairia 3 h e mostraria um horário que nunca existiu. Por isso
 * este formatador lê os dígitos e não faz conta de fuso nenhuma.
 */
function formatIzaWallClock(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return value;
  const [, ano, mes, dia, hora, minuto] = match;
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

function formatDuracao(minutos: number | null): string {
  if (minutos === null) return "—";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}

function maskCpf(document: string | null): string {
  if (!document || document.length < 11) return "—";
  return `${document.slice(0, 3)}.***.***-${document.slice(-2)}`;
}

// ─── Cabeçalho de conexão ───────────────────────────────────────────────────

const AMBIENTE: Record<
  IzaEnvironment,
  { titulo: string; texto: string; classe: string; Icone: typeof ShieldCheck }
> = {
  PRODUCTION: {
    titulo: "Conectado à IZA em produção",
    texto: "As apólices emitidas aqui são reais.",
    classe: "border-green-200 bg-green-50 text-green-900",
    Icone: ShieldCheck,
  },
  HOMOLOGATION: {
    titulo: "Ligado, mas apontando para homologação",
    texto:
      "Tudo responde normalmente e NINGUÉM está segurado de verdade — as apólices são de teste.",
    classe: "border-red-200 bg-red-50 text-red-900",
    Icone: ShieldAlert,
  },
  DISABLED: {
    titulo: "Seguro desligado",
    texto: "Nenhuma cobertura está sendo criada para os serviços em andamento.",
    classe: "border-neutral-200 bg-neutral-50 text-neutral-800",
    Icone: ShieldOff,
  },
};

const PASSO_ICONE: Record<HealthStepStatus, { Icone: typeof CheckCircle2; classe: string }> = {
  ok: { Icone: CheckCircle2, classe: "text-green-600" },
  falha: { Icone: XCircle, classe: "text-red-600" },
  alerta: { Icone: AlertTriangle, classe: "text-amber-500" },
  pulado: { Icone: MinusCircle, classe: "text-neutral-400" },
};

function PassosDoTeste({ steps }: { steps: HealthStep[] }) {
  if (!steps.length) {
    return <p className="text-sm text-[#737373]">Nenhum teste registrado ainda.</p>;
  }
  return (
    <ul className="space-y-2">
      {steps.map((step) => {
        const { Icone, classe } = PASSO_ICONE[step.status];
        return (
          <li key={step.key} className="flex gap-2">
            <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${classe}`} />
            <div>
              <p className="text-sm font-medium text-[#1d1d1b]">{step.label}</p>
              <p className="text-xs text-[#737373]">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function SeguroPage() {
  const { isChecking, allowed } = useAreaGuard("INSURANCE");

  const [filtros, setFiltros] = useState({
    status: "",
    module: "",
    search: "",
    from: "",
    to: "",
    page: 1,
  });
  const [coberturaAberta, setCoberturaAberta] = useState<string | null>(null);
  const [aba, setAba] = useState("coberturas");

  const status = useInsuranceStatus();
  const coberturas = useInsuranceCoverages({ ...filtros, pageSize: 20 });
  const testes = useInsuranceHealthChecks(30);
  const detalhe = useInsuranceCoverage(coberturaAberta);
  const rodarTeste = useRunHealthCheck();

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const config = status.data?.config;
  const ultimoTeste = status.data?.ultimoTeste ?? null;
  const ambiente = config ? AMBIENTE[config.environment] : null;

  const executarTeste = async () => {
    try {
      const resultado = await rodarTeste.mutateAsync();
      if (resultado.ok) toast.success("Comunicação com a IZA está saudável.");
      else toast.error("O teste encontrou problemas — veja as etapas abaixo.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível rodar o teste."));
    }
  };

  const atualizarFiltro = (campo: string, valor: string) =>
    setFiltros((atual) => ({ ...atual, [campo]: valor, page: 1 }));

  return (
    <div>
      <PageHeader
        title="Seguro IZA"
        description="Estado da integração, teste diário de comunicação e a cobertura de cada vaga."
        action={
          <Button onClick={executarTeste} disabled={rodarTeste.isPending}>
            {rodarTeste.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Testar agora
          </Button>
        }
      />

      {status.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : !status.data || !config || !ambiente ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Não foi possível carregar o estado do seguro.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Conexão */}
          <div className={`rounded-lg border p-4 ${ambiente.classe}`}>
            <div className="flex items-start gap-3">
              <ambiente.Icone className="mt-0.5 h-6 w-6 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{ambiente.titulo}</p>
                <p className="text-sm">{ambiente.texto}</p>
                <p className="mt-2 font-mono text-xs opacity-70">{config.baseUrl}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Último teste */}
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-[#1d1d1b]">Último teste de comunicação</h2>
                {ultimoTeste ? (
                  <Badge variant={ultimoTeste.ok ? "success" : "destructive"}>
                    {ultimoTeste.ok ? "Saudável" : "Com problema"}
                  </Badge>
                ) : null}
              </div>
              {ultimoTeste ? (
                <>
                  <p className="mb-3 text-xs text-[#737373]">
                    {formatInstantDateTime(ultimoTeste.checkedAt)} ·{" "}
                    {ultimoTeste.source === "MANUAL" ? "manual" : "automático"}
                    {ultimoTeste.latencyMs !== null ? ` · ${ultimoTeste.latencyMs} ms` : ""}
                  </p>
                  <PassosDoTeste steps={ultimoTeste.steps} />
                </>
              ) : (
                <p className="text-sm text-[#737373]">
                  Nenhum teste rodou ainda. O automático roda todo dia às 8h; o botão acima roda na
                  hora.
                </p>
              )}
            </div>

            {/* Configuração */}
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <h2 className="mb-3 font-semibold text-[#1d1d1b]">Como está configurado</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#737373]">Criação de coberturas</dt>
                  <dd>{config.openEnabled ? "ligada" : "desligada"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#737373]">Credencial</dt>
                  <dd>
                    {config.tokenConfigured
                      ? `configurada (${config.tokenLength} caracteres)`
                      : "ausente"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#737373]">Trajeto de ida antes do turno</dt>
                  <dd>{config.travelPreMinutes} min</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#737373]">Alerta por e-mail</dt>
                  <dd className="truncate">{config.alertEmail ?? "não configurado"}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-[#e5e5e5] pt-3">
                <p className="mb-2 text-xs font-medium text-[#737373]">
                  Freelancers cadastrados na IZA
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(status.data.cadastros).map(([estado, total]) => (
                    <Badge key={estado} variant="outline">
                      {estado}: {total}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div>
            <h2 className="mb-1 font-semibold text-[#1d1d1b]">
              O que merece atenção{" "}
              <span className="text-xs font-normal text-[#737373]">(últimos 30 dias)</span>
            </h2>
            {/* Sem esta linha, alguém que lembra dos números antigos acha que
                sumiu dado. O que sumiu foi ficção: até a virada o sistema
                falava com a homologação e nenhuma apólice era real. */}
            <p className="mb-3 text-xs text-[#737373]">
              Contando a partir de {formatInstantDate(status.data.contandoDesde)}, quando a
              operação passou a valer. O que veio antes rodou contra a homologação — as
              apólices daquele período não eram reais e ficam de fora de toda conta desta
              tela.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...status.data.alertas]
                .sort((a, b) => (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0))
                .map((alerta) => {
                  const ativo = alerta.total > 0;
                  const cor =
                    !ativo
                      ? "border-[#e5e5e5] bg-white"
                      : alerta.severity === "critico"
                        ? "border-red-200 bg-red-50"
                        : alerta.severity === "atencao"
                          ? "border-amber-200 bg-amber-50"
                          : "border-[#e5e5e5] bg-white";
                  return (
                    <div key={alerta.key} className={`rounded-lg border p-3 ${cor}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-[#1d1d1b]">{alerta.label}</p>
                        <span className="text-xl font-bold text-[#1d1d1b]">{alerta.total}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#737373]">{alerta.detail}</p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Contadores */}
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
            <h2 className="mb-3 font-semibold text-[#1d1d1b]">Coberturas por período</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Hoje", status.data.janelas.hoje],
                  ["7 dias", status.data.janelas.seteDias],
                  ["30 dias", status.data.janelas.trintaDias],
                ] as const
              ).map(([rotulo, dados]) => {
                const total = Object.values(dados).reduce((soma, n) => soma + n, 0);
                return (
                  <div key={rotulo}>
                    <p className="text-xs uppercase tracking-wide text-[#737373]">{rotulo}</p>
                    <p className="text-2xl font-bold text-[#1d1d1b]">{total}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(dados).map(([chave, valor]) => (
                        <Badge
                          key={chave}
                          variant={STATUS_VARIANT[chave as CoverageStatus] ?? "outline"}
                        >
                          {STATUS_LABEL[chave as CoverageStatus] ?? chave}: {valor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financeiro: o que essas coberturas custam e se o mês paga o piso. */}
          <FinanceiroCard />

          {/* Listas */}
          <Tabs value={aba} onValueChange={setAba}>
            <TabsList>
              <TabsTrigger value="coberturas">Cobertura por vaga</TabsTrigger>
              <TabsTrigger value="testes">Testes diários</TabsTrigger>
            </TabsList>

            <TabsContent value="coberturas" className="mt-4">
              <DataTable<Coverage>
                data={coberturas.data?.items ?? []}
                isFetching={coberturas.isFetching}
                controlledSearch={{
                  value: filtros.search,
                  onChange: (v) => atualizarFiltro("search", v),
                }}
                searchPlaceholder="Buscar por nome do freelancer ou CPF..."
                filters={
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label className="text-xs">Situação</Label>
                      <NativeSelect
                        value={filtros.status}
                        onChange={(e) => atualizarFiltro("status", e.target.value)}
                        className="w-44"
                      >
                        <option value="">Todas</option>
                        {Object.entries(STATUS_LABEL).map(([chave, rotulo]) => (
                          <option key={chave} value={chave}>
                            {rotulo}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <NativeSelect
                        value={filtros.module}
                        onChange={(e) => atualizarFiltro("module", e.target.value)}
                        className="w-36"
                      >
                        <option value="">Todos</option>
                        <option value="bars-restaurants">Empresa</option>
                        <option value="home-services">Em Casa</option>
                      </NativeSelect>
                    </div>
                    <div>
                      <Label className="text-xs">De</Label>
                      <Input
                        type="date"
                        value={filtros.from}
                        onChange={(e) => atualizarFiltro("from", e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Até</Label>
                      <Input
                        type="date"
                        value={filtros.to}
                        onChange={(e) => atualizarFiltro("to", e.target.value)}
                        className="w-40"
                      />
                    </div>
                  </div>
                }
                columns={[
                  {
                    header: "Serviço",
                    accessor: (row) => (
                      <div>
                        <p className="font-medium text-[#1d1d1b]">
                          {row.vacancy?.serviceType || row.vacancy?.title || "Vaga removida"}
                        </p>
                        <p className="text-xs text-[#737373]">
                          {row.vacancy?.contractorName ?? "—"} · {MODULE_LABEL[row.module]}
                        </p>
                      </div>
                    ),
                  },
                  {
                    header: "Freelancer",
                    accessor: (row) => (
                      <div>
                        <p className="text-[#1d1d1b]">{row.providerName ?? "—"}</p>
                        <p className="text-xs text-[#737373]">{maskCpf(row.document)}</p>
                      </div>
                    ),
                  },
                  {
                    header: "Turno previsto",
                    accessor: (row) => (
                      <span className="text-xs">{formatInstantDateTime(row.plannedStartAt)}</span>
                    ),
                    sortAccessor: (row) => row.plannedStartAt,
                  },
                  {
                    header: "Situação",
                    accessor: (row) => (
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </Badge>
                        {row.uninsurableReason ? (
                          <span className="text-xs text-[#737373]">
                            {MOTIVO_LABEL[row.uninsurableReason] ?? row.uninsurableReason}
                          </span>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    header: "Tempo coberto",
                    accessor: (row) => (
                      <div>
                        <span className="text-sm">{formatDuracao(row.duracaoMinutos)}</span>
                        {row.apoliceCurta ? (
                          <p className="text-xs font-medium text-red-600">
                            fechou cedo demais
                          </p>
                        ) : null}
                      </div>
                    ),
                    sortAccessor: (row) => row.duracaoMinutos ?? -1,
                  },
                  {
                    header: "",
                    accessor: (row) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCoberturaAberta(row.id)}
                      >
                        Detalhes
                      </Button>
                    ),
                  },
                ]}
                footer={
                  <div className="flex items-center justify-between text-sm text-[#737373]">
                    <span>
                      {coberturas.data?.total ?? 0} cobertura(s) · página {filtros.page}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={filtros.page <= 1}
                        onClick={() => setFiltros((a) => ({ ...a, page: a.page - 1 }))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(coberturas.data?.items.length ?? 0) < 20}
                        onClick={() => setFiltros((a) => ({ ...a, page: a.page + 1 }))}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                }
              />
            </TabsContent>

            <TabsContent value="testes" className="mt-4">
              <DataTable<HealthCheck>
                data={testes.data ?? []}
                isFetching={testes.isFetching}
                columns={[
                  {
                    header: "Quando",
                    accessor: (row) => formatInstantDateTime(row.checkedAt),
                    sortAccessor: (row) => row.checkedAt,
                  },
                  {
                    header: "Origem",
                    accessor: (row) => (row.source === "MANUAL" ? "Manual" : "Automático"),
                  },
                  {
                    header: "Resultado",
                    accessor: (row) => (
                      <Badge variant={row.ok ? "success" : "destructive"}>
                        {row.ok ? "Saudável" : "Com problema"}
                      </Badge>
                    ),
                  },
                  {
                    header: "Ambiente",
                    accessor: (row) =>
                      row.environment === "PRODUCTION"
                        ? "Produção"
                        : row.environment === "HOMOLOGATION"
                          ? "Homologação"
                          : "Desligado",
                  },
                  {
                    header: "Resposta",
                    accessor: (row) => (row.latencyMs !== null ? `${row.latencyMs} ms` : "—"),
                  },
                  {
                    header: "O que falhou",
                    accessor: (row) => {
                      const falhas = row.steps.filter((s) => s.status === "falha");
                      if (!falhas.length) return <span className="text-[#737373]">—</span>;
                      return (
                        <span className="text-xs text-red-700">
                          {falhas.map((s) => s.label).join(" · ")}
                        </span>
                      );
                    },
                  },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Detalhe */}
      <Dialog open={Boolean(coberturaAberta)} onOpenChange={(open) => !open && setCoberturaAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cobertura da vaga</DialogTitle>
            <DialogDescription>
              O que gravamos aqui e o que a IZA responde sobre esse CPF agora.
            </DialogDescription>
          </DialogHeader>

          {detalhe.isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
            </div>
          ) : !detalhe.data ? (
            <p className="text-sm text-[#737373]">Não foi possível carregar o detalhe.</p>
          ) : (
            <div className="space-y-5">
              {detalhe.data.apoliceCurta ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <p className="font-medium">
                    Esta apólice durou {formatDuracao(detalhe.data.duracaoMinutos)}.
                  </p>
                  <p>
                    O turno previsto ia até {formatInstantDateTime(detalhe.data.plannedEndAt)} — a
                    cobertura foi encerrada muito antes do fim do serviço.
                  </p>
                </div>
              ) : null}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Vaga</h3>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <Linha rotulo="Serviço" valor={detalhe.data.vacancy?.serviceType ?? detalhe.data.vacancy?.title ?? "—"} />
                  <Linha rotulo="Contratante" valor={detalhe.data.vacancy?.contractorName ?? "—"} />
                  <Linha rotulo="Tipo" valor={MODULE_LABEL[detalhe.data.module]} />
                  <Linha rotulo="Local" valor={detalhe.data.vacancy?.local ?? "—"} />
                  <Linha rotulo="Freelancer" valor={detalhe.data.providerName ?? "—"} />
                  <Linha rotulo="CPF" valor={maskCpf(detalhe.data.document)} />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">
                  O que o sistema registrou
                </h3>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <Linha
                    rotulo="Situação"
                    valor={STATUS_LABEL[detalhe.data.status] ?? detalhe.data.status}
                  />
                  <Linha
                    rotulo="Turno previsto"
                    valor={`${formatInstantDateTime(detalhe.data.plannedStartAt)} → ${formatInstantDateTime(detalhe.data.plannedEndAt)}`}
                  />
                  <Linha
                    rotulo="Cobertura aberta em"
                    valor={detalhe.data.sentStartedAt ? formatInstantDateTime(detalhe.data.sentStartedAt) : "—"}
                  />
                  <Linha
                    rotulo="Cobertura encerrada em"
                    valor={detalhe.data.sentFinishedAt ? formatInstantDateTime(detalhe.data.sentFinishedAt) : "—"}
                  />
                  <Linha rotulo="Tempo coberto" valor={formatDuracao(detalhe.data.duracaoMinutos)} />
                  <Linha rotulo="Período na IZA" valor={detalhe.data.izaPeriodId ?? "—"} />
                  <Linha rotulo="Tentativas" valor={String(detalhe.data.attempts)} />
                  <Linha
                    rotulo="Trajeto de ida avisado em"
                    valor={detalhe.data.trajeto ? formatInstantDateTime(detalhe.data.trajeto.sentAt) : "não avisado"}
                  />
                </dl>
                {detalhe.data.lastError ? (
                  <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    Último erro: {detalhe.data.lastError}
                  </p>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">
                  Cadastro do freelancer na IZA
                </h3>
                {detalhe.data.cadastro ? (
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <Linha rotulo="Estado" valor={detalhe.data.cadastro.state} />
                    <Linha rotulo="Pessoa (IZA)" valor={detalhe.data.cadastro.izaPersonId ?? "—"} />
                    <Linha rotulo="Contrato (IZA)" valor={detalhe.data.cadastro.izaContractId ?? "—"} />
                    <Linha
                      rotulo="Atualizado em"
                      valor={formatInstantDateTime(detalhe.data.cadastro.updatedAt)}
                    />
                  </dl>
                ) : (
                  <p className="text-sm text-[#737373]">
                    Este freelancer nunca foi cadastrado na IZA.
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1d1d1b]">
                    O que a IZA responde agora
                  </h3>
                  <span className="text-xs text-[#737373]">
                    consultado {formatInstantDateTime(detalhe.data.iza.consultadoEm)}
                  </span>
                </div>

                {detalhe.data.iza.erro ? (
                  <p className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                    {detalhe.data.iza.erro}
                  </p>
                ) : null}

                {detalhe.data.iza.pessoa ? (
                  <div className="mb-3">
                    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      <Linha rotulo="Segurado" valor={detalhe.data.iza.pessoa.nome ?? "—"} />
                      <Linha rotulo="Id na IZA" valor={detalhe.data.iza.pessoa.id ?? "—"} />
                    </dl>
                    {detalhe.data.iza.pessoa.contratos.length ? (
                      <div className="mt-2 space-y-1">
                        {detalhe.data.iza.pessoa.contratos.map((contrato) => (
                          <p key={contrato.id} className="text-xs text-[#737373]">
                            Apólice {contrato.nome ?? contrato.id} ·{" "}
                            <span className="font-medium">{contrato.status ?? "sem status"}</span>
                            {contrato.inicio ? ` · desde ${contrato.inicio}` : ""}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-red-700">
                        A IZA não devolveu nenhuma apólice para este CPF.
                      </p>
                    )}
                  </div>
                ) : !detalhe.data.iza.erro ? (
                  <p className="mb-3 text-sm text-red-700">
                    A IZA não conhece este CPF — nenhuma apólice foi emitida para esta pessoa.
                  </p>
                ) : null}

                <p className="mb-1 text-xs font-medium text-[#737373]">
                  Períodos no dia do serviço
                </p>
                {detalhe.data.iza.periodos.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                          <th className="py-1 pr-3">Tipo</th>
                          <th className="py-1 pr-3">Situação</th>
                          <th className="py-1 pr-3">Início</th>
                          <th className="py-1">Fim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhe.data.iza.periodos.map((periodo) => (
                          <tr key={periodo.id} className="border-b border-[#f5f5f5]">
                            <td className="py-1 pr-3">{periodo.tipoLabel}</td>
                            <td className="py-1 pr-3">{periodo.statusLabel}</td>
                            <td className="py-1 pr-3">{formatIzaWallClock(periodo.inicio)}</td>
                            <td className="py-1">{formatIzaWallClock(periodo.fim)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-[#737373]">
                      O plano Diárias encerra o período no fim do dia por conta própria — por isso o
                      fim costuma aparecer como 23:59, e não no horário do check-out.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[#737373]">
                    Nenhum período registrado na IZA para este CPF neste dia.
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f5f5f5] py-1">
      <dt className="shrink-0 text-[#737373]">{rotulo}</dt>
      <dd className="truncate text-right text-[#1d1d1b]">{valor}</dd>
    </div>
  );
}

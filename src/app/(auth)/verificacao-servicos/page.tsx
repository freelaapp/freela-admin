"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, MessagesSquare, RefreshCw, Send, Smartphone, Star, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDateTime } from "@/lib/date.utils";
import {
  useAttendanceFlows,
  useResolveAttendance,
  useSendAdminAlertTest,
  useSystemHealth,
} from "@/modules/admin/application/use-admin-system-health";
import {
  useSendWhatsAppChipTest,
  useWhatsAppChips,
} from "@/modules/admin/application/use-admin-whatsapp-chips";
import {
  chipStatus,
  describeChipTest,
  type WhatsAppChip,
} from "@/modules/admin/infrastructure/whatsapp-chips-api";
import {
  channelLabel,
  formatAgo,
  statusLabel,
  statusTone,
  toneClasses,
  type HealthTone,
} from "@/modules/admin/application/system-health-presentation";
import {
  describeAlertTest,
  type AdminAlertChannelStatus,
  type AttendanceFlowItem,
  type AttendanceOutcome,
  type ChannelHealth,
  type ProviderHealth,
  type SchedulerHealth,
} from "@/modules/admin/infrastructure/system-health-api";

const PROVIDER_LABEL: Record<string, string> = {
  "whatsapp-bridge": "WhatsApp (bridge)",
  ses: "E-mail (SES)",
  openpix: "OpenPix",
  asaas: "Asaas",
  database: "Banco de dados",
};

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  PENDING_CONTRACTOR_CONFIRMATION: "Aguardando contratante",
  PENDING_PROVIDER_CONFIRMATION: "Aguardando freelancer",
  SUPPORT_TICKET_REQUESTED: "Com o suporte",
};

type LinhaContestacao = AttendanceFlowItem & { id: string };

const BADGE_VARIANT: Record<HealthTone, "success" | "warning" | "destructive" | "outline"> = {
  ok: "success",
  warn: "warning",
  down: "destructive",
  idle: "outline",
};

function quando(iso: string | null | undefined): string {
  return iso ? formatInstantDateTime(iso) : "—";
}

// ─── Pedaços ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge variant={BADGE_VARIANT[statusTone(status)]}>{statusLabel(status)}</Badge>;
}

function ChannelCard({ canal }: { canal: ChannelHealth }) {
  const tone = statusTone(canal.status);
  const total = canal.last24h.sent + canal.last24h.failed;
  return (
    <div className={`rounded-lg border p-4 ${toneClasses(tone).card}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold">{channelLabel(canal.channel)}</p>
        <StatusBadge status={canal.status} />
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {canal.last24h.sent}
        <span className="ml-1 text-sm font-normal opacity-70">enviados</span>
      </p>
      <p className="text-sm tabular-nums">
        {canal.last24h.failed} falhas
        {total > 0 && (
          <span className="opacity-70"> · {Math.round((canal.last24h.failed / total) * 100)} %</span>
        )}
        <span className="opacity-70"> nas últimas 24 h</span>
      </p>
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="opacity-70">Último sucesso</dt>
          <dd className="tabular-nums">{quando(canal.lastSuccessAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-70">Última falha</dt>
          <dd className="tabular-nums">{quando(canal.lastFailure?.at)}</dd>
        </div>
      </dl>
      {canal.lastFailure && (
        <p
          className="mt-2 truncate font-mono text-[11px] opacity-80"
          title={[canal.lastFailure.kind, canal.lastFailure.error].filter(Boolean).join(" — ")}
        >
          {canal.lastFailure.kind && <span className="font-semibold">{canal.lastFailure.kind}: </span>}
          {canal.lastFailure.error ?? "sem detalhe do erro"}
        </p>
      )}
    </div>
  );
}

/**
 * Para onde vão os avisos da equipe (vaga nova, assinatura, suporte). Verde =
 * grupo achado no WhatsApp; vermelho = grupo configurado mas não resolvido;
 * amarelo = caminho antigo por telefones pessoais.
 */
function AdminAlertChannelCard({ canal }: { canal: AdminAlertChannelStatus }) {
  const { isSuperAdmin } = useAuth();
  const teste = useSendAdminAlertTest();

  const porGrupo = canal.mode === "group" && canal.group !== null;
  const tone: HealthTone = porGrupo ? (canal.group?.resolved ? "ok" : "down") : "warn";
  const rotulo = porGrupo ? "Grupo de WhatsApp" : "Telefones pessoais";
  const badge = porGrupo ? (canal.group?.resolved ? "Operando" : "Grupo não encontrado") : "Caminho antigo";

  const enviarTeste = async () => {
    try {
      const resultado = await teste.mutateAsync();
      const { tone: resultadoTone, message } = describeAlertTest(resultado);
      if (resultadoTone === "success") toast.success(message);
      else if (resultadoTone === "warning") toast.warning(message);
      else toast.error(message);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível enviar o teste."));
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClasses(tone).card}`} data-testid="admin-alert-channel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <MessagesSquare className="h-4 w-4" />
          Avisos internos (equipe)
        </p>
        <Badge variant={BADGE_VARIANT[tone]}>{badge}</Badge>
      </div>
      <p className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        {rotulo}
        {porGrupo ? (
          <span className="ml-1 font-normal">&ldquo;{canal.group?.name}&rdquo;</span>
        ) : (
          <span className="ml-1 font-normal tabular-nums">({canal.phones})</span>
        )}
      </p>
      <p className="mt-1 text-xs opacity-80">
        {porGrupo
          ? canal.group?.resolved
            ? "Vaga nova, assinatura e suporte caem neste grupo."
            : (canal.group?.error ?? "O nome configurado em ADMIN_ALERT_GROUP não existe no WhatsApp.")
          : canal.phones > 0
            ? "Cada aviso vira uma mensagem por pessoa. Configure ADMIN_ALERT_GROUP para mandar ao grupo."
            : "Nenhum telefone nas envs *_ALERT_PHONES. Configure ADMIN_ALERT_GROUP para mandar ao grupo."}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full bg-white/70"
        onClick={enviarTeste}
        disabled={teste.isPending || !isSuperAdmin}
        title={isSuperAdmin ? "Manda \"Teste do canal de avisos da Freela\" pelo caminho real" : "Só o Super Admin pode disparar o teste"}
      >
        {teste.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Enviar teste
      </Button>
    </div>
  );
}

/** Número padrão do teste (suporte da Freela) — editável antes de disparar. */
const DEFAULT_TEST_PHONE = "11915375766";

/**
 * Um número de WhatsApp: transacional (automáticas) ou campanha (tráfego pago).
 * Verde = conectado; vermelho = desconectado; cinza = não configurado (a campanha
 * cai no transacional). O botão abre um campo de telefone (default editável) e
 * dispara 1 mensagem de teste PELO número do card.
 */
function WhatsAppChipCard({ chip }: { chip: WhatsAppChip }) {
  const { isSuperAdmin } = useAuth();
  const teste = useSendWhatsAppChipTest();
  const [aberto, setAberto] = useState(false);
  const [telefone, setTelefone] = useState(DEFAULT_TEST_PHONE);

  const { tone, label } = chipStatus(chip);

  const enviar = async () => {
    if (!telefone.trim()) {
      toast.error("Informe um telefone para o teste.");
      return;
    }
    try {
      const resultado = await teste.mutateAsync({ chip: chip.key, to: telefone });
      const { tone: resultadoTone, message } = describeChipTest(resultado, chip.label);
      if (resultadoTone === "success") {
        toast.success(message);
        setAberto(false);
      } else {
        toast.error(message);
      }
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível enviar o teste."));
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 ${toneClasses(tone).card}`}
      data-testid={`whatsapp-chip-${chip.key}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-4 w-4" />
          {chip.label}
        </p>
        <Badge variant={BADGE_VARIANT[tone]}>{label}</Badge>
      </div>

      <p className="text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
        {chip.phone ? (
          <span className="tabular-nums">{chip.phone}</span>
        ) : (
          <span className="font-normal opacity-70">
            {chip.sameAsTransactional ? "Usa o número transacional" : "Sem número conectado"}
          </span>
        )}
      </p>

      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="opacity-70">Instância</dt>
          <dd className="font-mono">{chip.instanceIdMasked ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="opacity-70">Transporte</dt>
          <dd className="font-mono">{chip.provider}</dd>
        </div>
      </dl>

      {chip.error && (
        <p className="mt-2 truncate font-mono text-[11px] opacity-80" title={chip.error}>
          {chip.error}
        </p>
      )}

      <p className="mt-2 text-xs opacity-80">
        {chip.key === "campaign"
          ? chip.sameAsTransactional
            ? "Sem número dedicado: campanhas saem pelo transacional. Configure os *_CAMPAIGN_* para separar."
            : "Campanhas e prospecção (tráfego frio) saem por este número."
          : "Códigos, confirmações, grupos e avisos internos saem por este número."}
      </p>

      {aberto ? (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`teste-${chip.key}`} className="text-xs">
            Enviar teste para (DDD + número)
          </Label>
          <div className="flex gap-2">
            <Input
              id={`teste-${chip.key}`}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="11999998888"
              inputMode="tel"
              disabled={teste.isPending}
              className="bg-white/80"
            />
            <Button size="sm" onClick={enviar} disabled={teste.isPending}>
              {teste.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <button
            type="button"
            className="text-xs underline opacity-70 hover:opacity-100"
            onClick={() => setAberto(false)}
            disabled={teste.isPending}
          >
            cancelar
          </button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full bg-white/70"
          onClick={() => setAberto(true)}
          disabled={!isSuperAdmin}
          title={
            isSuperAdmin
              ? "Dispara 1 mensagem de teste por este número"
              : "Só o Super Admin pode disparar o teste"
          }
        >
          <Send className="mr-2 h-4 w-4" />
          Enviar teste
        </Button>
      )}
    </div>
  );
}

/** Seção "Números de WhatsApp": os dois chips (transacional × campanha). */
function WhatsAppChipsSection() {
  const chips = useWhatsAppChips();
  return (
    <div>
      <div className="mb-3">
        <h2 className="font-semibold text-[#1d1d1b]">Números de WhatsApp</h2>
        <p className="text-xs text-[#737373]">
          A separação dos dois chips: transacional (automáticas — códigos, confirmações, grupos) e
          campanha (tráfego pago). Teste cada um isoladamente.
        </p>
      </div>
      {chips.isLoading ? (
        <div className="flex h-24 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-[#eca826]" />
        </div>
      ) : chips.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {getAxiosErrorMessage(chips.error, "Não foi possível carregar os números de WhatsApp.")}
        </div>
      ) : (chips.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4 text-sm text-[#737373]">
          Nenhum chip retornado pela API.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="whatsapp-chips">
          {(chips.data ?? []).map((chip) => (
            <WhatsAppChipCard key={chip.key} chip={chip} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProvidersTable({ provedores }: { provedores: ProviderHealth[] }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white">
      <div className="border-b border-[#e5e5e5] p-4">
        <h2 className="font-semibold text-[#1d1d1b]">Provedores</h2>
        <p className="text-xs text-[#737373]">
          Cada integração externa consultada de verdade (bridge do WhatsApp, SES, OpenPix, Asaas, banco).
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provedor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Detalhe</TableHead>
            <TableHead className="whitespace-nowrap">Verificado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {provedores.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-[#737373]">
                Nenhum provedor verificado.
              </TableCell>
            </TableRow>
          ) : (
            provedores.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{PROVIDER_LABEL[p.name] ?? p.name}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="max-w-md truncate text-[#737373]" title={p.detail ?? undefined}>
                  {p.detail ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-[#737373]">{quando(p.checkedAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SchedulersTable({ schedulers }: { schedulers: SchedulerHealth[] }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white">
      <div className="border-b border-[#e5e5e5] p-4">
        <h2 className="font-semibold text-[#1d1d1b]">Schedulers</h2>
        <p className="text-xs text-[#737373]">
          Última execução de cada rotina automática. Linha amarela = atrasada (sem rodar há mais de 2× o intervalo).
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rotina</TableHead>
            <TableHead>Último resultado</TableHead>
            <TableHead className="whitespace-nowrap">Terminou em</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedulers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-[#737373]">
                Nenhuma rotina registrou heartbeat ainda.
              </TableCell>
            </TableRow>
          ) : (
            schedulers.map((s) => (
              <TableRow key={s.name} className={s.overdue ? "bg-amber-50 hover:bg-amber-100/60" : undefined}>
                <TableCell className="font-mono text-xs">
                  <span className="inline-flex items-center gap-2">
                    {s.name}
                    {s.overdue && (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Atrasado
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.lastStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-[#737373]">{quando(s.lastFinishedAt)}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs text-red-700" title={s.lastError ?? undefined}>
                  {s.lastError ?? <span className="text-[#a3a3a3]">—</span>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function VerificacaoServicosPage() {
  const { isChecking, allowed } = useAreaGuard("JOBS");

  const health = useSystemHealth();
  const contestacoes = useAttendanceFlows();
  const resolver = useResolveAttendance();

  const [emResolucao, setEmResolucao] = useState<AttendanceFlowItem | null>(null);
  const [decisao, setDecisao] = useState<AttendanceOutcome>("ATTENDED");
  const [nota, setNota] = useState("");

  // Relógio de 1 s para o "atualizado há Xs" — o dado em si só muda a cada 60 s.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const abrirResolucao = (item: AttendanceFlowItem) => {
    setDecisao("ATTENDED");
    setNota("");
    setEmResolucao(item);
  };

  const confirmarResolucao = async () => {
    if (!emResolucao) return;
    try {
      await resolver.mutateAsync({ jobId: emResolucao.jobId, outcome: decisao, note: nota });
      toast.success(
        decisao === "ATTENDED"
          ? "Presença confirmada: job concluído e repasse iniciado."
          : "Falta registrada: estorno e infração aplicados.",
      );
      setEmResolucao(null);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível resolver a contestação."));
    }
  };

  const segundosDesdeAtualizacao = health.dataUpdatedAt
    ? Math.max(0, Math.floor((agora - health.dataUpdatedAt) / 1000))
    : null;

  const dados = health.data;
  const problemas = dados
    ? dados.channels.filter((c) => statusTone(c.status) === "down").length +
      dados.providers.filter((p) => statusTone(p.status) === "down").length +
      dados.schedulers.filter((s) => s.overdue || s.lastStatus === "ERROR").length
    : 0;

  // A tabela quer um `id` por linha; o job é a chave natural do fluxo.
  const itensContestacao: LinhaContestacao[] = (contestacoes.data ?? dados?.attendance.items ?? []).map(
    (item) => ({ ...item, id: item.jobId }),
  );

  return (
    <div>
      <PageHeader
        title="Verificação de serviços"
        description="Canais de aviso, integrações, rotinas automáticas e contestações de presença — o que precisa de olho agora."
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-[#737373]" aria-live="polite">
              {health.isFetching
                ? "atualizando…"
                : segundosDesdeAtualizacao === null
                  ? ""
                  : `atualizado ${formatAgo(segundosDesdeAtualizacao)}`}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                health.refetch();
                contestacoes.refetch();
              }}
              disabled={health.isFetching}
            >
              {health.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
        }
      />

      {health.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : health.isError || !dados ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Não foi possível carregar a verificação de serviços.</p>
          <p className="mt-1">{getAxiosErrorMessage(health.error, "A API não respondeu.")}</p>
          <Button variant="outline" className="mt-3" onClick={() => health.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo */}
          <div
            className={`rounded-lg border p-4 ${
              problemas > 0 ? toneClasses("down").card : toneClasses("ok").card
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className={`mt-0.5 h-6 w-6 shrink-0 ${problemas > 0 ? "" : "opacity-40"}`} />
              <div className="flex-1">
                <p className="font-semibold">
                  {problemas > 0
                    ? `${problemas} ${problemas === 1 ? "item precisa" : "itens precisam"} de atenção`
                    : "Tudo operando"}
                </p>
                <p className="text-sm">
                  Gerado em {quando(dados.generatedAt)} · atualiza sozinho a cada 60 s.
                </p>
              </div>
            </div>
          </div>

          {/* Canais */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dados.channels.map((canal) => (
              <ChannelCard key={canal.channel} canal={canal} />
            ))}
            {dados.adminAlertChannel && <AdminAlertChannelCard canal={dados.adminAlertChannel} />}
          </div>

          {/* Números de WhatsApp (transacional × campanha) */}
          <WhatsAppChipsSection />

          {/* Nota + presença */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Star className="h-5 w-5 text-[#eca826]" />
                <h2 className="font-semibold text-[#1d1d1b]">Nota do sistema (30 d)</h2>
              </div>
              <p className="text-3xl font-bold tabular-nums text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
                {dados.systemScore.avg30d === null || dados.systemScore.avg30d === undefined
                  ? "—"
                  : dados.systemScore.avg30d.toFixed(1)}
                <span className="ml-1 text-base font-normal text-[#737373]">/ 5</span>
              </p>
              <p className="text-sm text-[#737373]">
                {dados.systemScore.count30d} {dados.systemScore.count30d === 1 ? "avaliação" : "avaliações"} nos últimos 30 dias
              </p>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#eca826]" />
                <h2 className="font-semibold text-[#1d1d1b]">Presença em aberto</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Contagem rotulo="Aguardando contratante" valor={dados.attendance.pendingContractor} tone="idle" />
                <Contagem rotulo="Contestadas" valor={dados.attendance.contested} tone="warn" />
                <Contagem rotulo="Com o suporte" valor={dados.attendance.supportTickets} tone="down" />
              </div>
            </div>
          </div>

          <ProvidersTable provedores={dados.providers} />
          <SchedulersTable schedulers={dados.schedulers} />

          {/* Contestações */}
          <div>
            <div className="mb-3">
              <h2 className="font-semibold text-[#1d1d1b]">Contestações de presença</h2>
              <p className="text-xs text-[#737373]">
                O contratante disse que o freelancer não foi. Resolver decide: compareceu (conclui e repassa) ou não compareceu (estorna e aplica a infração).
              </p>
            </div>
            {contestacoes.isLoading && !dados.attendance.items.length ? (
              <div className="flex h-24 items-center justify-center rounded-xl border border-[#e5e5e5] bg-white">
                <Loader2 className="h-5 w-5 animate-spin text-[#eca826]" />
              </div>
            ) : contestacoes.isError && !dados.attendance.items.length ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                {getAxiosErrorMessage(contestacoes.error, "Não foi possível carregar as contestações.")}
              </div>
            ) : (
              <DataTable<LinhaContestacao>
                data={itensContestacao}
                isFetching={contestacoes.isFetching}
                searchKey="providerName"
                searchPlaceholder="Buscar por freelancer..."
                defaultSort={{ index: 4, direction: "asc" }}
                columns={[
                  {
                    header: "Vaga",
                    accessor: (row) => (
                      <div>
                        <p className="font-medium text-[#1d1d1b]">{row.vacancyTitle ?? "Vaga sem título"}</p>
                        <p className="font-mono text-[11px] text-[#a3a3a3]">{row.vacancyId.slice(0, 8)}</p>
                      </div>
                    ),
                  },
                  { header: "Contratante", accessor: (row) => row.contractorName ?? "—" },
                  { header: "Freelancer", accessor: (row) => row.providerName ?? "—" },
                  {
                    header: "Situação",
                    accessor: (row) => (
                      <Badge variant={row.status === "SUPPORT_TICKET_REQUESTED" ? "destructive" : "warning"}>
                        {ATTENDANCE_STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                    ),
                  },
                  {
                    header: "Aberta em",
                    accessor: (row) => (
                      <span className="whitespace-nowrap tabular-nums text-[#737373]">{quando(row.openedAt)}</span>
                    ),
                    sortable: true,
                    sortAccessor: (row) => new Date(row.openedAt),
                  },
                  {
                    header: "O que o contratante disse",
                    accessor: (row) => (
                      <p className="max-w-xs truncate text-[#737373]" title={row.contractorReason ?? undefined}>
                        {row.contractorReason ?? "—"}
                      </p>
                    ),
                  },
                  {
                    header: "Ações",
                    accessor: (row) => (
                      <Button size="sm" onClick={() => abrirResolucao(row)}>
                        Resolver
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Resolver contestação */}
      <Dialog open={Boolean(emResolucao)} onOpenChange={(open) => !open && !resolver.isPending && setEmResolucao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver contestação</DialogTitle>
            <DialogDescription>
              {emResolucao?.providerName ?? "Freelancer"} em &ldquo;{emResolucao?.vacancyTitle ?? "vaga"}&rdquo; —
              contratante {emResolucao?.contractorName ?? "—"}.
            </DialogDescription>
          </DialogHeader>

          {emResolucao?.contractorReason && (
            <div className="mb-4 rounded-lg bg-[#f7f7f7] p-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[#737373]">O contratante disse</p>
              <p className="mt-1 text-[#1d1d1b]">{emResolucao.contractorReason}</p>
            </div>
          )}

          <fieldset className="space-y-2" disabled={resolver.isPending}>
            <legend className="mb-1 text-sm font-medium text-[#1d1d1b]">O freelancer compareceu?</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e5e5] p-3 has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
              <input
                type="radio"
                name="decisao"
                value="ATTENDED"
                checked={decisao === "ATTENDED"}
                onChange={() => setDecisao("ATTENDED")}
                className="mt-1 accent-green-600"
              />
              <span>
                <span className="block text-sm font-semibold text-[#1d1d1b]">Compareceu</span>
                <span className="block text-xs text-[#737373]">Job concluído, repasse iniciado, recibo e seguro seguem.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e5e5] p-3 has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
              <input
                type="radio"
                name="decisao"
                value="NO_SHOW"
                checked={decisao === "NO_SHOW"}
                onChange={() => setDecisao("NO_SHOW")}
                className="mt-1 accent-red-600"
              />
              <span>
                <span className="block text-sm font-semibold text-[#1d1d1b]">Não compareceu</span>
                <span className="block text-xs text-[#737373]">Estorno integral ao contratante e infração NO_SHOW (−5) ao freelancer.</span>
              </span>
            </label>
          </fieldset>

          <div className="mt-4">
            <Label htmlFor="nota-resolucao" className="text-sm">
              Observação (fica no histórico do fluxo)
            </Label>
            <textarea
              id="nota-resolucao"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={resolver.isPending}
              rows={3}
              placeholder="Ex.: falei com os dois pelo WhatsApp; o freelancer mandou foto do local."
              className="mt-1 flex w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] shadow-sm placeholder:text-[#a3a3a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eca826] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmResolucao(null)} disabled={resolver.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarResolucao}
              disabled={resolver.isPending}
              variant={decisao === "NO_SHOW" ? "destructive" : "default"}
            >
              {resolver.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decisao === "ATTENDED" ? "Confirmar presença" : "Registrar falta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Contagem({ rotulo, valor, tone }: { rotulo: string; valor: number; tone: HealthTone }) {
  return (
    <div className={`rounded-lg border p-3 ${valor > 0 ? toneClasses(tone).card : toneClasses("idle").card}`}>
      <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {valor}
      </p>
      <p className="text-xs">{rotulo}</p>
    </div>
  );
}

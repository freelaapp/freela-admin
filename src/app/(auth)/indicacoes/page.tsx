"use client";

import { useMemo, useState } from "react";
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
import { Loader2, BadgeCheck, Ban, Gift, HandCoins, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import {
  useApproveReward,
  useCancelReward,
  usePayReward,
  useReferralRewards,
  useReferralSummary,
  useReferrals,
} from "@/modules/admin/application/use-admin-referrals";
import type {
  Paginated,
  ReferralItem,
  ReferralStatus,
  ReferredAccountKind,
  RewardItem,
  RewardStatus,
} from "@/modules/admin/infrastructure/referrals-api";
import {
  describeReferralRange,
  resolveReferralPeriod,
  toInstantRange,
  type ReferralPeriodSelection,
} from "@/modules/admin/application/referral-period";
import { ReferralFunnelSection } from "./_components/referral-funnel-section";
import { KindBadge, ReferralDetailDialog } from "./_components/referral-detail-dialog";
import { ReferralPendingPanel } from "./_components/referral-pending-panel";
import {
  ACCOUNT_KIND_FILTER,
  EMPRESA_STEPS,
  STAGE_LABEL,
  TONE_CLASS,
  describeSituation,
  empresaStepIndex,
} from "./_lib/referral-labels";

/** Linhas por página nas duas listas. */
const PAGE_SIZE = 50;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const REFERRAL_STATUS_FILTER: Array<{ value: ReferralStatus | ""; label: string }> = [
  { value: "", label: "Todas as situações" },
  { value: "REGISTERED", label: "Abertas (ainda podem pagar)" },
  { value: "QUALIFIED", label: "Qualificadas" },
  { value: "REJECTED", label: "Rejeitadas" },
];

/**
 * Até onde o indicado chegou no caminho da empresa (login → empresa → vaga →
 * contratou → concluiu). Fora do caminho (freelancer, Em Casa) mostra só o
 * texto: essas contas não chegam à recompensa.
 */
function StageCell({ row }: { row: ReferralItem }) {
  const account = row.referredAccount;
  if (!account) return <span className="text-neutral-400">—</span>;
  const step = empresaStepIndex(account.stage);
  return (
    <div className="min-w-0">
      {step != null && (
        <div className="mb-1 flex items-center gap-1" aria-hidden>
          {EMPRESA_STEPS.map((label, index) => (
            <span
              key={label}
              title={label}
              className={`h-1.5 w-5 rounded-full ${index <= step ? "bg-emerald-500" : "bg-neutral-200"}`}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-700">{STAGE_LABEL[account.stage]}</p>
      {account.vacancies > 0 && (
        <p className="text-[11px] text-neutral-500">
          {account.vacancies} vaga(s) · {account.hires} contratação(ões) · {account.completedJobs}{" "}
          concluída(s)
        </p>
      )}
    </div>
  );
}

const REWARD_STATUS_LABEL: Record<RewardStatus, string> = {
  PENDING: "A aprovar",
  APPROVED: "A pagar",
  PAID: "Paga",
  CANCELLED: "Cancelada",
};

const REWARD_STATUS_CLASS: Record<RewardStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-neutral-200 text-neutral-600",
};

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/**
 * Paginação das listas. Antes as duas pediam 100 linhas e a tabela não tinha
 * página: da 101ª em diante as indicações simplesmente não apareciam.
 */
function Pager({
  data,
  page,
  onPage,
}: {
  data: Paginated<unknown> | undefined;
  page: number;
  onPage: (page: number) => void;
}) {
  if (!data || data.total === 0) return null;
  const first = (page - 1) * data.pageSize + 1;
  const last = Math.min(page * data.pageSize, data.total);
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
      <span>
        {first}–{last} de {data.total.toLocaleString("pt-BR")}
      </span>
      {lastPage > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Etiqueta de quem indicou. Sem `kind` = API anterior a 12/08/2026, quando só
 * freelancer podia indicar — dizer "freelancer" ali seria chute, então não diz
 * nada.
 */
function QuemIndicou({ kind }: { kind?: ReferralItem["referrerKind"] }) {
  if (!kind || kind === "DESCONHECIDO") return null;
  const map = {
    FREELANCER: { label: "Freelancer", cls: "bg-blue-100 text-blue-700" },
    CONTRATANTE: { label: "Contratante", cls: "bg-purple-100 text-purple-700" },
    AMBOS: { label: "Freelancer e contratante", cls: "bg-neutral-200 text-neutral-700" },
  } as const;
  const { label, cls } = map[kind];
  return (
    <span className={`mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export default function IndicacoesPage() {
  const { allowed, isChecking } = useAreaGuard("REFERRALS");
  const [tab, setTab] = useState<"rewards" | "referrals">("rewards");
  // Uma busca por aba: a mesma caixa filtrando as duas listas fazia a busca de
  // um freelancer nas recompensas esvaziar a lista de indicações.
  const [rewardSearch, setRewardSearch] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [rewardStatus, setRewardStatus] = useState<RewardStatus | "">("PENDING");
  const [rewardPage, setRewardPage] = useState(1);
  const [referralPage, setReferralPage] = useState(1);
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | "">("");
  const [accountKind, setAccountKind] = useState<ReferredAccountKind | "">("");
  const [detail, setDetail] = useState<ReferralItem | null>(null);
  const [period, setPeriod] = useState<ReferralPeriodSelection>({
    preset: "30d",
    customFrom: "",
    customTo: "",
  });
  const range = useMemo(() => resolveReferralPeriod(period), [period]);

  const summary = useReferralSummary();
  const rewards = useReferralRewards({
    search: rewardSearch || undefined,
    rewardStatus: rewardStatus || undefined,
    page: rewardPage,
    pageSize: PAGE_SIZE,
  });
  // A lista de indicações segue o período dos indicadores: o card "Cadastros
  // pelo link" e a lista contam as mesmas linhas.
  const referrals = useReferrals({
    search: referralSearch || undefined,
    status: referralStatus || undefined,
    accountKind: accountKind || undefined,
    ...toInstantRange(range),
    page: referralPage,
    pageSize: PAGE_SIZE,
  });

  const approve = useApproveReward();
  const pay = usePayReward();
  const cancel = useCancelReward();

  const [payTarget, setPayTarget] = useState<RewardItem | null>(null);
  const [paymentProof, setPaymentProof] = useState("");
  const [cancelTarget, setCancelTarget] = useState<RewardItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const handleApprove = async (reward: RewardItem) => {
    try {
      await approve.mutateAsync(reward.id);
      toast.success("Recompensa aprovada. Agora é pagar o PIX e registrar o comprovante.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const handlePay = async () => {
    if (!payTarget) return;
    try {
      await pay.mutateAsync({ id: payTarget.id, paymentProof });
      toast.success("Pagamento registrado.");
      setPayTarget(null);
      setPaymentProof("");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancel.mutateAsync({ id: cancelTarget.id, reason: cancelReason });
      toast.success("Recompensa cancelada.");
      setCancelTarget(null);
      setCancelReason("");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const rewardColumns = [
    {
      // Recompensa vai para quem indicou — freelancer ou contratante.
      header: "Quem indicou",
      accessor: (row: RewardItem) => (
        <div>
          <p className="font-medium">{row.provider?.profile?.name ?? "—"}</p>
          <p className="text-xs text-neutral-500">{row.provider?.phone ?? row.provider?.email}</p>
        </div>
      ),
    },
    {
      header: "Motivo",
      accessor: (row: RewardItem) =>
        row.type === "MONTHLY_BONUS" ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <Gift className="h-3.5 w-3.5" /> Bônus {row.competenceMonth}
          </span>
        ) : (
          <span className="text-sm">
            Indicou {row.referral?.referred?.profile?.name ?? "contratante"}
          </span>
        ),
    },
    {
      header: "Valor",
      accessor: (row: RewardItem) => <span className="font-semibold">{brl(row.amountInCents)}</span>,
      sortAccessor: (row: RewardItem) => row.amountInCents,
      sortable: true,
    },
    {
      header: "Chave PIX",
      accessor: (row: RewardItem) =>
        row.pixKey ? (
          <span className="text-xs">{row.pixKey}</span>
        ) : (
          // Sem chave o admin não consegue pagar — precisa saltar aos olhos.
          <span className="text-xs font-medium text-red-600">sem chave cadastrada</span>
        ),
    },
    {
      header: "Status",
      accessor: (row: RewardItem) => (
        <StatusPill
          label={REWARD_STATUS_LABEL[row.status]}
          className={REWARD_STATUS_CLASS[row.status]}
        />
      ),
    },
    {
      header: "Criada",
      accessor: (row: RewardItem) => formatInstantDate(row.createdAt),
      sortAccessor: (row: RewardItem) => new Date(row.createdAt),
      sortable: true,
    },
    {
      header: "Ações",
      accessor: (row: RewardItem) => (
        <div className="flex gap-2">
          {row.status === "PENDING" && (
            <Button size="sm" onClick={() => handleApprove(row)} disabled={approve.isPending}>
              <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
          )}
          {row.status === "APPROVED" && (
            <Button size="sm" onClick={() => setPayTarget(row)}>
              <HandCoins className="mr-1 h-3.5 w-3.5" /> Registrar pagamento
            </Button>
          )}
          {(row.status === "PENDING" || row.status === "APPROVED") && (
            <Button size="sm" variant="outline" onClick={() => setCancelTarget(row)}>
              <Ban className="mr-1 h-3.5 w-3.5" /> Cancelar
            </Button>
          )}
          {row.status === "PAID" && (
            <span className="text-xs text-neutral-500">{row.paymentProof}</span>
          )}
        </div>
      ),
    },
  ];

  const referralColumns = [
    {
      // Deixou de ser "Freelancer" em 12/08/2026: contratante também pode
      // indicar, e o rótulo antigo passou a mentir em parte das linhas.
      header: "Quem indicou",
      accessor: (row: ReferralItem) => (
        <div>
          <p className="font-medium">{row.referrer?.profile?.name ?? "—"}</p>
          <QuemIndicou kind={row.referrerKind} />
          <p className="text-xs text-neutral-500">
            código <span className="font-mono">{row.code?.code ?? "—"}</span>
          </p>
        </div>
      ),
      sortAccessor: (row: ReferralItem) => row.referrer?.profile?.name ?? "",
      sortable: true,
    },
    {
      // Antes "Contratante indicado": a maioria dos indicados nem é contratante
      // (em 05/10/2026, 21 de 25 tinham parado no 1º passo do cadastro).
      header: "Indicado",
      mobile: "title" as const,
      accessor: (row: ReferralItem) => (
        <div className="min-w-0">
          <p className="font-medium">{row.referred?.profile?.name ?? "—"}</p>
          {row.referredAccount && (
            <span className="flex flex-wrap gap-1">
              <KindBadge kind={row.referredAccount.kind} />
              {row.referredAccount.kind === "EMPRESA" && row.referredAccount.profiles.freelancer && (
                <KindBadge kind="FREELANCER" />
              )}
            </span>
          )}
          {row.referredAccount?.company?.name && (
            <p className="text-xs text-neutral-700">
              {row.referredAccount.company.name}
              {row.referredAccount.company.city ? ` · ${row.referredAccount.company.city}` : ""}
            </p>
          )}
          <p className="text-xs text-neutral-500 break-all">{row.referred?.email}</p>
          {row.referred?.phone && <p className="text-xs text-neutral-500">{row.referred.phone}</p>}
        </div>
      ),
    },
    {
      header: "Etapa",
      accessor: (row: ReferralItem) => <StageCell row={row} />,
    },
    {
      header: "Situação",
      accessor: (row: ReferralItem) => {
        const situation = describeSituation(row);
        return (
          <div className="max-w-64">
            <StatusPill label={situation.label} className={TONE_CLASS[situation.tone]} />
          </div>
        );
      },
    },
    {
      header: "Cadastrou em",
      accessor: (row: ReferralItem) => (
        <div>
          <p>{formatInstantDate(row.createdAt)}</p>
          {row.status === "QUALIFIED" && row.qualifiedAt && (
            <p className="text-xs text-emerald-700">qualificou {formatInstantDate(row.qualifiedAt)}</p>
          )}
          {row.status === "REGISTERED" && row.referredAccount && (
            <p className="text-xs text-neutral-500">
              prazo {formatInstantDate(row.referredAccount.deadline)}
            </p>
          )}
        </div>
      ),
      sortAccessor: (row: ReferralItem) => new Date(row.createdAt),
      sortable: true,
    },
    {
      header: "Ações",
      accessor: (row: ReferralItem) => (
        <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
          Detalhes <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Indicações"
        description="Programa Indique e Ganhe — freelancer OU contratante traz um contratante EMPRESA (bar/restaurante) e recebe quando ele contrata. Indicado que se cadastra como freelancer ou como contratante Em Casa não conta."
      />

      <ReferralFunnelSection
        selection={period}
        range={range}
        onSelectionChange={(next) => {
          setPeriod(next);
          setReferralPage(1);
        }}
      />

      <h2 className="mb-3 text-base font-semibold text-[#1d1d1b]">
        Recompensas e situação <span className="font-normal text-neutral-500">· desde o início</span>
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="A pagar (passivo)"
          value={s ? brl(s.outstandingInCents) : "—"}
          hint="aprovado + a aprovar"
        />
        <Kpi label="Já pago" value={s ? brl(s.rewards.PAID.amountInCents) : "—"} />
        <Kpi
          label="Indicações qualificadas"
          value={s ? String(s.referrals.QUALIFIED ?? 0) : "—"}
          hint={s ? `${s.referrals.REGISTERED ?? 0} ainda não contrataram` : undefined}
        />
        <Kpi
          label="Rejeitadas"
          value={s ? String(s.referrals.REJECTED ?? 0) : "—"}
          hint={
            s?.rejectedByPersonaBug
              ? `${s.rejectedByPersonaBug} pelo erro de cadastro corrigido em 28/09`
              : undefined
          }
        />
      </div>

      <ReferralPendingPanel summary={s} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant={tab === "rewards" ? "default" : "outline"} onClick={() => setTab("rewards")}>
          Recompensas
        </Button>
        <Button
          variant={tab === "referrals" ? "default" : "outline"}
          onClick={() => setTab("referrals")}
        >
          Indicações
        </Button>
        {tab === "rewards" && (
          <select
            className="ml-auto rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={rewardStatus}
            onChange={(event) => {
              setRewardStatus(event.target.value as RewardStatus | "");
              setRewardPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="PENDING">A aprovar</option>
            <option value="APPROVED">A pagar</option>
            <option value="PAID">Pagas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        )}
        {tab === "referrals" && (
          <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
            <select
              aria-label="Situação da indicação"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-auto"
              value={referralStatus}
              onChange={(event) => {
                setReferralStatus(event.target.value as ReferralStatus | "");
                setReferralPage(1);
              }}
            >
              {REFERRAL_STATUS_FILTER.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Tipo de conta criada"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-auto"
              value={accountKind}
              onChange={(event) => {
                setAccountKind(event.target.value as ReferredAccountKind | "");
                setReferralPage(1);
              }}
            >
              {ACCOUNT_KIND_FILTER.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab === "rewards" ? (
        <>
          <DataTable
            columns={rewardColumns}
            data={rewards.data?.items ?? []}
            isFetching={rewards.isFetching}
            searchPlaceholder="Buscar por quem indicou…"
            controlledSearch={{
              value: rewardSearch,
              onChange: (value) => {
                setRewardSearch(value);
                setRewardPage(1);
              },
            }}
          />
          <Pager data={rewards.data} page={rewardPage} onPage={setRewardPage} />
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            Cadastros feitos em {describeReferralRange(range)} (período dos indicadores acima).
          </p>
          <DataTable
            columns={referralColumns}
            data={referrals.data?.items ?? []}
            isFetching={referrals.isFetching}
            searchPlaceholder="Buscar por nome, e-mail, telefone ou código…"
            controlledSearch={{
              value: referralSearch,
              onChange: (value) => {
                setReferralSearch(value);
                setReferralPage(1);
              },
            }}
          />
          <Pager data={referrals.data} page={referralPage} onPage={setReferralPage} />
        </>
      )}

      <ReferralDetailDialog item={detail} onClose={() => setDetail(null)} />

      <Dialog open={Boolean(payTarget)} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payTarget && (
                <>
                  {brl(payTarget.amountInCents)} para {payTarget.provider?.profile?.name}
                  {payTarget.pixKey ? ` na chave ${payTarget.pixKey}` : " — sem chave cadastrada"}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="proof">Comprovante (txid do PIX)</Label>
            <Input
              id="proof"
              value={paymentProof}
              onChange={(event) => setPaymentProof(event.target.value)}
              placeholder="E12345678202608062130ABCDEF"
            />
            <p className="text-xs text-neutral-500">
              Obrigatório. Daqui a um mês é ele que responde se o PIX saiu.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>
              Voltar
            </Button>
            <Button onClick={handlePay} disabled={!paymentProof.trim() || pay.isPending}>
              {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar recompensa</DialogTitle>
            <DialogDescription>
              O freelancer deixa de receber. O motivo fica registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ex.: indicação fraudulenta — mesmo endereço do freelancer"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancel.isPending}
            >
              {cancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar recompensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

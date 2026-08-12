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
import { Loader2, BadgeCheck, Ban, Gift, HandCoins } from "lucide-react";
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
  ReferralItem,
  RewardItem,
  RewardStatus,
} from "@/modules/admin/infrastructure/referrals-api";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const REFERRAL_STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Cadastrou",
  QUALIFIED: "Qualificou",
  REJECTED: "Rejeitada",
};

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
  const [search, setSearch] = useState("");
  const [rewardStatus, setRewardStatus] = useState<RewardStatus | "">("PENDING");

  const summary = useReferralSummary();
  const rewards = useReferralRewards({
    search: search || undefined,
    rewardStatus: rewardStatus || undefined,
    pageSize: 100,
  });
  const referrals = useReferrals({ search: search || undefined, pageSize: 100 });

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
      header: "Freelancer",
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
        </div>
      ),
    },
    { header: "Código", accessor: (row: ReferralItem) => row.code?.code ?? "—" },
    {
      header: "Contratante indicado",
      accessor: (row: ReferralItem) => (
        <div>
          <p>{row.referred?.profile?.name ?? "—"}</p>
          <p className="text-xs text-neutral-500">{row.referred?.email ?? row.referred?.phone}</p>
        </div>
      ),
    },
    {
      header: "Situação",
      accessor: (row: ReferralItem) => (
        <div>
          <StatusPill
            label={REFERRAL_STATUS_LABEL[row.status] ?? row.status}
            className={
              row.status === "QUALIFIED"
                ? "bg-emerald-100 text-emerald-800"
                : row.status === "REJECTED"
                  ? "bg-red-100 text-red-700"
                  : "bg-neutral-200 text-neutral-700"
            }
          />
          {/* O motivo é o que permite responder ao freelancer que reclamar. */}
          {row.rejectionReason && (
            <p className="mt-1 text-xs text-red-600">{row.rejectionReason}</p>
          )}
        </div>
      ),
    },
    {
      header: "Cadastrou em",
      accessor: (row: ReferralItem) => formatInstantDate(row.createdAt),
      sortAccessor: (row: ReferralItem) => new Date(row.createdAt),
      sortable: true,
    },
    {
      header: "Qualificou em",
      accessor: (row: ReferralItem) =>
        row.qualifiedAt ? formatInstantDate(row.qualifiedAt) : "—",
    },
  ];

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Indicações"
        description="Programa Indique e Ganhe — freelancer OU contratante traz um contratante EMPRESA (bar/restaurante) e recebe quando ele contrata. Indicado que se cadastra como freelancer ou como contratante Em Casa não conta."
      />

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
          label="Rejeitadas pelo antifraude"
          value={s ? String(s.referrals.REJECTED ?? 0) : "—"}
        />
      </div>

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
            onChange={(event) => setRewardStatus(event.target.value as RewardStatus | "")}
          >
            <option value="">Todos os status</option>
            <option value="PENDING">A aprovar</option>
            <option value="APPROVED">A pagar</option>
            <option value="PAID">Pagas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        )}
      </div>

      {tab === "rewards" ? (
        <DataTable
          columns={rewardColumns}
          data={rewards.data?.items ?? []}
          isFetching={rewards.isFetching}
          searchPlaceholder="Buscar por freelancer…"
          controlledSearch={{ value: search, onChange: setSearch }}
        />
      ) : (
        <DataTable
          columns={referralColumns}
          data={referrals.data?.items ?? []}
          isFetching={referrals.isFetching}
          searchPlaceholder="Buscar por nome, e-mail ou código…"
          controlledSearch={{ value: search, onChange: setSearch }}
        />
      )}

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

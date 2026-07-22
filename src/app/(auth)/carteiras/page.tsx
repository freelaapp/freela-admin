"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInstantDate } from "@/lib/date.utils";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import {
  useAdjustWallet,
  useAdminWalletLedger,
  useAdminWallets,
} from "@/modules/admin/application/use-admin-wallets";
import type { WalletItem, WalletLedgerEntry } from "@/modules/admin/infrastructure/wallets-api";

const PAGE_SIZE = 30;

function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const ENTRY_TYPE_LABEL: Record<WalletLedgerEntry["type"], string> = {
  DEPOSIT: "Recarga",
  VACANCY_PAYMENT: "Pagamento de vaga",
  REFUND: "Estorno",
  WITHDRAWAL: "Saque",
  ADJUSTMENT: "Ajuste",
};

const ENTRY_STATUS_LABEL: Record<WalletLedgerEntry["status"], string> = {
  PENDING: "Processando",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

type Row = WalletItem & { id: string; badge: string };

export default function CarteirasPage() {
  // Área controlada por permissão; o ajuste manual de saldo segue super-admin.
  const { isSuperAdmin } = useAuth();
  const { isChecking, allowed } = useAreaGuard("WALLETS");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [selected, setSelected] = useState<WalletItem | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, isFetching } = useAdminWallets({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIndex = Math.min(page * PAGE_SIZE, total);

  const rows: Row[] = useMemo(
    () =>
      (data?.items ?? []).map((item) => ({
        ...item,
        id: item.userId,
        badge: item.status === "ACTIVE" ? "active" : "blocked",
      })),
    [data],
  );

  const columns = [
    {
      header: "Contratante",
      accessor: (row: Row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-[#1d1d1b]">{row.name ?? "—"}</p>
          <p className="truncate text-xs text-[#737373]">{row.email ?? "—"}</p>
        </div>
      ),
    },
    {
      header: "Saldo",
      accessor: (row: Row) => (
        <span className="font-semibold text-[#1d1d1b]">{formatBrl(row.balanceInCents)}</span>
      ),
      sortable: true,
      sortAccessor: (row: Row) => row.balanceInCents,
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.badge} />,
      className: "hidden md:table-cell",
    },
    {
      header: "Criada em",
      accessor: (row: Row) => formatInstantDate(row.createdAt),
      className: "hidden lg:table-cell",
      sortable: true,
      sortAccessor: (row: Row) => row.createdAt,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (isChecking || !allowed) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteiras"
        description="Saldo pré-pago dos contratantes, extrato e ajustes manuais."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Total retido"
          value={formatBrl(data?.summary.totalHeldInCents ?? 0)}
          icon={Wallet}
          iconColor="text-[#eca826]"
          help="Soma dos saldos de todas as carteiras (passivo da conta master)."
        />
        <KpiCard
          title="Carteiras"
          value={(data?.summary.walletsCount ?? 0).toLocaleString("pt-BR")}
          icon={Users}
        />
        <KpiCard
          title="Ativas"
          value={(data?.summary.activeCount ?? 0).toLocaleString("pt-BR")}
          icon={Users}
          iconColor="text-green-600"
        />
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          Não foi possível carregar as carteiras. Tente novamente.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Buscar por nome ou e-mail..."
          controlledSearch={{ value: search, onChange: setSearch }}
          isFetching={isFetching}
          defaultSort={{ index: 1, direction: "desc" }}
          footer={
            <div className="flex items-center justify-between text-sm text-[#737373]">
              <span>{`Mostrando ${fromIndex}–${toIndex} de ${total.toLocaleString("pt-BR")}`}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                  className="rounded-md border border-[#e5e5e5] p-1 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-[#1d1d1b]">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                  className="rounded-md border border-[#e5e5e5] p-1 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />
      )}

      <WalletDetailDialog
        wallet={selected}
        canAdjust={isSuperAdmin}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

/* ── Detail + ledger + adjust ────────────────────────────────── */

function WalletDetailDialog({
  wallet,
  canAdjust,
  onClose,
}: {
  wallet: WalletItem | null;
  canAdjust: boolean;
  onClose: () => void;
}) {
  const { data: ledger, isLoading } = useAdminWalletLedger(wallet?.userId ?? null);

  return (
    <Dialog open={!!wallet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="relative max-w-lg">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>{wallet?.name ?? "Carteira"}</DialogTitle>
          <DialogDescription>{wallet?.email ?? wallet?.userId}</DialogDescription>
        </DialogHeader>

        {wallet && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e5e5e5] bg-[#faf9f7] p-4">
              <p className="text-xs text-[#737373]">Saldo atual</p>
              <p className="text-2xl font-bold text-[#1d1d1b]">
                {formatBrl(ledger?.balanceInCents ?? wallet.balanceInCents)}
              </p>
            </div>

            {canAdjust && <AdjustForm userId={wallet.userId} />}

            <div>
              <p className="mb-2 text-sm font-semibold text-[#1d1d1b]">Extrato</p>
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[#eca826]" />
                </div>
              ) : (ledger?.entries.length ?? 0) === 0 ? (
                <p className="py-4 text-sm text-[#737373]">Sem lançamentos.</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {ledger!.entries.map((entry) => {
                    const isCredit = entry.direction === "CREDIT";
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[#faf9f7]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                            {ENTRY_TYPE_LABEL[entry.type] ?? entry.type}
                          </p>
                          <p className="truncate text-[11px] text-[#a3a3a3]">
                            {formatInstantDate(entry.createdAt)}
                            {entry.status !== "COMPLETED" &&
                              ` • ${ENTRY_STATUS_LABEL[entry.status]}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[13px] font-semibold ${
                            entry.status === "FAILED"
                              ? "text-[#a3a3a3] line-through"
                              : isCredit
                                ? "text-green-600"
                                : "text-[#1d1d1b]"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatBrl(entry.amountInCents)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ userId }: { userId: string }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useAdjustWallet();

  async function submit() {
    const value = Number.parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo do ajuste.");
      return;
    }
    const cents = Math.round(value * 100) * (direction === "debit" ? -1 : 1);
    try {
      const res = await mutation.mutateAsync({
        userId,
        payload: { deltaInCents: cents, reason: reason.trim() },
      });
      toast.success(`Ajuste aplicado. Novo saldo: ${formatBrl(res.balanceInCents)}`);
      setAmount("");
      setReason("");
    } catch (error) {
      const message =
        (error as { message?: string; error?: { message?: string } } | undefined)?.message ??
        "Não foi possível aplicar o ajuste.";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[#e5e5e5] p-3">
      <p className="text-sm font-semibold text-[#1d1d1b]">Ajuste manual (super-admin)</p>
      <div className="flex gap-2">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
          className="rounded-lg border border-[#e5e5e5] px-2 text-sm outline-none"
        >
          <option value="credit">Creditar</option>
          <option value="debit">Debitar</option>
        </select>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (R$)"
          className="flex-1"
        />
      </div>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (ex.: chamado #123)"
      />
      <Button onClick={submit} disabled={mutation.isPending} className="w-full">
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Aplicar ajuste
      </Button>
    </div>
  );
}

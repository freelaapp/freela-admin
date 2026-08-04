"use client";

import { useMemo, useState } from "react";
import {
  BadgePercent,
  CalendarPlus,
  Gift,
  Loader2,
  PlusCircle,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useSubscriptionDetail,
  useSubscriptionMutations,
  useSubscriptions,
} from "@/modules/admin/application/use-admin-subscriptions";
import type {
  AdminActionType,
  PlanCode,
  SubscriptionRow,
} from "@/modules/admin/infrastructure/subscriptions-api";

const PLAN_LABEL: Record<PlanCode, string> = {
  FREE: "Grátis",
  BASIC: "Básico",
  VIP: "Vip",
  ENTERPRISE: "Grandes Redes",
};

const ACTION_LABEL: Record<AdminActionType, string> = {
  PLAN_ASSIGNED: "Plano alterado",
  PLAN_SCHEDULED: "Downgrade agendado",
  COURTESY_GRANTED: "Cortesia concedida",
  COURTESY_REVOKED: "Cortesia encerrada",
  PERIOD_EXTENDED: "Ciclo estendido",
  QUOTA_ADJUSTED: "Cota ajustada",
  CANCELLED: "Assinatura cancelada",
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
};

const fmtCnpj = (cnpj: string | null) => {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

function PlanBadge({ code }: { code: PlanCode }) {
  const variant =
    code === "ENTERPRISE" ? "secondary" : code === "VIP" ? "default" : code === "BASIC" ? "outline" : "outline";
  return <Badge variant={variant}>{PLAN_LABEL[code]}</Badge>;
}

/**
 * Assinaturas das empresas: plano vigente, cota do mês e as ações comerciais
 * (cortesia, extensão de ciclo, ajuste de cota).
 *
 * Toda ação daqui mexe no que se cobra de um cliente, então a tela sempre mostra
 * a trilha de quem fez o quê — e o campo de motivo aparece junto da ação, não
 * escondido atrás de um "avançado".
 */
export default function AssinaturasPage() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanCode | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SubscriptionRow | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      ...(search ? { search } : {}),
      ...(planFilter ? { planCode: planFilter } : {}),
    }),
    [page, search, planFilter],
  );

  const { data, isLoading } = useSubscriptions(params);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        description="Plano de cada empresa, cota do mês e cortesias. Toda ação fica registrada."
      />

      <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="busca">Buscar empresa</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              id="busca"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nome ou CNPJ"
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-[190px]">
          <Label htmlFor="plano">Plano</Label>
          <NativeSelect
            id="plano"
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value as PlanCode | "");
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {(Object.keys(PLAN_LABEL) as PlanCode[]).map((code) => (
              <option key={code} value={code}>
                {PLAN_LABEL[code]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="rounded-lg border border-[#e5e5e5] bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Ciclo até</TableHead>
              <TableHead>Cortesia</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Carregando…
                </TableCell>
              </TableRow>
            )}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-neutral-500">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            )}

            {rows.map((row) => (
              <TableRow key={row.storeId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="tabular-nums text-neutral-600">{fmtCnpj(row.cnpj)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <PlanBadge code={row.planCode} />
                    {row.scheduledPlanCode && (
                      <span className="text-xs text-neutral-500">
                        → {PLAN_LABEL[row.scheduledPlanCode]}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-neutral-600">
                  {fmtDate(row.currentPeriodEnd)}
                </TableCell>
                <TableCell>
                  {row.underCourtesy ? (
                    <Badge variant="success">até {fmtDate(row.courtesyUntil)}</Badge>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                    Gerenciar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-neutral-600">
          <span>
            {meta.total} empresa(s) · página {meta.page} de {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ManageDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Painel de gestão de uma empresa: plano, cortesia, ciclo, cota e histórico. */
function ManageDialog({ row, onClose }: { row: SubscriptionRow | null; onClose: () => void }) {
  const storeId = row?.storeId ?? null;
  const { data: detail, isLoading } = useSubscriptionDetail(storeId);
  const { changePlan, courtesy, endCourtesy, extend, quota } = useSubscriptionMutations(storeId);

  const [courtesyMonths, setCourtesyMonths] = useState("1");
  const [courtesyPlan, setCourtesyPlan] = useState<PlanCode | "">("");
  const [courtesyNote, setCourtesyNote] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [quotaDelta, setQuotaDelta] = useState("5");

  if (!row) return null;

  const sub = detail?.subscription ?? null;
  const underCourtesy = !!sub?.courtesyUntil && new Date(sub.courtesyUntil) > new Date();
  const busy =
    changePlan.isPending ||
    courtesy.isPending ||
    endCourtesy.isPending ||
    extend.isPending ||
    quota.isPending;

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>
            {fmtCnpj(row.cnpj)} · {row.organizationName}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="py-8 text-center text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Carregando…
          </p>
        )}

        {!isLoading && detail && (
          <div className="space-y-6">
            {/* ── Situação atual ─────────────────────────────────── */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-neutral-50 p-4">
              <div>
                <p className="text-xs text-neutral-500">Plano</p>
                <p className="font-medium">{PLAN_LABEL[detail.plan.code]}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Taxa</p>
                <p className="font-medium tabular-nums">{detail.plan.serviceFeePercent}%</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Cota do mês</p>
                <p className="font-medium tabular-nums">
                  {detail.quota ? `${detail.quota.remaining} de ${detail.quota.limit}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Ciclo até</p>
                <p className="font-medium tabular-nums">{fmtDate(sub?.currentPeriodEnd ?? null)}</p>
              </div>
            </section>

            {underCourtesy && (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div>
                  <p className="font-medium text-green-900 flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Em cortesia até {fmtDate(sub!.courtesyUntil)}
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    {sub?.courtesyReason || "Sem motivo registrado."} O plano está liberado e a
                    cobrança fica suspensa até essa data.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => endCourtesy.mutate({ storeId: row.storeId })}
                >
                  <X className="w-4 h-4 mr-1" />
                  Encerrar
                </Button>
              </div>
            )}

            {/* ── Cortesia ───────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#eca826]" />
                Liberar cortesia
              </h3>
              <p className="text-sm text-neutral-600">
                A empresa passa a usar o plano de verdade — taxa menor, cota maior, tudo liberado —
                e não é cobrada até o fim do prazo.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="c-plano">Plano</Label>
                  <NativeSelect
                    id="c-plano"
                    value={courtesyPlan}
                    onChange={(e) => setCourtesyPlan(e.target.value as PlanCode | "")}
                  >
                    <option value="">Manter o atual</option>
                    {(Object.keys(PLAN_LABEL) as PlanCode[]).map((code) => (
                      <option key={code} value={code}>
                        {PLAN_LABEL[code]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="c-meses">Meses</Label>
                  <Input
                    id="c-meses"
                    type="number"
                    min={1}
                    max={24}
                    value={courtesyMonths}
                    onChange={(e) => setCourtesyMonths(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="c-motivo">Motivo</Label>
                  <Input
                    id="c-motivo"
                    value={courtesyNote}
                    onChange={(e) => setCourtesyNote(e.target.value)}
                    placeholder="Ex.: fechamento"
                  />
                </div>
              </div>
              <Button
                disabled={busy || !Number(courtesyMonths)}
                onClick={() =>
                  courtesy.mutate({
                    storeId: row.storeId,
                    months: Number(courtesyMonths),
                    ...(courtesyPlan ? { planCode: courtesyPlan } : {}),
                    ...(courtesyNote.trim() ? { note: courtesyNote.trim() } : {}),
                  })
                }
              >
                {courtesy.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Gift className="w-4 h-4 mr-1" />
                )}
                Liberar {courtesyMonths || "0"} mês(es) grátis
              </Button>
            </section>

            {/* ── Plano, ciclo e cota ────────────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-neutral-200 pt-5">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-neutral-500" />
                  Trocar de plano
                </h3>
                <p className="text-sm text-neutral-600">Vale na hora, sem cobrança.</p>
                <NativeSelect
                  value={detail.plan.code}
                  disabled={busy}
                  onChange={(e) =>
                    changePlan.mutate({
                      storeId: row.storeId,
                      planCode: e.target.value as PlanCode,
                    })
                  }
                >
                  {(Object.keys(PLAN_LABEL) as PlanCode[]).map((code) => (
                    <option key={code} value={code}>
                      {PLAN_LABEL[code]}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-neutral-500" />
                  Estender o ciclo
                </h3>
                <p className="text-sm text-neutral-600">Empurra a data de virada.</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    aria-label="Dias de extensão"
                  />
                  <Button
                    variant="secondary"
                    disabled={busy || !Number(extendDays)}
                    onClick={() =>
                      extend.mutate({ storeId: row.storeId, days: Number(extendDays) })
                    }
                  >
                    Estender
                  </Button>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <h3 className="font-medium flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-neutral-500" />
                  Ajustar a cota do mês
                </h3>
                <p className="text-sm text-neutral-600">
                  Positivo libera vagas, negativo desconta. Vira lançamento no extrato.
                </p>
                <div className="flex gap-2 max-w-sm">
                  <Input
                    type="number"
                    value={quotaDelta}
                    onChange={(e) => setQuotaDelta(e.target.value)}
                    aria-label="Vagas a ajustar"
                  />
                  <Button
                    variant="secondary"
                    disabled={busy || !Number(quotaDelta)}
                    onClick={() =>
                      quota.mutate({ storeId: row.storeId, delta: Number(quotaDelta) })
                    }
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </section>

            {/* ── Histórico ─────────────────────────────────────── */}
            <section className="border-t border-neutral-200 pt-5">
              <h3 className="font-medium mb-3">Histórico</h3>
              {detail.adminActions.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma ação registrada ainda.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.adminActions.map((action) => (
                    <li
                      key={action.id}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-neutral-100 pb-2 last:border-0"
                    >
                      <span className="font-medium">{ACTION_LABEL[action.action]}</span>
                      {action.toPlanCode && (
                        <span className="text-neutral-600">
                          {action.fromPlanCode ? `${PLAN_LABEL[action.fromPlanCode]} → ` : ""}
                          {PLAN_LABEL[action.toPlanCode]}
                        </span>
                      )}
                      {action.courtesyUntil && (
                        <span className="text-neutral-600">até {fmtDate(action.courtesyUntil)}</span>
                      )}
                      {action.note && <span className="text-neutral-500">· {action.note}</span>}
                      <span className="ml-auto text-neutral-400 tabular-nums">
                        {fmtDateTime(action.createdAt)}
                        {action.adminEmail ? ` · ${action.adminEmail}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

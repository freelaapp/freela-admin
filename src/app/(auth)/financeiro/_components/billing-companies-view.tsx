"use client";

import { useState } from "react";
import { Building2, CalendarClock, FileClock, Info } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInstantDate } from "@/lib/date.utils";
import { cn } from "@/lib/utils";
import { formatBrl, formatTaxId } from "@/modules/admin/application/invoice-presentation";
import { useBillingCompanies } from "@/modules/admin/application/use-admin-billing";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  BillingCompanies,
  BillingCompanyItem,
  BillingCompanyStandingCode,
  CompanyFigure,
} from "@/modules/admin/infrastructure/billing-api";
import { PreferencesDialog } from "../../empresas/_components/preferences-dialog";

/** A empresa escolhida em "Ver faturas" (a aba Faturas abre filtrada por ela). */
export type InvoiceCompanyFilter = { contractorUserId: string; name: string };

type Row = BillingCompanyItem & { id: string; busca: string };

const STANDING_STYLE: Record<BillingCompanyStandingCode, string> = {
  EM_DIA: "bg-green-500/10 text-green-700",
  VENCIDA: "bg-[#fef2f2] text-[#b91c1c]",
  BLOQUEADA: "bg-[#b91c1c] text-white",
};

/** Ordem e ícone dos três cards do topo. */
const CARDS: Array<{
  key: keyof BillingCompanies["cards"];
  icon: React.ElementType;
  iconColor: string;
  money: boolean;
}> = [
  { key: "companies", icon: Building2, iconColor: "text-[#eca826]", money: false },
  { key: "unbilled", icon: FileClock, iconColor: "text-[#737373]", money: true },
  { key: "accepted", icon: CalendarClock, iconColor: "text-[#b45309]", money: true },
];

/**
 * Aba "Empresas faturadas" do Financeiro (relato do dono, 15/10): cada empresa
 * do faturado pelo nome, antes mesmo da 1ª fatura, com o ciclo, o próximo
 * fechamento, o que está aberto, o que foi aceito e ainda não aconteceu, as
 * faturas em aberto e a situação. Todo número vem pronto da API com a conta e a
 * fonte; a tela não recalcula.
 */
export function BillingCompaniesView({
  onSeeInvoices,
}: {
  onSeeInvoices: (company: InvoiceCompanyFilter) => void;
}) {
  const companies = useBillingCompanies();
  const [billingOf, setBillingOf] = useState<BillingCompanyItem | null>(null);

  if (companies.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CARDS.map(({ key }) => (
            <Skeleton key={key} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Rota fora do ar (API anterior a esta aba): aviso calmo, não erro.
  if (apiErrorOf(companies.error).status === 404) {
    return (
      <Notice
        title="As empresas faturadas ainda não estão disponíveis neste ambiente."
        text="A API ainda não tem esta lista. Enquanto isso, o modo de cobrança de cada empresa está em Empresas > Documentos e cobrança > Cobrança."
      />
    );
  }

  // Sem a permissão FINANCE: tentar de novo não muda nada.
  if (apiErrorOf(companies.error).status === 403) {
    return (
      <Notice
        title="Você não tem acesso ao financeiro."
        text="Peça a um administrador a permissão Financeiro para ver as empresas faturadas."
      />
    );
  }

  if (companies.isError || !companies.data) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
        <p>Não conseguimos carregar as empresas faturadas.</p>
        <Button variant="outline" size="sm" onClick={() => companies.refetch()} className="mt-3">
          Tentar de novo
        </Button>
      </div>
    );
  }

  const data = companies.data;
  if (!data.invoicingEnabled) {
    return (
      <Notice
        title="O faturamento está desligado no servidor."
        text="Com ele desligado, todas as empresas pagam antes (pré-pago) e esta lista fica vazia."
      />
    );
  }

  const rows: Row[] = data.items.map((item) => ({
    ...item,
    id: item.contractorUserId,
    busca: `${item.name ?? ""} ${item.document ?? ""} ${formatTaxId(item.document)}`,
  }));

  const columns: Column<Row>[] = [
    {
      header: "Empresa",
      mobile: "title",
      accessor: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setBillingOf(row)}
            title="Abrir a cobrança desta empresa"
            className="text-left font-semibold text-[#1d1d1b] underline-offset-2 hover:text-[#eca826] hover:underline"
          >
            {row.name ?? "Sem nome"}
          </button>
          <p className="text-xs text-[#737373]">
            {row.document ? `CNPJ ${formatTaxId(row.document)}` : "Sem CNPJ no cadastro"}
          </p>
        </div>
      ),
    },
    {
      header: "Modo",
      accessor: (row) => (
        <div className="min-w-0">
          <p className="text-[#1d1d1b]">{row.modeLabel}</p>
          {row.modeSince && (
            <p className="text-xs text-[#737373]">{`desde ${formatInstantDate(row.modeSince)}`}</p>
          )}
        </div>
      ),
    },
    {
      header: "Próximo fechamento",
      accessor: (row) =>
        row.nextClose ? (
          <div className="min-w-0 text-sm">
            <p className="text-[#1d1d1b]">{row.nextClose.label}</p>
            {row.nextClose.note && (
              <p className="mt-0.5 text-xs text-[#b45309]">{row.nextClose.note}</p>
            )}
            <SeeCalc calc={row.nextClose.calc} source={row.nextClose.source} />
          </div>
        ) : (
          <span className="text-[#a3a3a3]">Nada a fechar</span>
        ),
    },
    {
      header: "Período aberto",
      headerTitle: "Serviços realizados e confirmados ainda sem fatura: débitos − créditos.",
      accessor: (row) => <FigureCell figure={row.openPeriod} />,
    },
    {
      header: "Aceitos a realizar",
      headerTitle: "Vagas aceitas no faturado cujo serviço ainda não aconteceu.",
      accessor: (row) => <FigureCell figure={row.acceptedUpcoming} />,
    },
    {
      header: "Em conferência",
      headerTitle:
        "Serviço terminou e espera a confirmação de presença para entrar na fatura. Depois de 35 dias sem desfecho, sai à parte e precisa do suporte.",
      accessor: (row) => (
        <div className="min-w-0">
          <FigureCell figure={row.inReview} />
          {row.stale && row.stale.count > 0 && (
            <div className="mt-1 text-[#b91c1c]">
              <p className="text-xs font-medium">{`Sem desfecho há mais de 35 dias: ${row.stale.label}`}</p>
              <SeeCalc calc={row.stale.calc} source={row.stale.source} />
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Faturas em aberto",
      headerTitle: "Faturas emitidas e não pagas.",
      accessor: (row) => <FigureCell figure={row.openInvoices} />,
    },
    {
      header: "Situação",
      accessor: (row) => (
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STANDING_STYLE[row.standing.code],
            )}
          >
            {row.standing.label}
          </span>
          {row.standing.calc && <SeeCalc calc={row.standing.calc} source="Faturas em aberto da empresa." />}
        </div>
      ),
    },
    {
      header: "Ações",
      mobile: "actions",
      accessor: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onSeeInvoices({ contractorUserId: row.contractorUserId, name: row.name ?? "Sem nome" })
            }
          >
            Ver faturas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBillingOf(row)}>
            Cobrança
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Indicadores das empresas faturadas" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map(({ key, icon, iconColor, money }) => {
          const card = data.cards[key];
          return (
            <div key={key} data-testid={`companies-kpi-${key}`}>
              <KpiCard
                className="h-full"
                title={card.label}
                value={money ? formatBrl(card.valueInCents) : String(card.count)}
                icon={icon}
                iconColor={iconColor}
                meta={card.meta}
                help={card.help}
                details={{ calc: card.calc, source: card.source }}
              />
            </div>
          );
        })}
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] p-6 text-center text-sm text-[#525252]">
          Nenhuma empresa no faturado. Para ligar: Empresas &gt; Documentos e cobrança &gt; Cobrança.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          caption="Empresas no faturado: bloqueadas e vencidas primeiro, depois pelo nome"
          searchPlaceholder="Buscar empresa (nome ou CNPJ)"
          searchKey="busca"
          isFetching={companies.isFetching}
        />
      )}

      <Dialog open={billingOf !== null} onOpenChange={(open) => !open && setBillingOf(null)} className="max-w-xl">
        <DialogContent className="relative max-h-[88vh] overflow-y-auto">
          <DialogClose onClick={() => setBillingOf(null)} />
          {billingOf && (
            <PreferencesDialog
              key={billingOf.contractorUserId}
              contractorUserId={billingOf.contractorUserId}
              companyName={billingOf.name ?? "Sem nome"}
              companyDocument={billingOf.document}
              blockEnabled={data.blockEnabled}
              initialTab="cobranca"
              onClose={() => setBillingOf(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** O número da célula e o "ver a conta" (abre com um toque; o `title` não existe no celular). */
function FigureCell({ figure }: { figure: CompanyFigure }) {
  const empty = figure.count === 0 && figure.valueInCents === 0;
  return (
    <div className="min-w-0 text-sm">
      <p className={empty ? "text-[#a3a3a3]" : "text-[#1d1d1b]"}>{figure.label}</p>
      {!empty && <SeeCalc calc={figure.calc} source={figure.source} />}
    </div>
  );
}

function SeeCalc({ calc, source }: { calc: string; source: string }) {
  return (
    <details className="mt-0.5 text-xs text-[#525252]">
      <summary className="cursor-pointer select-none text-[#737373]">ver a conta</summary>
      <p className="mt-1">{`Conta: ${calc}`}</p>
      <p className="mt-0.5">{`Fonte: ${source}`}</p>
    </details>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-[#1d1d1b]">{title}</p>
        <p className="text-[#525252]">{text}</p>
      </div>
    </div>
  );
}

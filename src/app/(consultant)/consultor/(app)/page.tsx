"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Building2, Loader2, Plus, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoicePills, type ChoicePillOption } from "@/components/ui/choice-pills";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatInstantDate } from "@/lib/date.utils";
import { formatPhoneBr } from "@/lib/utils";
import { useConsultantRegistrations } from "@/modules/consultant/application/use-consultant-registrations";
import { useConsultantProfile } from "@/modules/consultant/application/use-consultant-profile";
import {
  registrationPlace,
  registrationSourceLabel,
  registrationTypeLabel,
  totalPages,
} from "@/modules/consultant/application/registration-view";
import type { RegistrationItem, RegistrationTypeFilter } from "@/modules/consultant/domain/types";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const TYPE_OPTIONS: ChoicePillOption<RegistrationTypeFilter>[] = [
  { value: "all", label: "Todos" },
  { value: "freelancer", label: "Freelancers" },
  { value: "contractor", label: "Contratantes" },
];

function StatusPill({ status }: { status: RegistrationItem["status"] }) {
  return (
    <span
      className={
        status === "active"
          ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
          : "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
      }
    >
      {status === "active" ? "Ativo" : "Convite pendente"}
    </span>
  );
}

const COLUMNS: Column<RegistrationItem>[] = [
  { header: "Nome", accessor: "name", mobile: "title" },
  { header: "Empresa", accessor: (r) => r.companyName ?? "—" },
  { header: "Tipo", accessor: (r) => registrationTypeLabel(r) },
  { header: "Cidade", accessor: (r) => registrationPlace(r) },
  { header: "Origem", accessor: (r) => registrationSourceLabel(r.source) },
  { header: "Telefone", accessor: (r) => formatPhoneBr(r.phone) },
  { header: "E-mail", accessor: (r) => r.email ?? "—", className: "hidden xl:table-cell" },
  { header: "Status", accessor: (r) => <StatusPill status={r.status} /> },
  {
    header: "Cadastrado em",
    accessor: (r) => formatInstantDate(r.createdAt),
    className: "hidden lg:table-cell",
  },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function NewRegistrationButton() {
  return (
    <Button asChild className="font-medium">
      <Link href="/consultor/cadastrar">
        <Plus className="h-4 w-4" />
        Novo cadastro
      </Link>
    </Button>
  );
}

export default function ConsultorDashboardPage() {
  const [type, setType] = useState<RegistrationTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const filters = useMemo(() => ({ type, q, page, pageSize: PAGE_SIZE }), [type, q, page]);
  const registrations = useConsultantRegistrations(filters);
  const profile = useConsultantProfile();

  const data = registrations.data;
  const pages = totalPages(data?.total ?? 0, data?.pageSize ?? PAGE_SIZE);
  const hasFilters = type !== "all" || q !== "";
  const isEmptyAccount = !!data && data.total === 0 && !hasFilters;

  function changeType(next: RegistrationTypeFilter) {
    setType(next);
    setPage(1);
  }

  function changeSearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  const totals = profile.data?.totals;

  return (
    <div>
      <PageHeader
        title="Meus cadastros"
        description="Freelancers e contratantes que você trouxe"
        action={<NewRegistrationButton />}
      />

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard title="Cadastros" value={String(totals.registrations)} icon={Users} />
          <KpiCard title="Freelancers" value={String(totals.freelancers)} icon={User} />
          <KpiCard
            title="Empresas"
            value={String(totals.contractors)}
            icon={Building2}
            help="Contratantes do Freela Empresas e do Freela em Casa."
          />
          <KpiCard
            title="Empresas com vaga"
            value={String(totals.contractorsWithVacancy)}
            icon={Briefcase}
            help="Contratantes que já publicaram pelo menos uma vaga."
          />
        </div>
      )}

      {registrations.isLoading && !data ? (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : registrations.isError ? (
        <div className="flex h-[40vh] items-center justify-center">
          <p className="text-red-500">Erro ao carregar seus cadastros.</p>
        </div>
      ) : isEmptyAccount ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e5e5e5] bg-white p-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eca826]/10">
            <Users className="h-6 w-6 text-[#eca826]" />
          </div>
          <p className="mb-1 text-sm font-semibold text-[#1d1d1b]">Nenhum cadastro ainda</p>
          <p className="mb-4 text-xs text-[#737373]">
            Compartilhe seu link em &quot;Meu perfil&quot; ou cadastre alguém agora.
          </p>
          <NewRegistrationButton />
        </div>
      ) : (
        <DataTable
          columns={COLUMNS}
          data={data?.items ?? []}
          searchPlaceholder="Buscar por nome, empresa, e-mail ou telefone..."
          controlledSearch={{ value: search, onChange: changeSearch }}
          isFetching={registrations.isFetching}
          filters={
            <ChoicePills
              options={TYPE_OPTIONS}
              value={type}
              onChange={changeType}
              aria-label="Tipo de cadastro"
            />
          }
          footer={
            data ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#737373]">
                  {data.total} cadastro(s) · página {data.page} de {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || registrations.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pages || registrations.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

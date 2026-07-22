"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { useAdminFixedJobs, useCreateAdminFixedJob } from "@/modules/admin/application/use-admin-fixed-jobs";
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import type { FixedJobItem, FixedJobWorkScheduleSlot } from "@/modules/admin/infrastructure/fixed-jobs-api";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate } from "@/lib/date.utils";

function formatSalary(
  min: number | null,
  max: number | null,
  proposal?: number | null,
): string {
  const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  // Proposta única primeiro: é o campo que web e admin realmente gravam —
  // min/max ficam nulos nesses fluxos e a coluna vivia em "—".
  if (proposal != null) return fmt(proposal);
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  if (max != null) return `Até ${fmt(max)}`;
  return "—";
}

function mapStatus(status: string) {
  return status.toUpperCase() === "OPEN" ? ("open" as const) : ("finished" as const);
}

function mapToRow(v: FixedJobItem) {
  return {
    id: v.id,
    empresa: v.companyName,
    cargo: v.role,
    lugar: v.location,
    salario: formatSalary(v.salaryMinInCents, v.salaryMaxInCents, v.salaryProposalInCents),
    candidatos: v.applicationCount,
    // createdAt é INSTANTE UTC — formatVacancyDate (data pura) mostrava o dia
    // seguinte para posts criados após as 21h de Brasília.
    data: formatInstantDate(v.createdAt),
    status: mapStatus(v.status),
    statusKey: v.status.toUpperCase(),
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapToRow>;

const statusFilters = [
  { key: "all", label: "Todas" },
  { key: "OPEN", label: "Abertas" },
  { key: "CLOSED", label: "Encerradas" },
] as const;

type StatusKey = (typeof statusFilters)[number]["key"];

// ---------------------------------------------------------------------------
// Formulário: criar vaga fixa/CLT em nome de um contratante
// ---------------------------------------------------------------------------

type FixedJobFormState = {
  contractorUserId: string;
  title: string;
  role: string;
  category: string;
  companyName: string;
  location: string;
  salaryProposal: string;
  workScheduleSlots: FixedJobWorkScheduleSlot[];
  benefits: string;
  contactEmail: string;
  contactPhone: string;
  applicationInstructions: string;
  description: string;
};

const initialFixedJobForm: FixedJobFormState = {
  contractorUserId: "",
  title: "",
  role: "",
  category: "",
  companyName: "",
  location: "",
  salaryProposal: "",
  workScheduleSlots: [],
  benefits: "",
  contactEmail: "",
  contactPhone: "",
  applicationInstructions: "",
  description: "",
};

const WEEK_DAYS = [
  { id: "monday", label: "Segunda" },
  { id: "tuesday", label: "Terça" },
  { id: "wednesday", label: "Quarta" },
  { id: "thursday", label: "Quinta" },
  { id: "friday", label: "Sexta" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const FIXED_JOB_MAX_SALARY_IN_CENTS = 5_000_000;

function toCents(value: string): number | undefined {
  // Aceita pt-BR ("3.500,00" / "3500,00") E ponto decimal ("3500.00").
  // O parser antigo descartava TODO ponto: "350.50" virava 35050 reais (100x).
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let normalized = trimmed;
  if (trimmed.includes(",")) {
    // vírgula é o decimal; pontos são milhar
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = trimmed.match(/\./g)?.length ?? 0;
    const afterLastDot = trimmed.split(".").pop() ?? "";
    // um ponto só com 1-2 casas = decimal ("350.5"/"350.50"); resto = milhar
    if (dots > 1 || (dots === 1 && afterLastDot.length === 3)) {
      normalized = trimmed.replace(/\./g, "");
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function contractorLabel(c: ContractorItem): string {
  return c.companyName?.trim() || c.contactName || "(sem nome)";
}

function contractorLocation(c: ContractorItem): string {
  return [c.city, c.uf].filter(Boolean).join("/");
}

function formatScheduleSlots(slots: FixedJobWorkScheduleSlot[]): string | undefined {
  if (!slots.length) return undefined;
  // Ordena por dia da semana — a ordem de clique nos checkboxes gerava
  // "Sexta • Segunda" no texto que vai pros candidatos.
  const order = new Map(WEEK_DAYS.map((d, i) => [d.label, i]));
  return [...slots]
    .sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99))
    .map((slot) => `${slot.day} ${slot.start}-${slot.end}`)
    .join(" • ");
}

function getApiErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (typeof data !== "object" || data === null) return null;
  const message =
    (data as { error?: { message?: unknown }; message?: unknown }).error?.message ??
    (data as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function CreateFixedJobDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: contractors } = useAdminContractors();
  const createMutation = useCreateAdminFixedJob();
  const [form, setForm] = useState<FixedJobFormState>(initialFixedJobForm);
  const [error, setError] = useState<string | null>(null);

  const contractorOptions = useMemo(
    () =>
      [...(contractors ?? [])].sort((a, b) =>
        contractorLabel(a).localeCompare(contractorLabel(b), "pt-BR"),
      ),
    [contractors],
  );

  function updateField(field: keyof FixedJobFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleContractorChange(userId: string) {
    const contractor = contractorOptions.find((c) => c.userId === userId);
    setForm((current) => ({
      ...current,
      contractorUserId: userId,
      companyName: contractor ? contractorLabel(contractor) : current.companyName,
      location: contractor ? contractorLocation(contractor) : current.location,
      contactEmail: contractor?.contactEmail ?? contractor?.registrationEmail ?? current.contactEmail,
      contactPhone: contractor?.contactPhone ?? current.contactPhone,
    }));
  }

  function toggleScheduleDay(day: string) {
    setForm((current) => {
      const exists = current.workScheduleSlots.some((slot) => slot.day === day);
      return {
        ...current,
        workScheduleSlots: exists
          ? current.workScheduleSlots.filter((slot) => slot.day !== day)
          : [...current.workScheduleSlots, { day, start: "08:00", end: "18:00" }],
      };
    });
  }

  function updateScheduleSlot(day: string, field: "start" | "end", value: string) {
    setForm((current) => ({
      ...current,
      workScheduleSlots: current.workScheduleSlots.map((slot) =>
        slot.day === day ? { ...slot, [field]: value } : slot,
      ),
    }));
  }

  function close() {
    setForm(initialFixedJobForm);
    setError(null);
    onOpenChange(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.contractorUserId) return setError("Selecione o contratante.");
    if (!form.title.trim()) return setError("Informe o título da vaga.");
    if (!form.role.trim()) return setError("Informe o cargo.");
    if (!form.companyName.trim()) return setError("Informe a empresa.");
    if (!form.location.trim()) return setError("Informe a localidade.");
    if (!form.description.trim()) return setError("Informe a descrição da vaga.");

    const salaryProposalInCents = toCents(form.salaryProposal);
    if (form.salaryProposal.trim() && salaryProposalInCents === undefined) {
      return setError("Informe uma proposta salarial válida.");
    }
    if (salaryProposalInCents !== undefined && salaryProposalInCents > FIXED_JOB_MAX_SALARY_IN_CENTS) {
      return setError("A proposta salarial deve ser de até R$ 50.000,00.");
    }

    createMutation.mutate(
      {
        contractorUserId: form.contractorUserId,
        title: form.title.trim(),
        role: form.role.trim(),
        category: form.category.trim() || undefined,
        companyName: form.companyName.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        salaryProposalInCents,
        workSchedule: formatScheduleSlots(form.workScheduleSlots),
        workScheduleSlots: form.workScheduleSlots.length ? form.workScheduleSlots : undefined,
        benefits: form.benefits.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        applicationInstructions: form.applicationInstructions.trim() || undefined,
      },
      {
        onSuccess: () => close(),
        onError: (err) =>
          setError(getApiErrorMessage(err) ?? "Não foi possível criar a vaga fixa."),
      },
    );
  }

  const textareaClass =
    "w-full resize-none rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] placeholder:text-[#a3a3a3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eca826]";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogClose onClick={close} />
        <DialogHeader>
          <DialogTitle>Criar vaga fixa / CLT</DialogTitle>
          <DialogDescription>
            Publica uma vaga fixa no mural em nome de um contratante. Ela nasce aberta, igual à
            que o próprio contratante criaria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fj-contractor">Contratante *</Label>
            <NativeSelect
              id="fj-contractor"
              value={form.contractorUserId}
              onChange={(e) => handleContractorChange(e.target.value)}
            >
              <option value="">Selecione o contratante</option>
              {contractorOptions.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {contractorLabel(c)}
                  {contractorLocation(c) ? ` — ${contractorLocation(c)}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fj-title">Título da vaga *</Label>
            <Input
              id="fj-title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Ex: Garçom efetivo"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fj-role">Cargo *</Label>
              <Input
                id="fj-role"
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
                placeholder="Ex: Garçom"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fj-category">Categoria</Label>
              <Input
                id="fj-category"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                placeholder="Ex: Bares & Restaurantes"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fj-company">Empresa *</Label>
              <Input
                id="fj-company"
                value={form.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fj-location">Localidade *</Label>
              <Input
                id="fj-location"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Cidade/UF"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fj-salary">Proposta salarial (R$)</Label>
            <Input
              id="fj-salary"
              inputMode="decimal"
              value={form.salaryProposal}
              onChange={(e) => updateField("salaryProposal", e.target.value)}
              placeholder="Ex: 3200"
            />
          </div>

          <div className="rounded-md border border-[#e5e5e5] p-3">
            <p className="mb-2 text-sm font-medium text-[#1d1d1b]">Jornada</p>
            <div className="grid gap-2">
              {WEEK_DAYS.map((day) => {
                const slot = form.workScheduleSlots.find((item) => item.day === day.label);
                return (
                  <div
                    key={day.id}
                    className="grid grid-cols-[96px_1fr] items-center gap-2 rounded-md bg-[#f7f7f7] px-2 py-2 text-sm"
                  >
                    <label className="flex items-center gap-2 font-medium text-[#1d1d1b]">
                      <input
                        type="checkbox"
                        checked={Boolean(slot)}
                        onChange={() => toggleScheduleDay(day.label)}
                        className="size-4 accent-[#eca826]"
                      />
                      {day.label}
                    </label>
                    {slot ? (
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <NativeSelect
                          value={slot.start}
                          onChange={(e) => updateScheduleSlot(day.label, "start", e.target.value)}
                          className="py-1.5"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </NativeSelect>
                        <span className="text-xs text-[#a3a3a3]">às</span>
                        <NativeSelect
                          value={slot.end}
                          onChange={(e) => updateScheduleSlot(day.label, "end", e.target.value)}
                          className="py-1.5"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    ) : (
                      <span className="text-xs text-[#a3a3a3]">Sem expediente</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fj-benefits">Benefícios</Label>
            <textarea
              id="fj-benefits"
              rows={2}
              value={form.benefits}
              onChange={(e) => updateField("benefits", e.target.value)}
              className={textareaClass}
              placeholder="Ex: Vale-transporte, vale-refeição"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fj-contact-email">E-mail de contato</Label>
              <Input
                id="fj-contact-email"
                type="email"
                value={form.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fj-contact-phone">Telefone de contato</Label>
              <Input
                id="fj-contact-phone"
                value={form.contactPhone}
                onChange={(e) => updateField("contactPhone", e.target.value)}
                placeholder="(11) 90000-0000"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fj-instructions">Instruções para o candidato</Label>
            <textarea
              id="fj-instructions"
              rows={2}
              value={form.applicationInstructions}
              onChange={(e) => updateField("applicationInstructions", e.target.value)}
              className={textareaClass}
              placeholder="Como o candidato deve se candidatar"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="fj-description">Descrição da vaga *</Label>
            <textarea
              id="fj-description"
              rows={5}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className={textareaClass}
              placeholder="Descreva a vaga, requisitos e responsabilidades"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar vaga fixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VagasFixasPage() {
  // Área controlada por permissão; criar vaga on-behalf segue super-admin.
  const { isSuperAdmin } = useAuth();
  const { isChecking, allowed } = useAreaGuard("FIXED_JOBS");
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const { data: posts, isLoading, isError } = useAdminFixedJobs(selectedConsultantId || undefined);
  const { data: consultants } = useAdminConsultants();
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [createOpen, setCreateOpen] = useState(false);

  if (isChecking || !allowed) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-red-500">Erro ao carregar vagas fixas.</p>
      </div>
    );
  }

  const allRows: Row[] = posts?.map(mapToRow) ?? [];
  const rows =
    statusFilter === "all" ? allRows : allRows.filter((r) => r.statusKey === statusFilter);

  const columns = [
    { header: "Empresa", accessor: "empresa" as const, sortable: true, sortAccessor: (r: Row) => r.empresa },
    { header: "Cargo", accessor: "cargo" as const, sortable: true, sortAccessor: (r: Row) => r.cargo },
    { header: "Lugar", accessor: "lugar" as const, className: "hidden md:table-cell" },
    ...(isSuperAdmin
      ? [
          {
            header: "Consultor",
            accessor: (row: Row) =>
              row.consultor ? (
                <span className="text-[#1d1d1b]">{row.consultor}</span>
              ) : (
                <span className="text-[#a3a3a3]">—</span>
              ),
            className: "hidden md:table-cell",
            sortable: true,
            sortAccessor: (r: Row) => r.consultor ?? "",
          },
        ]
      : []),
    { header: "Salário", accessor: "salario" as const, className: "hidden lg:table-cell" },
    {
      header: "Candidatos",
      accessor: (row: Row) => (
        <Link
          href={`/vagas-fixas/${row.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-[#eca826] transition-colors hover:underline"
          title="Ver candidatos"
        >
          <Users className="w-4 h-4" />
          {row.candidatos}
        </Link>
      ),
      sortable: true,
      sortAccessor: (r: Row) => r.candidatos,
    },
    { header: "Criada em", accessor: "data" as const, sortable: true, sortAccessor: (r: Row) => new Date(r.raw.createdAt) },
    { header: "Status", accessor: (row: Row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas Fixas / CLT"
        description="Vagas fixas (CLT/efetivas) publicadas no mural pelos contratantes"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Criar vaga fixa
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por empresa..."
        searchKey="empresa"
        filters={
          <div className="flex flex-col gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <label htmlFor="consultor-filter" className="text-xs font-medium text-[#737373]">
                  Consultor:
                </label>
                <select
                  id="consultor-filter"
                  value={selectedConsultantId}
                  onChange={(e) => setSelectedConsultantId(e.target.value)}
                  className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                >
                  <option value="">Todos os consultores</option>
                  {consultants?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.key
                      ? "bg-[#eca826] text-white"
                      : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
                  }`}
                >
                  {f.label} (
                  {f.key === "all"
                    ? allRows.length
                    : allRows.filter((r) => r.statusKey === f.key).length}
                  )
                </button>
              ))}
            </div>
          </div>
        }
        footer={
          <span className="inline-flex items-center gap-1.5 text-xs text-[#737373]">
            <Users className="w-3.5 h-3.5" />
            {rows.length} vaga(s)
          </span>
        }
      />
      <CreateFixedJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

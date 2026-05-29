"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, UserPlus, Copy, Power } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useAdminConsultants,
  useCreateAdminConsultant,
  useUpdateAdminConsultant,
} from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import type {
  ConsultantItem,
  CreateConsultantPayload,
} from "@/modules/admin/infrastructure/consultants-api";
import { buildReferralLink } from "@/modules/admin/infrastructure/referral-link";

const EMPTY_FORM = {
  name: "",
  code: "",
  city: "",
  uf: "",
  phone: "",
  email: "",
  commissionRate: "",
  notes: "",
};

export default function ConsultoresPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: consultants, isLoading, isError } = useAdminConsultants();
  const createMutation = useCreateAdminConsultant();
  const updateMutation = useUpdateAdminConsultant();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isHydrated, isSuperAdmin, router]);

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
  }

  async function copyLink(code: string) {
    const link = buildReferralLink(code, {
      webAppUrl: process.env.NEXT_PUBLIC_WEB_APP_URL,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de indicação copiado!");
    } catch {
      toast.error(`Não foi possível copiar. Link: ${link}`);
    }
  }

  async function toggleActive(consultant: ConsultantItem) {
    setTogglingId(consultant.id);
    try {
      await updateMutation.mutateAsync({
        id: consultant.id,
        payload: { isActive: !consultant.isActive },
      });
      toast.success(consultant.isActive ? "Consultor desativado." : "Consultor ativado.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao atualizar consultor"));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do consultor.");
      return;
    }

    const rate = form.commissionRate.trim() ? Number(form.commissionRate.replace(",", ".")) : undefined;
    if (rate !== undefined && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      toast.error("Comissão deve ser um número entre 0 e 100.");
      return;
    }

    const payload: CreateConsultantPayload = {
      name: form.name.trim(),
      ...(form.code.trim() ? { code: form.code.trim() } : {}),
      ...(form.city.trim() ? { city: form.city.trim() } : {}),
      ...(form.uf.trim() ? { uf: form.uf.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(rate !== undefined ? { commissionRate: rate } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      toast.success(`Consultor criado! Código: ${created.code}`);
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao criar consultor"));
    }
  }

  const columns = [
    { header: "Nome", accessor: "name" as const },
    {
      header: "Código",
      accessor: (row: ConsultantItem) => (
        <span className="font-mono text-xs font-semibold text-[#1d1d1b]">{row.code}</span>
      ),
    },
    {
      header: "Cidade",
      accessor: (row: ConsultantItem) =>
        row.city ? `${row.city}${row.uf ? `/${row.uf}` : ""}` : "—",
      className: "hidden md:table-cell",
    },
    {
      header: "Cadastros indicados",
      accessor: (row: ConsultantItem) => (
        <span className="font-semibold text-[#1d1d1b]">{row.referralsCount}</span>
      ),
      sortAccessor: (row: ConsultantItem) => row.referralsCount,
      sortable: true,
      className: "hidden lg:table-cell",
    },
    {
      header: "Comissão",
      accessor: (row: ConsultantItem) =>
        row.commissionRate != null ? `${row.commissionRate}%` : "—",
      className: "hidden lg:table-cell",
    },
    {
      header: "Status",
      accessor: (row: ConsultantItem) => (
        <span
          className={
            row.isActive
              ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              : "inline-flex items-center rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs font-medium text-[#737373]"
          }
        >
          {row.isActive ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      header: "Cadastrado em",
      accessor: (row: ConsultantItem) => formatInstantDate(row.createdAt),
      className: "hidden md:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: ConsultantItem) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyLink(row.code)}
            title="Copiar link de indicação"
            className="text-[#737373] hover:text-[#1d1d1b]"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleActive(row)}
            disabled={togglingId === row.id}
            title={row.isActive ? "Desativar" : "Ativar"}
            className={row.isActive ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}
          >
            {togglingId === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Consultores"
        description="Parceiros que indicam novos cadastros por um link dedicado (?ref=código)"
        action={
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar consultores.</p>
        </div>
      ) : consultants && consultants.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhum consultor cadastrado ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre o primeiro consultor para gerar um link de indicação.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={consultants ?? []}
          searchPlaceholder="Buscar por nome..."
          searchKey="name"
          defaultSort={{ index: 3, direction: "desc" }}
        />
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogClose onClick={() => setModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>Novo Consultor</DialogTitle>
            <DialogDescription>
              O código de indicação é gerado automaticamente a partir do nome se não for
              informado. Compartilhe o link <span className="font-mono">/cadastro?ref=CÓDIGO</span>{" "}
              para vincular novos cadastros a este consultor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: André Consultor"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Código (opcional)</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="Gerado se vazio"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commissionRate">Comissão (%)</Label>
                <Input
                  id="commissionRate"
                  inputMode="decimal"
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                  placeholder="Ex.: 10"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Ex.: Fortaleza"
                />
              </div>
              <div className="space-y-1.5 w-20">
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  maxLength={2}
                  value={form.uf}
                  onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
                  placeholder="CE"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(85) 99999-9999"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="andre@exemplo.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anotações internas (opcional)"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={createMutation.isPending}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  "Cadastrar consultor"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

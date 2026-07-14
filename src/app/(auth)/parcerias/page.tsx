"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Store, Copy, Power, BarChart3, Users } from "lucide-react";
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
  useAdminPartnerships,
  useCreateAdminPartnership,
  useUpdateAdminPartnership,
  useAdminPartnershipReport,
  useAdminPartnershipAdLeads,
} from "@/modules/admin/application/use-admin-partnerships";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import type {
  PartnershipItem,
  CreatePartnershipPayload,
} from "@/modules/admin/infrastructure/partnerships-api";
import { buildPartnershipLink } from "@/modules/admin/infrastructure/referral-link";

const EMPTY_FORM = {
  name: "",
  code: "",
  city: "",
  uf: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

export default function ParceriasPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: partnerships, isLoading, isError } = useAdminPartnerships();
  const createMutation = useCreateAdminPartnership();
  const updateMutation = useUpdateAdminPartnership();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reportPartner, setReportPartner] = useState<PartnershipItem | null>(null);
  const {
    data: report,
    isLoading: reportLoading,
    isError: reportError,
  } = useAdminPartnershipReport(reportPartner?.id ?? null);
  const [leadsPartner, setLeadsPartner] = useState<PartnershipItem | null>(null);
  const {
    data: adLeads,
    isLoading: leadsLoading,
    isError: leadsError,
  } = useAdminPartnershipAdLeads(leadsPartner?.id ?? null);

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
    const link = buildPartnershipLink(code, {
      webAppUrl: process.env.NEXT_PUBLIC_WEB_APP_URL,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de parceria copiado!");
    } catch {
      toast.error(`Não foi possível copiar. Link: ${link}`);
    }
  }

  async function toggleActive(partner: PartnershipItem) {
    setTogglingId(partner.id);
    try {
      await updateMutation.mutateAsync({
        id: partner.id,
        payload: { isActive: !partner.isActive },
      });
      toast.success(partner.isActive ? "Parceria desativada." : "Parceria ativada.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao atualizar parceria"));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome da parceria.");
      return;
    }

    const payload: CreatePartnershipPayload = {
      name: form.name.trim(),
      ...(form.code.trim() ? { code: form.code.trim() } : {}),
      ...(form.city.trim() ? { city: form.city.trim() } : {}),
      ...(form.uf.trim() ? { uf: form.uf.trim() } : {}),
      ...(form.contactName.trim() ? { contactName: form.contactName.trim() } : {}),
      ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
      ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      toast.success(`Parceria criada! Código: ${created.code}`);
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao criar parceria"));
    }
  }

  const columns = [
    { header: "Nome", accessor: "name" as const },
    {
      header: "Código",
      accessor: (row: PartnershipItem) => (
        <span className="font-mono text-xs font-semibold text-[#1d1d1b]">{row.code}</span>
      ),
    },
    {
      header: "Cidade",
      accessor: (row: PartnershipItem) =>
        row.city ? `${row.city}${row.uf ? `/${row.uf}` : ""}` : "—",
      className: "hidden md:table-cell",
    },
    {
      header: "Empresas cadastradas",
      accessor: (row: PartnershipItem) => (
        <span className="font-semibold text-[#1d1d1b]">{row.referralsCount}</span>
      ),
      sortAccessor: (row: PartnershipItem) => row.referralsCount,
      sortable: true,
      className: "hidden lg:table-cell",
    },
    {
      header: "Status",
      accessor: (row: PartnershipItem) => (
        <span
          className={
            row.isActive
              ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              : "inline-flex items-center rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs font-medium text-[#737373]"
          }
        >
          {row.isActive ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    {
      header: "Criada em",
      accessor: (row: PartnershipItem) => formatInstantDate(row.createdAt),
      className: "hidden md:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: PartnershipItem) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeadsPartner(row)}
            title="Ver leads de anúncio"
            className="text-[#737373] hover:text-[#1d1d1b]"
          >
            <Users className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReportPartner(row)}
            title="Ver relatório da parceria"
            className="text-[#737373] hover:text-[#1d1d1b]"
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyLink(row.code)}
            title="Copiar link de parceria"
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
            className={
              row.isActive
                ? "text-red-500 hover:text-red-600"
                : "text-green-600 hover:text-green-700"
            }
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
        title="Parcerias"
        description="Parceiros que trazem empresas por um link de cadastro próprio (?parceria=código)"
        action={
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Parceria
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar parcerias.</p>
        </div>
      ) : partnerships && partnerships.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <Store className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhuma parceria cadastrada ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre a primeira parceria para gerar um link de cadastro.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Parceria
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={partnerships ?? []}
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
            <DialogTitle>Nova Parceria</DialogTitle>
            <DialogDescription>
              O código da parceria é gerado automaticamente a partir do nome se não for
              informado. Compartilhe o link{" "}
              <span className="font-mono">/cadastro?parceria=CÓDIGO</span> para vincular novos
              cadastros de empresas a esta parceria.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da parceria</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Colibri"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
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
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ex.: Fortaleza"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactName">Nome do contato</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                placeholder="Ex.: Maria (responsável)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">E-mail do contato</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="contato@parceria.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contactPhone">Telefone do contato</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="(85) 99999-9999"
                />
              </div>
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
                  "Cadastrar parceria"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!reportPartner}
        onOpenChange={(open) => !open && setReportPartner(null)}
      >
        <DialogContent>
          <DialogClose onClick={() => setReportPartner(null)} />
          <DialogHeader>
            <DialogTitle>Relatório da parceria</DialogTitle>
            <DialogDescription>
              {reportPartner
                ? `${reportPartner.name} — código ${reportPartner.code}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {reportLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
            </div>
          ) : reportError ? (
            <div className="py-6 text-center text-sm text-red-500">
              Erro ao carregar o relatório da parceria.
            </div>
          ) : report ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[11px] text-[#737373]">Empresas cadastradas</p>
                  <p className="text-xl font-bold text-[#1d1d1b]">
                    {report.companiesRegistered}
                  </p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[11px] text-[#737373]">Vagas abertas</p>
                  <p className="text-xl font-bold text-[#1d1d1b]">
                    {report.vacanciesOpened}
                  </p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[11px] text-[#737373]">GMV gerado</p>
                  <p className="text-xl font-bold text-[#1d1d1b]">
                    {formatCurrency(report.gmvCents)}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#e5e5e5] pt-4 space-y-3">
                <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide">
                  Por módulo
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-[#e5e5e5] rounded-lg p-3">
                    <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
                      Bares &amp; Restaurantes
                    </p>
                    <p className="text-xs text-[#737373]">
                      Vagas: {report.byModule["bars-restaurants"].vacanciesOpened}
                    </p>
                    <p className="text-xs text-[#737373]">
                      GMV: {formatCurrency(report.byModule["bars-restaurants"].gmvCents)}
                    </p>
                  </div>
                  <div className="bg-white border border-[#e5e5e5] rounded-lg p-3">
                    <p className="text-sm font-semibold text-[#1d1d1b] mb-1">Freela em Casa</p>
                    <p className="text-xs text-[#737373]">
                      Vagas: {report.byModule["home-services"].vacanciesOpened}
                    </p>
                    <p className="text-xs text-[#737373]">
                      GMV: {formatCurrency(report.byModule["home-services"].gmvCents)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#a3a3a3]">
                Gerado em {formatInstantDate(report.generatedAt)}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportPartner(null)}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!leadsPartner}
        onOpenChange={(open) => !open && setLeadsPartner(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogClose onClick={() => setLeadsPartner(null)} />
          <DialogHeader>
            <DialogTitle>Leads de anúncio</DialogTitle>
            <DialogDescription>
              {leadsPartner
                ? `${leadsPartner.name} — usuários que clicaram no anúncio desta parceria`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {leadsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
            </div>
          ) : leadsError ? (
            <div className="py-6 text-center text-sm text-red-500">
              Erro ao carregar os leads da parceria.
            </div>
          ) : adLeads && adLeads.total > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-[#737373]">
                <span className="font-semibold text-[#1d1d1b]">{adLeads.total}</span>{" "}
                {adLeads.total === 1 ? "pessoa clicou" : "pessoas clicaram"} no anúncio.
              </p>
              <div className="max-h-[55vh] overflow-auto rounded-lg border border-[#e5e5e5]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#f7f7f7] text-[#737373]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nome</th>
                      <th className="px-3 py-2 text-left font-medium">E-mail</th>
                      <th className="px-3 py-2 text-left font-medium">Telefone</th>
                      <th className="px-3 py-2 text-left font-medium">CPF</th>
                      <th className="px-3 py-2 text-right font-medium">Cliques</th>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">
                        Último acesso
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f1f1]">
                    {adLeads.leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-[#fafafa]">
                        <td className="px-3 py-2 text-[#1d1d1b]">{lead.name || "—"}</td>
                        <td className="px-3 py-2 text-[#737373]">{lead.email || "—"}</td>
                        <td className="px-3 py-2 text-[#737373] whitespace-nowrap">
                          {lead.phone || "—"}
                        </td>
                        <td className="px-3 py-2 text-[#737373] whitespace-nowrap">
                          {lead.cpf || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-[#1d1d1b]">
                          {lead.clicksCount}
                        </td>
                        <td className="px-3 py-2 text-[#737373] whitespace-nowrap">
                          {formatInstantDate(lead.lastClickedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[#737373]">
              Nenhum lead ainda. Vincule um anúncio a esta parceria na aba Propagandas —
              cada clique de usuário logado aparecerá aqui.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeadsPartner(null)}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

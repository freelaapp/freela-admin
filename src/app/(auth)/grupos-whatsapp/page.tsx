"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, MessageCircle, Pencil, Trash2 } from "lucide-react";
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
  useVacancyGroupRoutes,
  useWhatsAppGroups,
  useCreateVacancyGroupRoute,
  useUpdateVacancyGroupRoute,
  useDeleteVacancyGroupRoute,
} from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import type { VacancyGroupRoute } from "@/modules/admin/infrastructure/whatsapp-groups-api";

const EMPTY_FORM = { id: "", city: "", groupJid: "", groupName: "" };

export default function GruposWhatsappPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();

  const { data: routes, isLoading, isError } = useVacancyGroupRoutes();
  const { data: groups, isLoading: groupsLoading, isError: groupsError } = useWhatsAppGroups();
  const createMutation = useCreateVacancyGroupRoute();
  const updateMutation = useUpdateVacancyGroupRoute();
  const deleteMutation = useDeleteVacancyGroupRoute();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const isEditing = Boolean(form.id);
  const saving = createMutation.isPending || updateMutation.isPending;

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(route: VacancyGroupRoute) {
    setForm({
      id: route.id,
      city: route.cityLabel,
      groupJid: route.groupJid,
      groupName: route.groupName ?? "",
    });
    setModalOpen(true);
  }

  function onSelectGroup(jid: string) {
    const group = groups?.find((g) => g.jid === jid);
    setForm((prev) => ({ ...prev, groupJid: jid, groupName: group?.name ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.city.trim() || !form.groupJid.trim()) {
      toast.error("Informe a cidade e selecione o grupo.");
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: form.id,
          payload: { city: form.city, groupJid: form.groupJid, groupName: form.groupName },
        });
        toast.success("Mapeamento atualizado.");
      } else {
        await createMutation.mutateAsync({
          city: form.city,
          groupJid: form.groupJid,
          groupName: form.groupName,
        });
        toast.success("Cidade vinculada ao grupo.");
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao salvar mapeamento"));
    }
  }

  async function handleDelete(route: VacancyGroupRoute) {
    if (!window.confirm(`Remover o vínculo de "${route.cityLabel}"?`)) return;
    try {
      await deleteMutation.mutateAsync(route.id);
      toast.success("Vínculo removido.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao remover"));
    }
  }

  const columns = [
    { header: "Cidade", accessor: "cityLabel" as const },
    {
      header: "Grupo",
      accessor: (row: VacancyGroupRoute) => row.groupName || row.groupJid,
    },
    {
      header: "JID",
      accessor: (row: VacancyGroupRoute) => (
        <span className="font-mono text-xs text-[#737373]">{row.groupJid}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Criado em",
      accessor: (row: VacancyGroupRoute) => formatInstantDate(row.createdAt),
      className: "hidden md:table-cell",
    },
    {
      header: "",
      accessor: (row: VacancyGroupRoute) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(row)}
            className="text-[#737373] hover:text-[#1d1d1b]"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row)}
            className="text-red-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Grupos WhatsApp"
        description="Defina para qual grupo as vagas de cada cidade são enviadas. Cidades sem mapeamento caem no grupo padrão."
        action={
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Vincular cidade
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar mapeamentos.</p>
        </div>
      ) : routes && routes.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <MessageCircle className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhuma cidade vinculada ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Vincule uma cidade a um grupo para rotear as vagas automaticamente.
          </p>
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Vincular cidade
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={routes ?? []}
          searchPlaceholder="Buscar por cidade..."
          searchKey="cityLabel"
        />
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setForm(EMPTY_FORM);
        }}
      >
        <DialogContent>
          <DialogClose onClick={() => setModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar vínculo" : "Vincular cidade a grupo"}</DialogTitle>
            <DialogDescription>
              Vagas de contratantes dessa cidade serão enviadas ao grupo escolhido.
              A correspondência ignora acentos, maiúsculas e sufixo de estado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ex.: Jundiaí"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group">Grupo do WhatsApp</Label>
              {groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#737373]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando grupos...
                </div>
              ) : groupsError ? (
                <p className="text-sm text-red-500">
                  Não foi possível carregar os grupos da Evolution. Verifique a conexão da instância.
                </p>
              ) : (
                <select
                  id="group"
                  value={form.groupJid}
                  onChange={(e) => onSelectGroup(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#e5e5e5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/40"
                >
                  <option value="">Selecione um grupo...</option>
                  {groups?.map((g) => (
                    <option key={g.jid} value={g.jid}>
                      {g.name}
                      {g.participants != null ? ` (${g.participants})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : isEditing ? (
                  "Salvar alterações"
                ) : (
                  "Vincular"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

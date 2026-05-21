"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  useVacancyGroupStateRoutes,
  useCreateVacancyGroupStateRoute,
  useUpdateVacancyGroupStateRoute,
  useDeleteVacancyGroupStateRoute,
} from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type {
  VacancyGroupRoute,
  VacancyGroupStateRoute,
  WhatsAppGroup,
} from "@/modules/admin/infrastructure/whatsapp-groups-api";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const EMPTY_CITY = { id: "", city: "", groupJid: "", groupName: "" };
const EMPTY_STATE = { id: "", uf: "", groupJid: "", groupName: "" };

/** Native select listing the WhatsApp groups from fetchAllGroups. */
function GroupSelect({
  value,
  onChange,
  groups,
  loading,
  error,
}: {
  value: string;
  onChange: (jid: string) => void;
  groups: WhatsAppGroup[] | undefined;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#737373]">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando grupos...
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-red-500">
        Não foi possível carregar os grupos da Evolution. Verifique a conexão da instância.
      </p>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  );
}

export default function GruposWhatsappPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();

  const { data: groups, isLoading: groupsLoading, isError: groupsError } = useWhatsAppGroups();

  // City routes (overrides)
  const { data: routes, isLoading, isError } = useVacancyGroupRoutes();
  const createCity = useCreateVacancyGroupRoute();
  const updateCity = useUpdateVacancyGroupRoute();
  const deleteCity = useDeleteVacancyGroupRoute();

  // State (UF) routes (base)
  const { data: stateRoutes, isLoading: statesLoading, isError: statesError } =
    useVacancyGroupStateRoutes();
  const createState = useCreateVacancyGroupStateRoute();
  const updateState = useUpdateVacancyGroupStateRoute();
  const deleteState = useDeleteVacancyGroupStateRoute();

  const [tab, setTab] = useState("states");
  const [cityModal, setCityModal] = useState(false);
  const [cityForm, setCityForm] = useState(EMPTY_CITY);
  const [stateModal, setStateModal] = useState(false);
  const [stateForm, setStateForm] = useState(EMPTY_STATE);

  const cityEditing = Boolean(cityForm.id);
  const stateEditing = Boolean(stateForm.id);
  const citySaving = createCity.isPending || updateCity.isPending;
  const stateSaving = createState.isPending || updateState.isPending;

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) router.replace("/dashboard");
  }, [isHydrated, isSuperAdmin, router]);

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  function pickGroupName(jid: string): string {
    return groups?.find((g) => g.jid === jid)?.name ?? "";
  }

  // ─── City handlers ──────────────────────────────────────────────────────
  async function submitCity(e: React.FormEvent) {
    e.preventDefault();
    if (!cityForm.city.trim() || !cityForm.groupJid.trim()) {
      toast.error("Informe a cidade e selecione o grupo.");
      return;
    }
    try {
      if (cityEditing) {
        await updateCity.mutateAsync({
          id: cityForm.id,
          payload: { city: cityForm.city, groupJid: cityForm.groupJid, groupName: cityForm.groupName },
        });
        toast.success("Exceção atualizada.");
      } else {
        await createCity.mutateAsync({
          city: cityForm.city,
          groupJid: cityForm.groupJid,
          groupName: cityForm.groupName,
        });
        toast.success("Cidade vinculada ao grupo.");
      }
      setCityModal(false);
      setCityForm(EMPTY_CITY);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao salvar"));
    }
  }

  async function removeCity(route: VacancyGroupRoute) {
    if (!window.confirm(`Remover o vínculo de "${route.cityLabel}"?`)) return;
    try {
      await deleteCity.mutateAsync(route.id);
      toast.success("Vínculo removido.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao remover"));
    }
  }

  // ─── State handlers ─────────────────────────────────────────────────────
  async function submitState(e: React.FormEvent) {
    e.preventDefault();
    if (!stateForm.uf.trim() || !stateForm.groupJid.trim()) {
      toast.error("Selecione o estado e o grupo.");
      return;
    }
    try {
      if (stateEditing) {
        await updateState.mutateAsync({
          id: stateForm.id,
          payload: { uf: stateForm.uf, groupJid: stateForm.groupJid, groupName: stateForm.groupName },
        });
        toast.success("Estado atualizado.");
      } else {
        await createState.mutateAsync({
          uf: stateForm.uf,
          groupJid: stateForm.groupJid,
          groupName: stateForm.groupName,
        });
        toast.success("Estado vinculado ao grupo.");
      }
      setStateModal(false);
      setStateForm(EMPTY_STATE);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao salvar"));
    }
  }

  async function removeState(route: VacancyGroupStateRoute) {
    if (!window.confirm(`Remover o vínculo do estado "${route.uf}"?`)) return;
    try {
      await deleteState.mutateAsync(route.id);
      toast.success("Vínculo removido.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao remover"));
    }
  }

  const groupCol = (jid: string, name: string | null) => name || jid;

  const cityColumns = [
    { header: "Cidade", accessor: "cityLabel" as const },
    { header: "Grupo", accessor: (r: VacancyGroupRoute) => groupCol(r.groupJid, r.groupName) },
    {
      header: "JID",
      accessor: (r: VacancyGroupRoute) => (
        <span className="font-mono text-xs text-[#737373]">{r.groupJid}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "",
      accessor: (r: VacancyGroupRoute) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setCityForm({ id: r.id, city: r.cityLabel, groupJid: r.groupJid, groupName: r.groupName ?? "" }); setCityModal(true); }} className="text-[#737373] hover:text-[#1d1d1b]">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => removeCity(r)} className="text-red-500 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const stateColumns = [
    { header: "Estado", accessor: "uf" as const },
    { header: "Grupo", accessor: (r: VacancyGroupStateRoute) => groupCol(r.groupJid, r.groupName) },
    {
      header: "JID",
      accessor: (r: VacancyGroupStateRoute) => (
        <span className="font-mono text-xs text-[#737373]">{r.groupJid}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "",
      accessor: (r: VacancyGroupStateRoute) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setStateForm({ id: r.id, uf: r.uf, groupJid: r.groupJid, groupName: r.groupName ?? "" }); setStateModal(true); }} className="text-[#737373] hover:text-[#1d1d1b]">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => removeState(r)} className="text-red-500 hover:text-red-600">
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
        description="Roteamento das vagas por grupo. A regra: a cidade tem prioridade; sem cidade, vai pelo estado; sem nenhum, cai no grupo padrão."
      />

      <div className="mt-2">
      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="states">Por estado (base)</TabsTrigger>
          <TabsTrigger value="cities">Por cidade (exceções)</TabsTrigger>
        </TabsList>

        {/* ─── Estados ─── */}
        <TabsContent value="states">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setStateForm(EMPTY_STATE); setStateModal(true); }} className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
              <Plus className="w-4 h-4 mr-2" /> Vincular estado
            </Button>
          </div>
          {statesLoading ? (
            <div className="flex items-center justify-center h-[30vh]"><Loader2 className="h-10 w-10 animate-spin text-[#eca826]" /></div>
          ) : statesError ? (
            <p className="text-red-500">Erro ao carregar estados.</p>
          ) : (
            <DataTable columns={stateColumns} data={stateRoutes ?? []} searchPlaceholder="Buscar por UF..." searchKey="uf" />
          )}
        </TabsContent>

        {/* ─── Cidades ─── */}
        <TabsContent value="cities">
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setCityForm(EMPTY_CITY); setCityModal(true); }} className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
              <Plus className="w-4 h-4 mr-2" /> Vincular cidade
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-[30vh]"><Loader2 className="h-10 w-10 animate-spin text-[#eca826]" /></div>
          ) : isError ? (
            <p className="text-red-500">Erro ao carregar cidades.</p>
          ) : routes && routes.length === 0 ? (
            <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-[#eca826]" />
              </div>
              <p className="text-sm font-semibold text-[#1d1d1b] mb-1">Nenhuma exceção de cidade</p>
              <p className="text-xs text-[#737373]">Use exceções só quando uma cidade precisa de um grupo dedicado (ex.: Jundiaí).</p>
            </div>
          ) : (
            <DataTable columns={cityColumns} data={routes ?? []} searchPlaceholder="Buscar por cidade..." searchKey="cityLabel" />
          )}
        </TabsContent>
      </Tabs>
      </div>

      {/* ─── Modal Estado ─── */}
      <Dialog open={stateModal} onOpenChange={(o) => { setStateModal(o); if (!o) setStateForm(EMPTY_STATE); }}>
        <DialogContent>
          <DialogClose onClick={() => setStateModal(false)} />
          <DialogHeader>
            <DialogTitle>{stateEditing ? "Editar estado" : "Vincular estado a grupo"}</DialogTitle>
            <DialogDescription>Vagas de contratantes desse estado vão pro grupo escolhido, exceto cidades com grupo dedicado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitState} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="uf">Estado (UF)</Label>
              <select id="uf" value={stateForm.uf} onChange={(e) => setStateForm({ ...stateForm, uf: e.target.value })} className="w-full h-10 rounded-md border border-[#e5e5e5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/40">
                <option value="">Selecione o estado...</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Grupo do WhatsApp</Label>
              <GroupSelect value={stateForm.groupJid} onChange={(jid) => setStateForm({ ...stateForm, groupJid: jid, groupName: pickGroupName(jid) })} groups={groups} loading={groupsLoading} error={groupsError} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStateModal(false)} disabled={stateSaving} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button type="submit" disabled={stateSaving} className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
                {stateSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : stateEditing ? "Salvar" : "Vincular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Cidade ─── */}
      <Dialog open={cityModal} onOpenChange={(o) => { setCityModal(o); if (!o) setCityForm(EMPTY_CITY); }}>
        <DialogContent>
          <DialogClose onClick={() => setCityModal(false)} />
          <DialogHeader>
            <DialogTitle>{cityEditing ? "Editar exceção" : "Vincular cidade a grupo"}</DialogTitle>
            <DialogDescription>Exceção por cidade — tem prioridade sobre o grupo do estado. Ignora acento, maiúscula e sufixo de UF.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCity} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={cityForm.city} onChange={(e) => setCityForm({ ...cityForm, city: e.target.value })} placeholder="Ex.: Jundiaí" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Grupo do WhatsApp</Label>
              <GroupSelect value={cityForm.groupJid} onChange={(jid) => setCityForm({ ...cityForm, groupJid: jid, groupName: pickGroupName(jid) })} groups={groups} loading={groupsLoading} error={groupsError} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCityModal(false)} disabled={citySaving} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button type="submit" disabled={citySaving} className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
                {citySaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : cityEditing ? "Salvar" : "Vincular"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

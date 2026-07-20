"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  MessageSquarePlus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGroupDiagnostics,
  useCreateWhatsappGroup,
  useAddGroupParticipants,
} from "@/modules/admin/application/use-admin-whatsapp-groups";
import {
  useDedicatedGroups,
  useCreateDedicatedGroup,
  useUpdateDedicatedGroup,
  useDeleteDedicatedGroup,
  useCreateDedicatedWhatsappGroup,
} from "@/modules/admin/application/use-admin-dedicated-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { GroupDiagnostic } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import type { DedicatedGroupRule } from "@/modules/admin/infrastructure/dedicated-groups-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function getAxiosErrorMessage(err: unknown): string | null {
  const e = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return e?.response?.data?.error?.message ?? e?.response?.data?.message ?? null;
}

export default function GruposWhatsappPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: groups, isLoading, isError } = useGroupDiagnostics();
  const createGroup = useCreateWhatsappGroup();
  const addMembers = useAddGroupParticipants();

  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [participants, setParticipants] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<GroupDiagnostic | null>(null);
  const [addPhones, setAddPhones] = useState("");

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

  const recognized = groups?.filter((g) => g.recognized).length ?? 0;
  const offPattern = groups?.filter((g) => !g.recognized).length ?? 0;
  const rows = (groups ?? []).map((g) => ({ ...g, id: g.jid }));

  const previewName =
    city.trim() && uf.trim()
      ? `Vagas Freela ${city.trim()} ${uf.trim().toUpperCase()}`
      : null;

  const closeModal = () => {
    setOpen(false);
    setCity("");
    setUf("");
    setParticipants("");
  };

  const handleCreate = async () => {
    const cleanCity = city.trim();
    const cleanUf = uf.trim().toUpperCase();
    if (cleanCity.length < 2) {
      toast.error("Informe a cidade.");
      return;
    }
    if (!/^[A-Z]{2}$/.test(cleanUf)) {
      toast.error("UF inválida (use 2 letras, ex: SP).");
      return;
    }
    const parsedParticipants = participants
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    try {
      const group = await createGroup.mutateAsync({
        city: cleanCity,
        uf: cleanUf,
        participants: parsedParticipants,
      });
      toast.success(`Grupo "${group.name}" criado.`);
      closeModal();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err) ??
          "Não foi possível criar o grupo. Verifique a conexão da instância e os participantes.",
      );
    }
  };

  const openAdd = (g: GroupDiagnostic) => {
    setAddTarget(g);
    setAddPhones("");
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddTarget(null);
    setAddPhones("");
  };

  const handleAddMembers = async () => {
    if (!addTarget) return;
    const parsed = addPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      toast.error("Informe ao menos um telefone (com DDD).");
      return;
    }
    try {
      const res = await addMembers.mutateAsync({
        groupId: addTarget.jid,
        participants: parsed,
      });
      toast.success(
        `${res.requested} ${res.requested === 1 ? "número enviado" : "números enviados"} para "${addTarget.name}".`,
      );
      closeAdd();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err) ??
          "Não foi possível adicionar. Verifique se o bot é admin do grupo e se os números têm WhatsApp.",
      );
    }
  };

  const columns = [
    { header: "Grupo", accessor: "name" as const },
    {
      header: "Cidade",
      accessor: (g: GroupDiagnostic) => g.city ?? "—",
    },
    {
      header: "UF",
      accessor: (g: GroupDiagnostic) => g.uf ?? "—",
    },
    {
      header: "Status",
      accessor: (g: GroupDiagnostic) =>
        g.recognized ? (
          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> Reconhecido
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
            <AlertTriangle className="w-4 h-4" /> Fora do padrão
          </span>
        ),
    },
    {
      header: "Participantes",
      accessor: (g: GroupDiagnostic) => g.participants ?? "—",
      className: "hidden md:table-cell",
    },
    {
      header: "JID",
      accessor: (g: GroupDiagnostic) => (
        <span className="font-mono text-xs text-[#737373]">{g.jid}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Ações",
      accessor: (g: GroupDiagnostic) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openAdd(g)}
          className="border-[#e5e5e5] text-[#525252] hover:bg-[#f7f7f7] h-8"
          title="Adicionar membros a este grupo"
        >
          <UserPlus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      ),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Grupos WhatsApp"
        description='O roteamento é automático pelo nome do grupo no padrão "Vagas Freela <Cidade> <UF>". A vaga de um contratante vai para o grupo da sua cidade + estado. Grupos fora do padrão não recebem vagas.'
        action={
          <Button onClick={() => setOpen(true)} className="bg-[#eca826] hover:bg-[#d8961f] text-white">
            <Plus className="w-4 h-4 mr-1" /> Criar grupo
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">
            Erro ao carregar grupos. Verifique a conexão da instância do WhatsApp (Z-API).
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 text-green-700 px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4" /> {recognized} reconhecidos
            </span>
            {offPattern > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" /> {offPattern} fora do padrão
              </span>
            )}
          </div>
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Buscar por grupo, cidade ou UF..."
            searchKey="name"
          />
        </>
      )}

      <DedicatedGroupsSection />

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar grupo de WhatsApp</DialogTitle>
            <DialogDescription>
              O nome é montado no padrão para o grupo receber vagas automaticamente. A instância
              (bot) entra como admin; informe ao menos um número para iniciar o grupo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="wpp-city">Cidade</Label>
                <Input
                  id="wpp-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Jundiaí"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wpp-uf">UF</Label>
                <Input
                  id="wpp-uf"
                  value={uf}
                  maxLength={2}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wpp-participants">Participantes (telefones com DDD)</Label>
              <Input
                id="wpp-participants"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="11999999999, 11988888888"
              />
              <p className="text-xs text-[#737373]">
                Separe por vírgula. O grupo precisa de ao menos um membro inicial — você adiciona os
                demais depois no WhatsApp.
              </p>
            </div>
            {previewName && (
              <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
                Nome do grupo: <span className="font-semibold">{previewName}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModal}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createGroup.isPending}
              className="bg-[#eca826] hover:bg-[#d8961f] text-white"
            >
              {createGroup.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar grupo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(v) => (v ? setAddOpen(true) : closeAdd())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar membros</DialogTitle>
            <DialogDescription>
              Adiciona telefones ao grupo {addTarget ? `"${addTarget.name}"` : ""}. Mesmo campo da
              criação — o bot precisa ser admin do grupo; quem não puder ser adicionado direto
              recebe um convite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-participants">Telefones (com DDD)</Label>
              <Input
                id="add-participants"
                value={addPhones}
                onChange={(e) => setAddPhones(e.target.value)}
                placeholder="11999999999, 11988888888"
              />
              <p className="text-xs text-[#737373]">
                Separe por vírgula. Os números precisam ter WhatsApp.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeAdd}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={addMembers.isPending}
              className="bg-[#eca826] hover:bg-[#d8961f] text-white"
            >
              {addMembers.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Grupos de notificação DEDICADOS por contratante (ex.: "Notificações Coco Bambu Jundiaí").
 * Data-driven: cada regra casa um contratante por empresa (+ cidade) e replica a vaga ao
 * grupo cujo nome segue o padrão "Notificações <rótulo>". O casamento do grupo é pelo NOME.
 */
function DedicatedGroupsSection() {
  const { data: rules, isLoading } = useDedicatedGroups();
  const createRule = useCreateDedicatedGroup();
  const updateRule = useUpdateDedicatedGroup();
  const deleteRule = useDeleteDedicatedGroup();
  const createWppGroup = useCreateDedicatedWhatsappGroup();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DedicatedGroupRule | null>(null);
  const [label, setLabel] = useState("");
  const [companyMatch, setCompanyMatch] = useState("");
  const [cityMatch, setCityMatch] = useState("");

  const [wppOpen, setWppOpen] = useState(false);
  const [wppTarget, setWppTarget] = useState<DedicatedGroupRule | null>(null);
  const [participants, setParticipants] = useState("");

  const previewName = label.trim() ? `Notificações ${label.trim().replace(/\s+/g, " ")}` : null;

  const openCreate = () => {
    setEditing(null);
    setLabel("");
    setCompanyMatch("");
    setCityMatch("");
    setFormOpen(true);
  };

  const openEdit = (r: DedicatedGroupRule) => {
    setEditing(r);
    setLabel(r.label);
    setCompanyMatch(r.companyMatch);
    setCityMatch(r.cityMatch ?? "");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const submitForm = async () => {
    const l = label.trim();
    const c = companyMatch.trim();
    const city = cityMatch.trim();
    if (l.length < 2) {
      toast.error("Informe o rótulo (ex.: Coco Bambu Jundiaí).");
      return;
    }
    if (c.length < 2) {
      toast.error("Informe o termo da empresa (ex.: coco bambu).");
      return;
    }
    try {
      if (editing) {
        await updateRule.mutateAsync({
          id: editing.id,
          input: { label: l, companyMatch: c, cityMatch: city || null },
        });
        toast.success("Regra atualizada.");
      } else {
        await createRule.mutateAsync({ label: l, companyMatch: c, cityMatch: city || null });
        toast.success("Regra criada.");
      }
      closeForm();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err) ?? "Não foi possível salvar a regra.");
    }
  };

  const toggle = async (r: DedicatedGroupRule) => {
    try {
      await updateRule.mutateAsync({ id: r.id, input: { enabled: !r.enabled } });
    } catch (err) {
      toast.error(getAxiosErrorMessage(err) ?? "Não foi possível alterar o status.");
    }
  };

  const remove = async (r: DedicatedGroupRule) => {
    if (
      !window.confirm(
        `Excluir a regra "${r.label}"? As vagas desse contratante deixam de ir ao grupo dedicado. O grupo no WhatsApp NÃO é apagado.`,
      )
    ) {
      return;
    }
    try {
      await deleteRule.mutateAsync(r.id);
      toast.success("Regra removida.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err) ?? "Não foi possível remover a regra.");
    }
  };

  const openWpp = (r: DedicatedGroupRule) => {
    setWppTarget(r);
    setParticipants("");
    setWppOpen(true);
  };

  const closeWpp = () => {
    setWppOpen(false);
    setWppTarget(null);
    setParticipants("");
  };

  const submitWpp = async () => {
    if (!wppTarget) return;
    const parsed = participants
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    try {
      const group = await createWppGroup.mutateAsync({ id: wppTarget.id, participants: parsed });
      toast.success(`Grupo "${group.name}" criado.`);
      closeWpp();
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err) ??
          "Não foi possível criar o grupo. Verifique a conexão da instância e os participantes.",
      );
    }
  };

  return (
    <div className="mt-10 border-t border-[#e5e5e5] pt-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#171717]">Grupos de notificação dedicados</h2>
          <p className="text-sm text-[#737373] max-w-2xl mt-1">
            Cada regra faz as vagas de um contratante irem TAMBÉM para um grupo próprio
            (&quot;Notificações &lt;rótulo&gt;&quot;), além do grupo da cidade. O contratante é
            identificado pelo termo da empresa (+ cidade). O grupo é encontrado pelo NOME — crie o
            grupo no padrão pelo botão da regra.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#eca826] hover:bg-[#d8961f] text-white shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" /> Nova regra
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <p className="text-sm text-[#737373] bg-[#f7f7f7] rounded-lg px-4 py-6 text-center">
          Nenhuma regra cadastrada. Crie uma para replicar as vagas de um contratante num grupo
          dedicado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#e5e5e5]">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7f7] text-[#737373]">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Rótulo</th>
                <th className="text-left font-medium px-4 py-2.5">Empresa (casa)</th>
                <th className="text-left font-medium px-4 py-2.5">Cidade (casa)</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-[#f0f0f0]">
                  <td className="px-4 py-2.5 font-medium text-[#171717]">{r.label}</td>
                  <td className="px-4 py-2.5 text-[#525252]">{r.companyMatch}</td>
                  <td className="px-4 py-2.5 text-[#525252]">{r.cityMatch || "qualquer"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggle(r)}
                      className={
                        r.enabled
                          ? "inline-flex items-center gap-1 text-green-600 text-xs font-medium"
                          : "inline-flex items-center gap-1 text-[#a3a3a3] text-xs font-medium"
                      }
                      title="Clique para ativar/desativar"
                    >
                      {r.enabled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Ativo
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" /> Inativo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWpp(r)}
                        className="border-[#e5e5e5] text-[#525252] hover:bg-[#f7f7f7] h-8"
                        title='Criar o grupo no WhatsApp no padrão "Notificações <rótulo>"'
                      >
                        <MessageSquarePlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(r)}
                        className="border-[#e5e5e5] text-[#525252] hover:bg-[#f7f7f7] h-8"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => remove(r)}
                        className="border-[#e5e5e5] text-red-600 hover:bg-red-50 h-8"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Criar / editar regra */}
      <Dialog open={formOpen} onOpenChange={(v) => (v ? setFormOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regra" : "Nova regra de grupo dedicado"}</DialogTitle>
            <DialogDescription>
              As vagas de um contratante cujo nome contém o termo da empresa (e a cidade, se
              informada) vão TAMBÉM para o grupo dedicado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dg-label">Rótulo (empresa + cidade)</Label>
              <Input
                id="dg-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Coco Bambu Jundiaí"
              />
              <p className="text-xs text-[#737373]">
                Vira o nome do grupo: &quot;Notificações &lt;rótulo&gt;&quot;. Inclua empresa e
                cidade.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dg-company">Termo da empresa</Label>
                <Input
                  id="dg-company"
                  value={companyMatch}
                  onChange={(e) => setCompanyMatch(e.target.value)}
                  placeholder="coco bambu"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dg-city">Termo da cidade (opcional)</Label>
                <Input
                  id="dg-city"
                  value={cityMatch}
                  onChange={(e) => setCityMatch(e.target.value)}
                  placeholder="jundia"
                />
              </div>
            </div>
            <p className="text-xs text-[#737373]">
              Casamento é por trecho, sem acento/maiúsculas (ex.: &quot;jundia&quot; casa
              &quot;Jundiaí&quot;). Cidade vazia = qualquer cidade.
            </p>
            {previewName && (
              <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
                Nome do grupo: <span className="font-semibold">{previewName}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeForm}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitForm}
              disabled={createRule.isPending || updateRule.isPending}
              className="bg-[#eca826] hover:bg-[#d8961f] text-white"
            >
              {createRule.isPending || updateRule.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editing ? (
                "Salvar"
              ) : (
                "Criar regra"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar o grupo no WhatsApp */}
      <Dialog open={wppOpen} onOpenChange={(v) => (v ? setWppOpen(true) : closeWpp())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar grupo no WhatsApp</DialogTitle>
            <DialogDescription>
              Cria o grupo já no padrão para a regra {wppTarget ? `"${wppTarget.label}"` : ""}. A
              instância (bot) entra como admin; informe ao menos um número inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dg-participants">Participantes (telefones com DDD)</Label>
              <Input
                id="dg-participants"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="11999999999, 11988888888"
              />
              <p className="text-xs text-[#737373]">
                Separe por vírgula. Você adiciona os demais depois no WhatsApp.
              </p>
            </div>
            {wppTarget && (
              <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
                Nome do grupo:{" "}
                <span className="font-semibold">Notificações {wppTarget.label}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeWpp}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitWpp}
              disabled={createWppGroup.isPending}
              className="bg-[#eca826] hover:bg-[#d8961f] text-white"
            >
              {createWppGroup.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar grupo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

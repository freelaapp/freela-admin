"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Plus,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  Power,
  KeyRound,
  Pencil,
  AlertTriangle,
} from "lucide-react";
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
  useAdminPanelPermissions,
  useAdminPanelUsers,
  useCreateAdminPanelUser,
  useResetAdminPanelUserAccess,
  useUpdateAdminPanelUser,
} from "@/modules/admin/application/use-admin-panel-users";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  type AdminRole,
} from "@/modules/auth/domain/permissions";
import type {
  PanelUser,
  PermissionOption,
} from "@/modules/admin/infrastructure/panel-users-api";

/** Fallback local caso o catálogo da API não carregue — a tela nunca fica sem checkboxes. */
const FALLBACK_PERMISSIONS: PermissionOption[] = ADMIN_PERMISSIONS.map((key) => ({
  key,
  label: ADMIN_PERMISSION_LABELS[key],
}));

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  RECRUITER: "Recrutador",
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  permissions: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  role: "ADMIN",
  permissions: [],
};

/** Resultado de criação/reset — a senha temporária só aparece uma vez. */
type AccessResult = {
  title: string;
  email: string;
  tempPassword: string;
  emailSent: boolean;
};

export default function UsuariosPainelPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin, user } = useAuth();

  const { data: users, isLoading, isError } = useAdminPanelUsers();
  const { data: permissionCatalog } = useAdminPanelPermissions();
  const createMutation = useCreateAdminPanelUser();
  const updateMutation = useUpdateAdminPanelUser();
  const resetMutation = useResetAdminPanelUserAccess();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PanelUser | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<PanelUser | null>(null);
  const [accessResult, setAccessResult] = useState<AccessResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isHydrated, isSuperAdmin, router]);

  const permissions = useMemo(
    () => (permissionCatalog && permissionCatalog.length > 0 ? permissionCatalog : FALLBACK_PERMISSIONS),
    [permissionCatalog],
  );

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(row: PanelUser) {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      email: row.email,
      phone: row.phone ?? "",
      role: (row.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN") as AdminRole,
      permissions: [...row.permissions],
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  }

  function togglePermission(key: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  function selectAllPermissions() {
    setForm((prev) => ({ ...prev, permissions: permissions.map((p) => String(p.key)) }));
  }

  function clearPermissions() {
    setForm((prev) => ({ ...prev, permissions: [] }));
  }

  async function copyTempPassword() {
    if (!accessResult) return;
    try {
      await navigator.clipboard.writeText(accessResult.tempPassword);
      setCopied(true);
      toast.success("Senha temporária copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  async function toggleActive(row: PanelUser) {
    setTogglingId(row.id);
    try {
      await updateMutation.mutateAsync({
        id: row.id,
        payload: { isActive: !row.isActive },
      });
      toast.success(row.isActive ? "Usuário desativado." : "Usuário ativado.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao atualizar usuário"));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();

    if (name.length < 2) {
      toast.error("Informe o nome do usuário.");
      return;
    }
    if (!editing && !email) {
      toast.error("Informe o e-mail (login do painel). A senha temporária é enviada nele.");
      return;
    }

    // SUPER_ADMIN tem tudo por definição — mandar lista só confundiria o backend.
    const permissionsPayload = form.role === "SUPER_ADMIN" ? [] : form.permissions;

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          payload: {
            name,
            phone: form.phone.trim(),
            role: form.role,
            permissions: permissionsPayload,
          },
        });
        toast.success("Usuário atualizado.");
        closeForm();
        return;
      }

      const created = await createMutation.mutateAsync({
        name,
        email,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        role: form.role,
        permissions: permissionsPayload,
      });
      closeForm();
      setAccessResult({
        title: "Usuário criado",
        email: created.user.email,
        tempPassword: created.tempPassword,
        emailSent: created.emailSent,
      });
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, editing ? "Erro ao atualizar usuário" : "Erro ao criar usuário"),
      );
    }
  }

  async function handleReset() {
    if (!resetTarget) return;
    try {
      const res = await resetMutation.mutateAsync(resetTarget.id);
      const targetEmail = resetTarget.email;
      setResetTarget(null);
      setAccessResult({
        title: "Acesso redefinido",
        email: targetEmail,
        tempPassword: res.tempPassword,
        emailSent: res.emailSent,
      });
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao reenviar o acesso"));
    }
  }

  const permissionLabel = (key: string) =>
    permissions.find((p) => p.key === key)?.label ?? key;

  const columns = [
    {
      header: "Nome",
      accessor: (row: PanelUser) => (
        <span className="font-medium text-[#1d1d1b]">{row.name ?? "—"}</span>
      ),
      sortAccessor: (row: PanelUser) => row.name ?? "",
      sortable: true,
    },
    {
      header: "E-mail",
      accessor: (row: PanelUser) => (
        <span className="text-[#525252] break-all">{row.email}</span>
      ),
      sortAccessor: (row: PanelUser) => row.email,
      sortable: true,
    },
    {
      header: "Papel",
      accessor: (row: PanelUser) => (
        <span
          className={
            row.role === "SUPER_ADMIN"
              ? "inline-flex items-center rounded-full bg-[#eca826]/15 px-2 py-0.5 text-xs font-medium text-[#a06f0a]"
              : "inline-flex items-center rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs font-medium text-[#525252]"
          }
        >
          {ROLE_LABEL[row.role] ?? row.role}
        </span>
      ),
      sortAccessor: (row: PanelUser) => row.role,
      sortable: true,
    },
    {
      header: "Áreas liberadas",
      accessor: (row: PanelUser) =>
        row.role === "SUPER_ADMIN" ? (
          <span className="text-xs font-medium text-[#1d1d1b]">Todas</span>
        ) : row.permissions.length === 0 ? (
          <span className="text-xs text-[#a3a3a3]">Nenhuma restrita</span>
        ) : (
          <span
            className="text-xs font-medium text-[#1d1d1b]"
            title={row.permissions.map(permissionLabel).join(", ")}
          >
            {row.permissions.length} de {permissions.length}
          </span>
        ),
      sortAccessor: (row: PanelUser) =>
        row.role === "SUPER_ADMIN" ? permissions.length : row.permissions.length,
      sortable: true,
      className: "hidden md:table-cell",
    },
    {
      header: "Status",
      accessor: (row: PanelUser) => (
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
      header: "Criado em",
      accessor: (row: PanelUser) => formatInstantDate(row.createdAt),
      sortAccessor: (row: PanelUser) => row.createdAt,
      sortable: true,
      className: "hidden lg:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: PanelUser) => {
        const isSelf = !!user?.id && user.id === row.id;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
              title="Editar permissões"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetTarget(row)}
              title="Reenviar acesso"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <KeyRound className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleActive(row)}
              disabled={togglingId === row.id || isSelf}
              title={isSelf ? "Você não pode desativar o próprio usuário" : row.isActive ? "Desativar" : "Ativar"}
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
        );
      },
    },
  ];

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Usuários do painel"
        description="Quem entra no admin e quais áreas cada um enxerga. Super Admin tem acesso a tudo."
        action={
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo usuário
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar os usuários do painel.</p>
        </div>
      ) : users && users.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhum usuário do painel cadastrado
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Crie o primeiro acesso — a senha temporária vai por e-mail.
          </p>
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo usuário
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users ?? []}
          searchPlaceholder="Buscar por e-mail..."
          searchKey="email"
        />
      )}

      {/* Criar / editar usuário do painel */}
      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogClose onClick={closeForm} />
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuário do painel" : "Novo usuário do painel"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Ajuste o papel e as áreas liberadas. A mudança vale no próximo carregamento da tela do usuário — sem precisar relogar."
                : "O usuário recebe uma senha temporária por e-mail e a troca no primeiro acesso."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pu-name">Nome completo *</Label>
              <Input
                id="pu-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Jonathan Silva"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pu-email">E-mail (login do painel) *</Label>
              <Input
                id="pu-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jonathan@freelaservicos.com.br"
                disabled={!!editing}
              />
              {editing && (
                <p className="text-xs text-[#737373]">
                  O e-mail de login não muda por aqui.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pu-phone">Telefone</Label>
                <Input
                  id="pu-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-role">Papel</Label>
                <NativeSelect
                  id="pu-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as AdminRole })
                  }
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </NativeSelect>
              </div>
            </div>

            {form.role === "SUPER_ADMIN" ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  Super Admin enxerga <strong>todas</strong> as áreas do painel, inclusive esta
                  tela de usuários. Não há o que marcar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Áreas liberadas</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-xs font-medium text-[#eca826] hover:underline"
                    >
                      Marcar todas
                    </button>
                    <span className="text-[#e5e5e5]">|</span>
                    <button
                      type="button"
                      onClick={clearPermissions}
                      className="text-xs font-medium text-[#737373] hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-[#e5e5e5] p-3">
                  {permissions.map((permission) => {
                    const key = String(permission.key);
                    const checked = form.permissions.includes(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm text-[#1d1d1b] cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(key)}
                          className="h-4 w-4 rounded border-[#d4d4d4] accent-[#eca826]"
                        />
                        {permission.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-[#737373]">
                  Áreas fora desta lista (dashboard, catálogo, cidades, cupons, pipeline,
                  relatórios, treinamentos, configurações) ficam abertas a qualquer usuário do
                  painel.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={isSaving}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editing ? (
                  "Salvar alterações"
                ) : (
                  "Criar usuário"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de reenvio de acesso */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => (open ? undefined : setResetTarget(null))}
      >
        <DialogContent>
          <DialogClose onClick={() => setResetTarget(null)} />
          <DialogHeader>
            <DialogTitle>Reenviar acesso</DialogTitle>
            <DialogDescription>
              Gera uma nova senha temporária para {resetTarget?.name ?? "o usuário"} e reenvia o
              e-mail com as credenciais.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700">
              <p>
                A senha atual deixa de valer e a sessão ativa é encerrada — o usuário entra com a
                nova senha e a troca no primeiro acesso.
              </p>
              <p className="mt-1">
                E-mail de destino: <strong className="break-all">{resetTarget?.email}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resetMutation.isPending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="bg-[#eca826] text-white hover:bg-[#d4951e]"
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Reenviar acesso
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha temporária (criação ou reset) — aparece uma única vez */}
      <Dialog
        open={!!accessResult}
        onOpenChange={(open) => (open ? undefined : setAccessResult(null))}
      >
        <DialogContent>
          <DialogClose onClick={() => setAccessResult(null)} />
          <DialogHeader>
            <DialogTitle>{accessResult?.title ?? "Acesso gerado"}</DialogTitle>
            <DialogDescription>
              {accessResult?.emailSent
                ? "As credenciais foram enviadas por e-mail. A senha abaixo é um fallback caso precise repassar manualmente."
                : "O e-mail NÃO foi enviado. Repasse a senha temporária abaixo por um canal seguro."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                accessResult?.emailSent
                  ? "bg-green-50 border border-green-100 text-green-700"
                  : "bg-red-50 border border-red-100 text-red-700"
              }`}
            >
              {accessResult?.emailSent ? (
                <Check className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              )}
              <span>
                {accessResult?.emailSent
                  ? `E-mail enviado para ${accessResult?.email}.`
                  : "Falha no envio do e-mail — use a senha abaixo."}
              </span>
            </div>
            <div>
              <Label>Senha temporária</Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-[#f7f7f7] border border-[#e5e5e5] px-3 py-2 font-mono text-sm text-[#1d1d1b] break-all select-all">
                  {accessResult?.tempPassword}
                </code>
                <Button
                  variant="outline"
                  onClick={copyTempPassword}
                  className="border-[#e5e5e5] text-[#525252] hover:bg-[#f7f7f7] h-9 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-[#737373] mt-1">
                O usuário troca esta senha no primeiro acesso, em /login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setAccessResult(null)}
              className="bg-[#eca826] text-white hover:bg-[#d4951e]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

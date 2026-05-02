"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useAdminUsers } from "@/modules/admin/application/use-admin-users";
import type { UserItem } from "@/modules/admin/infrastructure/admin-api";

function mapUserToRow(u: UserItem) {
  return {
    id: u.id,
    nome: u.email.split("@")[0],
    email: u.email,
    perfil: "Usuário",
    status: u.isActive ? ("active" as const) : ("inactive" as const),
    emailConfirmado: u.emailConfirmed,
    raw: u,
  };
}

type Row = ReturnType<typeof mapUserToRow>;

export default function UsuariosPage() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const [modalEditar, setModalEditar] = useState<Row | null>(null);

  const rows: Row[] = users?.map(mapUserToRow) ?? [];

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
        <p className="text-red-500">Erro ao carregar usuários.</p>
      </div>
    );
  }

  const columns = [
    { header: "Nome", accessor: "nome" as const },
    { header: "Email", accessor: "email" as const },
    {
      header: "Perfil",
      accessor: (row: Row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#1d1d1b]/10 text-[#1d1d1b]">
          {row.perfil}
        </span>
      ),
    },
    {
      header: "Email Confirmado",
      accessor: (row: Row) => (
        <span className={`text-xs font-medium ${row.emailConfirmado ? "text-green-500" : "text-red-500"}`}>
          {row.emailConfirmado ? "Sim" : "Não"}
        </span>
      ),
      className: "hidden md:table-cell",
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <button
          onClick={() => setModalEditar(row)}
          className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários da plataforma"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        }
      />
      <DataTable columns={columns} data={rows} searchPlaceholder="Buscar usuário..." searchKey="email" />

      {/* Modal Editar Usuário */}
      <Dialog open={!!modalEditar} onOpenChange={(open) => !open && setModalEditar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalEditar(null)} />
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados do usuário selecionado.</DialogDescription>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Nome</label>
                <input
                  type="text"
                  defaultValue={modalEditar.nome}
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Email</label>
                <input
                  type="email"
                  defaultValue={modalEditar.email}
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Perfil</label>
                  <select
                    defaultValue={modalEditar.perfil}
                    className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 bg-white"
                  >
                    <option>Administrador</option>
                    <option>Operação</option>
                    <option>Comercial</option>
                    <option>Financeiro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Status</label>
                  <select
                    defaultValue={modalEditar.status}
                    className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 bg-white"
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalEditar(null)}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#eca826] text-white hover:bg-[#d4951e]"
              onClick={() => {
                toast.success("Usuário atualizado com sucesso!");
                setModalEditar(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

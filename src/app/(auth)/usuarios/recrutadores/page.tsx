"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, UserPlus } from "lucide-react";
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
  useAdminRecruiters,
  useCreateAdminRecruiter,
} from "@/modules/admin/application/use-admin-recruiters";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import type { RecruiterItem } from "@/modules/admin/infrastructure/admin-api";

export default function RecrutadoresPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: recruiters, isLoading, isError } = useAdminRecruiters();
  const createMutation = useCreateAdminRecruiter();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

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
    setForm({ name: "", email: "", phone: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    try {
      await createMutation.mutateAsync(form);
      toast.success("Recrutador criado! Senha temporária enviada por email.");
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao criar recrutador"));
    }
  }

  const columns = [
    { header: "Nome", accessor: "name" as const },
    { header: "Email", accessor: "email" as const },
    {
      header: "Telefone",
      accessor: (row: RecruiterItem) => row.phone ?? "—",
      className: "hidden md:table-cell",
    },
    {
      header: "Contratantes captados",
      accessor: (row: RecruiterItem) => (
        <span className="font-semibold text-[#1d1d1b]">{row.contractorsCount}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Cadastrado em",
      accessor: (row: RecruiterItem) =>
        formatInstantDate(row.createdAt),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recrutadores"
        description="Representantes que cadastram novos contratantes na plataforma"
        action={
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Recrutador
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar recrutadores.</p>
        </div>
      ) : recruiters && recruiters.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhum recrutador cadastrado ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre o primeiro representante para começar a captar contratantes.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Recrutador
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={recruiters ?? []}
          searchPlaceholder="Buscar por nome ou email..."
          searchKey="name"
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
            <DialogTitle>Novo Recrutador</DialogTitle>
            <DialogDescription>
              O recrutador receberá um email com a senha temporária e será
              obrigado a redefini-la no primeiro acesso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: João Silva"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="recrutador@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
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
                  "Cadastrar recrutador"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

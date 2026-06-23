"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Loader2, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useGroupDiagnostics,
  useCreateWhatsappGroup,
} from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { GroupDiagnostic } from "@/modules/admin/infrastructure/whatsapp-groups-api";
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

  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [participants, setParticipants] = useState("");

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
            Erro ao carregar grupos. Verifique a conexão da instância na Evolution API.
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
    </div>
  );
}

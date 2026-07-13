"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Hash,
  Percent,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
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
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminConsultant } from "@/modules/admin/application/use-admin-consultants";
import { useCreateWhatsappGroup } from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";

export default function ConsultorProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const consultantId = params?.id ?? "";
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: consultant, isLoading, isError } = useAdminConsultant(consultantId);
  const createGroup = useCreateWhatsappGroup();

  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [participants, setParticipants] = useState("");

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

  const previewName =
    city.trim() && uf.trim()
      ? `Vagas Freela ${city.trim()} ${uf.trim().toUpperCase()}`
      : null;

  const openModal = () => {
    setCity(consultant?.city ?? "");
    setUf(consultant?.uf ?? "");
    setParticipants(consultant?.phone ?? "");
    setOpen(true);
  };

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
        getAxiosErrorMessage(
          err,
          "Não foi possível criar o grupo. Verifique a conexão da instância e os participantes.",
        ),
      );
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/consultores"
          className="inline-flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#1d1d1b] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para consultores
        </Link>
      </div>

      <PageHeader
        title={consultant?.name ?? "Perfil do consultor"}
        description="Perfil do consultor e ações rápidas."
        action={
          <Button
            onClick={openModal}
            disabled={!consultant}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Criar grupo WhatsApp
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError || !consultant ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar o consultor.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field icon={<Hash className="w-4 h-4" />} label="Código">
              <span className="font-mono font-semibold text-[#1d1d1b]">{consultant.code}</span>
            </Field>
            <Field
              icon={<span className="text-xs font-semibold uppercase">{consultant.isActive ? "on" : "off"}</span>}
              label="Status"
            >
              <span
                className={
                  consultant.isActive
                    ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    : "inline-flex items-center rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs font-medium text-[#737373]"
                }
              >
                {consultant.isActive ? "Ativo" : "Inativo"}
              </span>
            </Field>
            <Field icon={<MapPin className="w-4 h-4" />} label="Cidade / UF">
              {consultant.city
                ? `${consultant.city}${consultant.uf ? `/${consultant.uf}` : ""}`
                : "—"}
            </Field>
            <Field icon={<Phone className="w-4 h-4" />} label="Telefone">
              {consultant.phone ? (
                <a
                  href={`tel:${consultant.phone}`}
                  className="text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                >
                  {consultant.phone}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field icon={<Mail className="w-4 h-4" />} label="E-mail">
              {consultant.email ? (
                <a
                  href={`mailto:${consultant.email}`}
                  className="text-[#1d1d1b] hover:text-[#eca826] transition-colors break-all"
                >
                  {consultant.email}
                </a>
              ) : (
                "—"
              )}
            </Field>
            <Field icon={<Percent className="w-4 h-4" />} label="Comissão">
              {consultant.commissionRate != null ? `${consultant.commissionRate}%` : "—"}
            </Field>
            <Field icon={<Users className="w-4 h-4" />} label="Cadastros indicados">
              <span className="font-semibold text-[#1d1d1b]">{consultant.referralsCount}</span>
            </Field>
            <Field icon={<span className="text-xs">📅</span>} label="Cadastrado em">
              {formatInstantDate(consultant.createdAt)}
            </Field>
          </div>
          {consultant.notes && (
            <div className="mt-4 bg-[#f7f7f7] rounded-lg p-3">
              <p className="text-[#737373] text-xs font-medium uppercase tracking-wide mb-1">
                Observações
              </p>
              <p className="text-sm text-[#1d1d1b] whitespace-pre-wrap">{consultant.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Criar grupo WhatsApp (prefilled do consultor) */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeModal())}>
        <DialogContent>
          <DialogClose onClick={closeModal} />
          <DialogHeader>
            <DialogTitle>Criar grupo de WhatsApp</DialogTitle>
            <DialogDescription>
              O nome é montado no padrão para o grupo receber vagas automaticamente. A instância
              (bot) entra como admin; informe ao menos um número para iniciar o grupo. Pré-preenchido
              com os dados do consultor.
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
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar grupo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3">
      <p className="flex items-center gap-1.5 text-[#737373] text-xs font-medium uppercase tracking-wide mb-1">
        <span className="text-[#a3a3a3]">{icon}</span>
        {label}
      </p>
      <div className="text-sm text-[#1d1d1b]">{children}</div>
    </div>
  );
}

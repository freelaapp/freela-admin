"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useCreateRegistration } from "@/modules/consultant/application/use-consultant-registrations";
import type {
  RegistrationModule,
  RegistrationPersona,
} from "@/modules/consultant/domain/types";

type SuccessInfo = {
  name: string;
  login: string;
  firstAccessPassword: string;
  channel: string | null;
};

export default function ConsultorCadastrarPage() {
  const router = useRouter();
  const createMutation = useCreateRegistration();

  const [persona, setPersona] = useState<RegistrationPersona>("provider");
  const [module, setModule] = useState<RegistrationModule>("bars-restaurants");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Informe nome e telefone.");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        persona,
        ...(persona === "contractor" ? { module } : {}),
        name: form.name.trim(),
        phone: form.phone.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      });
      const channel = result.inviteSentByWhatsApp
        ? "WhatsApp"
        : result.inviteSentByEmail
          ? "e-mail"
          : null;
      setSuccess({
        name: form.name.trim(),
        login: form.email.trim() || form.phone.trim(),
        firstAccessPassword: result.firstAccessPassword ?? "Mudar@123",
        channel,
      });
      toast.success("Cadastro criado com sucesso!");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao criar cadastro"));
    }
  }

  function handleNewRegistration() {
    setForm({ name: "", phone: "", email: "" });
    setPersona("provider");
    setModule("bars-restaurants");
    setSuccess(null);
  }

  if (success) {
    return (
      <div>
        <PageHeader
          title="Cadastro criado"
          description="Passe o login e a senha de primeiro acesso para a pessoa"
        />
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 space-y-4 max-w-md">
          <div className="flex items-center gap-2 text-[#16a34a]">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">{success.name} cadastrado(a)!</span>
          </div>

          <div className="rounded-lg border border-[#eca826]/40 bg-[#eca826]/10 p-4 space-y-3">
            <CredentialRow label="Login" value={success.login} />
            <CredentialRow label="Senha de 1º acesso" value={success.firstAccessPassword} mono />
            <p className="text-xs text-[#a8670a]">
              No primeiro acesso a pessoa troca a senha e completa o perfil.
            </p>
          </div>

          <p className="text-sm text-[#737373]">
            {success.channel
              ? `Também enviamos um convite por ${success.channel} com um link para definir a senha.`
              : "Não foi possível enviar o convite automaticamente — passe a senha acima manualmente."}
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleNewRegistration}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Novo cadastro
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/consultor")}
              className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
            >
              Ver meus cadastros
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Novo cadastro"
        description="Cadastro rápido — a pessoa entra com a senha padrão e a troca no primeiro acesso"
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e5e5e5] rounded-xl p-5 space-y-4 max-w-md"
      >
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            <TypeButton active={persona === "provider"} onClick={() => setPersona("provider")}>
              Freelancer
            </TypeButton>
            <TypeButton active={persona === "contractor"} onClick={() => setPersona("contractor")}>
              Contratante
            </TypeButton>
          </div>
        </div>

        {persona === "contractor" && (
          <div className="space-y-1.5">
            <Label htmlFor="module">Segmento</Label>
            <select
              id="module"
              value={module}
              onChange={(e) => setModule(e.target.value as RegistrationModule)}
              className="h-10 w-full rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            >
              <option value="bars-restaurants">Bares e Restaurantes</option>
              <option value="home-services">Serviços (Freela em Casa)</option>
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Maria Silva"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone (WhatsApp)</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+55 85 99999-9999"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email (opcional)</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="maria@exemplo.com"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/consultor")}
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
              "Cadastrar"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-[#a8670a]">{label}</p>
        <p className={`truncate text-sm text-[#1d1d1b] ${mono ? "font-mono font-semibold" : ""}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copiar ${label}`}
        className="shrink-0 rounded-md p-1.5 text-[#a8670a] transition-colors hover:bg-[#eca826]/20"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-10 rounded-lg border border-[#eca826] bg-[#eca826]/10 text-sm font-medium text-[#a8670a]"
          : "h-10 rounded-lg border border-[#e5e5e5] bg-white text-sm font-medium text-[#737373] hover:border-[#d4d4d4]"
      }
    >
      {children}
    </button>
  );
}

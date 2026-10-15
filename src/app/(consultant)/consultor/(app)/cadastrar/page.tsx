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

/**
 * Contratante cadastrado pelo consultor é sempre EMPRESA (bar/restaurante).
 * O Freela em Casa foi encerrado em 08/10/2026: conta só-Casa nasce sem login,
 * então a opção "Serviços (Freela em Casa)" saiu do formulário.
 */
const CONTRACTOR_MODULE: RegistrationModule = "bars-restaurants";

type SuccessInfo = {
  name: string;
  login: string;
  /**
   * Senha de 1º acesso que a API gerou (aleatória). `null` = a API não
   * devolveu: o painel NÃO inventa uma (a antiga "Mudar@123" fixa não vale
   * mais) — diz que ela foi no convite.
   */
  firstAccessPassword: string | null;
  channel: string | null;
};

const PASSWORD_IN_INVITE_NOTICE = "A senha de primeiro acesso foi enviada no convite.";

export default function ConsultorCadastrarPage() {
  const router = useRouter();
  const createMutation = useCreateRegistration();

  const [persona, setPersona] = useState<RegistrationPersona>("provider");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Informe nome e telefone.");
      return;
    }
    // A API valida /^\+?[1-9]\d{7,14}$/ — digitar como o placeholder
    // ("+55 85 99999-9999") dava 400 em inglês, e número sem DDI passava e
    // corrompia o cadastro (convite de WhatsApp ia pro nada). Normaliza:
    // só dígitos; 10-11 dígitos = nacional → prefixa 55.
    const digits = form.phone.replace(/\D/g, "");
    const phoneE164 =
      digits.length === 10 || digits.length === 11
        ? `+55${digits}`
        : digits.length >= 12 && digits.length <= 15
          ? `+${digits}`
          : null;
    if (!phoneE164) {
      toast.error("Telefone inválido — use DDD + número (ex.: 85 99999-9999).");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        persona,
        ...(persona === "contractor" ? { module: CONTRACTOR_MODULE } : {}),
        name: form.name.trim(),
        phone: phoneE164,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      });
      const channel = result.inviteSentByWhatsApp
        ? "WhatsApp"
        : result.inviteSentByEmail
          ? "e-mail"
          : null;
      setSuccess({
        name: form.name.trim(),
        login: form.email.trim() || phoneE164,
        firstAccessPassword: result.firstAccessPassword?.trim() || null,
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
            {success.firstAccessPassword ? (
              <CredentialRow label="Senha de 1º acesso" value={success.firstAccessPassword} mono />
            ) : (
              <p className="text-sm text-[#1d1d1b]">{PASSWORD_IN_INVITE_NOTICE}</p>
            )}
            <p className="text-xs text-[#a8670a]">
              No primeiro acesso a pessoa troca a senha e completa o perfil.
            </p>
          </div>

          <p className="text-sm text-[#737373]">
            {success.channel
              ? `Também enviamos um convite por ${success.channel} com um link para definir a senha.`
              : success.firstAccessPassword
                ? "Não foi possível enviar o convite automaticamente — passe a senha acima manualmente."
                : "Não foi possível confirmar o envio do convite. Se a pessoa não receber, peça ao suporte para reenviar o acesso."}
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
        description="Cadastro rápido — a pessoa recebe uma senha de primeiro acesso e a troca no primeiro login"
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
          <p className="text-xs text-[#737373]">
            Contratante = empresa (bar ou restaurante) que vai publicar vagas.
          </p>
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

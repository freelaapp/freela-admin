"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useConsultantProfile,
  useUpdateConsultantProfile,
} from "@/modules/consultant/application/use-consultant-profile";
import {
  consultantProfileSchema,
  toUpdateProfilePayload,
  type ConsultantProfileFormValues,
} from "@/modules/consultant/application/consultant-profile.schema";
import { formatPhoneMask } from "@/modules/consultant/application/phone-mask";
import { buildWhatsAppShareUrl } from "@/modules/consultant/application/referral-share";
import type { ConsultantProfile } from "@/modules/consultant/domain/types";

export default function ConsultorPerfilPage() {
  const { data: profile, isLoading, isError } = useConsultantProfile();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Meu perfil" description="Seu link de indicação e seus dados" />
      {isLoading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError || !profile ? (
        <p className="text-red-500">Não foi possível carregar seu perfil.</p>
      ) : (
        <div className="space-y-4">
          <ReferralLinkCard link={profile.referralLink} />
          <ProfileCard profile={profile} />
        </div>
      )}
    </div>
  );
}

function ReferralLinkCard({ link }: { link: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seu link de indicação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="break-all rounded-lg bg-[#f7f7f7] px-3 py-2 font-mono text-sm text-[#1d1d1b]">
          {link}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={copy} className="w-full sm:w-auto">
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={buildWhatsAppShareUrl(link)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Compartilhar no WhatsApp
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: ConsultantProfile }) {
  const place = profile.city
    ? profile.uf
      ? `${profile.city}/${profile.uf}`
      : profile.city
    : (profile.uf ?? "—");
  const readOnly: Array<[string, string]> = [
    ["E-mail de login", profile.email ?? "—"],
    ["Código", profile.code],
    ["Cidade", place],
    // A comissão virou regra no Painel (05/10/2026) — o % solto do cadastro saiu daqui.
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seus dados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProfileForm profile={profile} />
        <dl className="grid gap-3 sm:grid-cols-2">
          {readOnly.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[#737373]">{label}</dt>
              <dd className="break-words text-sm font-medium text-[#1d1d1b]">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-[#737373]">
          Para mudar e-mail de login, código ou comissão, fale com a equipe Freela.
        </p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/consultor/trocar-senha">
            <KeyRound className="h-4 w-4" />
            Trocar senha
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: ConsultantProfile }) {
  const update = useUpdateConsultantProfile();
  const values = useMemo<ConsultantProfileFormValues>(
    () => ({ name: profile.name, phone: formatPhoneMask(profile.phone ?? "") }),
    [profile.name, profile.phone],
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConsultantProfileFormValues>({
    resolver: zodResolver(consultantProfileSchema),
    values,
  });

  const onSubmit = async (form: ConsultantProfileFormValues) => {
    try {
      await update.mutateAsync(toUpdateProfilePayload(form));
      toast.success("Dados atualizados.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível salvar seus dados."));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone (WhatsApp)</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 98888-7777"
              aria-invalid={!!errors.phone}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(formatPhoneMask(e.target.value))}
            />
          )}
        />
        {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

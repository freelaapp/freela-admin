"use client";

import Link from "next/link";
import { ExternalLink, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompatibleInviteSection } from "@/components/admin/vacancy/compatible-invite-section";
import { VacancyReservesSection } from "@/components/admin/vacancy/vacancy-reserves-section";
import { useSupportCase } from "@/modules/admin/application/use-support-cases";
import type { SupportCaseItem } from "@/modules/admin/infrastructure/support-cases-api";

/**
 * "Ações da vaga": ligar para a empresa e para cada pessoa da lista (os mesmos telefones que o
 * modal da vaga já mostra), e os painéis que já existem no modal: Convidar compatíveis,
 * Escolher reservas e Chamar reserva. Conteúdo longo: rola dentro do diálogo.
 */
export function CaseToolsDialog({
  item,
  onClose,
}: {
  item: SupportCaseItem;
  onClose: () => void;
}) {
  const detail = useSupportCase(item.id);
  const people = detail.data?.people ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      className="max-w-3xl"
    >
      <DialogContent role="dialog" aria-label="Ações da vaga">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Ações da vaga</DialogTitle>
          <DialogDescription>
            {item.vacancy.title}
            {item.vacancy.companyName
              ? ` · ${item.vacancy.companyName}`
              : ""} · {item.vacancy.dayLabel}, {item.vacancy.startLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <section className="space-y-2 rounded-lg border border-[#e5e5e5] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[#737373]">
              Ligar
            </p>
            <div className="flex flex-wrap gap-2">
              {item.contractor.phone && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${item.contractor.phone}`}>
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Empresa
                    {item.contractor.contactName
                      ? ` (${item.contractor.contactName})`
                      : ""}
                  </a>
                </Button>
              )}
              {people
                .filter((p) => p.phone)
                .map((p) => (
                  <Button
                    key={p.candidacyId}
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <a href={`tel:${p.phone}`}>
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {p.name?.trim() || "Sem nome"}{" "}
                      {p.role === "PRINCIPAL"
                        ? "(escolhido)"
                        : `(suplente ${p.position ?? ""})`}
                    </a>
                  </Button>
                ))}
            </div>
            {detail.isLoading && (
              <p className="flex items-center gap-2 text-xs text-[#737373]">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
                Carregando a lista…
              </p>
            )}
            {!detail.isLoading &&
              !item.contractor.phone &&
              people.every((p) => !p.phone) && (
                <p className="text-xs text-[#737373]">
                  Ninguém da vaga tem telefone cadastrado.
                </p>
              )}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href={`/jobs?vaga=${item.vacancyId}`}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Abrir a vaga com todos os candidatos
              </Link>
            </Button>
          </section>
          <CompatibleInviteSection
            key={`convite-${item.vacancyId}`}
            vacancyId={item.vacancyId}
          />
          <VacancyReservesSection
            key={`reservas-${item.vacancyId}`}
            vacancyId={item.vacancyId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

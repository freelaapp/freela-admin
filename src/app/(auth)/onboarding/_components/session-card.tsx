"use client";

import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Copy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatSessionTimeRange,
  sessionAlertText,
} from "@/modules/admin/application/orientation-presentation";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";

type StatusInfo = { label: string; variant: "success" | "warning" | "muted" | "destructive" };

export function sessionStatusInfo(s: OrientationSessionView): StatusInfo {
  if (s.status === "CANCELLED") return { label: "Cancelada", variant: "destructive" };
  if (s.status === "FINISHED") return { label: "Encerrada", variant: "muted" };
  if (s.bookedCount >= s.capacity) return { label: "Lotada", variant: "warning" };
  return { label: "Aberta", variant: "success" };
}

/** "Todas as cidades" ou "Campinas, Valinhos · SP". */
export function audienceText(a: { ufs: string[]; cities: string[] }): string {
  if (a.ufs.length === 0 && a.cities.length === 0) return "Todas as cidades";
  const cities = a.cities.join(", ");
  const ufs = a.ufs.join(", ");
  return cities && ufs ? `${cities} · ${ufs}` : cities || ufs;
}

interface Props {
  session: OrientationSessionView;
  onEdit: (s: OrientationSessionView) => void;
  onCancel: (s: OrientationSessionView) => void;
  onCancelSeries: (seriesId: string) => void;
}

export function SessionCard({ session: s, onEdit, onCancel, onCancelSeries }: Props) {
  const status = sessionStatusInfo(s);
  const open = s.status === "OPEN";

  const copyLink = async () => {
    if (!s.meetUrl) return;
    try {
      await navigator.clipboard.writeText(s.meetUrl);
      toast.success("Link do Meet copiado.");
    } catch {
      toast.error("Não consegui copiar o link. Abra a turma e copie por lá.");
    }
  };

  return (
    <li className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[#1d1d1b]">{formatSessionTimeRange(s.startsAt, s.endsAt)}</p>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-[#525252] md:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" aria-hidden />
          <dt className="sr-only">Inscritos</dt>
          <dd>
            <span title={`${s.bookedCount} inscritos de ${s.capacity} lugares`}>
              {s.bookedCount}/{s.capacity}
            </span>
          </dd>
        </div>
        <div>
          <dt className="inline text-[#737373]">Dá a aula: </dt>
          <dd className="inline">{s.hostName ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline text-[#737373]">Público: </dt>
          <dd className="inline">{audienceText(s.audience)}</dd>
        </div>
      </dl>
      {s.alerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.alerts.map((a) => (
            <li
              key={a}
              className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {sessionAlertText(a)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="min-h-11 md:min-h-9">
          <Link href={`/onboarding/turmas/${s.id}`}>Abrir chamada</Link>
        </Button>
        {s.meetUrl && (
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => void copyLink()}>
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />
            Copiar link do Meet
          </Button>
        )}
        {open && (
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => onEdit(s)}>
            Editar
          </Button>
        )}
        {open && (
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => onCancel(s)}>
            Cancelar turma
          </Button>
        )}
        {open && s.seriesId && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 md:min-h-9"
            onClick={() => onCancelSeries(s.seriesId as string)}
          >
            Cancelar série
          </Button>
        )}
      </div>
    </li>
  );
}

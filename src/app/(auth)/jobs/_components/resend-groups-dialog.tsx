"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVacancyGroupBroadcastPreview } from "@/modules/admin/application/use-vacancy-group-broadcasts";
import {
  cidadeUf,
  formatKm,
  formatQuandoRelativo,
  grupos,
  RAIO_PADRAO_KM,
  sortDestinations,
} from "@/modules/admin/domain/group-broadcast";
import {
  isNotFoundError,
  type GroupBroadcastCenter,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";

/** "Vagas Freela Campinas SP · Campinas-SP · 4 km" */
export function linhaDoGrupo(g: {
  groupName: string;
  city: string | null;
  uf: string | null;
  distanceKm: number | null;
}): string {
  return [g.groupName, cidadeUf(g.city, g.uf), formatKm(g.distanceKm)].filter(Boolean).join(" · ");
}

/** "a até 30 km do local da vaga" — até onde o envio vai, e medido de onde. */
export function alcanceDoEnvio(radiusKm: number, center: GroupBroadcastCenter | null): string {
  if (radiusKm <= 0) return "todos os grupos da cidade da vaga";
  const origem =
    center?.source === "CONTRACTOR"
      ? "do endereço da empresa"
      : center?.source === "CITY_SEAT"
        ? "do centro da cidade da vaga"
        : "do local da vaga";
  return `todos os grupos a até ${radiusKm} km ${origem}`;
}

/** Estado "Nenhum grupo no raio" (modal e confirmação). */
export function NoGroupInRadius({
  center,
  radiusKm,
}: {
  center: GroupBroadcastCenter | null;
  radiusKm: number;
}) {
  const cidade = cidadeUf(center?.city ?? null, center?.uf ?? null);
  const semGrupo = cidade ? `${cidade} não tem grupo` : "A cidade da vaga não tem grupo";
  let titulo: string;
  let explicacao: string;
  if (radiusKm <= 0) {
    titulo = "Nenhum grupo na cidade da vaga.";
    explicacao = `${semGrupo}.`;
  } else if (center && center.source === null) {
    titulo = `Nenhum grupo para receber esta vaga.`;
    explicacao = `${semGrupo}, e sem a localização da vaga não dá para procurar grupos a até ${radiusKm} km.`;
  } else {
    titulo = `Nenhum grupo a até ${radiusKm} km do local da vaga.`;
    explicacao = `${semGrupo}, e nenhuma cidade a até ${radiusKm} km tem.`;
  }
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p>
        <strong>{titulo}</strong> {explicacao} Cadastre um grupo em Grupos de WhatsApp.
      </p>
      <Link
        href="/grupos-whatsapp"
        className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-amber-900 underline underline-offset-2"
      >
        Ir para Grupos de WhatsApp
      </Link>
    </div>
  );
}

/**
 * Confirmação do reenvio: diz QUAIS grupos vão receber (prévia da API, lida
 * só quando a confirmação abre — nunca uma por linha da lista) e avisa que vai
 * para todos no raio, inclusive os que já receberam.
 *
 * Renderiza num portal: aberta de dentro do modal da vaga ou de uma célula da
 * tabela, fica por cima de tudo e não herda rolagem nem filtro de ninguém.
 */
export function ResendGroupsDialog({
  vacancyId,
  open,
  onClose,
  onConfirm,
  sending,
  lastBroadcastAt,
  neverSent,
  now,
}: {
  vacancyId: string;
  open: boolean;
  onClose: () => void;
  /** `true` quando a API aceitou o pedido (aí a confirmação fecha). */
  onConfirm: () => Promise<boolean>;
  sending: boolean;
  lastBroadcastAt: string | null;
  neverSent: boolean;
  now?: Date;
}) {
  const preview = useVacancyGroupBroadcastPreview(vacancyId, open);

  if (!open || typeof document === "undefined") return null;

  const verbo = neverSent ? "Enviar" : "Reenviar";
  const apiAntiga = preview.isError && isNotFoundError(preview.error);
  const destinos = preview.data ? sortDestinations(preview.data.destinations) : [];
  const n = destinos.length;
  const radiusKm = preview.data?.radiusKm ?? RAIO_PADRAO_KM;
  const semDestino = Boolean(preview.data) && n === 0;

  let titulo: string;
  let rotuloBotao: string;
  if (preview.isLoading) {
    titulo = `${verbo} a vaga?`;
    rotuloBotao = verbo;
  } else if (apiAntiga) {
    titulo = `${verbo} a vaga ao grupo da cidade?`;
    rotuloBotao = verbo;
  } else if (preview.isError) {
    titulo = `${verbo} a vaga?`;
    rotuloBotao = verbo;
  } else if (semDestino) {
    titulo = "Nenhum grupo para receber esta vaga";
    rotuloBotao = verbo;
  } else {
    titulo = `${verbo} a vaga para ${grupos(n)}?`;
    rotuloBotao = `${verbo} para ${grupos(n)}`;
  }

  const ultima = lastBroadcastAt
    ? ` Última divulgação: ${formatQuandoRelativo(lastBroadcastAt, now)}.`
    : "";
  const deNovo = neverSent ? "" : " de novo";
  const inclusive = neverSent ? "" : ", inclusive os que já receberam. Quem já viu vai receber de novo";

  async function confirmar() {
    const aceito = await onConfirm();
    if (aceito) onClose();
  }

  return createPortal(
    <Dialog open onOpenChange={(aberto) => !aberto && !sending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" aria-label={titulo}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-sm text-[#1d1d1b]">
          {preview.isLoading ? (
            <p className="flex items-center gap-2 text-[#737373]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando os grupos que vão receber…
            </p>
          ) : apiAntiga ? (
            <p>
              A mensagem vai{deNovo} para o grupo da cidade da vaga
              {neverSent ? "." : ". Quem já viu vai receber de novo."}
              {ultima}
            </p>
          ) : preview.isError ? (
            <>
              <p className="text-red-700">
                Não conseguimos carregar a lista de grupos.{" "}
                <button
                  type="button"
                  onClick={() => void preview.refetch()}
                  className="cursor-pointer font-semibold underline underline-offset-2"
                >
                  Tentar de novo
                </button>
              </p>
              <p>
                A mensagem vai{deNovo} para {alcanceDoEnvio(RAIO_PADRAO_KM, null)}
                {inclusive}.{ultima}
              </p>
            </>
          ) : semDestino ? (
            <NoGroupInRadius center={preview.data!.center} radiusKm={radiusKm} />
          ) : (
            <>
              <p>
                A mensagem vai{deNovo} para {alcanceDoEnvio(radiusKm, preview.data!.center)}
                {inclusive}.{ultima}
              </p>
              <ul className="space-y-1 rounded-lg bg-[#f7f7f7] p-2" aria-label="Grupos que vão receber">
                {destinos.map((g) => (
                  <li key={g.groupJid || g.groupName} className="break-words text-[13px]">
                    {linhaDoGrupo(g)}
                  </li>
                ))}
              </ul>
              {preview.data!.skipped.length > 0 && (
                <div className="text-xs text-[#737373]">
                  <p className="font-medium">
                    {preview.data!.skipped.length === 1
                      ? "1 grupo fica de fora:"
                      : `${preview.data!.skipped.length} grupos ficam de fora:`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {preview.data!.skipped.map((g, i) => (
                      <li key={`${g.groupName}-${i}`} className="break-words">
                        {linhaDoGrupo(g)}
                        {g.reason ? ` — ${g.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sending}
            className="min-h-10 border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Voltar
          </Button>
          {!semDestino && (
            <Button
              onClick={() => void confirmar()}
              disabled={sending || preview.isLoading}
              className="min-h-10 bg-[#1d1d1b] text-white hover:bg-[#333]"
            >
              {sending ? "Enviando…" : rotuloBotao}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}

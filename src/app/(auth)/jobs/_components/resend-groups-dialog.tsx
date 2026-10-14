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
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
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
  isRouteMissingError,
  type GroupBroadcastCenterSource,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";

/** Teto da API para um envio (o que passa disso fica de fora). */
const TETO_DO_ENVIO = "limite de 8 cidades vizinhas e 20 grupos por vaga";

/** "Vagas Freela Campinas SP · Campinas-SP · 4 km" */
export function linhaDoGrupo(g: {
  groupName: string;
  city: string | null;
  uf: string | null;
  distanceKm: number | null;
}): string {
  return [g.groupName, cidadeUf(g.city, g.uf), formatKm(g.distanceKm)].filter(Boolean).join(" · ");
}

/** "todos os grupos a até 30 km do local da vaga" — até onde vai, e medido de onde. */
export function alcanceDoEnvio(radiusKm: number, source: GroupBroadcastCenterSource): string {
  if (radiusKm <= 0) return "todos os grupos da cidade da vaga";
  const origem =
    source === "CONTRACTOR"
      ? "do endereço da empresa"
      : source === "CITY_SEAT"
        ? "do centro da cidade da vaga"
        : "do local da vaga";
  return `todos os grupos a até ${radiusKm} km ${origem}`;
}

/** Estado "Nenhum grupo no raio" (modal e confirmação). */
export function NoGroupInRadius({
  city,
  uf,
  centerSource,
  radiusKm,
}: {
  city: string | null;
  uf: string | null;
  centerSource: GroupBroadcastCenterSource;
  radiusKm: number;
}) {
  const cidade = cidadeUf(city, uf);
  const semGrupo = cidade ? `${cidade} não tem grupo` : "A cidade da vaga não tem grupo";
  let titulo: string;
  let explicacao: string;
  if (radiusKm <= 0) {
    titulo = "Nenhum grupo na cidade da vaga.";
    explicacao = `${semGrupo}.`;
  } else if (centerSource === null) {
    titulo = "Nenhum grupo para receber esta vaga.";
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
  const apiAntiga = preview.isError && isRouteMissingError(preview.error);
  const p = preview.data;
  const destinos = p ? sortDestinations(p.destinations) : [];
  const n = destinos.length;
  const radiusKm = p?.radiusKm ?? RAIO_PADRAO_KM;
  const bloqueado = Boolean(p && !p.canResend);
  const semDestino = Boolean(p) && !bloqueado && n === 0;
  const erroDaPrevia = preview.isError && !apiAntiga;
  const podeEnviar = !preview.isLoading && !erroDaPrevia && !bloqueado && !semDestino;

  let titulo: string;
  let rotuloBotao = verbo;
  if (preview.isLoading || erroDaPrevia) {
    titulo = `${verbo} a vaga?`;
  } else if (apiAntiga) {
    titulo = `${verbo} a vaga ao grupo da cidade?`;
  } else if (bloqueado) {
    titulo = "Não dá para divulgar esta vaga agora";
  } else if (semDestino) {
    titulo = "Nenhum grupo para receber esta vaga";
  } else {
    titulo = `${verbo} a vaga para ${grupos(n)}?`;
    rotuloBotao = `${verbo} para ${grupos(n)}`;
  }

  const ultima = lastBroadcastAt
    ? ` Última divulgação: ${formatQuandoRelativo(lastBroadcastAt, now)}.`
    : "";
  const deNovo = neverSent ? "" : " de novo";
  const inclusive = neverSent ? "" : ", inclusive os que já receberam. Quem já viu vai receber de novo";
  const cidade = cidadeUf(p?.vacancyCity ?? null, p?.vacancyUf ?? null) ?? "A cidade da vaga";
  const notaDaCidade = !p || p.ownCityHasGroup
    ? null
    : p.fallbackUsed
      ? `${cidade} não tem grupo, e nenhuma cidade a até ${radiusKm} km tem: vai para o grupo de reserva.`
      : `${cidade} não tem grupo: vai só para os grupos de cidades vizinhas.`;

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
          ) : erroDaPrevia ? (
            <div role="alert" className="text-red-700">
              <p>Não conseguimos carregar a lista de grupos que vão receber.</p>
              <p className="mt-1 text-xs">{getAxiosErrorMessage(preview.error, "")}</p>
              <button
                type="button"
                onClick={() => void preview.refetch()}
                className="mt-1 inline-flex min-h-10 cursor-pointer items-center font-semibold underline underline-offset-2"
              >
                Tentar de novo
              </button>
            </div>
          ) : bloqueado ? (
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
              {p!.resendBlockedReason ?? "O reenvio não está liberado para esta vaga agora."}
            </p>
          ) : semDestino ? (
            <NoGroupInRadius
              city={p!.vacancyCity}
              uf={p!.vacancyUf}
              centerSource={p!.centerSource}
              radiusKm={radiusKm}
            />
          ) : (
            <>
              <p>
                A mensagem vai{deNovo} para {alcanceDoEnvio(radiusKm, p!.centerSource)}
                {inclusive}.{ultima}
              </p>
              {notaDaCidade && <p className="text-xs text-amber-800">{notaDaCidade}</p>}
              <ul className="space-y-1 rounded-lg bg-[#f7f7f7] p-2" aria-label="Grupos que vão receber">
                {destinos.map((g) => (
                  <li key={g.groupJid || g.groupName} className="break-words text-[13px]">
                    {linhaDoGrupo(g)}
                  </li>
                ))}
              </ul>
              {p!.skipped.length > 0 && (
                <div className="text-xs text-[#737373]">
                  <p className="font-medium">
                    {p!.skipped.length === 1
                      ? `1 grupo fica de fora pelo ${TETO_DO_ENVIO}:`
                      : `${p!.skipped.length} grupos ficam de fora pelo ${TETO_DO_ENVIO}:`}
                  </p>
                  <ul className="mt-1 space-y-0.5" aria-label="Grupos que ficam de fora">
                    {sortDestinations(p!.skipped).map((g, i) => (
                      <li key={`${g.groupJid || g.groupName}-${i}`} className="break-words">
                        {linhaDoGrupo(g)}
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
          {(podeEnviar || preview.isLoading) && (
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

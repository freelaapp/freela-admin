"use client";

import { AlertTriangle, Loader2, MapPin, Megaphone, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useFixedJobReach,
  useResendFixedJobGroupMessage,
} from "@/modules/admin/application/use-admin-fixed-jobs";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";

/**
 * "Essa vaga está aparecendo para alguém?"
 *
 * Era a pergunta sem resposta no painel. As 3 vagas do Grupo Trigo em Jundiaí
 * (13/08/2026) passaram 4 dias com ZERO candidatos por serem invisíveis: sem
 * coordenada, medidas a partir da matriz em São Paulo, e anunciadas num grupo
 * que naquela janela não recebia nada. Nenhum desses três sinais era visível.
 *
 * Aqui os três aparecem juntos, e o botão de reanunciar fica ao lado — porque a
 * conclusão quase sempre é essa.
 */
export function PainelAlcance({ postId }: { postId: string }) {
  const { data, isLoading, isError } = useFixedJobReach(postId);
  const reenviar = useResendFixedJobGroupMessage(postId);

  async function handleReenviar() {
    try {
      await reenviar.mutateAsync();
      toast.success("Anúncio reenviado ao grupo da cidade.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível enviar ao grupo."));
    }
  }

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#737373]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando alcance...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#737373]">
        Não foi possível calcular o alcance desta vaga.
      </div>
    );
  }

  const semNinguem = data.alcance === 0;

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#1d1d1b]">Alcance desta vaga</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReenviar}
          disabled={reenviar.isPending}
          title="Reenvia o anúncio ao grupo de WhatsApp da cidade da vaga"
        >
          {reenviar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          Reanunciar no grupo
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} className="text-[#a3a3a3]" />
          <strong className={semNinguem ? "text-red-600" : "text-[#1d1d1b]"}>
            {data.alcance.toLocaleString("pt-BR")}
          </strong>
          <span className="text-[#737373]">alcançados</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} className="text-[#a3a3a3]" />
          <strong className="text-[#1d1d1b]">{data.doCargo.toLocaleString("pt-BR")}</strong>
          <span className="text-[#737373]">do mesmo cargo</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} className="text-[#a3a3a3]" />
          <span className="text-[#737373]">
            {data.city ? `${data.city}${data.uf ? `/${data.uf}` : ""}` : "cidade não resolvida"}
          </span>
        </span>
      </div>

      {semNinguem && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-tight text-red-900">
          <strong>Ninguém está sendo alcançado.</strong> Confira o endereço da vaga — é dele
          que sai a cidade e o raio.
        </p>
      )}

      {data.semCoordenada && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-tight text-amber-900">
            <strong>Sem coordenada.</strong> O alcance está limitado a quem tem o nome da
            cidade batendo — o vizinho a 10 km fica de fora. A geocodificação roda de hora
            em hora e corrige sozinha.
          </p>
        </div>
      )}
    </div>
  );
}

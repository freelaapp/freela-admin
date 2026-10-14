import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import { useResendVacancyGroupMessage } from "./use-vacancy-outreach";
import {
  describeRoundOutcome,
  grupos,
  roundCounts,
  SEGUNDOS_ENTRE_GRUPOS,
  shouldKeepPolling,
} from "../domain/group-broadcast";
import {
  apiErrorCode,
  getVacancyGroupBroadcastPreview,
  getVacancyGroupBroadcasts,
  type VacancyGroupBroadcasts,
} from "../infrastructure/vacancy-group-broadcasts-api";

/** Prefixo comum: invalidar a divulgação invalida a prévia junto. */
export function groupBroadcastsKey(vacancyId: string | null) {
  return ["admin", "vacancy-group-broadcasts", vacancyId] as const;
}

export function groupBroadcastPreviewKey(vacancyId: string | null) {
  return ["admin", "vacancy-group-broadcasts", vacancyId, "preview"] as const;
}

/**
 * 404 (rota ainda não existe, ou vaga/empresa não encontrada) e 409 não mudam
 * tentando de novo; o resto (ex.: 503 de diretório) tenta mais uma vez.
 */
function retryUnlessFinal(failureCount: number, err: unknown) {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  return status !== 404 && status !== 409 && failureCount < 1;
}

/**
 * Aviso do erro do reenvio (modal, coluna e Modo painel): a mensagem da API é
 * a que diz o que fazer. Sem resposta, não dá para saber se saiu — o aviso
 * pede para atualizar antes de tentar, para não mandar em dobro.
 */
export function avisarErroDoReenvio(err: unknown): void {
  if (axios.isAxiosError(err) && !err.response) {
    toast.error(
      "Não conseguimos confirmar o envio. Atualize a página antes de reenviar, para não mandar em dobro.",
    );
    return;
  }
  const code = apiErrorCode(err);
  if (code === "BROADCAST_IN_PROGRESS") {
    // Não é erro de quem clicou: a rodada anterior ainda está na fila.
    toast.info(
      getAxiosErrorMessage(
        err,
        "Ainda estamos enviando a divulgação anterior. Espere terminar para reenviar.",
      ),
    );
    return;
  }
  if (code === "VACANCY_NOT_OPEN") {
    toast.error(getAxiosErrorMessage(err, "Só dá para divulgar vaga aberta."));
    return;
  }
  toast.error(getAxiosErrorMessage(err, "Não foi possível enviar aos grupos."));
}

/** Para onde a vaga foi divulgada, rodada por rodada (Empresas). */
export function useVacancyGroupBroadcasts(
  vacancyId: string | null,
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: groupBroadcastsKey(vacancyId),
    queryFn: () => getVacancyGroupBroadcasts(vacancyId as string),
    enabled: Boolean(vacancyId) && (options.enabled ?? true),
    refetchInterval: options.refetchInterval ?? false,
    retry: retryUnlessFinal,
    staleTime: 0,
  });
}

/** Quais grupos receberiam um reenvio agora (o N do botão e a lista da confirmação). */
export function useVacancyGroupBroadcastPreview(vacancyId: string | null, enabled = true) {
  return useQuery({
    queryKey: groupBroadcastPreviewKey(vacancyId),
    queryFn: () => getVacancyGroupBroadcastPreview(vacancyId as string),
    enabled: Boolean(vacancyId) && enabled,
    retry: retryUnlessFinal,
    staleTime: 30_000,
  });
}

export const POLL_MS = 5_000;
export const MAX_POLL_MS = 120_000;

interface Watch {
  roundId: string;
  startedAt: number;
}

/**
 * Reenvio para todos os grupos no raio + andamento.
 *
 * - Trava de clique duplo por `useRef` (o estado do React só muda no próximo
 *   render; dois cliques no mesmo quadro passariam pelo `isPending`).
 * - A API responde na hora e manda em fila (1 grupo a cada ~3 s): depois do
 *   reenvio a divulgação é relida a cada `pollMs` enquanto houver grupo na
 *   fila, até `maxPollMs`. Quando a rodada termina, o aviso final diz quantos
 *   receberam e por que os outros não.
 * - `keepLoaded`: o modal sempre lê a divulgação; a coluna da lista só lê
 *   enquanto acompanha um reenvio que ela mesma pediu.
 */
export function useGroupBroadcastResend(
  vacancyId: string,
  options: { keepLoaded?: boolean; pollMs?: number; maxPollMs?: number } = {},
) {
  const { keepLoaded = false, pollMs = POLL_MS, maxPollMs = MAX_POLL_MS } = options;
  const queryClient = useQueryClient();
  const reenviar = useResendVacancyGroupMessage();
  const trava = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [watch, setWatch] = useState<Watch | null>(null);
  // Sem reenvio, o modal ainda acompanha uma rodada que já estava na fila
  // (vaga recém-publicada) — contando a partir de quando ele abriu.
  const [abertoEm] = useState(() => Date.now());

  const cache = queryClient.getQueryData<VacancyGroupBroadcasts>(groupBroadcastsKey(vacancyId));
  // Recalculado a cada render: cada releitura re-renderiza (o `dataUpdatedAt`
  // muda), então o prazo e o fim da fila são vistos na hora.
  const continuar = shouldKeepPolling({
    rounds: cache?.rounds,
    inFlight: cache?.inFlight,
    watchRoundId: watch?.roundId ?? null,
    startedAt: watch?.startedAt ?? abertoEm,
    now: Date.now(),
    maxMs: maxPollMs,
  });

  const query = useVacancyGroupBroadcasts(vacancyId, {
    enabled: keepLoaded || watch !== null,
    refetchInterval: continuar ? pollMs : false,
  });

  // A rodada pedida terminou (ou passou do prazo): avisa o resultado uma vez.
  useEffect(() => {
    if (!watch) return;
    const round = query.data?.rounds.find((r) => r.roundId === watch.roundId);
    const terminou = round ? roundCounts(round).inFlight === 0 : false;
    const venceu = Date.now() - watch.startedAt > maxPollMs;
    if (!terminou && !venceu) return;
    if (round && terminou) {
      const { tone, message } = describeRoundOutcome(round);
      if (tone === "success") toast.success(message);
      else if (tone === "warning") toast.warning(message);
      else toast.error(message);
    } else if (round) {
      const c = roundCounts(round);
      toast.info(
        `O envio ainda não terminou: ${c.sent} de ${grupos(c.attempted)} já receberam. Veja o andamento em Detalhes da vaga.`,
      );
    } else {
      toast.info("Não conseguimos acompanhar o envio. Veja o resultado em Detalhes da vaga.");
    }
    setWatch(null);
    void queryClient.invalidateQueries({ queryKey: ["admin", "vacancy-outreach"] });
  }, [watch, query.data, query.dataUpdatedAt, query.errorUpdatedAt, maxPollMs, queryClient]);

  /** `true` = a API aceitou o pedido. */
  async function resend(): Promise<boolean> {
    if (trava.current) return false;
    trava.current = true;
    setEnviando(true);
    try {
      const res = await reenviar.mutateAsync({ vacancyId, module: "empresa" });
      if (res.roundId) {
        setWatch({ roundId: res.roundId, startedAt: Date.now() });
        const n = res.destinations.length;
        toast.info(
          n > 0
            ? `Enviando a vaga para ${grupos(n)}, 1 a cada ~${SEGUNDOS_ENTRE_GRUPOS} s. Avisamos quando terminar.`
            : "Envio pedido. Avisamos quando terminar.",
        );
      } else {
        // API antiga: envio síncrono, só ao grupo da cidade.
        toast.success("Vaga enviada ao grupo da cidade.");
      }
      return true;
    } catch (e) {
      avisarErroDoReenvio(e);
      // 409 (envio em andamento / vaga não aberta): relê para a tela mostrar o
      // porquê no lugar do botão.
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        void queryClient.invalidateQueries({ queryKey: groupBroadcastsKey(vacancyId) });
      }
      return false;
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  return {
    query,
    resend,
    /** Pedido em curso (POST). */
    enviando,
    /** Acompanhando uma rodada pedida por este botão. */
    acompanhando: watch !== null,
  };
}

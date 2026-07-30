"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getAdminOpenVacancies } from "@/modules/admin/infrastructure/admin-api";

/**
 * Alerta sonoro quando entra vaga nova.
 *
 * Existe para quem deixa o painel aberto (inclusive na TV do Modo Painel) e não
 * fica olhando: vaga nova é o evento que pede reação — alguém acompanha, cobra
 * candidatura, empurra o pagamento.
 *
 * ## Decisões que valem saber
 *
 * **Consulta as vagas ABERTAS, não todas.** É a lista mais leve e é exatamente
 * o recorte do evento ("abriu uma vaga"). Puxar a listagem completa a cada
 * minuto, em toda tela do painel, seria caro para nada.
 *
 * **A primeira carga NUNCA toca.** Ela só semeia o conjunto conhecido. Sem
 * isso, abrir o painel dispararia um som por vaga aberta que existe — dezenas
 * de uma vez.
 *
 * **O som é sintetizado (Web Audio), não um arquivo.** Evita subir binário no
 * repositório e não depende de asset servido corretamente.
 *
 * **Navegador bloqueia áudio até a pessoa interagir com a página.** Isso é
 * política do navegador, não bug: o AudioContext nasce suspenso e só destrava
 * no primeiro clique/tecla. Por isso o hook escuta o primeiro gesto e destrava
 * ali — e expõe `bloqueado` para a UI poder avisar em vez de falhar calada.
 */

const POLL_MS = 60_000;
const STORAGE_KEY = "admin:new-vacancy-chime";

/** Quantas vagas citar no toast antes de virar "e mais N". */
const MAX_NOMES_NO_TOAST = 3;

function lerPreferencia(): boolean {
  if (typeof window === "undefined") return true;
  // Default LIGADO: o alerta é o motivo de a feature existir. Quem não quiser
  // desliga uma vez e a escolha persiste.
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

/**
 * Dois toques curtos ascendentes. Curto de propósito: um som longo num
 * escritório vira incômodo e a pessoa desliga o alerta inteiro.
 */
function tocarAlerta(ctx: AudioContext): void {
  const agora = ctx.currentTime;
  const notas = [
    { freq: 880, inicio: 0 },
    { freq: 1174.66, inicio: 0.16 },
  ];

  for (const nota of notas) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = nota.freq;

    // Envelope com decaimento: onda quadrada/sem envelope estala no alto-falante.
    const t = agora + nota.inicio;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

export interface NewVacancyChime {
  ativo: boolean;
  alternar: () => void;
  /** O navegador ainda não liberou áudio (falta um gesto na página). */
  bloqueado: boolean;
}

export function useNewVacancyChime(): NewVacancyChime {
  const [ativo, setAtivo] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const conhecidasRef = useRef<Set<string> | null>(null);
  const ativoRef = useRef(true);

  // localStorage só existe no cliente: ler no primeiro efeito evita divergência
  // entre o HTML do servidor e o do cliente.
  useEffect(() => {
    const pref = lerPreferencia();
    setAtivo(pref);
    ativoRef.current = pref;
  }, []);

  /** Cria (ou retoma) o AudioContext. Só funciona dentro de um gesto do usuário. */
  const destravarAudio = useCallback(async () => {
    try {
      type ComWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as ComWebkit).webkitAudioContext;
      if (!Ctor) return;

      ctxRef.current ??= new Ctor();
      if (ctxRef.current.state === "suspended") {
        await ctxRef.current.resume();
      }
      setBloqueado(ctxRef.current.state !== "running");
    } catch {
      setBloqueado(true);
    }
  }, []);

  // Primeiro gesto na página destrava o áudio. `once` porque depois disso o
  // contexto fica vivo — reinscrever a cada clique seria desperdício.
  useEffect(() => {
    const handler = () => void destravarAudio();
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [destravarAudio]);

  const { data } = useQuery({
    queryKey: ["admin", "open-vacancies", "chime"],
    queryFn: () => getAdminOpenVacancies(),
    refetchInterval: POLL_MS,
    // O painel pode ficar numa TV, sem foco de janela; sem isto o navegador
    // pausaria o refetch e o alerta simplesmente nunca tocaria.
    refetchIntervalInBackground: true,
    staleTime: POLL_MS,
  });

  useEffect(() => {
    if (!data) return;

    const idsAtuais = new Set(data.map((v) => v.id));

    // Primeira carga: só semeia. Nunca toca (ver doc no topo).
    if (conhecidasRef.current === null) {
      conhecidasRef.current = idsAtuais;
      return;
    }

    const novas = data.filter((v) => !conhecidasRef.current!.has(v.id));
    conhecidasRef.current = idsAtuais;

    if (novas.length === 0) return;

    const nomes = novas
      .slice(0, MAX_NOMES_NO_TOAST)
      .map((v) => v.contractorCompanyName || v.contractorName || v.title)
      .join(", ");
    const resto = novas.length - Math.min(novas.length, MAX_NOMES_NO_TOAST);

    // O toast aparece mesmo com o som desligado: quem desligou o áudio ainda
    // quer saber que entrou vaga.
    toast.success(
      novas.length === 1 ? "Nova vaga aberta" : `${novas.length} novas vagas abertas`,
      { description: resto > 0 ? `${nomes} e mais ${resto}` : nomes, duration: 8000 },
    );

    if (!ativoRef.current) return;

    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") {
      // Sem gesto na página ainda: o navegador não deixa tocar. Sinaliza para a
      // UI em vez de falhar em silêncio.
      setBloqueado(true);
      return;
    }
    tocarAlerta(ctx);
  }, [data]);

  const alternar = useCallback(() => {
    setAtivo((anterior) => {
      const proximo = !anterior;
      ativoRef.current = proximo;
      window.localStorage.setItem(STORAGE_KEY, proximo ? "on" : "off");

      if (proximo) {
        // Ligar é um gesto do usuário: aproveita para destravar o áudio E dar
        // uma prévia, para a pessoa saber que som esperar.
        void destravarAudio().then(() => {
          const ctx = ctxRef.current;
          if (ctx && ctx.state === "running") tocarAlerta(ctx);
        });
      }
      return proximo;
    });
  }, [destravarAudio]);

  return { ativo, alternar, bloqueado };
}

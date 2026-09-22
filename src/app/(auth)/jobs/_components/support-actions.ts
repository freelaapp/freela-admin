import type { VacancyBucket } from "./vacancy-bucket";

/**
 * Área de trabalho do suporte — o que precisa ser FEITO em cada etapa da vaga.
 *
 * O painel já dizia em que etapa cada vaga está; não dizia o que fazer com ela.
 * Este arquivo é a resposta: para cada etapa, a lista de ações que o suporte
 * tica conforme executa, e a régua que decide quais delas já são CRÍTICAS.
 *
 * Fica separado da UI de propósito — é a peça que define a operação do time, a
 * que mais muda com a prática e a que mais merece teste isolado. Quem quiser
 * mexer no roteiro do suporte mexe aqui e em nenhum outro lugar.
 */

// ─── Régua de prioridade ────────────────────────────────────────────────────

/**
 * Quanto a vaga está pegando fogo. Deriva do TEMPO, nunca do humor de quem
 * olha: é o tempo que restou que decide quem se atende primeiro.
 */
export type SupportPriority = "normal" | "atencao" | "urgente" | "critico";

export const PRIORIDADE_ROTULO: Record<SupportPriority, string> = {
  normal: "Normal",
  atencao: "Atenção",
  urgente: "Urgente",
  critico: "Crítico",
};

/** Cor por prioridade: borda/texto e fundo. Mesma paleta das colunas do painel. */
export const PRIORIDADE_COR: Record<SupportPriority, { cor: string; corFundo: string }> = {
  normal: { cor: "#475569", corFundo: "#F1F5F9" },
  atencao: { cor: "#D97706", corFundo: "#FFFBEB" },
  urgente: { cor: "#EA580C", corFundo: "#FFF7ED" },
  critico: { cor: "#DC2626", corFundo: "#FEF2F2" },
};

/**
 * A janela de tempo da vaga, em horas, já resolvida.
 *
 * Duas medidas porque as etapas perguntam coisas diferentes: até o freelancer
 * entrar, o que aperta é quanto FALTA para o turno; depois que o serviço acaba,
 * o que aperta é há quanto tempo a avaliação está parada (ela trava o repasse).
 */
export interface JanelaDaVaga {
  /** Horas até o início do turno. Negativo = já começou. `null` = data ilegível. */
  horasAteInicio: number | null;
  /** Horas desde o fim do turno. Negativo = ainda não terminou. `null` = ilegível. */
  horasDesdeFim: number | null;
}

const HORA_MS = 60 * 60 * 1000;

/** Lê um instante ISO em horas de distância de `agora` (positivo = no futuro). */
function horasAte(iso: string | null | undefined, agora: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return (ms - agora) / HORA_MS;
}

export function calcularJanela(
  v: { startTime?: string | null; endTime?: string | null },
  agora: number = Date.now(),
): JanelaDaVaga {
  const ateInicio = horasAte(v.startTime, agora);
  const ateFim = horasAte(v.endTime, agora);
  return {
    horasAteInicio: ateInicio,
    // "Desde o fim" é o espelho de "até o fim": 3h depois do turno = −3h até o fim.
    horasDesdeFim: ateFim === null ? null : -ateFim,
  };
}

/**
 * Prioridade da vaga na fila do suporte.
 *
 * Antes do turno, a régua é o tempo que falta — é o pedido literal da operação
 * ("ordem de prioridade de acordo com o tempo para a vaga"). Depois que o
 * serviço começa, tempo-até-o-início vira número negativo e não diz mais nada:
 * vaga EM ANDAMENTO é acompanhamento (atenção), e vaga esperando avaliação
 * escala com os dias parada, porque é a avaliação que solta o repasse.
 *
 * Sem data legível não se inventa urgência: cai em "atenção", que põe a vaga na
 * frente das normais sem gritar como as que têm hora marcada.
 */
export function resolverPrioridade(
  bucket: VacancyBucket,
  janela: JanelaDaVaga,
): SupportPriority {
  if (bucket === "inProgress") return "atencao";

  if (bucket === "completedAwaitingReview") {
    const paradaHa = janela.horasDesdeFim;
    if (paradaHa === null) return "atencao";
    if (paradaHa >= 48) return "critico";
    if (paradaHa >= 24) return "urgente";
    return "atencao";
  }

  if (bucket === "completedReviewed" || bucket === "cancelled" || bucket === "lost") {
    return "normal";
  }

  const falta = janela.horasAteInicio;
  if (falta === null) return "atencao";
  // Turno já começou e a vaga ainda está numa etapa de espera: é o pior caso
  // do painel — o sistema cancela sozinho ao bater o horário.
  if (falta <= 2) return "critico";
  if (falta <= 6) return "urgente";
  if (falta <= 24) return "atencao";
  return "normal";
}

// ─── Catálogo de ações ──────────────────────────────────────────────────────

/**
 * Atalho operacional que a ação destrava na área de trabalho.
 *
 * Existe para a ação não virar só um texto a ticar: quem lê "cobrar pagamento"
 * quer o botão de cobrar ali, não uma viagem até outra tela.
 */
export type SupportAtalho =
  /** Abre a conversa do contratante no WhatsApp com o texto da etapa pronto. */
  | "whatsappContratante"
  /** Idem, com o freelancer aceito. */
  | "whatsappFreelancer"
  /** Reenvia o anúncio no grupo da cidade (mesma rota do disparo original). */
  | "reenviarGrupo"
  /** Dispara o aviso de etapa ao contratante (mesma rota do botão do card). */
  | "cobrarEscolha"
  | "cobrarPagamento";

export interface SupportAction {
  id: string;
  label: string;
  /** Por que a ação existe / como fazê-la. Vira a linha de apoio no checklist. */
  hint: string;
  /**
   * A ação vira CRÍTICA quando faltam menos horas que isto para o início do
   * turno. `Infinity` = crítica desde que a vaga entra na etapa (é o mínimo
   * que não pode deixar de ser feito). `null` = nunca vira crítica — é boa
   * prática, não pendência que segura a operação.
   */
  criticaAbaixoDeHoras: number | null;
  atalho?: SupportAtalho;
}

/**
 * Ações que valem em QUALQUER etapa, enquanto não forem feitas.
 *
 * A saudação é a primeira coisa que o suporte faz e não pertence a nenhuma
 * coluna: se a vaga andou para "aguardando seleção" sem ninguém ter falado com
 * o contratante, o buraco continua aberto — e some da tela se a ação morasse
 * só na primeira coluna.
 */
export const ACOES_SEMPRE: SupportAction[] = [
  {
    id: "saudacao",
    label: "Enviar saudação ao contratante",
    hint: "Agradecer a abertura da vaga, se apresentar como o suporte que vai acompanhar e garantir a melhor experiência com o freela.",
    criticaAbaixoDeHoras: Infinity,
    atalho: "whatsappContratante",
  },
];

/**
 * Ações por etapa, na ordem em que o suporte as executa.
 *
 * A ordem importa: a lista é lida de cima para baixo por quem está no telefone,
 * e a primeira linha de cada etapa é sempre a que resolve o caso sozinha na
 * maioria das vezes.
 */
export const ACOES_POR_ETAPA: Partial<Record<VacancyBucket, SupportAction[]>> = {
  // ── 1. Aberta, sem candidato ──────────────────────────────────────────────
  // "Não podemos deixar nenhuma vaga aberta sem freelance": aqui as ações
  // escalam de divulgação barata (grupo) para cara (ligação, grupo externo)
  // conforme o relógio anda.
  open: [
    {
      id: "divulgar_grupo",
      label: "Divulgar de novo no grupo de WhatsApp",
      hint: "Reenvia o anúncio no grupo da cidade — o primeiro disparo se perde no meio da conversa.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "reenviarGrupo",
    },
    {
      id: "chamar_base_reputacao",
      label: "Chamar no individual a base de freelas",
      hint: "Comece por quem já prestou serviço e tem boa reputação — depois abra para os compatíveis com o cargo e a cidade.",
      criticaAbaixoDeHoras: 72,
    },
    {
      id: "enquete_grupo",
      label: "Abrir enquete no grupo: quem está disponível?",
      hint: "A enquete mostra quem está livre no dia/horário sem depender de cada um responder no privado.",
      criticaAbaixoDeHoras: 48,
    },
    {
      id: "divulgar_externo",
      label: "Divulgar em grupos externos",
      hint: "Grupos de freelancer, grupos de emprego, Facebook. Use quando a base própria não cobriu.",
      criticaAbaixoDeHoras: 24,
    },
    {
      id: "ligar_freelas",
      label: "Ligar para os freelas compatíveis",
      hint: "Quem não respondeu no WhatsApp atende no telefone. É o último recurso antes de mexer na vaga.",
      criticaAbaixoDeHoras: 12,
    },
    {
      id: "alinhar_contratante_alcance",
      label: "Alinhar com o contratante o alcance da vaga",
      hint: "Sem candidato às vésperas, avise e proponha ajuste: valor, horário, requisitos.",
      criticaAbaixoDeHoras: 6,
      atalho: "whatsappContratante",
    },
  ],

  // ── 2. Aguardando seleção ─────────────────────────────────────────────────
  // Tem candidato: o gargalo é o contratante que não escolheu. Mas cobrar sem
  // saber quem ainda está de pé só empurra o problema — daí a triagem antes.
  awaitingSelection: [
    {
      id: "cobrar_escolha",
      label: "Cobrar a escolha do contratante",
      hint: "Manda o aviso de etapa no WhatsApp do contratante. Sem escolha, a vaga não anda.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "cobrarEscolha",
    },
    {
      id: "conferir_disponibilidade",
      label: "Conferir quem de fato está disponível",
      hint: "Fale com os candidatos antes de cobrar: candidatura antiga costuma já estar ocupada.",
      criticaAbaixoDeHoras: 48,
    },
    {
      id: "sugerir_candidatos",
      label: "Sugerir ao contratante os melhores disponíveis",
      hint: "Indique nome, reputação e histórico. Escolher fica mais fácil com dois ou três nomes na mão.",
      criticaAbaixoDeHoras: 24,
      atalho: "whatsappContratante",
    },
    {
      id: "ligar_contratante_escolha",
      label: "Ligar para o contratante",
      hint: "Perto do horário da vaga, WhatsApp não resolve — ligue.",
      criticaAbaixoDeHoras: 6,
    },
  ],

  // ── 3. Aguardando pagamento ───────────────────────────────────────────────
  // A vaga é cancelada pelo sistema ao bater o horário de início sem pagamento.
  // Por isso o deslocamento do freela entra aqui: quem mora longe precisa sair
  // antes de o pagamento cair, ou chega atrasado mesmo com tudo pago.
  awaitingPayment: [
    {
      id: "cobrar_pagamento",
      label: "Cobrar o pagamento do contratante",
      hint: "Manda o aviso de etapa no WhatsApp. Sem pagamento não nasce o job e a vaga cai sozinha no horário.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "cobrarPagamento",
    },
    {
      id: "realinhar_horario",
      label: "Realinhar horário de entrada e saída",
      hint: "Se o pagamento atrasou a ponto de apertar o turno, acerte com o contratante antes de o freela sair de casa.",
      criticaAbaixoDeHoras: 12,
      atalho: "whatsappContratante",
    },
    {
      id: "alinhar_deslocamento",
      label: "Alinhar o deslocamento do freelancer",
      hint: "Avise o escolhido para já ir se deslocando — o trajeto costuma ser mais longo que o atraso do pagamento.",
      criticaAbaixoDeHoras: 4,
      atalho: "whatsappFreelancer",
    },
    {
      id: "ligar_contratante_pagamento",
      label: "Ligar para o contratante",
      hint: "Faltando poucas horas, ligue: é a última janela antes do cancelamento automático.",
      criticaAbaixoDeHoras: 2,
    },
  ],

  // ── 4. Freela confirmado ──────────────────────────────────────────────────
  // Pago e agendado. O risco aqui não é mais dinheiro, é o freela não aparecer
  // ou aparecer errado — e as duas coisas se resolvem falando antes.
  confirmed: [
    {
      id: "cobrar_confirmacao",
      label: "Garantir a confirmação do freelancer",
      hint: "Ele confirma pelo link do WhatsApp ou pelo app. Se confirmou com o suporte, confirme pela plataforma na tela da vaga — sem isso a vaga volta ao mural.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "whatsappFreelancer",
    },
    {
      id: "passar_regras",
      label: "Passar as regras da vaga",
      hint: "Horário de entrada, vestimenta/uniforme, local e a quem se apresentar. E o principal: não atrasar.",
      criticaAbaixoDeHoras: 24,
      atalho: "whatsappFreelancer",
    },
    {
      id: "confirmar_deslocamento",
      label: "Confirmar que o freela está a caminho",
      hint: "Nas horas antes do turno, confirme que ele saiu. É o que dá tempo de repor se ele furar.",
      criticaAbaixoDeHoras: 4,
      atalho: "whatsappFreelancer",
    },
  ],

  // ── 5. Em andamento ───────────────────────────────────────────────────────
  // O turno está rolando: nenhuma ação daqui se resolve com prazo em horas, ou
  // é agora ou não é mais. Por isso as críticas são `Infinity` e o resto `null`.
  inProgress: [
    {
      id: "checar_chegada",
      label: "Conferir a chegada e orientar o check-in",
      hint: "Chegou no horário? Fez o check-in? Sem check-in o serviço não fecha e o repasse trava.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "whatsappFreelancer",
    },
    {
      id: "orientar_conduta",
      label: "Orientar a conduta no serviço",
      hint: "Seguir as orientações do contratante, não ficar no celular, e lembrar que ao final tem avaliação — é ela que traz mais vagas para ele.",
      criticaAbaixoDeHoras: null,
      atalho: "whatsappFreelancer",
    },
    {
      id: "checar_contratante_turno",
      label: "Conferir com o contratante durante o turno",
      hint: "Uma passada no meio do turno: está tudo certo com o freela? Problema pequeno se resolve durante, não depois.",
      criticaAbaixoDeHoras: null,
      atalho: "whatsappContratante",
    },
  ],

  // ── 6. Aguardando avaliação ───────────────────────────────────────────────
  completedAwaitingReview: [
    {
      id: "pedir_avaliacao_contratante",
      label: "Pedir a avaliação do contratante",
      hint: "É ela que libera o repasse ao freelancer e alimenta a plataforma com quem é bom. Peça logo ao fim do turno.",
      criticaAbaixoDeHoras: Infinity,
      atalho: "whatsappContratante",
    },
    {
      id: "pedir_avaliacao_freela",
      label: "Pedir a avaliação do freelancer",
      hint: "O outro lado da nota: é como a base aprende quais contratantes valem a pena.",
      criticaAbaixoDeHoras: null,
      atalho: "whatsappFreelancer",
    },
    {
      id: "registrar_ocorrencia",
      label: "Registrar as ocorrências do turno",
      hint: "Atraso, problema, elogio. O que não for anotado aqui não existe na próxima contratação.",
      criticaAbaixoDeHoras: null,
    },
  ],

  // Concluída e avaliada: ciclo fechado, nada a cobrar. Sem lista, a área de
  // trabalho mostra o estado e sai da frente.
  completedReviewed: [],
};

/** Todas as ações aplicáveis à vaga: as de sempre + as da etapa atual. */
export function acoesDaEtapa(bucket: VacancyBucket): SupportAction[] {
  return [...ACOES_SEMPRE, ...(ACOES_POR_ETAPA[bucket] ?? [])];
}

/**
 * A ação já é crítica?
 *
 * Vaga sem data legível cai em crítica quando a ação tem prazo: é melhor cobrar
 * à toa do que descobrir depois que a vaga sem data era a de hoje à noite.
 */
export function acaoEstaCritica(acao: SupportAction, janela: JanelaDaVaga): boolean {
  if (acao.criticaAbaixoDeHoras === null) return false;
  if (acao.criticaAbaixoDeHoras === Infinity) return true;
  if (janela.horasAteInicio === null) return true;
  return janela.horasAteInicio <= acao.criticaAbaixoDeHoras;
}

// ─── Pendências de uma vaga ─────────────────────────────────────────────────

export interface PendenciasDaVaga {
  /** Ações aplicáveis (sempre + etapa), na ordem de execução. */
  acoes: SupportAction[];
  feitas: number;
  total: number;
  /** As críticas que ainda NÃO foram ticadas — são elas que acendem o banner. */
  criticasPendentes: SupportAction[];
  prioridade: SupportPriority;
  /** Nada mais a fazer nesta etapa. */
  concluida: boolean;
}

export function resolverPendencias(
  bucket: VacancyBucket,
  janela: JanelaDaVaga,
  feitas: ReadonlySet<string>,
): PendenciasDaVaga {
  const acoes = acoesDaEtapa(bucket);
  const pendentes = acoes.filter((a) => !feitas.has(a.id));
  return {
    acoes,
    feitas: acoes.length - pendentes.length,
    total: acoes.length,
    criticasPendentes: pendentes.filter((a) => acaoEstaCritica(a, janela)),
    prioridade: resolverPrioridade(bucket, janela),
    concluida: pendentes.length === 0,
  };
}

/** Ordem do banner: o mais crítico primeiro, e dentro da prioridade o que tem
 *  menos tempo. Quem lê de cima para baixo atende na ordem certa. */
const PESO_PRIORIDADE: Record<SupportPriority, number> = {
  critico: 0,
  urgente: 1,
  atencao: 2,
  normal: 3,
};

export function compararUrgencia(
  a: { prioridade: SupportPriority; janela: JanelaDaVaga },
  b: { prioridade: SupportPriority; janela: JanelaDaVaga },
): number {
  const peso = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
  if (peso !== 0) return peso;
  // `null` (data ilegível) vai para o fim do empate: não dá para prometer que é
  // urgente, mas também não se esconde — a prioridade já a colocou no grupo.
  const ha = a.janela.horasAteInicio ?? Number.POSITIVE_INFINITY;
  const hb = b.janela.horasAteInicio ?? Number.POSITIVE_INFINITY;
  return ha - hb;
}

/** "em 3h20" / "em 45min" / "há 2h" — o tempo que sobra, como se fala. */
export function formatarTempoRestante(horas: number | null): string {
  if (horas === null) return "sem data";
  const passado = horas < 0;
  const abs = Math.abs(horas);
  let texto: string;
  if (abs >= 48) {
    texto = `${Math.floor(abs / 24)}d`;
  } else {
    // Conta em MINUTOS e só então divide: arredondar horas e minutos em
    // separado deixava "2h60"/"60min" na borda (0,999h → 60min em vez de 1h00).
    const totalMin = Math.round(abs * 60);
    if (totalMin < 60) {
      texto = `${Math.max(1, totalMin)}min`;
    } else {
      texto = `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, "0")}`;
    }
  }
  return passado ? `há ${texto}` : `em ${texto}`;
}

/**
 * Qual relógio a vaga mostra, na convenção "horas até" (negativo = passado).
 *
 * Antes do turno o que aperta é quanto FALTA para começar. Depois que o serviço
 * começa, tempo-até-o-início vira negativo e não diz mais nada de útil: o que
 * importa passa a ser o FIM — em andamento, quanto falta para terminar; parada
 * aguardando avaliação, há quanto tempo terminou (é a avaliação que trava o
 * repasse). Devolve na mesma escala do `horasAteInicio` para o
 * `formatarTempoRestante` render "em …"/"há …" sem outro caso especial.
 */
export function tempoDeReferencia(bucket: VacancyBucket, janela: JanelaDaVaga): number | null {
  if (bucket === "inProgress" || bucket === "completedAwaitingReview") {
    // `horasDesdeFim` é o espelho de "até o fim" (positivo = já terminou), então
    // negá-lo devolve "horas até o fim": +2 = termina em 2h, −3 = terminou há 3h.
    return janela.horasDesdeFim === null ? null : -janela.horasDesdeFim;
  }
  return janela.horasAteInicio;
}

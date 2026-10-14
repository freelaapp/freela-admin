import type {
  GroupBroadcastCenterSource,
  GroupBroadcastDestination,
  GroupBroadcastFailedGroup,
  GroupBroadcastLastRound,
  GroupBroadcastMode,
  GroupBroadcastRound,
  GroupDestinationReason,
  GroupDestinationStatus,
  VacancyGroupBroadcasts,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";

/**
 * Regras puras da "Divulgação nos grupos" (coluna Disparo + modal da vaga).
 *
 * Tudo que é conta ou texto com número mora aqui, testado sem tela: o dono
 * pede que todo número diga o que é, a conta e a fonte — e a mesma conta não
 * pode sair diferente na lista e no modal.
 */

/**
 * Raio padrão. Só é usado onde a API não manda o raio (o resumo da lista e
 * rodada sem raio gravado); o modal usa o `radiusKm` que vem da API.
 */
export const RAIO_PADRAO_KM = 30;

/** Intervalo da fila da API entre um grupo e outro (texto de andamento). */
export const SEGUNDOS_ENTRE_GRUPOS = 3;

const SP_TZ = "America/Sao_Paulo";

// ─── Palavras e formatos ─────────────────────────────────────────────────────

export function grupos(n: number): string {
  return `${n} ${n === 1 ? "grupo" : "grupos"}`;
}

/** "Campinas-SP" (ou só o que houver). */
export function cidadeUf(city: string | null, uf: string | null): string | null {
  if (city && uf) return `${city}-${uf}`;
  return city || uf || null;
}

/** Distância arredondada para o km inteiro mais próximo. */
export function formatKm(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return null;
  const inteiro = Math.round(distanceKm);
  return inteiro < 1 ? "menos de 1 km" : `${inteiro} km`;
}

function diaSp(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: SP_TZ });
}

/** "09:12" no fuso de Brasília. */
export function formatHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP_TZ });
}

/** "14/10 às 09:12" no fuso de Brasília. */
export function formatDiaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${diaSp(d)} às ${formatHora(iso)}`;
}

/** "hoje às 09:12 (há 25 min)", "ontem às 18:00 (há 15 h)", "11/08 às 20:04 (há 63 dias)". */
export function formatQuandoRelativo(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = diaSp(d);
  const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rotuloDia = dia === diaSp(now) ? "hoje" : dia === diaSp(ontem) ? "ontem" : dia;
  const minutos = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  let ha: string;
  if (minutos < 1) ha = "agora há pouco";
  else if (minutos < 60) ha = `há ${minutos} min`;
  else if (minutos < 48 * 60) ha = `há ${Math.floor(minutos / 60)} h`;
  else {
    const dias = Math.floor(minutos / (24 * 60));
    ha = `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  return `${rotuloDia} às ${formatHora(iso)} (${ha})`;
}

// ─── Rótulos ─────────────────────────────────────────────────────────────────

export function reasonLabel(reason: GroupDestinationReason, radiusKm: number): string {
  switch (reason) {
    case "VACANCY_CITY":
      return "Cidade da vaga";
    case "RADIUS":
      return `Até ${radiusKm || RAIO_PADRAO_KM} km`;
    case "VIP_STORE_GROUP":
      return "Grupo exclusivo da empresa";
    case "FALLBACK":
      return "Grupo de reserva";
    default:
      return "Outro motivo";
  }
}

/** Código da falha → texto, quando a API não mandou o motivo escrito. */
const ERRO_POR_CODIGO: Record<string, string> = {
  WHATSAPP_DESLIGADO: "A integração com o WhatsApp está desligada.",
  FALHA_NO_ENVIO: "O WhatsApp recusou o envio.",
  ENVIO_INTERROMPIDO: "O envio foi interrompido no meio.",
  EXPIRADO: "Ficou mais de 2 h na fila e não saiu.",
  LIMITE_DE_GRUPOS: "Passou do limite de grupos por vaga.",
};

/** Motivo da falha/pulo de um grupo, como a API escreveu (ou pelo código). */
export function motivoDoGrupo(d: Pick<GroupBroadcastDestination, "error" | "errorCode">): string {
  return d.error || (d.errorCode && ERRO_POR_CODIGO[d.errorCode]) || d.errorCode || "Motivo não informado.";
}

export function modeLabel(mode: GroupBroadcastMode): string {
  return mode === "MANUAL" ? "Reenvio manual" : "Automático";
}

/** Situação do grupo: ícone + palavra (nunca só cor). */
export function statusLabel(d: Pick<GroupBroadcastDestination, "status" | "sentAt">): {
  icon: string;
  text: string;
  tone: "green" | "red" | "gray" | "blue";
} {
  const hora = d.sentAt ? ` às ${formatHora(d.sentAt)}` : "";
  switch (d.status) {
    case "SENT":
      return { icon: "✓", text: `Enviado${hora}`, tone: "green" };
    case "FAILED":
      return { icon: "✗", text: `Falhou${hora}`, tone: "red" };
    case "SKIPPED":
      return { icon: "–", text: "Pulado", tone: "gray" };
    case "PENDING":
      return { icon: "…", text: "Na fila", tone: "blue" };
    case "SENDING":
      return { icon: "…", text: "Enviando agora", tone: "blue" };
    default:
      return { icon: "?", text: "Situação desconhecida", tone: "gray" };
  }
}

/**
 * "do local da vaga" / "do endereço da empresa" / "do centro de Campinas-SP":
 * de onde a distância foi medida (a fonte do número).
 */
export function origemDaDistancia(
  source: GroupBroadcastCenterSource,
  city: string | null = null,
  uf: string | null = null,
): string {
  switch (source) {
    case "CONTRACTOR":
      return "do endereço da empresa (a vaga não tem localização própria no mapa)";
    case "CITY_SEAT": {
      const cidade = cidadeUf(city, uf);
      return cidade
        ? `do centro de ${cidade} (a vaga não tem localização no mapa)`
        : "do centro da cidade da vaga (a vaga não tem localização no mapa)";
    }
    default:
      return "do local da vaga";
  }
}

// ─── Rodadas ─────────────────────────────────────────────────────────────────

const EM_ANDAMENTO: GroupDestinationStatus[] = ["PENDING", "SENDING"];

export function roundInFlight(round: GroupBroadcastRound): boolean {
  if (round.destinations.length === 0) return round.summary.pending > 0;
  return round.destinations.some((d) => EM_ANDAMENTO.includes(d.status));
}

/** Grupo da cidade da vaga primeiro; depois por distância; depois por nome. */
export function sortDestinations<T extends Pick<GroupBroadcastDestination, "reason" | "distanceKm" | "groupName">>(
  destinations: T[],
): T[] {
  const peso = (d: T) => (d.reason === "VACANCY_CITY" ? 0 : 1);
  return [...destinations].sort(
    (a, b) =>
      peso(a) - peso(b) ||
      (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
      a.groupName.localeCompare(b.groupName, "pt-BR"),
  );
}

/** Contagem da rodada pelas linhas (pulados fora da conta). */
export function roundCounts(round: GroupBroadcastRound) {
  const tentados = round.destinations.filter((d) => d.status !== "SKIPPED");
  const conta = (lista: GroupBroadcastDestination[]) => ({
    total: lista.length,
    sent: lista.filter((d) => d.status === "SENT").length,
  });
  const de = (r: GroupDestinationReason) => tentados.filter((d) => d.reason === r);
  return {
    attempted: tentados.length,
    sent: tentados.filter((d) => d.status === "SENT").length,
    failed: tentados.filter((d) => d.status === "FAILED").length,
    inFlight: tentados.filter((d) => EM_ANDAMENTO.includes(d.status)).length,
    skipped: round.destinations.length - tentados.length,
    ownCity: conta(de("VACANCY_CITY")),
    radius: conta(de("RADIUS")),
    fallback: conta(de("FALLBACK")),
    vip: conta(de("VIP_STORE_GROUP")),
    other: conta(de("UNKNOWN")),
  };
}

/** Rótulo de cada parcela da composição ("1 da cidade da vaga + 3 a até 30 km"). */
function rotulosDaComposicao(raioKm: number) {
  return {
    ownCity: () => "da cidade da vaga",
    radius: () => `a até ${raioKm || RAIO_PADRAO_KM} km`,
    fallback: (n: number) => (n === 1 ? "grupo de reserva" : "grupos de reserva"),
    vip: (n: number) => (n === 1 ? "exclusivo da empresa" : "exclusivos da empresa"),
    other: (n: number) => (n === 1 ? "outro" : "outros"),
  };
}

function peca(sent: number, total: number, rotulo: string): string | null {
  if (total === 0) return null;
  return sent === total ? `${total} ${rotulo}` : `${sent} de ${total} ${rotulo}`;
}

/**
 * "Recebeu em 3 de 4 grupos na última rodada (1 da cidade da vaga + 2 de 3 a
 * até 30 km)". Pulados ficam fora da conta; o raio é o DESTA rodada.
 */
export function roundHeadline(round: GroupBroadcastRound): string {
  const c = roundCounts(round);
  const r = rotulosDaComposicao(round.radiusKm);
  const partes = [
    peca(c.ownCity.sent, c.ownCity.total, r.ownCity()),
    peca(c.radius.sent, c.radius.total, r.radius()),
    peca(c.fallback.sent, c.fallback.total, r.fallback(c.fallback.total)),
    peca(c.vip.sent, c.vip.total, r.vip(c.vip.total)),
    peca(c.other.sent, c.other.total, r.other(c.other.total)),
  ].filter(Boolean);
  const composicao = partes.length > 0 ? ` (${partes.join(" + ")})` : "";
  if (c.inFlight > 0) {
    return `Enviando: ${c.sent} de ${grupos(c.attempted)} já receberam${composicao}. A mensagem sai em 1 grupo a cada ~${SEGUNDOS_ENTRE_GRUPOS} s.`;
  }
  return `Recebeu em ${c.sent} de ${grupos(c.attempted)} na última rodada${composicao}.`;
}

/** Resumo de uma rodada recolhida: "4 de 4 grupos receberam". */
export function roundShortSummary(round: GroupBroadcastRound): string {
  const c = roundCounts(round);
  if (c.inFlight > 0) return `enviando, ${c.sent} de ${grupos(c.attempted)}`;
  return `${c.sent} de ${grupos(c.attempted)} ${c.sent === 1 ? "recebeu" : "receberam"}`;
}

function semPontoFinal(s: string): string {
  return s.trim().replace(/[.\s]+$/, "");
}

/** Motivo da falha da rodada inteira (o primeiro que a API deu). */
export function primeiroMotivo(round: GroupBroadcastRound): string | null {
  const falha = round.destinations.find((d) => d.status === "FAILED" && (d.error || d.errorCode));
  return falha ? semPontoFinal(motivoDoGrupo(falha)) : null;
}

export function roundAllFailed(round: GroupBroadcastRound): boolean {
  const c = roundCounts(round);
  return c.attempted > 0 && c.inFlight === 0 && c.sent === 0;
}

/** "Vagas A (motivo); Vagas B (motivo)" — quem não recebeu, com o porquê. */
function listaDeFalhas(falhas: Array<{ groupName: string; motivo: string | null }>): string {
  return falhas
    .map((f) => (f.motivo ? `${f.groupName} (${semPontoFinal(f.motivo)})` : f.groupName))
    .join("; ");
}

/** Aviso (toast) quando a rodada termina — textos do UX §4. */
export function describeRoundOutcome(round: GroupBroadcastRound): {
  tone: "success" | "warning" | "error";
  message: string;
} {
  const c = roundCounts(round);
  if (c.attempted === 0) {
    return { tone: "error", message: "A vaga não saiu em nenhum grupo: todos ficaram de fora desta rodada." };
  }
  if (c.sent === c.attempted) {
    return { tone: "success", message: `Vaga enviada a ${grupos(c.sent)}.` };
  }
  const naoRecebeu = round.destinations.filter((d) => d.status !== "SKIPPED" && d.status !== "SENT");
  if (c.sent === 0) {
    const motivo = primeiroMotivo(round);
    return {
      tone: "error",
      message: `A vaga não saiu em nenhum grupo.${motivo ? ` ${motivo}.` : ""} Tente de novo em alguns minutos.`,
    };
  }
  const detalhe =
    naoRecebeu.length === 1
      ? `${naoRecebeu[0].groupName} não recebeu: ${semPontoFinal(motivoDoGrupo(naoRecebeu[0]))}.`
      : `Não receberam: ${listaDeFalhas(naoRecebeu.map((d) => ({ groupName: d.groupName, motivo: motivoDoGrupo(d) })))}.`;
  return {
    tone: "warning",
    message: `Vaga enviada a ${c.sent} de ${grupos(c.attempted)}. ${detalhe} Veja em Detalhes da vaga.`,
  };
}

/**
 * Continua relendo a divulgação? Depois do reenvio: até a rodada pedida
 * aparecer e não ter mais grupo na fila. Sem reenvio: enquanto houver grupo na
 * fila (ex.: vaga acabou de ser publicada). Nos dois casos, só até `maxMs`
 * depois de `startedAt`.
 */
export function shouldKeepPolling(input: {
  rounds: GroupBroadcastRound[] | undefined;
  /** `inFlight` da API (grupos na fila em qualquer rodada), quando houver. */
  inFlight?: number;
  watchRoundId: string | null;
  startedAt: number;
  now: number;
  maxMs: number;
}): boolean {
  if (input.now - input.startedAt > input.maxMs) return false;
  const rounds = input.rounds ?? [];
  if (input.watchRoundId) {
    const round = rounds.find((r) => r.roundId === input.watchRoundId);
    return !round || roundInFlight(round);
  }
  return (input.inFlight ?? 0) > 0 || (rounds.length > 0 && roundInFlight(rounds[0]));
}

/** Quando a vaga saiu num grupo pela última vez (para a confirmação do reenvio). */
export function lastBroadcastAt(data: VacancyGroupBroadcasts | undefined): string | null {
  if (!data) return null;
  const vezes: string[] = [];
  for (const r of data.rounds) {
    for (const d of r.destinations) {
      if (d.status === "SENT") vezes.push(d.sentAt ?? r.createdAt);
    }
  }
  if (data.groupBroadcastAt) vezes.push(data.groupBroadcastAt);
  const validas = vezes.filter((v) => !Number.isNaN(Date.parse(v)));
  if (validas.length === 0) return null;
  return validas.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

// ─── Selo da coluna "Disparo" ────────────────────────────────────────────────

/** A última rodada (resumo da lista) ainda tem grupo na fila? */
export function lastRoundInFlight(r: GroupBroadcastLastRound | null | undefined): boolean {
  if (!r) return false;
  return r.pending > 0 || r.sent + r.failedCount < r.total;
}

export type DispatchTone = "green" | "blue" | "amber" | "red" | "gray";

export interface DispatchBadgeModel {
  /** Ícone + palavra(s). */
  text: string;
  /** Hora (Brasília) mostrada em cinza depois do texto. */
  time: string | null;
  tone: DispatchTone;
  /** Tooltip: a conta e a origem do número. */
  title: string;
}

interface OutreachLike {
  lastSentAt?: string | null;
  autoSentAt?: string | null;
  manualSentAt?: string | null;
  groupBroadcast?: { lastRound: GroupBroadcastLastRound | null };
}

const NUNCA: DispatchBadgeModel = {
  text: "✗ Não divulgada",
  time: null,
  tone: "red",
  title: "Esta vaga ainda não saiu em nenhum grupo.",
};

const REGISTRO_ANTIGO: DispatchBadgeModel = {
  text: "✓ enviado",
  time: null,
  tone: "gray",
  title: "Enviada antes de o painel registrar os grupos. Não sabemos quais grupos receberam.",
};

/** "1 da cidade da vaga + 3 a até 30 km" — composição dos grupos tentados. */
function composicaoDaLista(r: GroupBroadcastLastRound): string | null {
  // Contagem da API não fecha com o total: não afirma a divisão.
  if (r.ownCity + r.inRadius + r.fallback + r.vip !== r.total) return null;
  const rot = rotulosDaComposicao(RAIO_PADRAO_KM);
  const partes = [
    r.ownCity > 0 ? `${r.ownCity} ${rot.ownCity()}` : null,
    r.inRadius > 0 ? `${r.inRadius} ${rot.radius()}` : null,
    r.fallback > 0 ? `${r.fallback} ${rot.fallback(r.fallback)}` : null,
    r.vip > 0 ? `${r.vip} ${rot.vip(r.vip)}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" + ") : null;
}

/**
 * "Não recebeu: Vagas Freela Vinhedo SP. Motivo: O bot não está no grupo." —
 * com os até 3 nomes que a API manda; o resto fica para Detalhes da vaga.
 */
function quemNaoRecebeu(failedCount: number, failed: GroupBroadcastFailedGroup[]): string {
  if (failedCount === 0) return "";
  if (failed.length === 0) {
    return ` ${failedCount === 1 ? "1 não recebeu" : `${failedCount} não receberam`}: veja quais e o motivo em Detalhes da vaga.`;
  }
  const resto = failedCount - failed.length;
  const mais = resto > 0 ? ` E mais ${resto}: veja em Detalhes da vaga.` : "";
  if (failed.length === 1) {
    const f = failed[0];
    return ` Não recebeu: ${f.groupName}.${f.errorMessage ? ` Motivo: ${semPontoFinal(f.errorMessage)}.` : ""}${mais}`;
  }
  return ` Não receberam: ${listaDeFalhas(failed.map((f) => ({ groupName: f.groupName, motivo: f.errorMessage })))}.${mais}`;
}

/**
 * Selo da coluna "Disparo" (e da 2ª linha do Status no celular). Conta só a
 * ÚLTIMA rodada; pulados ficam fora da conta (`total` = tentados).
 */
export function dispatchBadge(
  record: OutreachLike | undefined,
  /** `groupBroadcastAt` da vaga: saiu num grupo, mesmo sem registro na coluna. */
  vacancyBroadcastAt?: string | null,
): DispatchBadgeModel {
  if (!record) {
    return vacancyBroadcastAt
      ? {
          ...REGISTRO_ANTIGO,
          title: `Enviada em ${formatDiaHora(vacancyBroadcastAt)}, antes de o painel registrar os grupos. Não sabemos quais grupos receberam.`,
        }
      : NUNCA;
  }

  // API antiga (sem o campo): o mesmo selo de antes.
  if (record.groupBroadcast === undefined) return seloAntigo(record);

  const r = record.groupBroadcast.lastRound;
  if (!r) return REGISTRO_ANTIGO;

  const tentados = r.total;
  const hora = formatHora(r.at);
  const quando = formatDiaHora(r.at);
  const rodada = r.mode === "MANUAL" ? "reenvio manual" : "automática";
  const composicao = composicaoDaLista(r);
  const pulados =
    r.skipped > 0
      ? ` ${r.skipped === 1 ? "1 grupo ficou de fora (pulado) e não entra" : `${r.skipped} grupos ficaram de fora (pulados) e não entram`} na conta.`
      : "";
  const antes =
    r.mode === "MANUAL" && record.autoSentAt && record.autoSentAt !== r.at
      ? ` Antes: automática, ${formatDiaHora(record.autoSentAt)}.`
      : "";

  if (tentados === 0) {
    return {
      text: "✗ Não divulgada",
      time: null,
      tone: "red",
      title: `Última rodada: ${rodada}, ${quando}. Nenhum grupo foi tentado.${pulados}`,
    };
  }

  if (lastRoundInFlight(r)) {
    return {
      text: `… enviando ${r.sent} de ${grupos(tentados)}`,
      time: null,
      tone: "blue",
      title: `Enviando agora (${rodada}, ${quando}): a mensagem sai em 1 grupo a cada ~${SEGUNDOS_ENTRE_GRUPOS} s. Já receberam ${r.sent} de ${grupos(tentados)}.${pulados}`,
    };
  }

  if (r.sent === tentados) {
    return {
      text: `✓ ${grupos(r.sent)} · ${r.mode === "MANUAL" ? "reenvio" : "auto"}`,
      time: hora,
      tone: r.mode === "MANUAL" ? "blue" : "green",
      title: `Última rodada: ${rodada}, ${quando}. Recebeu em ${r.sent} de ${grupos(tentados)}${composicao ? `: ${composicao}` : ""}.${pulados}${antes}`,
    };
  }

  if (r.sent === 0) {
    const motivo = r.failed.find((f) => f.errorMessage)?.errorMessage ?? null;
    return {
      text: "✗ Falhou ·",
      time: hora,
      tone: "red",
      title: `Tentamos ${grupos(tentados)} em ${quando} e nenhum recebeu.${motivo ? ` Motivo: ${semPontoFinal(motivo)}.` : " Veja o motivo em Detalhes da vaga."}${pulados}${antes}`,
    };
  }

  return {
    text: `⚠ ${r.sent} de ${grupos(tentados)} ·`,
    time: hora,
    tone: "amber",
    title: `Última rodada: ${rodada}, ${quando}. Recebeu em ${r.sent} de ${grupos(tentados)}${composicao ? ` (tentados: ${composicao})` : ""}.${quemNaoRecebeu(r.failedCount, r.failed)}${pulados}${antes}`,
  };
}

/** O selo de antes do registro por grupo (API antiga). */
function seloAntigo(record: OutreachLike): DispatchBadgeModel {
  const auto = record.autoSentAt ?? null;
  const manual = record.manualSentAt ?? null;
  if (!auto && !manual) {
    return {
      ...REGISTRO_ANTIGO,
      title: "Enviado antes de o painel passar a registrar a origem do disparo",
    };
  }
  // Os dois existem: o selo mostra o ÚLTIMO; o histórico fica no title.
  const manualDepois = Boolean(manual) && (!auto || Date.parse(manual!) >= Date.parse(auto!));
  const titulo = [
    auto ? `Automático em ${formatDiaHora(auto)}` : "Automático não saiu",
    manual ? `Manual em ${formatDiaHora(manual)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    text: manualDepois ? "✓ manual" : "✓ automático",
    time: formatHora((manualDepois ? manual : auto)!),
    tone: manualDepois ? "blue" : "green",
    title: titulo,
  };
}

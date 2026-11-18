import type {
  ProviderAccountStatus,
  ProviderItem,
  ProvidersStatusCounts,
  ProviderStatusFilter,
} from "../infrastructure/admin-api";
import { dayLabel } from "./suspensions-presentation";

/**
 * D5, fatia B (18/11): textos da situação dos freelancers. Puro (sem React).
 *
 * Duas réguas: "Conta" (uma por pessoa: Exclusão pedida → Banida → Perfil desativado → Ativa) e
 * "Marcas" entre as ativas (Suspensa agora, Sem aula), que podem se repetir na mesma pessoa.
 */

export const ACCOUNT_LABEL: Record<ProviderAccountStatus, string> = {
  ACTIVE: "Ativa",
  BANNED: "Banida",
  DELETION_REQUESTED: "Exclusão pedida",
  PROFILE_INACTIVE: "Perfil desativado",
};

export const ACCOUNT_HINT: Partial<Record<ProviderAccountStatus, string>> = {
  DELETION_REQUESTED: "Pediu para excluir a conta e não entra no app enquanto isso.",
  BANNED: "Banida pelo suporte: não entra no app.",
  PROFILE_INACTIVE: "O perfil de Empresas está desligado; a conta continua ativa.",
};

export const DELETION_BAN_HINT = "Pediu para excluir a conta: não dá para banir nem desbanir.";

/** "Suspensa, volta em sáb 14/11" · "Suspensa até a conversa" · os dois. Nulo = não suspensa. */
export function suspensionTagText(
  s: ProviderItem["suspension"] | undefined,
): string | null {
  if (!s) return null;
  if (s.endsAt && s.requiresConversation) {
    return `Suspensa, volta em ${dayLabel(s.endsAt)} depois da conversa`;
  }
  if (s.endsAt) return `Suspensa, volta em ${dayLabel(s.endsAt)}`;
  return "Suspensa até a conversa";
}

/** Filtro "Situação": com a API nova, as situações da conta; com a antiga, Ativo/Inativo. */
export function statusFilterOptions(
  newApi: boolean,
): Array<{ value: ProviderStatusFilter; label: string }> {
  if (!newApi) {
    return [
      { value: "active", label: "Ativo" },
      { value: "inactive", label: "Inativo" },
    ];
  }
  return [
    { value: "active", label: "Ativas" },
    { value: "suspended", label: "Suspensas agora" },
    { value: "banned", label: "Banidas" },
    { value: "deletion_requested", label: "Exclusão pedida" },
    { value: "profile_inactive", label: "Perfil desativado" },
    { value: "inactive", label: "Inativas (qualquer motivo)" },
  ];
}

function n(v: number): string {
  return v.toLocaleString("pt-BR");
}

/** "14h32" em Brasília. */
function hourLabel(iso: string): string {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}h${get("minute")}`;
}

/**
 * A legenda da faixa: diz o que cada número conta e de onde vem (regra do dono: todo número com a
 * conta e a fonte).
 */
export function countsLegend(c: ProvidersStatusCounts): string {
  const profile = c.profileInactive > 0 ? ` + Perfil desativado (${n(c.profileInactive)})` : "";
  return (
    `Cada conta entra uma vez: Ativas (${n(c.active)}) + Banidas (${n(c.banned)}) + ` +
    `Exclusão pedida (${n(c.deletionRequested)})${profile} = ${n(c.total)} freelancers de Empresas ` +
    "nesta lista. Suspensas e Sem aula contam só entre as ativas e podem se repetir na mesma pessoa. " +
    "Excluídas são contas anonimizadas, fora desta lista; as apagadas de vez não dá para contar. " +
    `Atualizado às ${hourLabel(c.computedAt)} (a contagem fica guardada por até 5 minutos).`
  );
}

/**
 * O "?" das regras que ainda dependem do Denner (D2 e D3): mostra qual regra a tela usa hoje.
 */
export const RULES_HELP: Array<{ title: string; text: string }> = [
  {
    title: "Ativa",
    text: "Conta ativa (não pediu exclusão, não foi banida) e perfil de Empresas ligado.",
  },
  {
    title: "Banida",
    text: "Login desligado pelo suporte (ícone de banir), com a conta ativa. Quem pediu exclusão não conta aqui.",
  },
  {
    title: "Exclusão pedida",
    text: "Pediu para excluir a conta (exclusão pendente ou parada). Não entra no app enquanto isso.",
  },
  {
    title: "Perfil desativado",
    text: "Conta ativa, mas o perfil de Empresas está desligado.",
  },
  {
    title: "Inativas (qualquer motivo)",
    text:
      "Banidas + Exclusão pedida + Perfil desativado: o filtro “Inativo” de antes. " +
      "Não é “não abre o app há 30 dias”: essa regra ainda não existe (pergunta D2 para o Denner).",
  },
  {
    title: "Suspensas agora",
    text: "Entre as ativas: suspensão valendo agora (sem poder se candidatar), pela tela Suspensões.",
  },
  {
    title: "Sem aula",
    text: "Entre as ativas: aula obrigatória pendente (ou sem cadastro global).",
  },
  {
    title: "Excluídas",
    text:
      "Contas já anonimizadas: só o número, fora desta lista. Para ver, use Usuários → Excluídos " +
      "(pergunta D3 para o Denner).",
  },
];

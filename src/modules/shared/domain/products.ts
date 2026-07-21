import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  MapPin,
  Package,
  Repeat,
  Tags,
  Truck,
  Users,
} from "lucide-react";

/**
 * As verticais do ecossistema Freela dentro de um painel só.
 *
 * A decisão de ter UMA central em vez de um site por produto veio da natureza do
 * que se administra: metade das telas (consultores, parcerias, cupons, cidades,
 * propagandas, treinamentos) é transversal, e o staff é o mesmo. Sites separados
 * significariam um segundo login para revogar quando alguém sai da empresa e a
 * mesma correção feita duas ou três vezes.
 *
 * Cada vertical tem a SUA API e o SEU banco — o que muda por aqui é só de onde a
 * tela lê. Serviços fala direto com o api-freela; Fretes passa pelo proxy
 * `/api/fretes` (a chave daquela API não pode ir para o navegador).
 */
export type ProductId = "servicos" | "fretes" | "entregas";

export type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  superAdminOnly?: boolean;
  /** Tela ainda sem backend — navega, mas avisa que o produto não existe ainda. */
  comingSoon?: boolean;
};

export type Product = {
  id: ProductId;
  label: string;
  /** Rótulo curto do badge ao lado do logo. */
  badge: string;
  icon: typeof LayoutDashboard;
  /** Prefixo das rotas. Serviços é a raiz por retrocompatibilidade dos links. */
  basePath: string;
  /** Vertical inteira ainda não implementada (aparece no seletor, mas avisa). */
  comingSoon?: boolean;
  nav: NavItem[];
};

/**
 * Fretes hoje é captação de cadastro: a API tem duas tabelas
 * (`driver_registrations`, `company_registrations`) e mais nada. Motoristas e
 * Empresas leem dado real; o restante fica marcado como `comingSoon` porque
 * depende do produto existir no backend, não de front. Preferimos a tela dizer
 * "em breve" a exibir número inventado — dado falso em painel de gestão vira
 * decisão errada.
 */
const FRETES_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/fretes" },
  { label: "Motoristas", icon: Users, path: "/fretes/motoristas" },
  { label: "Empresas", icon: Building2, path: "/fretes/empresas" },
  { label: "Fretes", icon: Truck, path: "/fretes/fretes", comingSoon: true },
  { label: "Fretes Recorrentes", icon: Repeat, path: "/fretes/recorrentes", comingSoon: true },
  { label: "Tipos de Veículo", icon: Boxes, path: "/fretes/tipos-veiculo", comingSoon: true },
  { label: "Tabela de Preços", icon: Tags, path: "/fretes/tabela-precos", comingSoon: true },
  { label: "Cidades", icon: MapPin, path: "/fretes/cidades", comingSoon: true },
  { label: "Financeiro", icon: DollarSign, path: "/fretes/financeiro", comingSoon: true },
  { label: "Relatórios", icon: BarChart3, path: "/fretes/relatorios", comingSoon: true },
];

const ENTREGAS_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/entregas", comingSoon: true },
  { label: "Entregadores", icon: Users, path: "/entregas/entregadores", comingSoon: true },
  { label: "Contratantes", icon: Building2, path: "/entregas/contratantes", comingSoon: true },
  { label: "Entregas", icon: Package, path: "/entregas/entregas", comingSoon: true },
  { label: "Relatórios", icon: ClipboardList, path: "/entregas/relatorios", comingSoon: true },
];

/** Preenchido pelo layout com a nav legada de Serviços (que já existe lá). */
export function buildProducts(servicosNav: NavItem[]): Product[] {
  return [
    {
      id: "servicos",
      label: "Serviços",
      badge: "ADMIN",
      icon: LayoutDashboard,
      basePath: "/dashboard",
      nav: servicosNav,
    },
    {
      id: "fretes",
      label: "Fretes",
      badge: "FRETES",
      icon: Truck,
      basePath: "/fretes",
      nav: FRETES_NAV,
    },
    {
      id: "entregas",
      label: "Entregas",
      badge: "ENTREGAS",
      icon: Package,
      basePath: "/entregas",
      comingSoon: true,
      nav: ENTREGAS_NAV,
    },
  ];
}

/** Vertical ativa a partir da URL — a rota é a fonte da verdade, não um estado
 * guardado; assim link compartilhado e refresh caem sempre no lugar certo. */
export function productIdFromPath(pathname: string): ProductId {
  if (pathname === "/fretes" || pathname.startsWith("/fretes/")) return "fretes";
  if (pathname === "/entregas" || pathname.startsWith("/entregas/")) return "entregas";
  return "servicos";
}

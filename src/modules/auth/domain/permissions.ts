/**
 * Permissões do painel admin — uma chave por área/menu.
 *
 * Espelha `api-freela/src/shared/auth/domain/admin-permission.ts`. A API é a
 * fonte da verdade (o catálogo com rótulos vem de
 * `GET /v1/admins/panel-users/permissions`); esta lista existe para tipar as
 * chamadas de `hasPermission()` e para o front ter um fallback de rótulos caso
 * o catálogo não carregue.
 *
 * Regras:
 * - `SUPER_ADMIN` ignora a lista: tem acesso a tudo, sempre.
 * - Demais admins só entram na área se a chave estiver em `permissions`.
 * - Áreas fora desta lista (dashboard, catálogo, cidades, cupons, pipeline,
 *   relatórios, treinamentos, configurações, fretes, entregas) seguem abertas a
 *   qualquer admin logado.
 */
export const ADMIN_PERMISSIONS = [
  "FINANCE",
  "WALLETS",
  "WHATSAPP_GROUPS",
  "ADVERTISEMENTS",
  "PARTNERSHIPS",
  "CONSULTANTS",
  "FIXED_JOBS",
  "CASA_VACANCIES",
  "JOBS",
  "USERS",
  "FREELANCERS",
  "COMPANIES",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Rótulos em PT (fallback local do catálogo servido pela API). */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  FINANCE: "Financeiro",
  WALLETS: "Carteiras",
  WHATSAPP_GROUPS: "Grupos WhatsApp",
  ADVERTISEMENTS: "Propagandas",
  PARTNERSHIPS: "Parcerias",
  CONSULTANTS: "Consultores",
  FIXED_JOBS: "Vagas Fixas (CLT)",
  CASA_VACANCIES: "Vagas Casa",
  JOBS: "Jobs",
  USERS: "Usuários",
  FREELANCERS: "Freelancers",
  COMPANIES: "Empresas",
};

export type AdminRole = "ADMIN" | "SUPER_ADMIN" | "RECRUITER";

/** Sessão do admin logado, como devolvida por `GET /v1/admins/me`. */
export interface AdminSession {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole | string;
  permissions: string[];
  isActive: boolean;
}

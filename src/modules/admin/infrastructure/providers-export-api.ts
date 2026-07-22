/**
 * Suporte à exportação CSV da listagem de freelancers.
 *
 * Fica em arquivo separado de `admin-api.ts` de propósito: a listagem é
 * paginada (a tela mostra 100 por página) e o CSV precisa do **conjunto
 * filtrado inteiro**, então aqui mora o varrimento de todas as páginas.
 */
import { getAdminProviders, type GetAdminProvidersParams, type ProviderItem } from "./admin-api";

/**
 * Item da listagem + `userCreatedAt`.
 *
 * `ProviderItem.createdAt` é a criação do **perfil de prestador** do módulo
 * Bares & Restaurantes. `userCreatedAt` é a criação da **conta** do usuário
 * (`shared.users.created_at`) — é essa a "data de cadastro" que interessa ao
 * negócio. Opcional porque APIs anteriores ao deploy do campo não o mandam.
 */
export type ProviderExportItem = ProviderItem & {
  userCreatedAt?: string | null;
};

/** Data de cadastro a exibir + de onde ela saiu (para não rotular errado). */
export function providerSignupDate(p: ProviderExportItem): {
  value: string | null;
  /** `true` = criação da conta; `false` = fallback para a criação do perfil B&R. */
  isAccount: boolean;
} {
  if (p.userCreatedAt) return { value: p.userCreatedAt, isAccount: true };
  return { value: p.createdAt ?? null, isAccount: false };
}

/** Teto do backend (`MAX_LIMIT` em `list-providers.handler.ts`). */
const EXPORT_PAGE_SIZE = 500;
/** Trava de segurança: 200 páginas × 500 = 100k registros. */
const MAX_PAGES = 200;

/**
 * Busca **todas** as páginas da listagem com os filtros já aplicados no
 * servidor (busca, UF, cidade, cargo, status). Deduplica por `id` porque a
 * ordenação por `created_at` pode repetir linhas entre páginas em caso de
 * empate no timestamp.
 */
export async function fetchAllAdminProviders(
  filters: Omit<GetAdminProvidersParams, "page" | "limit"> = {},
): Promise<ProviderExportItem[]> {
  const seen = new Set<string>();
  const all: ProviderExportItem[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getAdminProviders({ ...filters, page, limit: EXPORT_PAGE_SIZE });
    const batch = (res.data ?? []) as ProviderExportItem[];
    if (batch.length === 0) break;

    for (const item of batch) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      all.push(item);
    }

    if (batch.length < EXPORT_PAGE_SIZE) break;
    if (res.total > 0 && all.length >= res.total) break;
  }

  return all;
}

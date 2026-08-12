import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const adjacencyApi = createAuthedClient("/v1/admins/service-adjacency");

export interface ServiceAdjacency {
  id: string;
  /** Função que a pessoa TEM. */
  roleSlug: string;
  /** Função cujas vagas ela passa a enxergar. */
  neighborSlug: string;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdjacencyRole {
  slug: string;
  name: string;
}

export interface AdjacencyList {
  items: ServiceAdjacency[];
  /** Se a expansão está de fato valendo em produção. Com a flag desligada o
   * mapa existe e não muda o feed de ninguém — a tela precisa dizer isso. */
  enabled: boolean;
  roles: AdjacencyRole[];
}

export async function getServiceAdjacencies(): Promise<AdjacencyList> {
  const res = await adjacencyApi.get("");
  return {
    items: res.data.data ?? [],
    enabled: Boolean(res.data.meta?.enabled),
    roles: res.data.meta?.roles ?? [],
  };
}

export async function createServiceAdjacency(payload: {
  roleSlug: string;
  neighborSlug: string;
  note?: string;
}): Promise<ServiceAdjacency> {
  const res = await adjacencyApi.post("", payload);
  return res.data.data;
}

export async function updateServiceAdjacency(
  id: string,
  payload: { active?: boolean; note?: string },
): Promise<ServiceAdjacency> {
  const res = await adjacencyApi.patch(`/${id}`, payload);
  return res.data.data;
}

export async function deleteServiceAdjacency(id: string): Promise<void> {
  await adjacencyApi.delete(`/${id}`);
}

import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Client admin do módulo Freela em Casa (home-services). Base distinta do client de
 * Bares & Restaurantes (`/v1/bars-restaurants/admin`) — aqui os contratantes vêm do
 * schema `freela_em_casa`. Espelha a listagem admin de Empresas (BR), porém com o
 * shape do CasaContractor (endereço + rating; sem jobs/ticket no payload).
 */
const casaAdminApi = createAuthedClient("/v1/home-services/admin");

export interface CasaContractorItem {
  id: string;
  userId: string;
  /** Nome do responsável/estabelecimento. */
  name: string;
  companyName: string | null;
  /** CPF ou CNPJ (sem formatação garantida). */
  document: string | null;
  address: string | null;
  cep: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
  number: string | null;
  complement: string | null;
  cityId: string | null;
  avatarUrl: string | null;
  rating: number | null;
  /** Telefone da CONTA (shared.users) — o CasaContractor não tem telefone próprio. */
  phone?: string | null;
  /** E-mail de login/cadastro (shared.users). */
  registrationEmail?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  referredByConsultant?: { id: string; name: string; code: string } | null;
  referredByPartnership?: { id: string; name: string; code: string } | null;
}

/** Lista todos os contratantes do módulo Freela em Casa (Admin). */
export async function getAdminCasaContractors(): Promise<CasaContractorItem[]> {
  const res = await casaAdminApi.get("/contractors");
  return res.data.data;
}

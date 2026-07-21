import { ComingSoon } from "@/components/shared/coming-soon";

/**
 * Catch-all das telas de Fretes que ainda não existem (fretes, recorrentes,
 * tabela de preços, tipos de veículo, cidades, financeiro, relatórios). As telas
 * COM dado real — /fretes/motoristas e /fretes/empresas — são segmentos
 * estáticos e ganham deste catch-all na resolução do Next.
 */
export default function FretesEmBrevePage() {
  return (
    <ComingSoon
      title="Fretes"
      description="Módulo em construção"
      reason="O Freela Fretes hoje está em captação de cadastro: a API tem motoristas e empresas, e nada além disso. Frete, tabela de preços, veículos e financeiro aparecem aqui quando existirem no backend."
    />
  );
}

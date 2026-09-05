/**
 * Formatador ÚNICO de dinheiro do painel: centavos → "R$ 156,00".
 *
 * Mantém DE PROPÓSITO o estilo já usado nas telas (espaço após o "R$", vírgula
 * decimal, SEM separador de milhar) para não mudar nenhum valor exibido ao
 * consolidar os formatadores ad-hoc espalhados. `null`/`undefined` é
 * responsabilidade de quem chama (ex.: `?? "—"`).
 */
export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

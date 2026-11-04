/**
 * "Abrir a vaga" de outras telas (fila do suporte, fluxo v2 C2): `/jobs?vaga=<id>` abre o modal
 * da vaga. Devolve o id, ou null quando o parâmetro falta ou não parece um id.
 */
export function vacancyIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get("vaga")?.trim();
  return id && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
}

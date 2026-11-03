/**
 * "Rua Prates, 480, Bom Retiro, São Paulo/SP, 01121000" → bairro · cidade/UF na
 * 1ª linha e rua, número na 2ª. A lista mostra só isso (o endereço inteiro fica
 * no `title` e no modal): o endereço completo quebrava a linha em 7.
 */
export function shortAddress(address: string): { place: string; street: string | null } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const cityIdx = parts.findIndex((p) => /\/[A-Za-z]{2}$/.test(p));
  if (cityIdx < 0) return { place: parts.slice(0, 2).join(", ") || address, street: null };
  const bairro = cityIdx >= 1 && !/^\d+[A-Za-z]?$/.test(parts[cityIdx - 1]) ? parts[cityIdx - 1] : null;
  const streetParts = parts.slice(0, bairro ? cityIdx - 1 : cityIdx);
  return {
    place: bairro ? `${bairro} · ${parts[cityIdx]}` : parts[cityIdx],
    street: streetParts.length > 0 ? streetParts.join(", ") : null,
  };
}

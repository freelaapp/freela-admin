import type { RegistrationItem, RegistrationSource } from "@/modules/consultant/domain/types";

export function registrationTypeLabel(item: Pick<RegistrationItem, "persona" | "module">): string {
  if (item.persona === "provider") return "Freelancer";
  if (item.persona === "contractor") {
    if (item.module === "home-services" || item.module === "freela-em-casa") return "Casa";
    if (item.module === "bars-restaurants") return "Empresa";
    return "Contratante";
  }
  return "—";
}

export function registrationSourceLabel(source: RegistrationSource | null): string {
  if (source === "LINK") return "Pelo link";
  if (source === "ON_BEHALF") return "Cadastrado por mim";
  return "—";
}

export function registrationPlace(item: Pick<RegistrationItem, "city" | "uf">): string {
  if (item.city && item.uf) return `${item.city}/${item.uf}`;
  return item.city ?? item.uf ?? "—";
}

export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

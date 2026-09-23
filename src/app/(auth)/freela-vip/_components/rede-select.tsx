"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useVipContractors } from "@/modules/admin/application/use-freela-vip";
import type { VipContractorItem } from "@/modules/admin/infrastructure/freela-vip-api";
import { QueryError } from "./query-error";

/** Nome de exibição de uma rede — companyName, senão contactName, senão o próprio userId. */
const contractorLabel = (c: VipContractorItem): string => c.companyName ?? c.contactName ?? c.userId;

/** Nome · cidade/UF de uma rede, tolerando cidade/UF ausentes. */
const contractorLocation = (c: VipContractorItem): string => (c.city ? ` · ${c.city}${c.uf ? `/${c.uf}` : ""}` : "");

export function redeLabel(contractors: VipContractorItem[] | undefined, userId: string | null | undefined): string {
  if (!userId) return "—";
  const c = contractors?.find((x) => x.userId === userId);
  if (!c) return userId;
  return `${contractorLabel(c)}${contractorLocation(c)}`;
}

/** Seleciona a rede (contratante) pelo `userId`, com filtro por nome/cidade. */
export function RedeSelect({
  value, onChange, disabled, id = "rede",
}: { value: string; onChange: (userId: string) => void; disabled?: boolean; id?: string }) {
  const { data: contractors = [], isLoading, isError, refetch } = useVipContractors();
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? contractors.filter((c) => `${contractorLabel(c)} ${c.city ?? ""}`.toLowerCase().includes(q))
      : contractors;
    return [...list].sort((a, b) => contractorLabel(a).localeCompare(contractorLabel(b), "pt-BR"));
  }, [contractors, filter]);
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        placeholder="Filtrar empresa por nome ou cidade…"
        aria-label="Filtrar redes por nome ou cidade"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        disabled={disabled}
      />
      <NativeSelect id={id} value={value} disabled={disabled || isLoading || isError} onChange={(e) => onChange(e.target.value)}>
        <option value="">{isLoading ? "Carregando…" : isError ? "Erro ao carregar redes" : "Selecione a rede"}</option>
        {options.map((c) => (
          <option key={c.userId} value={c.userId}>
            {contractorLabel(c)}{contractorLocation(c)}
          </option>
        ))}
      </NativeSelect>
      {isError && <QueryError compact message="Não foi possível carregar as redes. Tente de novo; se persistir, peça ao super-admin para conferir suas permissões." onRetry={() => refetch()} />}
    </div>
  );
}

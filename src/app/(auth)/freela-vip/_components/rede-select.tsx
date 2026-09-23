"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAdminContractorsList } from "@/modules/admin/application/use-freela-vip";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";

export function redeLabel(contractors: ContractorItem[] | undefined, userId: string | null | undefined): string {
  if (!userId) return "—";
  const c = contractors?.find((x) => x.userId === userId);
  if (!c) return userId;
  return `${c.companyName ?? c.contactName} · ${c.city}/${c.uf}`;
}

/** Seleciona a rede (contratante) pelo `userId`, com filtro por nome/cidade. */
export function RedeSelect({
  value, onChange, disabled, id = "rede",
}: { value: string; onChange: (userId: string) => void; disabled?: boolean; id?: string }) {
  const { data: contractors = [], isLoading } = useAdminContractorsList();
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? contractors.filter((c) => `${c.companyName ?? ""} ${c.contactName} ${c.city}`.toLowerCase().includes(q))
      : contractors;
    return [...list].sort((a, b) => (a.companyName ?? a.contactName).localeCompare(b.companyName ?? b.contactName, "pt-BR"));
  }, [contractors, filter]);
  return (
    <div className="flex flex-col gap-1.5">
      <Input placeholder="Filtrar empresa por nome ou cidade…" value={filter} onChange={(e) => setFilter(e.target.value)} disabled={disabled} />
      <NativeSelect id={id} value={value} disabled={disabled || isLoading} onChange={(e) => onChange(e.target.value)}>
        <option value="">{isLoading ? "Carregando…" : "Selecione a rede"}</option>
        {options.map((c) => (
          <option key={c.userId} value={c.userId}>
            {(c.companyName ?? c.contactName) + ` · ${c.city}/${c.uf}`}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

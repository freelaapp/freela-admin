"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCatalogRoles } from "@/modules/admin/application/use-admin-catalog";
import type { OrientationQueueFilter, QueueStatus } from "@/modules/admin/infrastructure/orientation-api";
import { DEFAULT_ACTIVE_DAYS } from "../_lib/queue-filters";

interface Props {
  filter: OrientationQueueFilter;
  onChange: (next: OrientationQueueFilter) => void;
}

const FIELD = "flex flex-col gap-1 text-xs font-medium text-[#525252]";
const CONTROL = "min-h-11 md:min-h-9";

const STATUS_OPTIONS: Array<{ value: QueueStatus; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  { value: "BOOKED", label: "Aula marcada" },
  { value: "APPROVED", label: "Aprovado" },
  { value: "REJECTED", label: "Reprovado" },
];
const ACTIVE_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "0", label: "Qualquer data (sem filtro)" },
];

function triState(v: boolean | undefined): string {
  return v === undefined ? "" : v ? "sim" : "nao";
}
function fromTriState(v: string): boolean | undefined {
  return v === "sim" ? true : v === "nao" ? false : undefined;
}

/** Texto que só vira filtro ao sair do campo ou apertar Enter (evita uma consulta por letra). */
function CommitInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };
  return (
    <label className={FIELD}>
      {label}
      <Input
        className={CONTROL}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
    </label>
  );
}

/** UF: 2 letras, sempre maiúsculas. Só vira filtro com 2 letras (ou vazio, que limpa). */
function UfInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = draft === "" || /^[A-Z]{2}$/.test(draft);
  const commit = () => {
    if (!valid) return;
    if (draft !== value) onCommit(draft);
  };
  return (
    <label className={FIELD}>
      UF
      <Input
        className={CONTROL}
        value={draft}
        maxLength={2}
        autoCapitalize="characters"
        aria-invalid={!valid}
        placeholder="SP"
        onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      {!valid && <span className="text-[#991b1b]">Use 2 letras, como SP.</span>}
    </label>
  );
}

export function QueueFiltersBar({ filter, onChange }: Props) {
  const set = (patch: Partial<OrientationQueueFilter>) => {
    const next = { ...filter, ...patch };
    for (const k of Object.keys(next) as Array<keyof OrientationQueueFilter>) {
      if (next[k] === undefined || next[k] === "") delete next[k];
    }
    onChange(next);
  };
  const roles = useCatalogRoles();
  const roleOptions = roles.data ?? [];
  const role = filter.role ?? "";
  const activeDays = String(filter.activeWithinDays ?? DEFAULT_ACTIVE_DAYS);
  const activeOptions = ACTIVE_OPTIONS.some((o) => o.value === activeDays)
    ? ACTIVE_OPTIONS
    : [...ACTIVE_OPTIONS, { value: activeDays, label: `${activeDays} dias` }];

  return (
    <section aria-label="Filtros da Fila" className="rounded-lg border border-[#e5e5e5] bg-white p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={FIELD}>
          Situação
          <NativeSelect
            className={CONTROL}
            value={filter.status ?? "PENDING"}
            onChange={(e) => set({ status: e.target.value as QueueStatus })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <CommitInput label="Cidade" value={filter.city ?? ""} onCommit={(v) => set({ city: v || undefined })} />
        <UfInput value={filter.uf ?? ""} onCommit={(v) => set({ uf: v || undefined })} />
        <label className={FIELD}>
          Função
          <NativeSelect className={CONTROL} value={role} onChange={(e) => set({ role: e.target.value || undefined })}>
            <option value="">Todas</option>
            {role && !roleOptions.some((r) => r.slug === role) && <option value={role}>{role}</option>}
            {roleOptions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={FIELD}>
          Acessou nos últimos
          <NativeSelect
            className={CONTROL}
            value={activeDays}
            onChange={(e) => set({ activeWithinDays: Number(e.target.value) })}
          >
            {activeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={FIELD}>
          Cadastro de
          <Input
            type="date"
            className={CONTROL}
            value={filter.signedUpFrom ?? ""}
            onChange={(e) => set({ signedUpFrom: e.target.value || undefined })}
          />
        </label>
        <label className={FIELD}>
          Cadastro até
          <Input
            type="date"
            className={CONTROL}
            value={filter.signedUpTo ?? ""}
            onChange={(e) => set({ signedUpTo: e.target.value || undefined })}
          />
        </label>
        <label className={FIELD}>
          Já trabalhou
          <NativeSelect
            className={CONTROL}
            value={triState(filter.workedBefore)}
            onChange={(e) => set({ workedBefore: fromTriState(e.target.value) })}
          >
            <option value="">Tanto faz</option>
            <option value="sim">Já trabalhou</option>
            <option value="nao">Nunca trabalhou</option>
          </NativeSelect>
        </label>
        <label className={FIELD}>
          Faltas
          <NativeSelect
            className={CONTROL}
            value={filter.noShows ?? ""}
            onChange={(e) => set({ noShows: (e.target.value || undefined) as OrientationQueueFilter["noShows"] })}
          >
            <option value="">Tanto faz</option>
            <option value="NONE">Nunca faltou</option>
            <option value="ANY">Já faltou</option>
          </NativeSelect>
        </label>
        <label className={FIELD}>
          Convocado
          <NativeSelect
            className={CONTROL}
            value={filter.convoked ?? ""}
            onChange={(e) => set({ convoked: (e.target.value || undefined) as OrientationQueueFilter["convoked"] })}
          >
            <option value="">Tanto faz</option>
            <option value="NEVER">Nunca convocado</option>
            <option value="EVER">Já convocado</option>
          </NativeSelect>
        </label>
        <label className={FIELD}>
          Pediu aviso
          <NativeSelect
            className={CONTROL}
            value={triState(filter.notifyRequested)}
            onChange={(e) => set({ notifyRequested: fromTriState(e.target.value) })}
          >
            <option value="">Tanto faz</option>
            <option value="sim">Pediu aviso</option>
            <option value="nao">Não pediu</option>
          </NativeSelect>
        </label>
      </div>
      {(filter.uf || filter.city) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#1d1d1b]">
          Lugar: <strong>{[filter.city, filter.uf].filter(Boolean).join(" - ")}</strong>
          <button
            type="button"
            className="min-h-9 text-xs underline"
            onClick={() => set({ uf: undefined, city: undefined })}
          >
            Limpar lugar
          </button>
        </p>
      )}
    </section>
  );
}

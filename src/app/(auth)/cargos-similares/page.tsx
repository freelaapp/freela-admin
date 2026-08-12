"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { AlertTriangle, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCreateServiceAdjacency,
  useDeleteServiceAdjacency,
  useServiceAdjacencies,
  useUpdateServiceAdjacency,
} from "@/modules/admin/application/use-admin-service-adjacency";
import type { ServiceAdjacency } from "@/modules/admin/infrastructure/service-adjacency-api";

export default function CargosSimilaresPage() {
  const { data, isLoading } = useServiceAdjacencies();
  const criar = useCreateServiceAdjacency();
  const atualizar = useUpdateServiceAdjacency();
  const remover = useDeleteServiceAdjacency();

  const [form, setForm] = useState({ roleSlug: "", neighborSlug: "", note: "" });

  // Agrupado por "quem tem", que é como a regra é lida: *quem é garçom vê
  // também...*. A lista plana de pares obrigaria o operador a montar isso de
  // cabeça a cada leitura.
  const porFuncao = useMemo(() => {
    const mapa = new Map<string, ServiceAdjacency[]>();
    for (const item of data?.items ?? []) {
      const atual = mapa.get(item.roleSlug);
      if (atual) atual.push(item);
      else mapa.set(item.roleSlug, [item]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [data?.items]);

  const nomePorSlug = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const role of data?.roles ?? []) mapa.set(role.slug, role.name);
    return mapa;
  }, [data?.roles]);

  const rotular = (slug: string) => nomePorSlug.get(slug) ?? slug;

  const adicionar = async () => {
    if (!form.roleSlug || !form.neighborSlug) {
      toast.error("Escolha as duas funções.");
      return;
    }
    try {
      await criar.mutateAsync({
        roleSlug: form.roleSlug,
        neighborSlug: form.neighborSlug,
        note: form.note.trim() || undefined,
      });
      toast.success("Vizinhança cadastrada.");
      setForm({ roleSlug: "", neighborSlug: "", note: "" });
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível cadastrar."));
    }
  };

  const alternar = async (item: ServiceAdjacency) => {
    try {
      await atualizar.mutateAsync({ id: item.id, active: !item.active });
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível alterar."));
    }
  };

  const excluir = async (item: ServiceAdjacency) => {
    try {
      await remover.mutateAsync(item.id);
      toast.success("Vizinhança removida.");
    } catch (error) {
      toast.error(getAxiosErrorMessage(error, "Não foi possível remover."));
    }
  };

  const ativas = (data?.items ?? []).filter((i) => i.active).length;

  return (
    <div>
      <PageHeader
        title="Cargos semelhantes"
        description="Quem tem uma função passa a enxergar também as vagas das funções vizinhas."
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Estado real da regra. Cadastrar sem a chave ligada não muda nada
              para ninguém — e não dizer isso faria o operador cadastrar trinta
              linhas e concluir que o sistema está quebrado. */}
          <div
            className={`rounded-lg border p-4 ${
              data?.enabled
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {data?.enabled
                    ? `Valendo agora — ${ativas} vizinhança(s) ativa(s) no feed dos freelancers.`
                    : "Cadastrado, mas ainda não valendo."}
                </p>
                <p className="text-sm">
                  {data?.enabled
                    ? "Lembrando que isto amplia o que cada pessoa enxerga; não cria vagas novas."
                    : "A chave PROVIDER_SERVICE_ADJACENCY_ENABLED está desligada: o que estiver aqui não altera o feed de ninguém até ela ser ligada."}
                </p>
              </div>
            </div>
          </div>

          {/* Cadastro */}
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
            <h2 className="mb-1 font-semibold text-[#1d1d1b]">Nova vizinhança</h2>
            <p className="mb-3 text-xs text-[#737373]">
              Vale em um sentido só. Para que valha nos dois, cadastre também o inverso — assim
              remover um lado não derruba o outro sem querer.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <Label className="text-xs">Quem tem a função</Label>
                <NativeSelect
                  value={form.roleSlug}
                  onChange={(e) => setForm((f) => ({ ...f, roleSlug: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {(data?.roles ?? []).map((role) => (
                    <option key={role.slug} value={role.slug}>
                      {role.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <ArrowRight className="mb-2 h-4 w-4 shrink-0 text-[#737373]" />
              <div className="min-w-[200px] flex-1">
                <Label className="text-xs">Passa a ver vagas de</Label>
                <NativeSelect
                  value={form.neighborSlug}
                  onChange={(e) => setForm((f) => ({ ...f, neighborSlug: e.target.value }))}
                >
                  <option value="">Selecione…</option>
                  {(data?.roles ?? [])
                    .filter((role) => role.slug !== form.roleSlug)
                    .map((role) => (
                      <option key={role.slug} value={role.slug}>
                        {role.name}
                      </option>
                    ))}
                </NativeSelect>
              </div>
              <div className="min-w-[220px] flex-1">
                <Label className="text-xs">Por quê (opcional)</Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Ex.: cumim é o apoio direto do garçom"
                />
              </div>
              <Button onClick={adicionar} disabled={criar.isPending}>
                {criar.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Adicionar
              </Button>
            </div>
          </div>

          {/* Mapa */}
          {porFuncao.length === 0 ? (
            <p className="text-sm text-[#737373]">Nenhuma vizinhança cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {porFuncao.map(([roleSlug, itens]) => (
                <div key={roleSlug} className="rounded-lg border border-[#e5e5e5] bg-white p-4">
                  <p className="mb-2 text-sm">
                    <span className="font-semibold text-[#1d1d1b]">Quem é {rotular(roleSlug)}</span>
                    <span className="text-[#737373]"> também vê vagas de:</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {itens.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                          item.active
                            ? "border-[#e5e5e5] bg-white text-[#1d1d1b]"
                            : "border-dashed border-[#d4d4d4] bg-[#fafafa] text-[#a3a3a3]"
                        }`}
                        title={item.note ?? undefined}
                      >
                        <span>{rotular(item.neighborSlug)}</span>
                        <button
                          type="button"
                          onClick={() => alternar(item)}
                          className="text-xs underline decoration-dotted"
                        >
                          {item.active ? "desativar" : "ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => excluir(item)}
                          aria-label={`Remover ${rotular(item.neighborSlug)}`}
                          className="text-[#a3a3a3] hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[#737373]">
            A regra dá um salto só: se garçom vê cumim e cumim vê lavador de pratos, o garçom{" "}
            <strong>não</strong> passa a ver lavador de pratos. Sem esse limite, poucos cadastros
            fariam todo mundo ver tudo.{" "}
            <Badge variant="outline">{data?.items.length ?? 0} regra(s)</Badge>
          </p>
        </div>
      )}
    </div>
  );
}

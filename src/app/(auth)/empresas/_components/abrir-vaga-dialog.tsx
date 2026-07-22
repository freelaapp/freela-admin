"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogCategories } from "@/modules/admin/application/use-admin-catalog";
import { useAdminCreateVacancy } from "@/modules/admin/application/use-admin-create-vacancy";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  brasiliaWallTimeToUtcIso,
  hhmmToMinutes,
  nextDayYmd,
  type AdminCreateVacancyInput,
} from "@/modules/admin/infrastructure/admin-vacancies-api";
import type { CategoryRole } from "@/modules/admin/infrastructure/catalog-api";

interface AbrirVagaDialogProps {
  /** userId do contratante dono da vaga (vai no corpo como `contractorUserId`). */
  contractorUserId: string;
  companyName: string;
  /** Cidade cadastrada do contratante — usada como default do select. */
  contractorCity: string | null;
  /** Cidades já conhecidas do painel (mesma fonte da tela "Cidades"). */
  cityOptions: string[];
  onClose: () => void;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Dia de hoje em Brasília (`YYYY-MM-DD`) — o slice de ISO-UTC vira o dia após as 21h. */
function todayInBrasilia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Abre uma vaga por hora (Bares & Restaurantes) em nome de um contratante.
 *
 * Espelha a semântica do formulário do contratante no web
 * (`freela-web-v2/src/app/(auth)/(contractor)/contractor/publicar`): título = nome
 * do cargo do catálogo, datas/horas em ISO-UTC a partir da hora de parede de
 * Brasília, jornada que vira a noite empurra o fim para o dia seguinte, e
 * `pricingTierLabel` só existe em cargo com preço por faixa. O preço final é
 * calculado pelo backend — o resumo abaixo é só referência do catálogo.
 */
export function AbrirVagaDialog({
  contractorUserId,
  companyName,
  contractorCity,
  cityOptions,
  onClose,
}: AbrirVagaDialogProps) {
  const { data: categories, isLoading, isError } = useCatalogCategories();
  const createVacancy = useAdminCreateVacancy();

  const [categorySlug, setCategorySlug] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [tierLabel, setTierLabel] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [providesMeal, setProvidesMeal] = useState(false);
  const [cityId, setCityId] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // Só categorias ATIVAS do módulo Empresa (Bares & Restaurantes) — o endpoint
  // do catálogo devolve os dois módulos e também as inativas.
  const brCategories = useMemo(
    () => (categories ?? []).filter((c) => c.module === "bars-restaurants" && c.active),
    [categories],
  );

  const selectedCategory = useMemo(
    () => brCategories.find((c) => c.slug === categorySlug) ?? null,
    [brCategories, categorySlug],
  );

  const categoryRoles = useMemo<CategoryRole[]>(
    () => (selectedCategory?.roles ?? []).filter((r) => r.active && r.role.active),
    [selectedCategory],
  );

  const selectedRole = useMemo(
    () => categoryRoles.find((r) => r.role.slug === roleSlug) ?? null,
    [categoryRoles, roleSlug],
  );

  const isTiered = selectedRole?.pricingModel === "TIERED";
  const tiers = useMemo(
    () => (selectedRole?.tiers ?? []).filter((t) => t.active !== false),
    [selectedRole],
  );

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const c of cityOptions) {
      const name = c?.trim();
      if (name) set.add(name);
    }
    const own = contractorCity?.trim();
    if (own) set.add(own);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cityOptions, contractorCity]);

  const startMinutes = hhmmToMinutes(startTime);
  const endMinutes = hhmmToMinutes(endTime);
  // Fim menor ou igual ao início = jornada que vira a noite (fim no dia seguinte),
  // igual ao formulário do contratante no web.
  const crossesMidnight =
    startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes;
  const durationHours =
    startMinutes !== null && endMinutes !== null
      ? ((endMinutes - startMinutes + (crossesMidnight ? 24 * 60 : 0)) / 60)
      : null;

  function selectCategory(slug: string) {
    setCategorySlug(slug);
    // Trocar de categoria zera cargo/faixa: as funções e os preços mudam por categoria.
    setRoleSlug("");
    setTierLabel("");
  }

  function selectRole(slug: string) {
    setRoleSlug(slug);
    setTierLabel("");
    setHasBreak(false);
    setBreakStart("");
    setBreakEnd("");
  }

  /** Valida o mínimo; devolve a mensagem do primeiro problema ou `null`. */
  function validate(): string | null {
    if (!selectedCategory) return "Selecione a categoria.";
    if (!selectedRole) return "Selecione o cargo.";
    if (isTiered && !tierLabel) return "Selecione a faixa de preço do cargo.";
    if (!date) return "Informe a data da vaga.";
    if (!startTime || !endTime) return "Informe o horário de início e de fim.";
    if (startMinutes === null || endMinutes === null) return "Horário inválido.";
    if (startMinutes === endMinutes) {
      return "O horário de fim precisa ser diferente do de início.";
    }
    if (durationHours !== null && durationHours > 24) {
      return "A jornada não pode passar de 24 horas.";
    }
    if (hasBreak) {
      const breakStartMinutes = hhmmToMinutes(breakStart);
      const breakEndMinutes = hhmmToMinutes(breakEnd);
      if (breakStartMinutes === null || breakEndMinutes === null) {
        return "Informe o início e o fim da pausa.";
      }
      // Compara na linha do tempo da jornada (minutos desde o início da vaga).
      const toOffset = (minutes: number) =>
        minutes < startMinutes ? minutes + 24 * 60 - startMinutes : minutes - startMinutes;
      const breakStartOffset = toOffset(breakStartMinutes);
      const breakEndOffset = toOffset(breakEndMinutes);
      if (breakEndOffset <= breakStartOffset) {
        return "O fim da pausa precisa ser depois do início da pausa.";
      }
      if (
        durationHours !== null
        && (breakStartOffset <= 0 || breakEndOffset >= durationHours * 60)
      ) {
        return "A pausa precisa ficar dentro do horário da vaga.";
      }
    }
    return null;
  }

  async function handleSubmit() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    // `validate()` já garantiu tudo abaixo.
    const role = selectedRole!;
    const endDateYmd = crossesMidnight ? nextDayYmd(date) : date;

    // Pausa: mesma regra de data do fim — horário "menor" que o início caiu no
    // dia seguinte junto com a jornada que virou a noite.
    const includeBreak = hasBreak && !isTiered;
    const breakDateYmd = (hhmm: string) =>
      (hhmmToMinutes(hhmm) as number) < (startMinutes as number) ? nextDayYmd(date) : date;

    const payload: AdminCreateVacancyInput = {
      contractorUserId,
      title: role.role.name,
      description: description.trim() || undefined,
      serviceType: role.role.slug,
      categorySlug: selectedCategory!.slug,
      pricingTierLabel: isTiered ? tierLabel : null,
      date,
      startTime: brasiliaWallTimeToUtcIso(date, startTime),
      endTime: brasiliaWallTimeToUtcIso(endDateYmd, endTime),
      breakStartTime: includeBreak
        ? brasiliaWallTimeToUtcIso(breakDateYmd(breakStart), breakStart)
        : undefined,
      breakEndTime: includeBreak
        ? brasiliaWallTimeToUtcIso(breakDateYmd(breakEnd), breakEnd)
        : undefined,
      providesMeal,
      // Vazio = backend usa o endereço/cidade cadastrados do contratante.
      address: address.trim() || undefined,
      cityId: cityId || undefined,
    };

    try {
      await createVacancy.mutateAsync(payload);
      toast.success(
        `Vaga PUBLICADA para ${companyName}. Ela já está aberta para os freelancers — `
          + "aprovar a candidatura e pagar continua sendo do contratante.",
        { duration: 8000 },
      );
      onClose();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível abrir a vaga."));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Abrir vaga — {companyName}</DialogTitle>
        <DialogDescription>
          Publica uma vaga por hora (Bares &amp; Restaurantes) em nome do contratante. A vaga
          nasce aberta, com os mesmos disparos de push e grupo de WhatsApp.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">Erro ao carregar o catálogo de categorias e cargos.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vaga-categoria">Categoria</Label>
            <NativeSelect
              id="vaga-categoria"
              value={categorySlug}
              onChange={(e) => selectCategory(e.target.value)}
            >
              <option value="">Selecione a categoria...</option>
              {brCategories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vaga-cargo">Cargo</Label>
            <NativeSelect
              id="vaga-cargo"
              value={roleSlug}
              onChange={(e) => selectRole(e.target.value)}
              disabled={!selectedCategory}
            >
              <option value="">
                {selectedCategory ? "Selecione o cargo..." : "Escolha a categoria primeiro"}
              </option>
              {categoryRoles.map((r) => (
                <option key={r.id} value={r.role.slug}>
                  {r.role.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {isTiered && (
            <div className="space-y-1.5">
              <Label htmlFor="vaga-faixa">
                {selectedRole?.tierQualifierLabel || "Faixa de preço"}
              </Label>
              <NativeSelect
                id="vaga-faixa"
                value={tierLabel}
                onChange={(e) => setTierLabel(e.target.value)}
              >
                <option value="">Selecione a faixa...</option>
                {tiers.map((t) => (
                  <option key={t.label} value={t.label}>
                    {t.label} — {formatCents(t.totalInCents)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="vaga-data">Data</Label>
            <Input
              id="vaga-data"
              type="date"
              value={date}
              min={todayInBrasilia()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vaga-inicio">Início</Label>
              <Input
                id="vaga-inicio"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vaga-fim">Fim</Label>
              <Input
                id="vaga-fim"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {durationHours !== null && durationHours > 0 && (
            <p className="text-xs text-[#737373]">
              Jornada de {durationHours.toString().replace(".", ",")} h
              {crossesMidnight ? " — termina no dia seguinte." : "."}
              {selectedRole && selectedRole.pricingModel !== "TIERED"
                ? ` Referência do catálogo: ${formatCents(selectedRole.hourlyRateInCents)}/h, mínimo de ${selectedRole.minimumJourneyHours} h.`
                : ""}
            </p>
          )}

          {selectedRole && !isTiered && (
            <div className="space-y-2 rounded-lg border border-[#e5e5e5] p-3">
              <label className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                <input
                  type="checkbox"
                  checked={hasBreak}
                  onChange={(e) => setHasBreak(e.target.checked)}
                  className="h-4 w-4 accent-[#eca826]"
                />
                Pausa não remunerada
              </label>
              {hasBreak && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vaga-pausa-inicio">Início da pausa</Label>
                    <Input
                      id="vaga-pausa-inicio"
                      type="time"
                      value={breakStart}
                      onChange={(e) => setBreakStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vaga-pausa-fim">Fim da pausa</Label>
                    <Input
                      id="vaga-pausa-fim"
                      type="time"
                      value={breakEnd}
                      onChange={(e) => setBreakEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-[#1d1d1b]">
            <input
              type="checkbox"
              checked={providesMeal}
              onChange={(e) => setProvidesMeal(e.target.checked)}
              className="h-4 w-4 accent-[#eca826]"
            />
            O contratante oferece refeição
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="vaga-cidade">Cidade</Label>
            <NativeSelect
              id="vaga-cidade"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              <option value="">
                {contractorCity
                  ? `Usar a cidade do cadastro (${contractorCity})`
                  : "Usar a cidade do cadastro do contratante"}
              </option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vaga-endereco">Endereço (opcional)</Label>
            <Input
              id="vaga-endereco"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Deixe vazio para usar o endereço cadastrado da empresa"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vaga-descricao">Descrição (opcional)</Label>
            <textarea
              id="vaga-descricao"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes do serviço, uniforme, ponto de encontro..."
              className="w-full rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 resize-none"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">
              A vaga é publicada na hora. Aprovar a candidatura e pagar continua sendo do
              contratante — o painel só abre a vaga.
            </p>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={createVacancy.isPending}
          className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || isError || createVacancy.isPending}
          className="bg-[#eca826] text-white hover:bg-[#d4951e]"
        >
          {createVacancy.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Publicar vaga
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

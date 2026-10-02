"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useAudienceOptions,
  usePreviewAudience,
} from "@/modules/admin/application/use-admin-referrals";
import {
  EXTERNAL_LIST_AUDIENCE,
  type BaseAudience,
} from "@/modules/admin/infrastructure/referrals-api";
import {
  AUDIENCE_LABELS,
  MODULE_LABELS,
  RADIUS_KM_MAX,
  audienceLabel,
  audienceOptionsFor,
  buildAudienceFilters,
  countFromPreview,
  changeAudience,
  CONTACTED_DAYS_MAX,
  NO_VACANCY_DAYS_MAX,
  isContractorAudience,
  refineDayErrors,
  stepBlockers,
  NAME_MAX,
  type AccountModule,
  type WizardAudience,
  type WizardKind,
  type WizardState,
} from "../_lib/campaign-wizard";
import { excludedLines } from "../_lib/campaign-results";
import { ExternalListPicker } from "./external-list-picker";
import { OptionPill } from "./option-pill";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

interface Props {
  kind: WizardKind;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  /** Avulsa já criada: o público foi congelado na criação. */
  locked?: boolean;
}

/**
 * Passo 1 — Público (spec 2026-10-01 campanhas parte 1 §8.2): os recortes de hoje +
 * todos/ativos, filtros (tipo de conta, UF, cidade, raio na avulsa) e a contagem com
 * WhatsApp, só e-mail e excluídos por saída. Na planilha, a caixa de aceite obrigatória.
 */
export function WizardAudienceStep({
  kind,
  state,
  onChange,
  locked = false,
}: Props) {
  const isSheet = state.audience === EXTERNAL_LIST_AUDIENCE;
  // Só busca as cidades com o passo aberto e público da base: monta a audiência inteira na API.
  const audienceOptions = useAudienceOptions(
    !locked && !isSheet ? (state.audience as BaseAudience) : null,
  );
  const previewAudience = usePreviewAudience();
  const cities = audienceOptions.data?.cities ?? [];
  const ufs = [
    ...new Set(
      cities.map((c) => c.uf).filter((uf): uf is string => Boolean(uf)),
    ),
  ].sort();
  const nameError = state.name.trim()
    ? stepBlockers(state, 1, kind).find((message) =>
        message.startsWith("O nome precisa"),
      )
    : undefined;
  const refineErrors = refineDayErrors(state);
  const refineInvalid = Boolean(
    refineErrors.noVacancy || refineErrors.contacted,
  );
  const visibleCities = state.ufs.length
    ? cities.filter((c) => c.uf && state.ufs.includes(c.uf))
    : cities;

  async function handleCount() {
    try {
      const res = await previewAudience.mutateAsync({
        audience: state.audience as BaseAudience,
        filters: buildAudienceFilters(state),
      });
      onChange({ count: countFromPreview(res) });
    } catch (error) {
      toast.error(
        getAxiosErrorMessage(error, "Não foi possível contar o público."),
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="wz-name">Nome da campanha</Label>
        <Input
          id="wz-name"
          className="min-h-11"
          value={state.name}
          maxLength={NAME_MAX}
          aria-invalid={nameError ? true : undefined}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={
            kind === "avulsa"
              ? "Apresentação Freela — out/2026"
              : "Sextou — toda sexta"
          }
        />
        {nameError && (
          <p role="alert" className="text-xs text-red-700">
            {nameError}
          </p>
        )}
      </div>

      {locked ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-[#1d1d1b]">
            {audienceLabel(state.audience)}
          </p>
          <p className="text-xs text-neutral-500">
            O público foi congelado quando a campanha foi criada. Para mudar,
            encerre esta campanha e crie outra.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="wz-audience">Quem recebe</Label>
            <NativeSelect
              id="wz-audience"
              className="min-h-11"
              value={state.audience}
              onChange={(event) =>
                onChange(
                  changeAudience(state, event.target.value as WizardAudience),
                )
              }
            >
              {audienceOptionsFor(kind).map((key) => (
                <option key={key} value={key}>
                  {AUDIENCE_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
          </div>

          {isSheet ? (
            <>
              <ExternalListPicker
                value={state.picker}
                onChange={(picker) =>
                  // Planilha nova: o aceite vale para a lista antiga, então volta a pedir.
                  onChange(
                    picker.sheet !== state.picker.sheet
                      ? { picker, optInConfirmed: false }
                      : { picker },
                  )
                }
                onFileName={(name) => {
                  if (!state.name.trim()) onChange({ name });
                }}
              />
              <label className="flex min-h-11 items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0"
                  checked={state.optInConfirmed}
                  onChange={(event) =>
                    onChange({ optInConfirmed: event.target.checked })
                  }
                />
                <span>
                  <strong>
                    Essas pessoas aceitaram receber mensagens da Freela.
                  </strong>
                  <span className="block text-xs text-amber-900">
                    Obrigatório. Lista fria, sem aceite, não vai pelo WhatsApp.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <>
              {isContractorAudience(state.audience) && (
                <div className="space-y-1.5">
                  <Label>Tipo de conta</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(MODULE_LABELS) as AccountModule[]).map(
                      (mod) => (
                        <OptionPill
                          key={mod}
                          selected={state.modules.includes(mod)}
                          onClick={() =>
                            onChange({
                              modules: toggle(state.modules, mod),
                              count: null,
                            })
                          }
                        >
                          {MODULE_LABELS[mod]}
                        </OptionPill>
                      ),
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Nenhum marcado = os dois.
                  </p>
                </div>
              )}

              {ufs.length > 0 && !state.radiusCity && (
                <div className="space-y-1.5">
                  <Label>
                    Estados{" "}
                    <span className="font-normal text-neutral-500">
                      {state.ufs.length
                        ? `(${state.ufs.length})`
                        : "(nenhum = todos)"}
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {ufs.map((uf) => (
                      <OptionPill
                        key={uf}
                        selected={state.ufs.includes(uf)}
                        onClick={() =>
                          onChange({
                            ufs: toggle(state.ufs, uf),
                            cities: [],
                            count: null,
                          })
                        }
                      >
                        {uf}
                      </OptionPill>
                    ))}
                  </div>
                </div>
              )}

              {/* Raio vale nas duas, avulsa e automática (spec 2026-10-01 parte 2 §2.6). */}
              <div className="space-y-1.5">
                <Label htmlFor="wz-radius-city">
                  Raio a partir de uma cidade
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <NativeSelect
                    id="wz-radius-city"
                    className="min-h-11 sm:flex-1"
                    value={state.radiusCity}
                    onChange={(event) =>
                      onChange({
                        radiusCity: event.target.value,
                        cities: [],
                        ufs: [],
                        count: null,
                      })
                    }
                  >
                    <option value="">Sem raio (usar estados e cidades)</option>
                    {cities.map((opt) => (
                      <option
                        key={`${opt.city}-${opt.uf ?? ""}`}
                        value={opt.city}
                      >
                        {opt.city}
                        {opt.uf ? ` · ${opt.uf}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                  <div className="flex items-center gap-1.5">
                    <Input
                      aria-label="Raio em km"
                      type="number"
                      min={1}
                      max={RADIUS_KM_MAX}
                      className="min-h-11 w-28"
                      value={state.radiusKm}
                      disabled={!state.radiusCity}
                      onChange={(event) =>
                        onChange({
                          radiusKm: Number(event.target.value),
                          count: null,
                        })
                      }
                    />
                    <span className="text-sm text-neutral-600">km</span>
                  </div>
                </div>
              </div>

              {!state.radiusCity && (
                <div className="space-y-1.5">
                  <Label>
                    Cidades{" "}
                    <span className="font-normal text-neutral-500">
                      {state.cities.length
                        ? `(${state.cities.length} escolhida${state.cities.length === 1 ? "" : "s"})`
                        : "(nenhuma = todas)"}
                    </span>
                  </Label>
                  {audienceOptions.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                      Levantando as cidades deste público…
                    </div>
                  ) : (
                    <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-neutral-200 p-2">
                      {visibleCities.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          Nenhuma cidade neste público.
                        </p>
                      ) : (
                        visibleCities.map((opt) => (
                          <OptionPill
                            key={`${opt.city}-${opt.uf ?? ""}`}
                            selected={state.cities.includes(opt.city)}
                            onClick={() =>
                              onChange({
                                cities: toggle(state.cities, opt.city),
                                count: null,
                              })
                            }
                          >
                            {opt.city}
                            {opt.uf ? ` · ${opt.uf}` : ""}{" "}
                            <span className="opacity-70">{opt.total}</span>
                          </OptionPill>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <fieldset
                className="space-y-1 rounded-md border border-neutral-200 p-3"
                data-testid="audience-refine"
              >
                <legend className="px-1 text-sm font-medium text-[#1d1d1b]">
                  Refinar
                </legend>
                {isContractorAudience(state.audience) && (
                  <>
                    <div
                      data-refine-row
                      className="flex min-h-11 flex-wrap items-center gap-2 text-sm"
                    >
                      <input
                        id="wz-no-vacancy"
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        checked={state.refineNoVacancy}
                        onChange={(event) =>
                          onChange({
                            refineNoVacancy: event.target.checked,
                            count: null,
                          })
                        }
                      />
                      <label htmlFor="wz-no-vacancy">
                        Não publicou vaga nos últimos
                      </label>
                      <Input
                        aria-label="Dias sem publicar vaga"
                        aria-invalid={refineErrors.noVacancy ? true : undefined}
                        aria-describedby={
                          refineErrors.noVacancy
                            ? "wz-no-vacancy-error"
                            : undefined
                        }
                        type="number"
                        min={1}
                        max={NO_VACANCY_DAYS_MAX}
                        className="min-h-11 w-20"
                        value={state.noVacancyDays}
                        disabled={!state.refineNoVacancy}
                        onChange={(event) =>
                          onChange({
                            noVacancyDays: Number(event.target.value),
                            count: null,
                          })
                        }
                      />
                      <span>dias</span>
                      {refineErrors.noVacancy && (
                        <p
                          id="wz-no-vacancy-error"
                          role="alert"
                          className="basis-full text-xs text-red-700"
                        >
                          {refineErrors.noVacancy}
                        </p>
                      )}
                    </div>
                    <div
                      data-refine-row
                      className="flex min-h-11 flex-wrap items-center gap-2 text-sm"
                    >
                      <input
                        id="wz-hired"
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        checked={state.excludeHired}
                        onChange={(event) =>
                          onChange({
                            excludeHired: event.target.checked,
                            count: null,
                          })
                        }
                      />
                      <label htmlFor="wz-hired">Tirar quem já contratou</label>
                    </div>
                  </>
                )}
                <div
                  data-refine-row
                  className="flex min-h-11 flex-wrap items-center gap-2 text-sm"
                >
                  <input
                    id="wz-contacted"
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={state.excludeContacted}
                    onChange={(event) =>
                      onChange({
                        excludeContacted: event.target.checked,
                        count: null,
                      })
                    }
                  />
                  <label htmlFor="wz-contacted">
                    Não mandar para quem recebeu campanha nos últimos
                  </label>
                  <Input
                    aria-label="Dias desde a última campanha"
                    aria-invalid={refineErrors.contacted ? true : undefined}
                    aria-describedby={
                      refineErrors.contacted ? "wz-contacted-error" : undefined
                    }
                    type="number"
                    min={1}
                    max={CONTACTED_DAYS_MAX}
                    className="min-h-11 w-20"
                    value={state.contactedDays}
                    disabled={!state.excludeContacted}
                    onChange={(event) =>
                      onChange({
                        contactedDays: Number(event.target.value),
                        count: null,
                      })
                    }
                  />
                  <span>dias</span>
                  {refineErrors.contacted && (
                    <p
                      id="wz-contacted-error"
                      role="alert"
                      className="basis-full text-xs text-red-700"
                    >
                      {refineErrors.contacted}
                    </p>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  Conta dias corridos (horário de Brasília) e também quem já tem
                  envio pendente em outra campanha em andamento ou agendada.
                </p>
              </fieldset>

              {/* Contar ANTES de criar: o público é congelado na criação. */}
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm" data-testid="audience-count">
                    {state.count ? (
                      <>
                        <span className="font-semibold text-neutral-900">
                          {kind === "automatica" && "≈ "}
                          {state.count.total} pessoa
                          {state.count.total === 1 ? "" : "s"}
                          {kind === "automatica" && " por execução (aprox.)"}
                        </span>
                        <span className="block text-xs text-neutral-600">
                          {kind === "automatica" &&
                            "Cada execução recalcula o público e respeita o limite por execução. "}
                          {state.count.whatsapp} com WhatsApp ·{" "}
                          {state.count.email} só e-mail ·{" "}
                          {state.count.excludedByOptOut} já pediram para não
                          receber (ficam de fora)
                        </span>
                        {state.count.semCoordenada > 0 && (
                          <span className="mt-1 block text-xs text-amber-700">
                            {state.count.semCoordenada} ficaram de fora do raio
                            por não ter endereço com coordenada.
                          </span>
                        )}
                        {excludedLines(
                          state.count.excluded,
                          buildAudienceFilters(state),
                        ).length > 0 && (
                          <ul
                            className="mt-1 space-y-0.5 text-xs text-neutral-600"
                            data-testid="audience-excluded"
                          >
                            {excludedLines(
                              state.count.excluded,
                              buildAudienceFilters(state),
                            ).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <span className="text-neutral-600">
                        {kind === "avulsa"
                          ? "Confira quantos entram antes de seguir."
                          : "Confira quantos entram a cada execução."}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={previewAudience.isPending || refineInvalid}
                    onClick={handleCount}
                  >
                    {previewAudience.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Contar"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  brasiliaLocalInput,
  pacingLabel,
  type WizardKind,
  type WizardState,
} from "../_lib/campaign-wizard";
import { OptionPill } from "./option-pill";

/** 0=domingo..6=sábado — mesma convenção da API. */
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Campo apagado vira NaN: a trava do passo pede o número de volta. */
const numberOrNaN = (value: number | null) => value ?? Number.NaN;

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: number | null;
  min: number;
  max?: number;
  onChange: (value: number | null) => void;
  className?: string;
}) {
  return (
    <div className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className="min-h-11"
        value={value === null || Number.isNaN(value) ? "" : value}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      />
    </div>
  );
}

interface Props {
  kind: WizardKind;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  /** Avulsa já criada: "Continuar" salva no rascunho em vez de criar outra. */
  created?: boolean;
}

/**
 * Passo 3 — Quando (spec 2026-10-01 campanhas parte 1 §8.2): avulsa dispara agora ou
 * agenda data/hora (Brasília) + ritmo; automática é semanal ou por data, como hoje.
 */
export function WizardWhenStep({
  kind,
  state,
  onChange,
  created = false,
}: Props) {
  if (kind === "automatica")
    return <AutomaticWhen state={state} onChange={onChange} />;
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Quando</Label>
        <div className="flex flex-wrap gap-2">
          <OptionPill
            selected={state.when === "now"}
            onClick={() => onChange({ when: "now" })}
          >
            Disparar agora
          </OptionPill>
          <OptionPill
            selected={state.when === "schedule"}
            onClick={() => onChange({ when: "schedule" })}
          >
            Agendar
          </OptionPill>
        </div>
      </div>

      {state.when === "schedule" && (
        <div className="space-y-1.5">
          <Label htmlFor="wz-schedule-at">
            Data e hora (horário de Brasília)
          </Label>
          <Input
            id="wz-schedule-at"
            type="datetime-local"
            className="min-h-11 sm:w-64"
            min={brasiliaLocalInput(new Date())}
            value={state.scheduleAt}
            onChange={(event) => onChange({ scheduleAt: event.target.value })}
          />
          <p className="text-xs text-neutral-500">
            Até 60 dias à frente. Fora da janela de envio, a campanha começa e
            espera o próximo horário.
          </p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#1d1d1b]">Ritmo</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField
            id="wz-per-hour"
            label="Mensagens por hora"
            min={1}
            max={60}
            value={state.messagesPerHour}
            onChange={(value) =>
              onChange({ messagesPerHour: numberOrNaN(value) })
            }
          />
          <NumberField
            id="wz-daily-cap"
            label="Teto por dia"
            min={1}
            max={1000}
            value={state.dailyCap}
            onChange={(value) => onChange({ dailyCap: numberOrNaN(value) })}
          />
          <NumberField
            id="wz-window-start"
            label="Das (hora)"
            min={0}
            max={23}
            value={state.windowStartHour}
            onChange={(value) =>
              onChange({ windowStartHour: numberOrNaN(value) })
            }
          />
          <NumberField
            id="wz-window-end"
            label="Até (hora)"
            min={1}
            max={24}
            value={state.windowEndHour}
            onChange={(value) =>
              onChange({ windowEndHour: numberOrNaN(value) })
            }
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={state.weekdaysOnly}
            onChange={(event) =>
              onChange({ weekdaysOnly: event.target.checked })
            }
          />
          Só dias úteis
        </label>
        <p className="text-xs text-neutral-500">
          {pacingLabel(state)}. Padrão: base 60/hora e 200/dia; planilha 20/hora
          e 100/dia.
        </p>
      </fieldset>

      {!created && (
        <p className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          Ao continuar, a campanha é criada como rascunho e a lista de pessoas
          fica congelada. Nada sai antes de você disparar ou agendar no passo 4.
        </p>
      )}
    </div>
  );
}

function AutomaticWhen({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Agenda</Label>
        <div className="flex flex-wrap gap-2">
          <OptionPill
            selected={state.scheduleKind === "WEEKLY"}
            onClick={() => onChange({ scheduleKind: "WEEKLY" })}
          >
            Toda semana
          </OptionPill>
          <OptionPill
            selected={state.scheduleKind === "DATED"}
            onClick={() => onChange({ scheduleKind: "DATED" })}
          >
            Data específica
          </OptionPill>
        </div>
      </div>

      {state.scheduleKind === "WEEKLY" ? (
        <>
          <div className="space-y-1.5">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, day) => (
                <OptionPill
                  key={day}
                  selected={state.weekdays.includes(day)}
                  onClick={() =>
                    onChange({
                      weekdays: state.weekdays.includes(day)
                        ? state.weekdays.filter((d) => d !== day)
                        : [...state.weekdays, day].sort((a, b) => a - b),
                    })
                  }
                >
                  {label}
                </OptionPill>
              ))}
            </div>
          </div>
          <NumberField
            id="wz-send-hour"
            label="Hora (Brasília)"
            min={0}
            max={23}
            value={state.sendHour}
            onChange={(value) => onChange({ sendHour: numberOrNaN(value) })}
            className="w-40"
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <NumberField
              id="wz-target-month"
              label="Mês"
              min={1}
              max={12}
              value={state.targetMonth}
              onChange={(value) => onChange({ targetMonth: value })}
            />
            <NumberField
              id="wz-target-day"
              label="Dia"
              min={1}
              max={31}
              value={state.targetDay}
              onChange={(value) => onChange({ targetDay: value })}
            />
          </div>
          <NumberField
            id="wz-lead-days"
            label="Dias antes da data"
            min={0}
            max={60}
            value={state.leadDays}
            onChange={(value) => onChange({ leadDays: numberOrNaN(value) })}
            className="w-40"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={state.repeatsAnnually}
              onChange={(event) =>
                onChange({ repeatsAnnually: event.target.checked })
              }
            />
            Repetir todo ano
          </label>
          {!state.repeatsAnnually && (
            <NumberField
              id="wz-target-year"
              label="Ano"
              min={2020}
              max={2100}
              value={state.targetYear}
              onChange={(value) => onChange({ targetYear: value })}
              className="w-40"
            />
          )}
        </>
      )}

      <div className="w-56 space-y-1">
        <NumberField
          id="wz-max-per-run"
          label="Máximo por execução (opcional)"
          min={1}
          value={state.maxPerRun}
          onChange={(value) => onChange({ maxPerRun: value })}
        />
        <p className="text-xs text-neutral-500">
          Vazio = o público inteiro a cada execução. Ritmo padrão: 60/hora, até
          200/dia, das 9h às 18h, dias úteis.
        </p>
      </div>
    </div>
  );
}

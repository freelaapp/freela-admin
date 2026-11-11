"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAdminLotLines } from "@/modules/admin/application/use-lot-day";
import { isLotsUnavailable } from "@/modules/admin/application/lots-presentation";
import {
  arrivalText,
  askText,
  attendanceText,
  chosenText,
  linesSummary,
  paymentText,
  type LineText,
  type Tone,
} from "@/modules/admin/application/lot-lines-presentation";
import type { AdminLotLine } from "@/modules/admin/infrastructure/lot-lines-api";
import { formatVacancyTime } from "@/lib/date.utils";

const TONE: Record<Tone, string> = {
  ok: "text-[#1d1d1b]",
  wait: "text-[#8a5a00]",
  bad: "text-red-700",
  neutral: "text-[#737373]",
};

function Cell({ label, value }: { label: string; value: LineText }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">{label}</p>
      <p className={`text-sm ${TONE[value.tone]}`}>{value.text}</p>
      {value.notes.map((note) => (
        <p key={note} className="text-xs text-[#737373]">
          {note}
        </p>
      ))}
    </div>
  );
}

function Line({ line, serviceDate }: { line: AdminLotLine; serviceDate: string }) {
  const hasChosen = !!line.chosen;
  return (
    <li data-testid="lot-line" className="space-y-3 rounded-lg border border-[#e5e5e5] bg-white p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold text-[#1d1d1b]">
          {chosenText(line)}
          <span className="ml-2 text-sm font-normal text-[#737373]">
            {line.title}
            {line.startTime && line.endTime
              ? ` · ${formatVacancyTime(line.startTime)} às ${formatVacancyTime(line.endTime)}`
              : ""}
          </span>
        </p>
      </div>
      {hasChosen ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Cell label="Ainda pode vir?" value={askText(line.ask, { serviceDate, vacancyId: line.vacancyId })} />
          <Cell label="Pagamento" value={paymentText(line.payment, { serviceDate, hasChosen })} />
          <Cell label="Chegou?" value={arrivalText(line.arrival, { serviceDate })} />
          <Cell label="Compareceu?" value={attendanceText(line.attendance)} />
        </div>
      ) : (
        <p className="text-sm text-[#737373]">
          Vaga livre: sem pergunta, pagamento, chegada ou presença.
          {line.payment?.paid ? " Há um valor pago guardado para quem for escolhido." : ""}
        </p>
      )}
    </li>
  );
}

/**
 * A3: uma linha por vaga do lote (quem está escolhido, "Ainda pode vir?", pagamento, chegada e
 * presença). Horários em Brasília. Só leitura. Rota respondendo 404 (recurso desligado na API): a
 * seção mostra "recurso desligado" e o resto do detalhe segue como estava. Erro em outro código: aviso
 * dentro da seção, com "Tentar de novo".
 */
export function LotLinesSection({ lotId, enabled }: { lotId: string; enabled: boolean }) {
  const query = useAdminLotLines(lotId, enabled);

  if (query.isLoading) {
    return (
      <section aria-busy="true" className="mt-6 flex items-center gap-2 text-sm text-[#737373]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando as vagas do lote...
      </section>
    );
  }
  if (query.isError && isLotsUnavailable(query.error)) {
    return (
      <section data-testid="lot-lines-off" className="mt-6 rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#737373]">
        Vaga por vaga: recurso desligado na API.
      </section>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <p>Não foi possível carregar a situação de cada vaga.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => query.refetch()}>
          Tentar de novo
        </Button>
      </section>
    );
  }

  const { lines, serviceDate } = query.data;
  return (
    <section className="mt-6 space-y-3" aria-label="Vaga por vaga">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1b]">Vaga por vaga</h2>
        <p data-testid="lot-lines-summary" className="text-xs text-[#737373]">
          {linesSummary(lines)}
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#737373]">Este lote não tem vagas ativas.</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <Line key={line.vacancyId} line={line} serviceDate={serviceDate} />
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useInsuranceFinancial } from "@/modules/admin/application/use-admin-insurance";
import {
  PERIODOS_FINANCEIROS,
  type PeriodoFinanceiro,
} from "@/modules/admin/infrastructure/insurance-api";

const dinheiro = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const MES_LONGO = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
});

/**
 * O que o seguro custa e se o volume justifica o piso do contrato.
 *
 * Duas informações que precisam aparecer JUNTAS: o período escolhido responde
 * "quanto rodou agora", mas quem manda na fatura é o **piso mensal** — abaixo
 * dele o mês custa R$ 300 mesmo com uma única apólice. Mostrar só o período
 * daria a leitura tranquilizadora errada ("hoje custou R$ 6,80").
 *
 * O trajeto (ida/volta) aparece como número mas fica FORA do custo: ele também
 * é período na IZA, só que se entra na fatura é pergunta comercial em aberto.
 * Somar por conta própria inventaria um número; escondê-lo esconderia a dúvida.
 */
export function FinanceiroCard() {
  const [periodo, setPeriodo] = useState<PeriodoFinanceiro>("hoje");
  const { data, isLoading, isError } = useInsuranceFinancial(periodo);

  const rotulo =
    PERIODOS_FINANCEIROS.find((p) => p.chave === periodo)?.label.toLowerCase() ?? "hoje";

  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-[#1d1d1b]">Financeiro</h2>
        <div className="flex flex-wrap gap-1">
          {PERIODOS_FINANCEIROS.map((opcao) => (
            <Button
              key={opcao.chave}
              type="button"
              size="sm"
              variant={opcao.chave === periodo ? "default" : "outline"}
              onClick={() => setPeriodo(opcao.chave)}
            >
              {opcao.label}
            </Button>
          ))}
        </div>
      </div>

      {isError && (
        <p className="text-sm text-red-600">Não foi possível carregar os números do seguro.</p>
      )}
      {isLoading && !data && <p className="text-sm text-[#737373]">Carregando…</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#737373]">
                Contratações {rotulo}
              </p>
              <p className="text-2xl font-bold text-[#1d1d1b]">{data.periodo.contratacoes}</p>
              <p className="mt-1 text-xs text-[#737373]">
                {dinheiro(data.precoPorContratacaoEmCentavos)} cada
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#737373]">Custo {rotulo}</p>
              <p className="text-2xl font-bold text-[#1d1d1b]">
                {dinheiro(data.periodo.custoEmCentavos)}
              </p>
              <p className="mt-1 text-xs text-[#737373]">
                {data.periodo.trajetos} período{data.periodo.trajetos === 1 ? "" : "s"} de trajeto
                (fora desta conta)
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[#737373]">
                Fatura de {MES_LONGO.format(new Date(data.mes.de))}
              </p>
              <p className="text-2xl font-bold text-[#1d1d1b]">
                {dinheiro(data.mes.faturaEmCentavos)}
              </p>
              <p className="mt-1 text-xs text-[#737373]">
                {data.mes.contratacoes} contrataç{data.mes.contratacoes === 1 ? "ão" : "ões"} ={" "}
                {dinheiro(data.mes.usoEmCentavos)} de uso
              </p>
            </div>
          </div>

          <MetaMinima data={data} />
        </>
      )}
    </div>
  );
}

/** A pergunta do chefe: o mês bate o piso de R$ 300? */
function MetaMinima({ data }: { data: NonNullable<ReturnType<typeof useInsuranceFinancial>["data"]> }) {
  const { mes, pisoMensalEmCentavos, contratacoesParaOPiso } = data;
  const progresso = Math.min(100, (mes.usoEmCentavos / pisoMensalEmCentavos) * 100);

  return (
    <div
      className={`mt-4 rounded-lg border p-3 ${
        mes.atingiuPiso ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[#1d1d1b]">
          Piso mensal de {dinheiro(pisoMensalEmCentavos)}
        </p>
        <p className="text-sm font-semibold text-[#1d1d1b]">
          {mes.atingiuPiso
            ? "Atingido — a partir daqui paga-se o uso"
            : `Faltam ${mes.faltamContratacoes} contrataç${
                mes.faltamContratacoes === 1 ? "ão" : "ões"
              }`}
        </p>
      </div>

      {/* Barra com o mesmo dado do texto: quem bate o olho lê a proporção,
          quem precisa do número lê embaixo. */}
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuenow={Math.round(progresso)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Uso do mês em relação ao piso de ${dinheiro(pisoMensalEmCentavos)}`}
      >
        <div
          className={`h-full rounded-full ${mes.atingiuPiso ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${progresso}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[#737373]">
        {mes.atingiuPiso ? (
          <>
            O uso do mês ({dinheiro(mes.usoEmCentavos)}) já passou do piso. São{" "}
            {contratacoesParaOPiso} contratações para chegar até aqui.
          </>
        ) : (
          <>
            O mês custa {dinheiro(pisoMensalEmCentavos)} de qualquer jeito:{" "}
            <strong>{dinheiro(mes.ociosoEmCentavos)}</strong> é capacidade paga e não usada. São{" "}
            {contratacoesParaOPiso} contratações no mês para o piso deixar de sobrar.
          </>
        )}
      </p>
    </div>
  );
}

"use client";

import type { DashboardTopContractor } from "@/modules/admin/infrastructure/dashboard-api";
import {
  DASH,
  formatCurrencyCents,
  formatInteger,
} from "@/modules/admin/application/dashboard-presentation";

/**
 * P10 — Top 10 contratantes do período. Ranking pelas contratações concluídas, desempate pelo
 * valor movimentado. A tabela rola dentro do próprio quadro no celular; a página não.
 */
export function TopContractorsTable({
  rows,
  periodLabel,
}: {
  rows: DashboardTopContractor[] | undefined;
  periodLabel: string;
}) {
  return (
    <section aria-labelledby="top-contratantes" className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <h2 id="top-contratantes" className="text-base font-semibold text-[#1d1d1b]">
        Top 10 contratantes
      </h2>
      <p className="mb-3 mt-1 text-xs text-[#737373]">{periodLabel}</p>

      {rows === undefined ? (
        <p className="text-sm text-[#737373]">
          O Top 10 ainda não está disponível nesta versão da API.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[#737373]">Nenhum contratante com contratação concluída neste período.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Contratante</th>
                <th className="py-2 pr-3 font-medium">Cidade</th>
                <th className="py-2 pr-3 text-right font-medium">Vagas criadas</th>
                <th className="py-2 pr-3 text-right font-medium">Concluídas</th>
                <th className="py-2 text-right font-medium">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.contractorUserId} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="py-2 pr-3 text-[#737373]">{r.position}º</td>
                  <td className="py-2 pr-3 font-medium text-[#1d1d1b]">{r.name ?? "Sem nome"}</td>
                  <td className="py-2 pr-3 text-[#525252]">
                    {r.city ? `${r.city}${r.uf ? `/${r.uf}` : ""}` : DASH}
                  </td>
                  <td className="py-2 pr-3 text-right">{formatInteger(r.vacanciesCreated)}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatInteger(r.hiresCompleted)}</td>
                  <td className="py-2 text-right">{formatCurrencyCents(r.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-3 text-xs text-[#525252]">
        <summary className="cursor-pointer select-none font-medium text-[#737373] hover:text-[#1d1d1b]">
          Ver a conta
        </summary>
        <p className="mt-1">
          Conta: os 10 contratantes com mais contratações concluídas no período (freelancers
          escolhidos em vagas com o serviço finalizado no período; uma vaga com 3 freelancers conta
          3). Empate: maior valor movimentado. &quot;Concluídas&quot; = contratações concluídas;
          &quot;Vagas criadas&quot; = vagas publicadas no período; &quot;Valor&quot; = pagamentos
          concluídos das vagas concluídas no período (o que o contratante pagou, não só a taxa).
        </p>
        <p className="mt-0.5">
          Fonte: vagas, candidaturas aceitas, serviços e pagamentos de Empresa + Casa, agrupados pela
          conta do contratante; contas internas e vagas de QA (cargo Teste) ficam fora.
        </p>
      </details>
    </section>
  );
}

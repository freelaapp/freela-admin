import { formatValue } from "@/modules/admin/application/engagement-format";
import type { CityRow } from "@/modules/admin/infrastructure/engagement-api";

const place = (c: CityRow) => (c.uf ? `${c.city} - ${c.uf}` : c.city);

/** Tabela no desktop, cartões no celular. Já vem ordenada por vagas pela API. */
export function CityTable({ rows, limit = 20 }: { rows: CityRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        Por cidade
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-[#737373]">
        Ordenado por vagas publicadas no período (até {limit} cidades).
      </p>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#737373]">Nenhuma vaga publicada no período.</p>
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                <th className="py-2 font-medium">Cidade</th>
                <th className="py-2 text-right font-medium">Vagas publicadas</th>
                <th className="py-2 text-right font-medium">Candidaturas</th>
                <th className="py-2 text-right font-medium">Candidaturas por vaga</th>
                <th className="py-2 text-right font-medium">Freelancers que abriram</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={place(c)} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="py-2 text-[#1d1d1b]">{place(c)}</td>
                  <td className="py-2 text-right">{formatValue(c.vacanciesPublished)}</td>
                  <td className="py-2 text-right">{formatValue(c.candidacies)}</td>
                  <td className="py-2 text-right">{formatValue(c.avgCandidaciesPerVacancy, "decimal")}</td>
                  <td className="py-2 text-right">{formatValue(c.freelancersOpened)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-2 md:hidden">
            {shown.map((c) => (
              <li key={place(c)} className="rounded-lg border border-[#e5e5e5] p-3">
                <p className="font-medium text-[#1d1d1b]">{place(c)}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-[#737373]">Vagas publicadas</dt>
                  <dd className="text-right font-semibold">{formatValue(c.vacanciesPublished)}</dd>
                  <dt className="text-[#737373]">Candidaturas</dt>
                  <dd className="text-right font-semibold">{formatValue(c.candidacies)}</dd>
                  <dt className="text-[#737373]">Por vaga</dt>
                  <dd className="text-right font-semibold">{formatValue(c.avgCandidaciesPerVacancy, "decimal")}</dd>
                  <dt className="text-[#737373]">Freelancers que abriram</dt>
                  <dd className="text-right font-semibold">{formatValue(c.freelancersOpened)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

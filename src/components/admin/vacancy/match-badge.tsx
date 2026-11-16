/**
 * Selo de compatibilidade candidato × vaga, espelhando o painel do contratante.
 *
 * Só aparece quando o backend manda a nota (flag `FREELA_CANDIDATE_MATCH_ENABLED`
 * ligada). `null` = a vaga não tem dado para comparar → texto explícito, nunca
 * "0%". `undefined` = recurso desligado → não renderiza nada. Faixas iguais às
 * dos cards do contratante: ≥70 verde, ≥40 âmbar, abaixo cinza.
 */
export function MatchBadge({ score }: { score?: number | null }) {
  if (score === undefined) return null;
  if (score === null) {
    return (
      <span className="text-[10px] text-[#a3a3a3]">
        Sem dados desta vaga para comparar
      </span>
    );
  }
  const tone =
    score >= 70
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 40
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      title="Compatibilidade do candidato com a vaga (mesmo cálculo do contratante)"
    >
      {score}% compatível
    </span>
  );
}

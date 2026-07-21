import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

/**
 * Tela de vertical/recurso que ainda não tem backend.
 *
 * De propósito NÃO exibe número de exemplo: um painel de gestão com dado
 * inventado vira decisão errada — alguém tira print de um faturamento falso.
 * Aqui a tela diz o que falta e por quê.
 */
export function ComingSoon({
  title,
  description,
  reason,
}: {
  title: string;
  description?: string;
  reason?: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="bg-white rounded-xl border border-[#e5e5e5] p-10 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center">
          <Construction className="w-6 h-6 text-[#eca826]" />
        </div>
        <p className="text-base font-semibold text-[#1d1d1b]">Em breve</p>
        <p className="text-sm text-[#737373] max-w-md">
          {reason ??
            "Esta tela depende de dados que o produto ainda não gera. Assim que o backend existir, ela passa a mostrar informação real — preferimos deixá-la vazia a exibir número de exemplo."}
        </p>
      </div>
    </div>
  );
}

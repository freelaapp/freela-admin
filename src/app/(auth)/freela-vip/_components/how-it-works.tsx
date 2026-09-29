"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** Os 6 passos do Freela VIP em linguagem do dia a dia — quem faz cada um. */
const STEPS: { title: string; who: string; text: string }[] = [
  { title: "Crie o ciclo da loja", who: "Você", text: "Escolha a loja (plano Grandes Redes), cidades, funções, quantas vagas e se pede antecedentes." },
  { title: "Convide", who: "Você", text: "Na aba Convidar, marque os freelas da base e envie pelo WhatsApp. Ou divulgue o link público do ciclo." },
  { title: "Formulário e nota", who: "Freela e sistema", text: "O freela preenche em menos de 8 minutos. A nota sai sozinha: 70+ vai para entrevista, 50 a 69 fica na lista de espera, abaixo de 50 fica fora." },
  { title: "Entrevista e referências", who: "Você", text: "Converse com o freela, confirme experiências e referências na ficha e siga." },
  { title: "Antecedentes", who: "Freela e equipe", text: "Só se o ciclo pedir: o freela envia as certidões e quem tem a permissão analisa." },
  { title: "Aprovar como VIP", who: "Você", text: "O VIP entra sozinho nos favoritos e na lista VIP da loja — e no grupo de WhatsApp dela, se a loja já tem grupo." },
];

/** `defaultOpen` vale só na montagem — depois é a pessoa que abre/fecha. */
export function HowItWorks({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group rounded-xl border border-[#E2E8F0] bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13.5px] font-semibold text-[#0F172A]">
        Como funciona o Freela VIP
        <ChevronDown className="h-4 w-4 text-[#64748B] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="grid gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-lg bg-[#F8FAFC] p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F172A] text-[12px] font-semibold text-white">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#0F172A]">{s.title}</p>
              <p className="text-[11.5px] font-medium uppercase tracking-wide text-[#b7791f]">{s.who}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[#475569]">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

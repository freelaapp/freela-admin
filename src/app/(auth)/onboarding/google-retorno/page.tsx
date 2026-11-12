"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCompleteGoogleConnect } from "@/modules/admin/application/use-orientation";
import { googleErrorMessage } from "@/modules/admin/application/orientation-google-presentation";

type Phase =
  | { kind: "working" }
  | { kind: "done"; email: string | null }
  | { kind: "failed"; message: string };

/** Aceita corpo `{ error: { code } }` e plano `{ code }`; nunca devolve a mensagem. */
function errorCode(err: unknown): string | undefined {
  const data = (err as { response?: { data?: { code?: unknown; error?: { code?: unknown } } } })?.response?.data;
  const code = data?.error?.code ?? data?.code;
  return typeof code === "string" ? code : undefined;
}

function Retorno() {
  const params = useSearchParams();
  // Valores da URL lidos UMA vez: depois o endereço é limpo e o efeito pode rodar de novo (StrictMode).
  const [initial] = useState(() => ({
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
  }));
  const [phase, setPhase] = useState<Phase>(() => {
    if (initial.error) return { kind: "failed", message: "Você cancelou a conexão com o Google." };
    if (!initial.code || !initial.state)
      return { kind: "failed", message: "Abra Configurações e toque em Conectar de novo." };
    return { kind: "working" };
  });
  const complete = useCompleteGoogleConnect();
  const sent = useRef(false);

  useEffect(() => {
    if (initial.error || !initial.code || !initial.state) return;
    if (sent.current) return;
    sent.current = true;
    window.history.replaceState(null, "", "/onboarding/google-retorno");
    complete
      .mutateAsync({ code: initial.code, state: initial.state })
      .then((view) => setPhase({ kind: "done", email: view?.connection?.googleEmail ?? null }))
      .catch((err: unknown) => setPhase({ kind: "failed", message: googleErrorMessage(errorCode(err)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-6 text-center">
        {phase.kind === "working" && (
          <div role="status" className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
            <p className="text-sm text-[#737373]">Conectando a sua conta Google…</p>
          </div>
        )}
        {phase.kind === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <p className="text-sm font-semibold text-[#1d1d1b]">
              {phase.email ? `Conectado como ${phase.email}` : "Conta Google conectada"}
            </p>
          </div>
        )}
        {phase.kind === "failed" && (
          <div role="alert" className="flex flex-col items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <p className="text-sm text-[#1d1d1b]">{phase.message}</p>
          </div>
        )}
        {phase.kind !== "working" && (
          <Link
            href="/onboarding/configuracoes"
            className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#eca826] px-4 text-sm font-medium text-white sm:w-auto"
          >
            Voltar para Configurações
          </Link>
        )}
      </div>
    </div>
  );
}

export default function GoogleRetornoPage() {
  return (
    <Suspense fallback={null}>
      <Retorno />
    </Suspense>
  );
}

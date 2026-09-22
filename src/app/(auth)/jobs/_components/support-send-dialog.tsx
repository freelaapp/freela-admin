"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

import { whatsappLink } from "./support-messages";

/**
 * Prévia antes do disparo: a mensagem já vem preenchida, o suporte confere,
 * completa os campos em branco (candidatos, uniforme…) e clica Enviar. É o meio
 * termo do dono — "só apertar o botão", mas sem mandar um WhatsApp errado para o
 * cliente e resolvendo as mensagens que pedem um dado na hora.
 *
 * Não decide NADA de negócio: recebe o texto pronto e um `onEnviar`. Se o envio
 * pela plataforma falhar (ou faltar telefone), o `wa.me` continua ali como saída.
 */
export function SupportSendDialog({
  titulo,
  destinatarioRotulo,
  telefone,
  textoInicial,
  onEnviar,
  onClose,
}: {
  titulo: string;
  /** "Contratante · Marcos" / "Freelancer · João". */
  destinatarioRotulo: string;
  /** Telefone cru (para exibir e para montar o `wa.me` de emergência). */
  telefone: string | null;
  textoInicial: string;
  onEnviar: (texto: string) => Promise<void>;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enviando) onClose();
    };
    window.addEventListener("keydown", onKey);
    textareaRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, enviando]);

  const waLink = whatsappLink(telefone, texto);
  const podeEnviar = texto.trim().length > 0 && !enviando;

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      await onEnviar(texto.trim());
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar. Tente pelo WhatsApp.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !enviando && onClose()}
        data-testid="send-dialog-overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Enviar mensagem — ${titulo}`}
        className="relative flex max-h-[88vh] w-full max-w-[520px] flex-col rounded-2xl bg-white shadow-[0_12px_48px_rgba(15,23,42,.28)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Enviar pela plataforma
            </p>
            <h3 className="truncate text-[15px] font-bold leading-tight text-[#0F172A]">
              {titulo}
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-[#475569]">
              {destinatarioRotulo}
              {telefone ? ` · ${telefone}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Fechar"
            className="shrink-0 cursor-pointer rounded-md p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <label className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-[#64748B]">
            Mensagem (você pode editar antes de enviar)
          </label>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            className="w-full resize-y rounded-[10px] border border-[#CBD5E1] px-3 py-2 text-[13px] leading-snug text-[#0F172A] focus:border-[#94A3B8] focus:outline-none"
          />
          {erro ? (
            <p className="mt-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] font-medium text-[#991B1B]">
              {erro}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-[#E2E8F0] px-4 py-3">
          {/* Saída de emergência: se a plataforma recusar ou faltar algo, o
              WhatsApp manual continua a um clique com o mesmo texto. */}
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9]"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Abrir no WhatsApp
            </a>
          ) : (
            <span className="text-[11.5px] font-medium text-[#94A3B8]">Sem telefone cadastrado</span>
          )}
          <button
            type="button"
            onClick={enviar}
            disabled={!podeEnviar}
            className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            {enviando ? "Enviando…" : "Enviar pela plataforma"}
          </button>
        </footer>
      </div>
    </div>
  );
}

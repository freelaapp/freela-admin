import { Fragment, type ReactNode } from "react";
import { Link2, Phone, Reply } from "lucide-react";
import type { PreviewButton } from "../_lib/marketing-template-rules";

interface Props {
  /** URL assinada da imagem do topo (prévia). */
  imageUrl?: string | null;
  /** Há imagem salva, mas sem URL de prévia: mostra o espaço dela. */
  hasImage?: boolean;
  /** Texto já com os dados de exemplo. */
  text: string;
  buttons: PreviewButton[];
}

const BOLD = /(\*[^*\n]+\*)/g;

/** `*texto*` vira negrito, como o WhatsApp mostra. */
function formatWhatsApp(text: string): ReactNode[] {
  return text
    .split(BOLD)
    .map((part, index) =>
      /^\*[^*\n]+\*$/.test(part) ? (
        <strong key={index}>{part.slice(1, -1)}</strong>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

function ButtonIcon({ type }: { type: PreviewButton["type"] }) {
  if (type === "URL") return <Link2 className="h-3.5 w-3.5" aria-hidden />;
  if (type === "PHONE") return <Phone className="h-3.5 w-3.5" aria-hidden />;
  return <Reply className="h-3.5 w-3.5" aria-hidden />;
}

/**
 * Prévia igual ao WhatsApp (spec 2026-10-01 campanhas parte 1 §8.1): balão branco no
 * fundo do WhatsApp, imagem no topo, texto e os botões embaixo, um por linha.
 */
export function WhatsAppPreview({
  imageUrl,
  hasImage = false,
  text,
  buttons,
}: Props) {
  return (
    <div
      data-testid="whatsapp-preview"
      className="rounded-lg bg-[#e5ddd5] p-3 sm:p-4"
    >
      <div
        data-testid="whatsapp-bubble"
        className="w-full max-w-[300px] rounded-lg bg-white p-1.5 text-[#111] shadow-sm"
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL S3 assinada (host dinâmico)
          <img
            src={imageUrl}
            alt="Imagem do topo"
            className="aspect-[1.91/1] w-full rounded-md object-cover"
          />
        ) : hasImage ? (
          <div className="flex aspect-[1.91/1] items-center justify-center rounded-md bg-[#f0a72b] text-sm font-bold text-[#1a1a1a]">
            Imagem do topo
          </div>
        ) : null}
        <p className="whitespace-pre-line break-words px-1 py-1.5 text-[13px] leading-snug">
          {formatWhatsApp(text)}
        </p>
        <p className="px-1 pb-1 text-right text-[11px] text-neutral-500">
          Freela Serviços · 10:42
        </p>
        {buttons.map((button, index) => (
          <div
            key={`${button.type}-${index}`}
            className="flex min-h-10 items-center justify-center gap-1.5 border-t border-neutral-200 px-2 text-[13px] text-[#0a84ff]"
          >
            <ButtonIcon type={button.type} />
            <span data-testid="preview-button">{button.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

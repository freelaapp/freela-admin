"use client";

import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { uploadCampaignTemplateImage } from "@/modules/admin/infrastructure/campaign-templates-api";

const DEFAULT_IMAGE_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];
const TYPE_LABEL: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

/** ["image/png", "image/jpeg"] → "PNG ou JPEG". */
function describeTypes(types: readonly string[]): string {
  const labels = types.map((type) => TYPE_LABEL[type] ?? type);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} ou ${labels[labels.length - 1]}`;
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface Props {
  /** `imageKey` gravado no template (o que a API persiste). */
  imageKey: string;
  /**
   * URL só para PREVIEW imediato após o upload — o backend não devolve URL
   * na listagem/detalhe do template, só na resposta do upload (24h,
   * presignada). Em modo edição, sem upload novo, fica vazia: mostramos a
   * `imageKey` salva em vez de tentar montar uma URL quebrada.
   */
  previewUrl: string;
  onChange: (next: { imageKey: string; previewUrl: string }) => void;
  disabled?: boolean;
  /** Tipos aceitos (padrão: PNG, JPEG e WebP). O modelo da Meta não aceita WebP no topo. */
  allowedTypes?: readonly string[];
  /** Texto de ajuda ao lado do botão. */
  hint?: string;
  /**
   * Nome do arquivo a enviar, pelo tipo real (ex.: image/jpeg → `x.jpg`). Garante que a
   * chave gravada sempre tenha extensão válida mesmo se o arquivo original não tiver.
   * Devolver `null` mantém o arquivo como veio.
   */
  fileNameForType?: (mime: string) => string | null;
}

/**
 * Upload de imagem do template (push/WhatsApp). Mesma UX de
 * `AdDialog` (`(auth)/propagandas/page.tsx`), mas via
 * `uploadCampaignTemplateImage` (Task 1) — grava `imageKey`, não a API de
 * propagandas. Estado de "enviando" vem do `useMutation` (React Query), sem
 * `useState` local.
 */
export function ImageUploadField({
  imageKey,
  previewUrl,
  onChange,
  disabled,
  allowedTypes = DEFAULT_IMAGE_TYPES,
  hint = "Recomendado: 1200×400px (3:1), máx 5 MB. Opcional.",
  fileNameForType,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({ mutationFn: uploadCampaignTemplateImage });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Formato inválido. Use ${describeTypes(allowedTypes)}.`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande. O máximo é 5 MB.");
      return;
    }
    try {
      const renamed = fileNameForType?.(file.type);
      const toUpload = renamed ? new File([file], renamed, { type: file.type }) : file;
      const { key, url } = await upload.mutateAsync(toUpload);
      onChange({ imageKey: key, previewUrl: url });
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao enviar a imagem."));
    }
  }

  return (
    <div className="space-y-1.5">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL S3 presignada (host dinâmico)
        <img
          src={previewUrl}
          alt="Prévia da imagem"
          className="w-full aspect-[3/1] rounded-lg object-cover border border-[#e5e5e5]"
        />
      ) : (
        <div className="w-full aspect-[3/1] rounded-lg border border-dashed border-[#e5e5e5] bg-[#f7f7f7] flex flex-col items-center justify-center gap-1 text-[#a3a3a3]">
          <ImageIcon className="w-6 h-6" />
          <span className="text-xs">
            {imageKey ? "Imagem já enviada — sem prévia (envie de novo pra trocar)" : "Nenhuma imagem enviada"}
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(",")}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || upload.isPending}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || upload.isPending}
          className="min-h-11 border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {previewUrl || imageKey ? "Trocar imagem" : "Enviar imagem"}
            </>
          )}
        </Button>
        <p className="text-xs text-[#a3a3a3]">{hint}</p>
      </div>
    </div>
  );
}

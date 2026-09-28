import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  signupOriginLabels,
  type SignupOriginTone,
} from "@/modules/admin/application/signup-origin-presentation";
import type { SignupOriginSource } from "@/modules/admin/infrastructure/admin-api";

const VARIANT: Record<SignupOriginTone, NonNullable<BadgeProps["variant"]>> = {
  indicacao: "default",
  consultor: "outline",
  parceria: "outline",
  campanha: "warning",
  utm: "outline",
  social: "muted",
  canal: "muted",
  normal: "muted",
  legado: "outline",
};

/**
 * Coluna "Origem": uma etiqueta por fonte (spec 2026-09-28 §3). Etiqueta longa
 * (nome de quem indicou, campanha/UTM sem espaço) quebra linha: nada de
 * `whitespace-nowrap`, e `wrap-anywhere` (overflow-wrap:anywhere) porque o
 * `break-words` não encolhe o min-content dentro do inline-flex do Badge.
 */
export function SignupOriginBadges({ source }: { source: SignupOriginSource }) {
  const labels = signupOriginLabels(source);
  if (labels.length === 1 && labels[0].key === "vazio") {
    return <span className="text-xs text-[#a3a3a3]">{labels[0].text}</span>;
  }
  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-1">
      {labels.map((label) => (
        <Badge
          key={label.key}
          data-signup-origin={label.key}
          variant={VARIANT[label.tone]}
          title={label.title}
          className="max-w-full font-medium wrap-anywhere"
        >
          {label.text}
        </Badge>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSaveVipMessageTemplate, useVipMessageTemplates } from "@/modules/admin/application/use-freela-vip";
import { formatDate, VIP_MOMENT_LABELS } from "@/modules/admin/application/freela-vip-presentation";

export function TemplatesTab() {
  const { data: templates = [], isLoading } = useVipMessageTemplates();
  const save = useSaveVipMessageTemplate();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (isLoading) return <div className="py-8 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[#64748B]">Cada momento aceita só as variáveis listadas (entre chaves). Uma variável desconhecida é recusada pelo servidor.</p>
      {templates.map((t) => {
        const value = drafts[t.moment] ?? t.text;
        const dirty = value !== t.text;
        return (
          <section key={t.moment} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold">{VIP_MOMENT_LABELS[t.moment] ?? t.moment}</h3>
              <Badge variant="secondary">{t.isOverride ? `personalizada v${t.version ?? "?"}` : "padrão"}</Badge>
              <span className="text-[12px] text-[#64748B]">variáveis: {t.variables.map((v) => `{${v}}`).join(" ")}{t.updatedAt ? ` · ${formatDate(t.updatedAt)}` : ""}</span>
            </div>
            <textarea aria-label={`Mensagem — ${VIP_MOMENT_LABELS[t.moment] ?? t.moment}`} className="min-h-[96px] w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm" maxLength={4000} value={value} onChange={(e) => setDrafts({ ...drafts, [t.moment]: e.target.value })} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={!dirty || !value.trim() || save.isPending} onClick={() => save.mutate({ moment: t.moment, text: value }, { onSuccess: () => setDrafts((prev) => { const next = { ...prev }; delete next[t.moment]; return next; }) })}>Salvar</Button>
              <Button size="sm" variant="outline" disabled={!dirty} onClick={() => setDrafts((prev) => { const next = { ...prev }; delete next[t.moment]; return next; })}>Desfazer</Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Video, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useTrainingVideos,
  useTrainingVideoMutations,
} from "@/modules/admin/application/use-admin-training-videos";
import type {
  TrainingVideo,
  TrainingVideoAudience,
} from "@/modules/admin/infrastructure/training-videos-api";

const AUDIENCE_LABEL: Record<TrainingVideoAudience, string> = {
  FREELANCER: "Freelancer",
  CONTRACTOR: "Contratante",
  BOTH: "Ambos",
};

/** Vídeos de treinamento (links YouTube/Vimeo) exibidos no web e no app. CRUD via /admin/training-videos. */
export default function TreinamentosPage() {
  const { data: videos = [], isLoading } = useTrainingVideos();
  const [editing, setEditing] = useState<TrainingVideo | "new" | null>(null);

  const stats = useMemo(() => {
    const active = videos.filter((v) => v.active).length;
    return { total: videos.length, active, inactive: videos.length - active };
  }, [videos]);

  return (
    <div>
      <PageHeader
        title="Treinamentos"
        description="Vídeos de treinamento (links YouTube/Vimeo) para freelancers e contratantes."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4 mr-1" /> Novo vídeo
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando vídeos...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Video className="w-4 h-4" />} label="Vídeos" value={stats.total} />
            <StatCard
              icon={<Eye className="w-4 h-4 text-success" />}
              label="Ativos"
              value={stats.active}
            />
            <StatCard
              icon={<EyeOff className="w-4 h-4 text-muted-foreground" />}
              label="Inativos"
              value={stats.inactive}
            />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Ordem</th>
                  <th className="text-left font-medium py-3 px-4">Título</th>
                  <th className="text-left font-medium py-3 px-4">Categoria</th>
                  <th className="text-left font-medium py-3 px-4">Público</th>
                  <th className="text-left font-medium py-3 px-4">Vídeo</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-muted-foreground">{v.displayOrder}</td>
                    <td className="py-3 px-4 font-medium text-foreground">{v.title}</td>
                    <td className="py-3 px-4 text-muted-foreground">{v.category}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{AUDIENCE_LABEL[v.targetAudience]}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={v.externalVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {v.externalProvider ?? "Link"}
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      {v.active ? (
                        <Badge variant="outline" className="text-success border-success/30">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          onClick={() => setEditing(v)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <DeleteButton id={v.id} />
                      </div>
                    </td>
                  </tr>
                ))}
                {videos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum vídeo de treinamento ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <VideoDialog
          video={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const { remove } = useTrainingVideoMutations();
  return (
    <Button
      size="icon"
      variant="ghost"
      title="Remover vídeo"
      disabled={remove.isPending}
      onClick={() => {
        if (confirm("Remover este vídeo de treinamento?")) remove.mutate(id);
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

function VideoDialog({ video, onClose }: { video: TrainingVideo | null; onClose: () => void }) {
  const { create, update } = useTrainingVideoMutations();
  const isEdit = video !== null;

  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [category, setCategory] = useState(video?.category ?? "");
  const [targetAudience, setTargetAudience] = useState<TrainingVideoAudience>(
    video?.targetAudience ?? "BOTH",
  );
  const [externalVideoUrl, setExternalVideoUrl] = useState(video?.externalVideoUrl ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(video?.displayOrder ?? 0));
  const [active, setActive] = useState(video?.active ?? true);

  const isUrl = /^https?:\/\/.+/i.test(externalVideoUrl.trim());
  const canSave =
    title.trim().length > 0 && category.trim().length > 0 && isUrl;

  const pending = create.isPending || update.isPending;

  async function save() {
    const dto = {
      title: title.trim(),
      // "" limpa a descrição no backend; undefined significaria "não mexer"
      // e apagar o texto + salvar era silenciosamente ignorado.
      description: description.trim(),
      category: category.trim(),
      targetAudience,
      externalVideoUrl: externalVideoUrl.trim(),
      displayOrder: Number(displayOrder) || 0,
      active,
    };
    if (isEdit && video) {
      await update.mutateAsync({ id: video.id, dto });
    } else {
      await create.mutateAsync(dto);
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar vídeo" : "Novo vídeo"}</DialogTitle>
          <DialogDescription>
            Cole o link do YouTube ou Vimeo. O público define quem vê o vídeo no app e no site.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Título">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Como aceitar uma vaga"
            />
          </Field>
          <Field label="Descrição (opcional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do conteúdo"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Primeiros passos"
              />
            </Field>
            <Field label="Público">
              <NativeSelect
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as TrainingVideoAudience)}
              >
                <option value="BOTH">Ambos</option>
                <option value="FREELANCER">Freelancer</option>
                <option value="CONTRACTOR">Contratante</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Link do vídeo (YouTube/Vimeo)">
            <Input
              value={externalVideoUrl}
              onChange={(e) => setExternalVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Ordem de exibição">
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between pb-1">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave || pending}>
            {pending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar vídeo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  Power,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/modules/auth/application/use-auth";
import {
  useAdminAds,
  useAdminAdMutations,
} from "@/modules/admin/application/use-admin-ads";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  uploadAdImage,
  type AdAudience,
  type AdvertisementItem,
  type CreateAdPayload,
} from "@/modules/admin/infrastructure/ads-api";
import { formatInstantDate } from "@/lib/date.utils";

const AUDIENCE_LABEL: Record<AdAudience, string> = {
  FREELANCER: "Freelancer",
  CONTRACTOR: "Contratante",
  BOTH: "Ambos",
};

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Brasília é UTC-3 fixo (sem horário de verão desde 2019). */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

type AdStatus = "ATIVO" | "PAUSADO" | "AGENDADO" | "ENCERRADO";

const STATUS_CONFIG: Record<AdStatus, { label: string; className: string }> = {
  ATIVO: { label: "Ativo", className: "bg-green-100 text-green-700" },
  PAUSADO: { label: "Pausado", className: "bg-[#f1f1f1] text-[#737373]" },
  AGENDADO: { label: "Agendado", className: "bg-blue-100 text-blue-700" },
  ENCERRADO: { label: "Encerrado", className: "bg-amber-100 text-amber-700" },
};

function getAdStatus(ad: AdvertisementItem, now: Date): AdStatus {
  if (!ad.active) return "PAUSADO";
  if (ad.startsAt && new Date(ad.startsAt) > now) return "AGENDADO";
  if (ad.endsAt && new Date(ad.endsAt) < now) return "ENCERRADO";
  return "ATIVO";
}

function formatCtr(clicks: number, views: number): string {
  if (!views) return "—";
  const pct = (clicks / views) * 100;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatPeriod(ad: AdvertisementItem): string {
  if (!ad.startsAt && !ad.endsAt) return "—";
  const start = ad.startsAt ? formatInstantDate(ad.startsAt) : null;
  const end = ad.endsAt ? formatInstantDate(ad.endsAt) : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `a partir de ${start}`;
  return `até ${end}`;
}

/** ISO (UTC) → valor de `<input type="date">` no fuso -03:00 (Brasília). */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Date(date.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Propagandas (Ads v1) — CRUD + métricas de anúncios exibidos no web e no app. */
export default function PropagandasPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: ads = [], isLoading, isError } = useAdminAds();
  const { update, remove } = useAdminAdMutations();

  const [editing, setEditing] = useState<AdvertisementItem | "new" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isHydrated, isSuperAdmin, router]);

  const stats = useMemo(() => {
    const now = new Date();
    const running = ads.filter((ad) => getAdStatus(ad, now) === "ATIVO").length;
    const views = ads.reduce((sum, ad) => sum + ad.viewsCount, 0);
    const clicks = ads.reduce((sum, ad) => sum + ad.clicksCount, 0);
    return { running, views, clicks };
  }, [ads]);

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  async function toggleActive(ad: AdvertisementItem) {
    setTogglingId(ad.id);
    try {
      await update.mutateAsync({ id: ad.id, payload: { active: !ad.active } });
    } catch {
      // toast de erro já exibido pelo hook
    } finally {
      setTogglingId(null);
    }
  }

  function handleDelete(ad: AdvertisementItem) {
    if (confirm(`Excluir o anúncio "${ad.title}"? Essa ação não pode ser desfeita.`)) {
      remove.mutate(ad.id);
    }
  }

  const columns = [
    {
      header: "Banner",
      accessor: (row: AdvertisementItem) => <AdThumbnail ad={row} />,
    },
    {
      header: "Título",
      accessor: (row: AdvertisementItem) => (
        <span className="font-medium text-[#1d1d1b]">{row.title}</span>
      ),
    },
    {
      header: "Público",
      accessor: (row: AdvertisementItem) => (
        <Badge variant="outline">{AUDIENCE_LABEL[row.audience]}</Badge>
      ),
    },
    {
      header: "Período",
      accessor: (row: AdvertisementItem) => (
        <span className="text-[#737373] whitespace-nowrap">{formatPeriod(row)}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Status",
      accessor: (row: AdvertisementItem) => <AdStatusBadge ad={row} />,
    },
    {
      header: "Views",
      accessor: (row: AdvertisementItem) => row.viewsCount.toLocaleString("pt-BR"),
      sortAccessor: (row: AdvertisementItem) => row.viewsCount,
      sortable: true,
    },
    {
      header: "Cliques",
      accessor: (row: AdvertisementItem) => row.clicksCount.toLocaleString("pt-BR"),
      sortAccessor: (row: AdvertisementItem) => row.clicksCount,
      sortable: true,
    },
    {
      header: "CTR",
      accessor: (row: AdvertisementItem) => formatCtr(row.clicksCount, row.viewsCount),
    },
    {
      header: "Ações",
      accessor: (row: AdvertisementItem) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(row)}
            title="Editar anúncio"
            className="text-[#737373] hover:text-[#1d1d1b]"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleActive(row)}
            disabled={togglingId === row.id}
            title={row.active ? "Pausar" : "Ativar"}
            className={
              row.active
                ? "text-red-500 hover:text-red-600"
                : "text-green-600 hover:text-green-700"
            }
          >
            {togglingId === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row)}
            disabled={remove.isPending}
            title="Excluir anúncio"
            className="text-[#737373] hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Propagandas"
        description="Anúncios exibidos no carrossel do site e no app (freelancers e contratantes)."
        action={
          <Button
            onClick={() => setEditing("new")}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo anúncio
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar propagandas.</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <Megaphone className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhum anúncio cadastrado ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre o primeiro anúncio para exibi-lo no site e no app.
          </p>
          <Button
            onClick={() => setEditing("new")}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo anúncio
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Anúncios ativos"
              value={String(stats.running)}
              icon={Megaphone}
              meta={`de ${ads.length} cadastrados`}
            />
            <KpiCard
              title="Views totais"
              value={stats.views.toLocaleString("pt-BR")}
              icon={Eye}
            />
            <KpiCard
              title="Cliques totais"
              value={stats.clicks.toLocaleString("pt-BR")}
              icon={MousePointerClick}
            />
            <KpiCard
              title="CTR médio"
              value={formatCtr(stats.clicks, stats.views)}
              icon={Percent}
            />
          </div>

          <DataTable
            columns={columns}
            data={ads}
            searchPlaceholder="Buscar por título..."
            searchKey="title"
          />
        </div>
      )}

      {editing && (
        <AdDialog
          ad={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AdThumbnail({ ad }: { ad: AdvertisementItem }) {
  if (!ad.imageUrl) {
    return (
      <div className="h-10 w-[120px] rounded bg-[#f1f1f1] flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-[#a3a3a3]" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL S3 presignada (host dinâmico)
    <img
      src={ad.imageUrl}
      alt={ad.title}
      className="h-10 w-[120px] rounded object-cover bg-[#f1f1f1]"
    />
  );
}

function AdStatusBadge({ ad }: { ad: AdvertisementItem }) {
  const { label, className } = STATUS_CONFIG[getAdStatus(ad, new Date())];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function AdDialog({
  ad,
  onClose,
}: {
  ad: AdvertisementItem | null;
  onClose: () => void;
}) {
  const { create, update } = useAdminAdMutations();
  const isEdit = ad !== null;

  const [title, setTitle] = useState(ad?.title ?? "");
  const [targetUrl, setTargetUrl] = useState(ad?.targetUrl ?? "");
  const [audience, setAudience] = useState<AdAudience>(ad?.audience ?? "BOTH");
  const [startDate, setStartDate] = useState(isoToDateInput(ad?.startsAt));
  const [endDate, setEndDate] = useState(isoToDateInput(ad?.endsAt));
  const [displayOrder, setDisplayOrder] = useState(String(ad?.displayOrder ?? 0));
  const [active, setActive] = useState(ad?.active ?? true);
  const [imageKey, setImageKey] = useState(ad?.imageKey ?? "");
  const [previewUrl, setPreviewUrl] = useState(ad?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pending = create.isPending || update.isPending;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande. O máximo é 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const { key, url } = await uploadAdImage(file);
      setImageKey(key);
      setPreviewUrl(url);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao enviar a imagem."));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedUrl = targetUrl.trim();
    if (!trimmedTitle) {
      toast.error("Informe o título do anúncio.");
      return;
    }
    if (!imageKey) {
      toast.error("Envie a imagem do banner.");
      return;
    }
    if (trimmedUrl && !trimmedUrl.startsWith("https://")) {
      toast.error("O link de destino deve começar com https://");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      toast.error("Data final deve ser depois da inicial.");
      return;
    }

    // Convenção Brasília (spec §2.3): início do dia / fim do dia em -03:00.
    const startsAt = startDate ? `${startDate}T00:00:00-03:00` : null;
    const endsAt = endDate ? `${endDate}T23:59:59-03:00` : null;
    const order = Number(displayOrder) || 0;

    try {
      if (isEdit && ad) {
        await update.mutateAsync({
          id: ad.id,
          payload: {
            title: trimmedTitle,
            imageKey,
            targetUrl: trimmedUrl || null,
            audience,
            displayOrder: order,
            active,
            startsAt,
            endsAt,
          },
        });
      } else {
        const payload: CreateAdPayload = {
          title: trimmedTitle,
          imageKey,
          audience,
          displayOrder: order,
          active,
          ...(trimmedUrl ? { targetUrl: trimmedUrl } : {}),
          ...(startsAt ? { startsAt } : {}),
          ...(endsAt ? { endsAt } : {}),
        };
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      // toast de erro já exibido pelo hook
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
          <DialogDescription>
            O banner aparece no carrossel do site e do app para o público
            selecionado. Sem período definido, o anúncio fica no ar enquanto
            estiver ativo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Banner</Label>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL S3 presignada (host dinâmico)
              <img
                src={previewUrl}
                alt="Prévia do banner"
                className="w-full aspect-[3/1] rounded-lg object-cover border border-[#e5e5e5]"
              />
            ) : (
              <div className="w-full aspect-[3/1] rounded-lg border border-dashed border-[#e5e5e5] bg-[#f7f7f7] flex flex-col items-center justify-center gap-1 text-[#a3a3a3]">
                <ImageIcon className="w-6 h-6" />
                <span className="text-xs">Nenhuma imagem enviada</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {previewUrl ? "Trocar imagem" : "Enviar imagem"}
                  </>
                )}
              </Button>
              <p className="text-xs text-[#a3a3a3]">
                Recomendado: 1200×400px (3:1), máx 5 MB.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-title">Título</Label>
            <Input
              id="ad-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Parceiro Colibri — 20% off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-target-url">Link de destino (opcional)</Label>
            <Input
              id="ad-target-url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://parceiro.com.br/promo"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ad-audience">Público</Label>
            <NativeSelect
              id="ad-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as AdAudience)}
            >
              <option value="BOTH">Ambos</option>
              <option value="FREELANCER">Freelancer</option>
              <option value="CONTRACTOR">Contratante</option>
            </NativeSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ad-starts-at">Início (opcional)</Label>
              <Input
                id="ad-starts-at"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-ends-at">Fim (opcional)</Label>
              <Input
                id="ad-ends-at"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ad-order">Ordem de exibição</Label>
              <Input
                id="ad-order"
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between pb-1">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || uploading}
              className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
            >
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Criar anúncio"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

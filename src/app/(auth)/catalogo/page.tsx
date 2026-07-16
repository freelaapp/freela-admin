"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Clock, Layers, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
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
  useCatalogCategories,
  useCatalogRoles,
  useCatalogMutations,
} from "@/modules/admin/application/use-admin-catalog";
import {
  BONUS_LABEL,
  MODULE_LABEL,
  PRICING_LABEL,
  type CategoryRole,
  type CategoryRoleTier,
  type PricingModel,
  type ServiceCategory,
  type ServiceModule,
  type ServiceRole,
} from "@/modules/admin/infrastructure/catalog-api";
import { Field, RoleDialog, slugify } from "./role-dialog";

// ── helpers de dinheiro (centavos ↔ reais) ──────────────────
const toReais = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
// Aceita pt-BR ("1.200,00") E ponto decimal ("1200.00"). O parser antigo só
// trocava vírgula por ponto: "1.200,00" virava parseFloat("1.200.00") = 1.2.
const toCents = (reais: string) => {
  const trimmed = reais.trim();
  if (!trimmed) return 0;
  let normalized = trimmed;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    const dots = trimmed.match(/\./g)?.length ?? 0;
    const afterLastDot = trimmed.split(".").pop() ?? "";
    if (dots > 1 || (dots === 1 && afterLastDot.length === 3)) {
      normalized = trimmed.replace(/\./g, "");
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
const brl = (cents: number) => `R$ ${toReais(cents)}`;

const MODULES: ServiceModule[] = ["bars-restaurants", "home-services"];

export default function CatalogoPage() {
  const { data: categories = [], isLoading: loadingCats } = useCatalogCategories();
  const { data: roles = [], isLoading: loadingRoles } = useCatalogRoles();

  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: ServiceCategory }>({ open: false });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: ServiceRole }>({ open: false });
  const [priceDialog, setPriceDialog] = useState<{
    open: boolean;
    category?: ServiceCategory;
    categoryRole?: CategoryRole;
  }>({ open: false });

  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();

  const byModule = useMemo(() => {
    const matchesQuery = (cat: ServiceCategory) =>
      !q ||
      cat.name.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q) ||
      cat.roles.some((cr) => cr.role.name.toLowerCase().includes(q));

    const map: Record<ServiceModule, ServiceCategory[]> = {
      "bars-restaurants": [],
      "home-services": [],
    };
    for (const c of categories) {
      if (!matchesQuery(c)) continue;
      (map[c.module] ?? (map[c.module] = [])).push(c);
    }
    return map;
  }, [categories, q]);

  const stats = useMemo(
    () => ({
      categories: categories.length,
      roles: roles.length,
      priced: categories.reduce((n, c) => n + c.roles.length, 0),
    }),
    [categories, roles],
  );

  // Durante a busca, abre automaticamente as categorias que casam; fora dela,
  // o usuário controla a expansão.
  const isOpen = (id: string) => (q ? true : openItems.has(id));
  const toggle = (id: string) =>
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Catálogo de Serviços"
        description="Gerencie categorias, funções (com tipo de bônus) e preços (por hora ou por faixa)."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRoleDialog({ open: true })}>
              <Plus className="w-4 h-4 mr-1" /> Nova função
            </Button>
            <Button onClick={() => setCatDialog({ open: true })}>
              <Plus className="w-4 h-4 mr-1" /> Nova categoria
            </Button>
          </div>
        }
      />

      {loadingCats || loadingRoles ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando catálogo...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Categorias</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{stats.categories}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Funções</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{stats.roles}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Precificações</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{stats.priced}</div>
            </div>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria ou função..."
            className="max-w-sm"
          />

          <div className="space-y-8">
            {MODULES.map((mod) => (
              <section key={mod}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {MODULE_LABEL[mod]}
                </h2>
                {(byModule[mod] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl p-4">
                    Nenhuma categoria neste módulo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {byModule[mod].map((cat) => (
                      <div key={cat.id} className="bg-card border border-border rounded-xl px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggle(cat.id)}
                            className="flex-1 flex items-center justify-between py-3 text-left"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{cat.icon ?? "📁"}</span>
                                <span className="font-medium text-foreground">{cat.name}</span>
                                <span className="text-xs text-muted-foreground">/{cat.slug}</span>
                                {!cat.active && <Badge variant="secondary">inativa</Badge>}
                                <Badge variant="outline">{cat.roles.length} funções</Badge>
                              </div>
                              {cat.roles.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {cat.roles.slice(0, 5).map((cr) => (
                                    <span
                                      key={cr.id}
                                      className="text-xs text-muted-foreground bg-accent rounded px-1.5 py-0.5"
                                    >
                                      {cr.role.icon ? `${cr.role.icon} ` : ""}
                                      {cr.role.name}
                                    </span>
                                  ))}
                                  {cat.roles.length > 5 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{cat.roles.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isOpen(cat.id) ? "rotate-180" : ""}`}
                            />
                          </button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setCatDialog({ open: true, category: cat })}
                            title="Editar categoria"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                        {isOpen(cat.id) && (
                          <div className="pb-3">
                            <div className="flex justify-end mb-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPriceDialog({ open: true, category: cat })}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar função à categoria
                              </Button>
                            </div>
                            {cat.roles.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-3">
                                Nenhuma função precificada aqui ainda.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border text-muted-foreground">
                                      <th className="text-left font-medium py-2 px-2">Função</th>
                                      <th className="text-left font-medium py-2 px-2">Pagamento</th>
                                      <th className="text-left font-medium py-2 px-2">Preço</th>
                                      <th className="text-left font-medium py-2 px-2">Bônus</th>
                                      <th className="text-left font-medium py-2 px-2">Diurno</th>
                                      <th className="text-right font-medium py-2 px-2">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cat.roles.map((cr) => (
                                      <tr key={cr.id} className="border-b border-border/60 last:border-0">
                                        <td className="py-2 px-2">
                                          <span className="font-medium text-foreground">{cr.role.name}</span>
                                          {!cr.active && (
                                            <Badge variant="secondary" className="ml-2">
                                              inativa
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <span className="inline-flex items-center gap-1">
                                            {cr.pricingModel === "TIERED" ? (
                                              <Layers className="w-3.5 h-3.5" />
                                            ) : (
                                              <Clock className="w-3.5 h-3.5" />
                                            )}
                                            {PRICING_LABEL[cr.pricingModel]}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2">
                                          {cr.pricingModel === "TIERED" ? (
                                            <span className="text-muted-foreground">
                                              {cr.tiers.length} faixa(s)
                                              {cr.tiers[0] ? ` · ${brl(cr.tiers[0].totalInCents)}…` : ""}
                                            </span>
                                          ) : (
                                            <span>
                                              {brl(cr.hourlyRateInCents)}/h · mín {cr.minimumJourneyHours}h
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-2">
                                          <Badge variant="outline">{BONUS_LABEL[cr.role.bonusModel]}</Badge>
                                        </td>
                                        <td className="py-2 px-2">{cr.isDaytimeOnly ? "Sim" : "—"}</td>
                                        <td className="py-2 px-2 text-right whitespace-nowrap">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            title="Editar função"
                                            onClick={() => setRoleDialog({ open: true, role: cr.role })}
                                          >
                                            <Tag className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            title="Editar preço"
                                            onClick={() =>
                                              setPriceDialog({ open: true, category: cat, categoryRole: cr })
                                            }
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {catDialog.open && (
        <CategoryDialog category={catDialog.category} onClose={() => setCatDialog({ open: false })} />
      )}
      {roleDialog.open && (
        <RoleDialog role={roleDialog.role} onClose={() => setRoleDialog({ open: false })} />
      )}
      {priceDialog.open && priceDialog.category && (
        <PriceDialog
          category={priceDialog.category}
          categoryRole={priceDialog.categoryRole}
          roles={roles}
          onClose={() => setPriceDialog({ open: false })}
        />
      )}
    </div>
  );
}

// ── Dialog: Categoria ───────────────────────────────────────
function CategoryDialog({ category, onClose }: { category?: ServiceCategory; onClose: () => void }) {
  const { createCategory, updateCategory, deactivateCategory } = useCatalogMutations();
  const editing = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [module, setModule] = useState<ServiceModule>(category?.module ?? "bars-restaurants");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(category?.displayOrder ?? 0));
  const busy = createCategory.isPending || updateCategory.isPending;

  async function save() {
    if (editing && category) {
      await updateCategory.mutateAsync({
        id: category.id,
        dto: { name, module, icon: icon || undefined, displayOrder: Number(displayOrder) || 0 },
      });
    } else {
      await createCategory.mutateAsync({
        slug: slug || slugify(name),
        name,
        module,
        icon: icon || undefined,
        displayOrder: Number(displayOrder) || 0,
      });
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>Agrupa funções e seus preços por módulo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editing) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          {!editing && (
            <Field label="Slug (kebab-case)">
              <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </Field>
          )}
          <Field label="Módulo">
            <NativeSelect
              value={module}
              onChange={(e) => setModule(e.target.value as ServiceModule)}
              disabled={editing}
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABEL[m]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone (emoji)">
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🍽️" />
            </Field>
            <Field label="Ordem">
              <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {editing && category?.active && (
            <Button
              variant="destructive"
              type="button"
              onClick={async () => {
                await deactivateCategory.mutateAsync(category.id);
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Desativar
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy || !name}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dialog: Preço (category-role) ───────────────────────────
function PriceDialog({
  category,
  categoryRole,
  roles,
  onClose,
}: {
  category: ServiceCategory;
  categoryRole?: CategoryRole;
  roles: ServiceRole[];
  onClose: () => void;
}) {
  const { setCategoryRole, removeCategoryRole } = useCatalogMutations();
  const editing = Boolean(categoryRole);

  const usedRoleIds = new Set(category.roles.map((r) => r.roleId));
  const availableRoles = roles.filter((r) => r.active && !usedRoleIds.has(r.id));

  const [roleId, setRoleId] = useState(categoryRole?.roleId ?? availableRoles[0]?.id ?? "");
  const [pricingModel, setPricingModel] = useState<PricingModel>(categoryRole?.pricingModel ?? "HOURLY");
  const [hourly, setHourly] = useState(toReais(categoryRole?.hourlyRateInCents ?? 0));
  const [minHours, setMinHours] = useState(String(categoryRole?.minimumJourneyHours ?? 4));
  const [daytime, setDaytime] = useState(categoryRole?.isDaytimeOnly ?? false);
  const [tierLabel, setTierLabel] = useState(categoryRole?.tierQualifierLabel ?? "");
  // priceText fica livre enquanto digita (o valor era re-formatado a cada
  // tecla — "50" virava "5,00" no segundo dígito); converte só no salvar.
  const [tiers, setTiers] = useState<(CategoryRoleTier & { priceText: string })[]>(
    categoryRole?.tiers?.length
      ? categoryRole.tiers.map((t) => ({ ...t, priceText: toReais(t.totalInCents) }))
      : [{ label: "", totalInCents: 0, priceText: "" }],
  );

  const busy = setCategoryRole.isPending || removeCategoryRole.isPending;
  const canSave =
    roleId &&
    (pricingModel === "HOURLY" ? Number(minHours) >= 1 : tiers.some((t) => t.label.trim()));

  async function save() {
    await setCategoryRole.mutateAsync({
      categoryId: category.id,
      roleId,
      dto: {
        hourlyRateInCents: toCents(hourly),
        minimumJourneyHours: Number(minHours) || 1,
        isDaytimeOnly: daytime,
        pricingModel,
        tierQualifierLabel: pricingModel === "TIERED" ? tierLabel || null : null,
        tiers:
          pricingModel === "TIERED"
            ? tiers
                .filter((t) => t.label.trim())
                .map((t, i) => ({ label: t.label.trim(), totalInCents: toCents(t.priceText), displayOrder: i }))
            : [],
      },
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Preço — ${categoryRole?.role.name}` : "Adicionar função à categoria"}
          </DialogTitle>
          <DialogDescription>Categoria: {category.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!editing && (
            <Field label="Função">
              {availableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todas as funções ativas já estão nesta categoria. Crie uma nova função.
                </p>
              ) : (
                <NativeSelect value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          )}

          <Field label="Modelo de pagamento">
            <NativeSelect
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as PricingModel)}
            >
              <option value="HOURLY">{PRICING_LABEL.HOURLY}</option>
              <option value="TIERED">{PRICING_LABEL.TIERED}</option>
            </NativeSelect>
          </Field>

          {pricingModel === "HOURLY" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor por hora (R$)">
                <Input value={hourly} onChange={(e) => setHourly(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Jornada mínima (h)">
                <Input type="number" value={minHours} onChange={(e) => setMinHours(e.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="space-y-2">
              <Field label="Rótulo do qualificador">
                <Input
                  value={tierLabel}
                  onChange={(e) => setTierLabel(e.target.value)}
                  placeholder="Ex.: Tamanho do imóvel"
                />
              </Field>
              <Label className="text-xs text-muted-foreground">Faixas</Label>
              {tiers.map((t, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    placeholder="Rótulo (ex.: Pequeno)"
                    value={t.label}
                    onChange={(e) =>
                      setTiers((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      className="pl-7"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={t.priceText}
                      onChange={(e) =>
                        setTiers((p) =>
                          p.map((x, j) => (j === i ? { ...x, priceText: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setTiers((p) => p.filter((_, j) => j !== i))}
                    title="Remover faixa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTiers((p) => [...p, { label: "", totalInCents: 0, priceText: "" }])}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar faixa
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Label>Somente diurno</Label>
            <Switch checked={daytime} onCheckedChange={setDaytime} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing && categoryRole && (
            <Button
              variant="destructive"
              type="button"
              onClick={async () => {
                await removeCategoryRole.mutateAsync({
                  categoryId: category.id,
                  roleId: categoryRole.roleId,
                });
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Remover da categoria
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy || !canSave}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

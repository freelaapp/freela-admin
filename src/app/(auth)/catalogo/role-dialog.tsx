"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogMutations } from "@/modules/admin/application/use-admin-catalog";
import {
  BONUS_LABEL,
  type BonusModel,
  type ServiceRole,
} from "@/modules/admin/infrastructure/catalog-api";

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Diálogo de criar/editar uma Função (ServiceRole). A função é compartilhada
 * entre categorias; o tipo de bônus (gorjeta/avaliação) vive aqui.
 */
export function RoleDialog({ role, onClose }: { role?: ServiceRole; onClose: () => void }) {
  const { createRole, updateRole } = useCatalogMutations();
  const editing = Boolean(role);
  const [name, setName] = useState(role?.name ?? "");
  const [slug, setSlug] = useState(role?.slug ?? "");
  const [icon, setIcon] = useState(role?.icon ?? "");
  const [aliases, setAliases] = useState((role?.aliases ?? []).join(", "));
  const [bonusModel, setBonusModel] = useState<BonusModel>(role?.bonusModel ?? "TIP");
  const [active, setActive] = useState(role?.active ?? true);
  const busy = createRole.isPending || updateRole.isPending;

  const aliasArr = () => aliases.split(",").map((a) => a.trim()).filter(Boolean);

  async function save() {
    if (editing && role) {
      await updateRole.mutateAsync({
        id: role.id,
        dto: { name, icon: icon || undefined, aliases: aliasArr(), bonusModel, active },
      });
    } else {
      await createRole.mutateAsync({
        slug: slug || slugify(name),
        name,
        icon: icon || undefined,
        aliases: aliasArr(),
        bonusModel,
      });
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar função" : "Nova função"}</DialogTitle>
          <DialogDescription>
            A função é reutilizável entre categorias. O tipo de bônus vive aqui.
          </DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone (emoji)">
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🍷" />
            </Field>
            <Field label="Tipo de bônus">
              <NativeSelect
                value={bonusModel}
                onChange={(e) => setBonusModel(e.target.value as BonusModel)}
              >
                <option value="TIP">{BONUS_LABEL.TIP}</option>
                <option value="EVALUATION">{BONUS_LABEL.EVALUATION}</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Aliases (separados por vírgula)">
            <Input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="waiter, garconete"
            />
          </Field>
          {editing && (
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || !name}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

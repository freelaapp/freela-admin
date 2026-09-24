"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useAdminGroups,
  useGroupSettings,
  useRefreshAdminGroups,
} from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useVipGroups } from "@/modules/admin/application/use-vip-groups";
import { buildApplyTargets, parseGroupsTab } from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupView } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import { AddMembersDialog } from "./_components/add-members-dialog";
import { CityGroupsTab } from "./_components/city-groups-tab";
import { CreateCityGroupDialog } from "./_components/create-city-group-dialog";
import { DedicatedGroupsTab } from "./_components/dedicated-groups-tab";
import { DefaultPhonesCard } from "./_components/default-phones-card";
import { DeleteGroupDialog } from "./_components/delete-group-dialog";
import { DirectoryStatusBanner } from "./_components/directory-status-banner";
import { VipGroupsTab } from "./_components/vip-groups-tab";

function Spinner() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
    </div>
  );
}

export default function GruposWhatsappPage() {
  const { isChecking, allowed } = useAreaGuard("WHATSAPP_GROUPS");
  if (isChecking || !allowed) return <Spinner />;
  // A aba fica na URL (?aba=): useSearchParams pede um Suspense acima no App Router.
  return (
    <Suspense fallback={<Spinner />}>
      <GruposWhatsappScreen />
    </Suspense>
  );
}

function GruposWhatsappScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseGroupsTab(searchParams.get("aba"));
  const setTab = (next: string) => router.replace(`${pathname}?aba=${parseGroupsTab(next)}`, { scroll: false });

  const groupsQuery = useAdminGroups();
  const settingsQuery = useGroupSettings();
  const vipQuery = useVipGroups("");
  const refresh = useRefreshAdminGroups();

  const [createOpen, setCreateOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ groupJid: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminGroupView | null>(null);

  const defaultPhones = settingsQuery.data?.defaultPhones ?? [];
  // Enquanto carrega ou depois de um erro, `defaultPhones` acima é só o fallback `[]` —
  // NUNCA uma lista vazia confirmada. Quem edita/aplica precisa saber a diferença.
  const settingsUnready = settingsQuery.isLoading || settingsQuery.isError || !settingsQuery.data;
  const groups = useMemo(() => groupsQuery.data?.groups ?? [], [groupsQuery.data]);
  const vipStores = useMemo(() => vipQuery.data ?? [], [vipQuery.data]);
  const targets = useMemo(() => buildApplyTargets(groups, vipStores), [groups, vipStores]);

  const openAdd = (g: AdminGroupView) => {
    if (g.groupJid) setAddTarget({ groupJid: g.groupJid, name: g.name });
  };
  const onRefresh = () =>
    refresh.mutate(undefined, {
      onError: (err) => toast.error(getAxiosErrorMessage(err, "Não foi possível atualizar agora.")),
    });

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        title="Grupos WhatsApp"
        description='Grupos criados pelo painel. A vaga vai para o grupo "Vagas Freela <Cidade> <UF>" da cidade do contratante; excluir tira o bot do grupo.'
        action={
          <Button onClick={() => setCreateOpen(true)} className="bg-[#eca826] text-white hover:bg-[#d8961f]">
            <Plus className="mr-1 h-4 w-4" /> Criar grupo
          </Button>
        }
      />

      <DefaultPhonesCard
        defaultPhones={defaultPhones}
        isLoading={settingsQuery.isLoading}
        isError={settingsQuery.isError}
        unready={settingsUnready}
        onRetry={() => settingsQuery.refetch()}
        targets={targets}
      />

      {groupsQuery.isLoading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#eca826]" />
        </div>
      ) : groupsQuery.isError || !groupsQuery.data ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
        >
          <span className="flex-1">Não foi possível carregar os grupos.</span>
          <Button size="sm" variant="outline" onClick={() => groupsQuery.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <DirectoryStatusBanner list={groupsQuery.data} onRefresh={onRefresh} refreshing={refresh.isPending} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="cidades">Cidades</TabsTrigger>
              <TabsTrigger value="dedicados">Dedicados</TabsTrigger>
              <TabsTrigger value="vip">VIP</TabsTrigger>
            </TabsList>
            <TabsContent value="cidades">
              <CityGroupsTab groups={groups} onAddMembers={openAdd} onDelete={setDeleteTarget} />
            </TabsContent>
            <TabsContent value="dedicados">
              <DedicatedGroupsTab
                groups={groups}
                defaultPhones={defaultPhones}
                onAddMembers={openAdd}
                onDelete={setDeleteTarget}
              />
            </TabsContent>
            <TabsContent value="vip">
              <VipGroupsTab
                stores={vipStores}
                isLoading={vipQuery.isLoading}
                isError={vipQuery.isError}
                onRetry={() => vipQuery.refetch()}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {createOpen && (
        <CreateCityGroupDialog
          defaultPhones={defaultPhones}
          defaultPhonesLoaded={!settingsUnready}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {addTarget && <AddMembersDialog target={addTarget} onClose={() => setAddTarget(null)} />}
      {deleteTarget && <DeleteGroupDialog group={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

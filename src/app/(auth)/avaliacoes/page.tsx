"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Star, AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminFeedbacks } from "@/modules/admin/application/use-admin-feedbacks";
import type { FeedbackItem } from "@/modules/admin/infrastructure/admin-api";
import {
  AuthorProfileDialog,
  AuthorAvatar,
  type AuthorProfile,
} from "@/components/shared/author-profile-dialog";
import { formatInstantDate } from "@/lib/date.utils";

const formatDate = formatInstantDate;

function renderStars(n: number) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= n ? "text-[#eca826] fill-[#eca826]" : "text-[#e5e5e5]"}`} />
      ))}
    </div>
  );
}

function mapFeedbackToRow(f: FeedbackItem) {
  return {
    id: f.id,
    freelancer: f.authorName || `Usuário (${f.authorId.slice(0, 8)})`,
    empresa: f.jobTitle || `Job (${f.jobId.slice(0, 8)})`,
    nota: f.rating,
    comentario: f.comment,
    data: formatDate(f.createdAt),
    role: f.role,
    raw: f,
  };
}

type Row = ReturnType<typeof mapFeedbackToRow>;

/** role = quem ESCREVEU a avaliação (PROVIDER = freelancer, CONTRACTOR = contratante). */
function feedbackToAuthor(f: FeedbackItem): AuthorProfile {
  return {
    name: f.authorName || `Usuário (${f.authorId.slice(0, 8)})`,
    role: f.role === "PROVIDER" || f.role === "CONTRACTOR" ? f.role : undefined,
    avatarUrl: f.authorAvatarUrl ?? null,
    companyName: f.authorCompanyName ?? null,
    email: f.authorEmail ?? null,
    phone: f.authorPhone ?? null,
    city: f.authorCity ?? null,
    uf: f.authorUf ?? null,
    jobTitle: f.authorJobTitle ?? null,
  };
}

const moderacoesMock = [
  { id: 101, freelancer: "Carlos Silva", empresa: "Bar do Zé", avaliacaoOriginal: 2.0, contestacao: "Discordo da nota de pontualidade, cheguei no horário combinado.", data: "13/03/2026", status: "pendente" as const },
  { id: 102, freelancer: "Pedro Santos", empresa: "Buffet Real Festas", avaliacaoOriginal: 3.0, contestacao: "A nota de postura não condiz com meu comportamento no evento.", data: "12/03/2026", status: "pendente" as const },
  { id: 103, freelancer: "Fernanda Lima", empresa: "Restaurante Fogo & Brasa", avaliacaoOriginal: 2.5, contestacao: "Não concordo com a avaliação de comunicação, sempre respondi rápido.", data: "11/03/2026", status: "pendente" as const },
];

export default function AvaliacoesPage() {
  const { data: feedbacks, isLoading, isError } = useAdminFeedbacks();
  const [tab, setTab] = useState<"avaliacoes" | "moderacao">("avaliacoes");
  const [modalAceitar, setModalAceitar] = useState<typeof moderacoesMock[0] | null>(null);
  const [modalRejeitar, setModalRejeitar] = useState<typeof moderacoesMock[0] | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorProfile | null>(null);

  const rows: Row[] = feedbacks?.map(mapFeedbackToRow) ?? [];

  const columns = [
    {
      header: "Autor",
      accessor: (row: Row) => (
        <button
          onClick={() => setSelectedAuthor(feedbackToAuthor(row.raw))}
          className="flex items-center gap-2.5 text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-[#eca826]/10 cursor-pointer transition-colors"
          title="Ver perfil do avaliador"
        >
          <AuthorAvatar name={row.freelancer} avatarUrl={row.raw.authorAvatarUrl} />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[#1d1d1b] truncate">{row.freelancer}</span>
            {row.raw.authorCompanyName && (
              <span className="block text-xs text-[#737373] truncate">{row.raw.authorCompanyName}</span>
            )}
          </span>
        </button>
      ),
    },
    { header: "Job", accessor: "empresa" as const, className: "hidden md:table-cell" },
    {
      header: "Nota",
      accessor: (row: Row) => renderStars(row.nota),
    },
    {
      header: "Comentário",
      accessor: (row: Row) => (
        <span className="text-sm text-[#737373] max-w-xs truncate block">{row.comentario || "—"}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Papel",
      accessor: (row: Row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          row.role === "PROVIDER" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
        }`}>
          {row.role === "PROVIDER" ? "Freelancer" : "Contratante"}
        </span>
      ),
    },
    { header: "Data", accessor: "data" as const, className: "hidden md:table-cell" },
  ];

  const moderacaoColumns = [
    { header: "Freelancer", accessor: "freelancer" as const },
    { header: "Empresa", accessor: "empresa" as const, className: "hidden md:table-cell" },
    {
      header: "Nota Original",
      accessor: (row: typeof moderacoesMock[0]) => (
        <span className="inline-flex items-center gap-1 text-sm font-semibold">
          <Star className="w-4 h-4 text-[#eca826] fill-[#eca826]" />
          {row.avaliacaoOriginal}
        </span>
      ),
    },
    {
      header: "Contestação",
      accessor: (row: typeof moderacoesMock[0]) => (
        <span className="text-sm text-[#737373] max-w-xs truncate block">{row.contestacao}</span>
      ),
    },
    { header: "Data", accessor: "data" as const, className: "hidden md:table-cell" },
    {
      header: "Status",
      accessor: () => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
          <AlertTriangle className="w-3 h-3" />
          Aguardando
        </span>
      ),
    },
    {
      header: "Ações",
      accessor: (row: typeof moderacoesMock[0]) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setModalAceitar(row)}
            className="p-1.5 rounded-md hover:bg-green-100 hover:text-green-700 cursor-pointer transition-colors"
            title="Aceitar"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModalRejeitar(row)}
            className="p-1.5 rounded-md hover:bg-red-100 hover:text-red-600 cursor-pointer transition-colors"
            title="Rejeitar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-red-500">Erro ao carregar avaliações.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Avaliações" description="Sistema de reputação dos freelancers" />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("avaliacoes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "avaliacoes"
              ? "bg-[#eca826] text-white"
              : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
          }`}
        >
          Avaliações
        </button>
        <button
          onClick={() => setTab("moderacao")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            tab === "moderacao"
              ? "bg-[#eca826] text-white"
              : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
          }`}
        >
          Aguardando Moderação
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
            {moderacoesMock.length}
          </span>
        </button>
      </div>

      {tab === "avaliacoes" ? (
        <DataTable columns={columns} data={rows} searchPlaceholder="Buscar por autor..." searchKey="freelancer" />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Dados fictícios</p>
            <p className="text-sm text-amber-700 mt-0.5">Os dados exibidos abaixo são apenas ilustrativos. O módulo de contestação será disponibilizado em breve.</p>
          </div>
        </div>
      )}

      {tab === "moderacao" && (
        <DataTable columns={moderacaoColumns} data={moderacoesMock} searchPlaceholder="Buscar por freelancer..." searchKey="freelancer" />
      )}

      {/* Modal Perfil do Avaliador */}
      <AuthorProfileDialog
        open={!!selectedAuthor}
        onOpenChange={(open) => !open && setSelectedAuthor(null)}
        author={selectedAuthor}
      />

      {/* Modal Aceitar Contestação */}
      <Dialog open={!!modalAceitar} onOpenChange={(open) => !open && setModalAceitar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalAceitar(null)} />
          <DialogHeader>
            <DialogTitle>Aceitar Contestação</DialogTitle>
            <DialogDescription>Confirme os detalhes antes de aceitar a contestação.</DialogDescription>
          </DialogHeader>
          {modalAceitar && (
            <div className="space-y-3 text-sm">
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Freelancer</p>
                <p className="font-semibold text-[#1d1d1b]">{modalAceitar.freelancer}</p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Empresa</p>
                <p className="font-semibold text-[#1d1d1b]">{modalAceitar.empresa}</p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Avaliação Original</p>
                <p className="font-semibold text-[#1d1d1b] inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#eca826] fill-[#eca826]" />
                  {modalAceitar.avaliacaoOriginal}
                </p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Contestação</p>
                <p className="font-medium text-[#1d1d1b]">{modalAceitar.contestacao}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAceitar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-green-500 text-white hover:bg-green-600" onClick={() => { toast.success("Contestação aceita!"); setModalAceitar(null); }}>
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Rejeitar Contestação */}
      <Dialog open={!!modalRejeitar} onOpenChange={(open) => !open && setModalRejeitar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalRejeitar(null)} />
          <DialogHeader>
            <DialogTitle>Rejeitar Contestação</DialogTitle>
            <DialogDescription>Confirme os detalhes antes de rejeitar a contestação.</DialogDescription>
          </DialogHeader>
          {modalRejeitar && (
            <div className="space-y-3 text-sm">
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Freelancer</p>
                <p className="font-semibold text-[#1d1d1b]">{modalRejeitar.freelancer}</p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Empresa</p>
                <p className="font-semibold text-[#1d1d1b]">{modalRejeitar.empresa}</p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Avaliação Original</p>
                <p className="font-semibold text-[#1d1d1b] inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-[#eca826] fill-[#eca826]" />
                  {modalRejeitar.avaliacaoOriginal}
                </p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Contestação</p>
                <p className="font-medium text-[#1d1d1b]">{modalRejeitar.contestacao}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRejeitar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-red-500 text-white hover:bg-red-600" onClick={() => { toast.success("Contestação rejeitada!"); setModalRejeitar(null); }}>
              <X className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

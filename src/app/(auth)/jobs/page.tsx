"use client";

import { useState } from "react";
import { Plus, Eye, Pencil, UserPlus, AlertTriangle, Clock, Send, MessageCircle, Star, Check, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { useAdminVacancies } from "@/modules/admin/application/use-admin-vacancies";
import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

const vagasUrgentes = [
  { id: 101, empresa: "Bar do Zé", cidade: "São Paulo", cargo: "Garçom", qtdFaltando: 2, valor: "R$ 180", data: "13/03/2026", horario: "18:00 - 02:00", tempoRestante: "1h 45min", freelancersDisponiveis: 28 },
  { id: 102, empresa: "Churrascaria Gaúcha", cidade: "Porto Alegre", cargo: "Churrasqueiro", qtdFaltando: 2, valor: "R$ 280", data: "13/03/2026", horario: "11:00 - 20:00", tempoRestante: "45min", freelancersDisponiveis: 12 },
  { id: 103, empresa: "Restaurante Sabor & Arte", cidade: "São Paulo", cargo: "Auxiliar de Cozinha", qtdFaltando: 1, valor: "R$ 160", data: "13/03/2026", horario: "17:00 - 23:00", tempoRestante: "1h 20min", freelancersDisponiveis: 35 },
];

const freelancersDisponiveis = [
  { id: 1, nome: "Ana Souza", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.9 },
  { id: 2, nome: "Carlos Lima", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.7 },
  { id: 3, nome: "Mariana Costa", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.8 },
  { id: 4, nome: "Pedro Rocha", cidade: "Rio de Janeiro", cargo: "Cozinheiro", avaliacao: 4.6 },
  { id: 5, nome: "Juliana Mendes", cidade: "Belo Horizonte", cargo: "Recepcionista", avaliacao: 5.0 },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function mapVacancyStatus(status: string) {
  switch (status) {
    case "OPEN": return "open" as const;
    case "CLOSED": return "filled" as const;
    case "CANCELLED": return "cancelled" as const;
    default: return "open" as const;
  }
}

function mapVacancyToRow(v: VacancyItem) {
  const start = formatTime(v.startTime);
  const end = formatTime(v.endTime);
  return {
    id: v.id,
    empresa: v.contractorCompanyName || v.contractorName || "Sem nome",
    cidade: v.address || "N/A",
    cargo: v.serviceType,
    qtd: 1,
    preenchidas: v.status === "CLOSED" ? 1 : 0,
    valor: `R$ ${(v.payment / 100).toFixed(2).replace(".", ",")}`,
    data: formatDate(v.date),
    horario: `${start} - ${end}`,
    status: mapVacancyStatus(v.status),
    raw: v,
  };
}

type Row = ReturnType<typeof mapVacancyToRow>;

const tabs = ["Todas as Vagas", "Vagas Urgentes"] as const;
type Tab = typeof tabs[number];

export default function JobsPage() {
  const { data: vacancies, isLoading, isError } = useAdminVacancies();
  const [tab, setTab] = useState<Tab>("Todas as Vagas");
  const [enviando, setEnviando] = useState<number | null>(null);

  const [modalDetalhes, setModalDetalhes] = useState<Row | null>(null);
  const [modalEditar, setModalEditar] = useState<Row | null>(null);
  const [modalConvocar, setModalConvocar] = useState<Row | null>(null);
  const [selecionadosConvocar, setSelecionadosConvocar] = useState<number[]>([]);

  const rows: Row[] = vacancies?.map(mapVacancyToRow) ?? [];

  const handleEnviarWhatsApp = (vaga: typeof vagasUrgentes[0]) => {
    setEnviando(vaga.id);
    setTimeout(() => {
      setEnviando(null);
      toast.success(`WhatsApp enviado para ${vaga.freelancersDisponiveis} freelancers de ${vaga.cargo} em ${vaga.cidade}.`);
    }, 1500);
  };

  const handleEnviarTodos = () => {
    toast.info(`WhatsApp sendo enviado para todas as ${vagasUrgentes.length} vagas urgentes.`);
  };

  const handleConvocar = () => {
    if (selecionadosConvocar.length === 0) {
      toast.error("Selecione pelo menos um freelancer para convocar.");
      return;
    }
    toast.success(`${selecionadosConvocar.length} freelancer(s) convocado(s) com sucesso!`);
    setSelecionadosConvocar([]);
    setModalConvocar(null);
  };

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
        <p className="text-red-500">Erro ao carregar vagas.</p>
      </div>
    );
  }

  const columns = [
    { header: "Empresa", accessor: "empresa" as const },
    { header: "Cidade", accessor: "cidade" as const, className: "hidden md:table-cell" },
    { header: "Cargo", accessor: "cargo" as const },
    { header: "Qtd", accessor: "qtd" as const },
    { header: "Valor/FL", accessor: "valor" as const, className: "hidden lg:table-cell" },
    { header: "Data", accessor: "data" as const },
    { header: "Horário", accessor: "horario" as const, className: "hidden lg:table-cell" },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setModalDetalhes(row)}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Ver"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModalEditar(row)}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setModalConvocar(row); setSelecionadosConvocar([]); }}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Convocar"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas / Jobs"
        description="Gerencie as vagas e solicitações de freelancers"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Criar Job
          </Button>
        }
      />

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === t
                ? "bg-[#eca826] text-white"
                : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {t}
            {t === "Vagas Urgentes" && vagasUrgentes.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {vagasUrgentes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Todas as Vagas" && (
        <DataTable columns={columns} data={rows} searchPlaceholder="Buscar por empresa..." searchKey="empresa" />
      )}

      {tab === "Vagas Urgentes" && (
        <div className="space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-sm">
                {vagasUrgentes.length} vagas não preenchidas a menos de 2h do horário
              </span>
            </div>
            <Button
              onClick={handleEnviarTodos}
              size="sm"
              className="sm:ml-auto bg-green-500 text-white hover:bg-green-600 font-medium"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar WhatsApp para todos
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {vagasUrgentes.map((vaga) => (
              <div
                key={vaga.id}
                className="bg-white border border-[#e5e5e5] rounded-xl p-5 space-y-4 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#1d1d1b]">{vaga.empresa}</h3>
                    <p className="text-sm text-[#737373]">{vaga.cidade}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500">
                    <Clock className="w-3 h-3" />
                    {vaga.tempoRestante}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#737373]">Cargo</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.cargo}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Vagas faltando</p>
                    <p className="font-bold text-red-500">{vaga.qtdFaltando}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Valor</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.valor}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Horário</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.horario}</p>
                  </div>
                </div>

                <div className="bg-[#f7f7f7] rounded-lg p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-[#737373]">Freelancers disponíveis: </span>
                    <span className="font-bold text-[#1d1d1b]">{vaga.freelancersDisponiveis}</span>
                  </div>
                  <MessageCircle className="w-4 h-4 text-[#737373]" />
                </div>

                <Button
                  onClick={() => handleEnviarWhatsApp(vaga)}
                  disabled={enviando === vaga.id}
                  className="w-full bg-green-500 text-white hover:bg-green-600 font-medium"
                >
                  {enviando === vaga.id ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar WhatsApp ({vaga.freelancersDisponiveis} freelancers)
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Detalhes da Vaga */}
      <Dialog open={!!modalDetalhes} onOpenChange={(open) => !open && setModalDetalhes(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalDetalhes(null)} />
          <DialogHeader>
            <DialogTitle>Detalhes da Vaga</DialogTitle>
            <DialogDescription>Informações completas da vaga selecionada.</DialogDescription>
          </DialogHeader>
          {modalDetalhes && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Empresa</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.empresa}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Cidade</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.cidade}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Cargo</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.cargo}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Quantidade</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.qtd}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Preenchidas</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.preenchidas}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Valor/FL</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.valor}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Data</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.data}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Horário</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.horario}</p>
                </div>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-[#737373]">Status</p>
                  <div className="mt-1"><StatusBadge status={modalDetalhes.status} /></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalhes(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Vaga */}
      <Dialog open={!!modalEditar} onOpenChange={(open) => !open && setModalEditar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalEditar(null)} />
          <DialogHeader>
            <DialogTitle>Editar Vaga</DialogTitle>
            <DialogDescription>Edite os dados da vaga (visual apenas).</DialogDescription>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Empresa</label>
                <input type="text" defaultValue={modalEditar.empresa} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Cidade</label>
                  <input type="text" defaultValue={modalEditar.cidade} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Cargo</label>
                  <input type="text" defaultValue={modalEditar.cargo} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Quantidade</label>
                  <input type="text" defaultValue={modalEditar.qtd} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Valor/FL</label>
                  <input type="text" defaultValue={modalEditar.valor} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Data</label>
                  <input type="text" defaultValue={modalEditar.data} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Horário</label>
                  <input type="text" defaultValue={modalEditar.horario} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e]" onClick={() => { toast.success("Vaga atualizada com sucesso!"); setModalEditar(null); }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Convocar Freelancers */}
      <Dialog open={!!modalConvocar} onOpenChange={(open) => !open && setModalConvocar(null)}>
        <DialogContent className="max-w-xl">
          <DialogClose onClick={() => setModalConvocar(null)} />
          <DialogHeader>
            <DialogTitle>Convocar Freelancers</DialogTitle>
            <DialogDescription>
              {modalConvocar ? `Selecione os freelancers disponíveis para ${modalConvocar.cargo} em ${modalConvocar.cidade}.` : "Selecione os freelancers para convocação."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {freelancersDisponiveis.map((fl) => {
              const selecionado = selecionadosConvocar.includes(fl.id);
              return (
                <div
                  key={fl.id}
                  onClick={() => {
                    setSelecionadosConvocar((prev) =>
                      selecionado ? prev.filter((id) => id !== fl.id) : [...prev, fl.id]
                    );
                  }}
                  className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                    selecionado ? "border-[#eca826] bg-[#eca826]/5" : "border-[#e5e5e5] hover:bg-[#f7f7f7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selecionado ? "bg-[#eca826] border-[#eca826]" : "border-[#e5e5e5]"}`}>
                      {selecionado && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1b]">{fl.nome}</p>
                      <p className="text-xs text-[#737373]">{fl.cidade} • {fl.cargo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-[#eca826]">
                    <Star className="w-3.5 h-3.5 fill-[#eca826]" />
                    {fl.avaliacao}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConvocar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e]" onClick={handleConvocar}>
              <UserPlus className="w-4 h-4 mr-2" />
              Convocar ({selecionadosConvocar.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

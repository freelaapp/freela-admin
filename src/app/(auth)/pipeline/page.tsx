"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Plus, GripVertical, Phone, Presentation, ClipboardList, Briefcase, RefreshCw, Repeat, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const contratanteStages = [
  {
    name: "Fazer Contato",
    icon: Phone,
    leads: [
      { empresa: "Cantina Italiana", responsavel: "Marco Rossi", cidade: "São Paulo", segmento: "Restaurante", origem: "Instagram" },
      { empresa: "Pub London", responsavel: "Ana Clara", cidade: "Curitiba", segmento: "Bar", origem: "Google" },
      { empresa: "Sushi House", responsavel: "Kenji Tanaka", cidade: "São Paulo", segmento: "Restaurante", origem: "Outbound" },
    ],
  },
  {
    name: "Contato",
    icon: Phone,
    leads: [
      { empresa: "Espaço Eventos SP", responsavel: "Luciana Melo", cidade: "São Paulo", segmento: "Evento", origem: "Indicação" },
      { empresa: "Bar 1800", responsavel: "Felipe Ramos", cidade: "Rio de Janeiro", segmento: "Bar", origem: "Instagram" },
    ],
  },
  {
    name: "Apresentação",
    icon: Presentation,
    leads: [
      { empresa: "Beach Club Floripa", responsavel: "Diego Santos", cidade: "Florianópolis", segmento: "Balada", origem: "Outbound" },
      { empresa: "Steakhouse Premium", responsavel: "Renata Lopes", cidade: "Rio de Janeiro", segmento: "Restaurante", origem: "Evento" },
    ],
  },
  {
    name: "Cadastro",
    icon: ClipboardList,
    leads: [
      { empresa: "Rooftop Bar", responsavel: "Thiago Alves", cidade: "São Paulo", segmento: "Bar", origem: "Instagram" },
    ],
  },
  {
    name: "1ª Contratação",
    icon: Briefcase,
    leads: [
      { empresa: "Grill House", responsavel: "Paula Ferraz", cidade: "Belo Horizonte", segmento: "Restaurante", origem: "Indicação" },
    ],
  },
  {
    name: "2ª Contratação",
    icon: RefreshCw,
    leads: [
      { empresa: "Buffet Real", responsavel: "Carla Mendes", cidade: "Curitiba", segmento: "Buffet", origem: "Indicação" },
    ],
  },
  {
    name: "Recorrente",
    icon: Repeat,
    leads: [
      { empresa: "Bar do Zé", responsavel: "José Almeida", cidade: "São Paulo", segmento: "Bar", origem: "Indicação" },
      { empresa: "Hotel Luxo Palace", responsavel: "Roberto Dias", cidade: "Belo Horizonte", segmento: "Hotel", origem: "Google" },
    ],
  },
];

const freelancerStages = [
  { name: "Lead captado", leads: [{ empresa: "João Silva", responsavel: "Garçom", cidade: "São Paulo", segmento: "", origem: "App" }] },
  { name: "Contato realizado", leads: [{ empresa: "Ana Souza", responsavel: "Bartender", cidade: "Rio de Janeiro", segmento: "", origem: "Indicação" }] },
  { name: "Cadastro completo", leads: [] },
  { name: "1º Job", leads: [] },
  { name: "Recorrente", leads: [] },
];

type Tab = "contratantes" | "freelancers";

export default function PipelinePage() {
  const [tab, setTab] = useState<Tab>("contratantes");
  const [showAlert, setShowAlert] = useState(false);
  const stages = tab === "contratantes" ? contratanteStages : freelancerStages;

  useEffect(() => {
    const dismissed = sessionStorage.getItem("pipeline-alert-dismissed");
    if (!dismissed) {
      setShowAlert(true);
    }
  }, []);

  const dismissAlert = () => {
    sessionStorage.setItem("pipeline-alert-dismissed", "true");
    setShowAlert(false);
  };

  return (
    <div>
      <PageHeader
        title="Pipeline Comercial"
        description="Funil de vendas para aquisição de contratantes e freelancers"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Novo Lead
          </Button>
        }
      />

      <Dialog open={showAlert} onOpenChange={setShowAlert}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#eca826]" />
                Dados de Demonstração
              </span>
            </DialogTitle>
            <DialogDescription>
              O Pipeline Comercial ainda não possui integração com o banco de dados. 
              Os leads e estágios exibidos são <strong>dados fictícios</strong> para demonstração visual.
              <br /><br />
              A integração real será implementada em breve.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissAlert} className="bg-[#eca826] text-white hover:bg-[#d4951e]">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-1 mb-6 bg-[#f7f7f7] p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("contratantes")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "contratantes" ? "bg-white text-[#1d1d1b] shadow-sm" : "text-[#737373] hover:text-[#1d1d1b]"
          }`}
        >
          Contratantes
        </button>
        <button
          onClick={() => setTab("freelancers")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "freelancers" ? "bg-white text-[#1d1d1b] shadow-sm" : "text-[#737373] hover:text-[#1d1d1b]"
          }`}
        >
          Freelancers
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.name} className="min-w-[260px] flex-shrink-0">
            <div className="border-t-4 border-[#eca826] bg-white rounded-xl border border-[#e5e5e5]">
              <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                <h3 className="font-semibold text-xs text-[#1d1d1b]">{stage.name}</h3>
                <span className="text-xs font-medium text-[#737373] bg-[#f7f7f7] px-2 py-0.5 rounded-full">
                  {stage.leads.length}
                </span>
              </div>
              <div className="p-3 space-y-2 min-h-[80px]">
                {stage.leads.map((lead, i) => (
                  <div key={i} className="bg-[#f7f7f7]/50 rounded-lg p-3 cursor-pointer hover:bg-[#f7f7f7] transition-colors">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-[#1d1d1b]">{lead.empresa}</p>
                      <GripVertical className="w-4 h-4 text-[#737373] shrink-0" />
                    </div>
                    <p className="text-xs text-[#737373] mt-1">{lead.responsavel}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-[#737373]">{lead.cidade}</span>
                      {lead.origem && (
                        <span className="text-xs bg-[#eca826]/10 text-[#eca826] px-1.5 py-0.5 rounded">{lead.origem}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

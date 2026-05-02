"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Bell, Globe, CreditCard, MessageSquare, Smartphone, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const sections = [
  { title: "Notificações", description: "Configure alertas e notificações do sistema", icon: Bell },
  { title: "WhatsApp Business API", description: "Integração com WhatsApp para comunicação", icon: MessageSquare, badge: "Em breve" },
  { title: "Meta Ads", description: "Integração com Meta para campanhas", icon: Globe, badge: "Em breve" },
  { title: "Pagamentos Pix", description: "Integração com sistema de pagamentos via Pix", icon: CreditCard, badge: "Em breve" },
  { title: "App Mobile", description: "Configurações do aplicativo mobile", icon: Smartphone, badge: "Em breve" },
];

export default function ConfiguracoesPage() {
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("configuracoes-alert-dismissed");
    if (!dismissed) {
      setShowAlert(true);
    }
  }, []);

  const dismissAlert = () => {
    sessionStorage.setItem("configuracoes-alert-dismissed", "true");
    setShowAlert(false);
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Configurações gerais e integrações" />

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
              A página de Configurações ainda não possui integração com o banco de dados.
              As opções e integrações exibidas são <strong>dados fictícios</strong> para demonstração visual.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.title} className="bg-white rounded-xl border border-[#e5e5e5] p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#eca826]/10 flex items-center justify-center shrink-0">
                <s.icon className="w-5 h-5 text-[#eca826]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#1d1d1b] text-sm">{s.title}</h3>
                  {s.badge && (
                    <span className="text-[10px] font-medium bg-[#f7f7f7] text-[#737373] px-1.5 py-0.5 rounded">{s.badge}</span>
                  )}
                </div>
                <p className="text-xs text-[#737373] mt-1">{s.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

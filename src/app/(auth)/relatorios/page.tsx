"use client";

import { useRef, useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Users, Building2, MapPin, Briefcase, DollarSign, XCircle, FileText, Download, X, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAdminMetrics } from "@/modules/admin/application/use-admin-metrics";
import { useAdminProviders } from "@/modules/admin/application/use-admin-providers";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import { formatInstantDate } from "@/lib/date.utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const reports = [
  { key: "overview", title: "Visão Geral da Plataforma", description: "Métricas consolidadas de usuários, jobs e receita", icon: DollarSign },
  { key: "freelancers", title: "Freelancers mais ativos", description: "Top freelancers por número de jobs realizados", icon: Users },
  { key: "empresas", title: "Empresas que mais contratam", description: "Ranking de empresas por volume de contratações", icon: Building2 },
  { key: "cidades", title: "Cidades com maior demanda", description: "Análise geográfica de demanda por freelancers", icon: MapPin },
  { key: "cargos", title: "Cargos mais demandados", description: "Cargos com maior volume de vagas abertas", icon: Briefcase },
  { key: "cancelamentos", title: "Taxa de cancelamento", description: "Análise de jobs cancelados e motivos", icon: XCircle },
];

export default function RelatoriosPage() {
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("relatorios-alert-dismissed");
    if (!dismissed) {
      setShowAlert(true);
    }
  }, []);

  const dismissAlert = () => {
    sessionStorage.setItem("relatorios-alert-dismissed", "true");
    setShowAlert(false);
  };
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: metrics } = useAdminMetrics();
  const { data: providersPage } = useAdminProviders({ limit: 500 });
  const providers = providersPage?.data;
  const { data: contractors } = useAdminContractors();

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-${openReport}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const selectedReport = reports.find((r) => r.key === openReport);

  return (
    <div>
      <PageHeader title="Relatórios" description="Relatórios automáticos da operação" />

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
              Os relatórios exibidos usam dados reais da plataforma, mas a funcionalidade de
              geração avançada e exportação em PDF ainda está em desenvolvimento.
              <br /><br />
              Alguns campos podem conter dados de teste ou estar incompletos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissAlert} className="bg-[#eca826] text-white hover:bg-[#d4951e]">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <button
            key={r.title}
            onClick={() => setOpenReport(r.key)}
            className="text-left bg-white rounded-xl border border-[#e5e5e5] p-5 hover:border-[#eca826]/30 transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#eca826]/10 flex items-center justify-center mb-3 group-hover:bg-[#eca826]/20 transition-colors">
              <r.icon className="w-5 h-5 text-[#eca826]" />
            </div>
            <h3 className="font-semibold text-[#1d1d1b] text-sm">{r.title}</h3>
            <p className="text-xs text-[#737373] mt-1">{r.description}</p>
          </button>
        ))}
      </div>

      <Dialog open={!!openReport} onOpenChange={() => setOpenReport(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#eca826]" />
                {selectedReport?.title}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div ref={reportRef} className="bg-white p-6 space-y-6">
            <div className="text-center border-b border-[#e5e5e5] pb-4">
              <h2 className="text-xl font-bold text-[#1d1d1b]">{selectedReport?.title}</h2>
              <p className="text-sm text-[#737373]">Gerado em {formatInstantDate(new Date())}</p>
            </div>

            {openReport === "overview" && metrics && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Métricas Gerais</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Total Freelancers</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.totalFreelancers}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Total Empresas</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.totalCompanies}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Vagas Abertas</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.openVacancies}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Jobs Concluídos</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.completedJobs}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Total Usuários</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.totalUsers}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Faturamento</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">R$ {(metrics.totalRevenue / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {openReport === "freelancers" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Freelancers Cadastrados</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5]">
                      <th className="text-left py-2 text-[#737373] font-medium">Cargo</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Cidade</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Trabalhos</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(providers ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-[#e5e5e5]/50">
                        <td className="py-2">{p.jobTitle || "N/A"}</td>
                        <td className="py-2">{p.city || "N/A"}</td>
                        <td className="py-2">{p.trabalhos}</td>
                        <td className="py-2">{p.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {openReport === "empresas" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Empresas Cadastradas</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5]">
                      <th className="text-left py-2 text-[#737373] font-medium">Empresa</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Cidade</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Jobs</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(contractors ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-[#e5e5e5]/50">
                        <td className="py-2">{c.companyName || c.contactName || "N/A"}</td>
                        <td className="py-2">{c.city || "N/A"}</td>
                        <td className="py-2">{c.jobs}</td>
                        <td className="py-2">{c.ticketMedio ? `R$ ${(c.ticketMedio / 100).toFixed(2)}` : "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {openReport === "cidades" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Distribuição por Cidade</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5]">
                      <th className="text-left py-2 text-[#737373] font-medium">Cidade</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Freelancers</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Empresas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set([
                      ...(providers ?? []).map((p) => p.city || "N/A"),
                      ...(contractors ?? []).map((c) => c.city || "N/A"),
                    ])).map((city, i) => {
                      const fCount = (providers ?? []).filter((p) => p.city === city).length;
                      const eCount = (contractors ?? []).filter((c) => c.city === city).length;
                      return (
                        <tr key={i} className="border-b border-[#e5e5e5]/50">
                          <td className="py-2">{city}</td>
                          <td className="py-2">{fCount}</td>
                          <td className="py-2">{eCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {openReport === "cargos" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Cargos na Plataforma</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5]">
                      <th className="text-left py-2 text-[#737373] font-medium">Cargo</th>
                      <th className="text-left py-2 text-[#737373] font-medium">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      (providers ?? []).reduce((map, p) => {
                        const title = p.jobTitle || "N/A";
                        map.set(title, (map.get(title) || 0) + 1);
                        return map;
                      }, new Map<string, number>())
                    ).map(([cargo, count], i) => (
                      <tr key={i} className="border-b border-[#e5e5e5]/50">
                        <td className="py-2">{cargo}</td>
                        <td className="py-2">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {openReport === "cancelamentos" && metrics && (
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1d1d1b]">Cancelamentos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Vagas Canceladas</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.cancelledVacancies}</p>
                  </div>
                  <div className="bg-[#f7f7f7] rounded-lg p-3">
                    <p className="text-xs text-[#737373]">Jobs Cancelados</p>
                    <p className="text-lg font-bold text-[#1d1d1b]">{metrics.cancelledJobs}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-[#737373] pt-4 border-t border-[#e5e5e5]">
              Freela Admin — Relatório gerado automaticamente
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenReport(null)} className="border-[#e5e5e5] text-[#737373]">
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>
            <Button onClick={handleDownloadPDF} disabled={downloading} className="bg-[#eca826] text-white hover:bg-[#d4951e]">
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

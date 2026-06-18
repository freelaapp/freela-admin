"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, Phone, Mail, MapPin, Building2, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { useCrmCompany, useCrmMutations } from "@/modules/admin/application/use-admin-crm";
import type { CrmCompanyStatus, CrmPriority } from "@/modules/admin/infrastructure/crm-api";
import { PRIORITY_META, PRIORITY_OPTIONS, STATUS_LABEL, STATUS_OPTIONS } from "./crm-constants";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CompanyDialog({
  companyId,
  onOpenChange,
}: {
  companyId: string | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: company, isLoading } = useCrmCompany(companyId);
  const m = useCrmMutations();

  // contato
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState("");
  const [cPhone, setCPhone] = useState("");
  // tarefa
  const [tTitle, setTTitle] = useState("");
  const [tPriority, setTPriority] = useState<CrmPriority>("MEDIA");
  const [tDue, setTDue] = useState("");
  // nota
  const [note, setNote] = useState("");

  const id = companyId as string;

  async function patch(dto: { status?: CrmCompanyStatus; priority?: CrmPriority }) {
    try {
      await m.updateCompany.mutateAsync({ id, dto });
    } catch {
      toast.error("Não foi possível atualizar.");
    }
  }

  async function addContact() {
    if (!cName.trim()) return;
    try {
      await m.addContact.mutateAsync({
        companyId: id,
        dto: { name: cName.trim(), role: cRole.trim() || undefined, phone: cPhone.trim() || undefined },
      });
      setCName(""); setCRole(""); setCPhone("");
    } catch {
      toast.error("Erro ao adicionar contato.");
    }
  }

  async function addTask() {
    if (!tTitle.trim()) return;
    try {
      await m.createTask.mutateAsync({
        title: tTitle.trim(),
        companyId: id,
        priority: tPriority,
        dueAt: tDue ? new Date(tDue).toISOString() : undefined,
      });
      setTTitle(""); setTDue(""); setTPriority("MEDIA");
    } catch {
      toast.error("Erro ao adicionar tarefa.");
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    try {
      await m.addNote.mutateAsync({ companyId: id, body: note.trim() });
      setNote("");
    } catch {
      toast.error("Erro ao adicionar anotação.");
    }
  }

  return (
    <Dialog open={!!companyId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#eca826]" />
              {company?.name ?? (isLoading ? "Carregando…" : "Empresa")}
            </span>
          </DialogTitle>
        </DialogHeader>

        {company && (
          <div className="space-y-5">
            {/* Status + prioridade + dados */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-[#737373]">Status</span>
                <NativeSelect
                  value={company.status}
                  onChange={(e) => patch({ status: e.target.value as CrmCompanyStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-[#737373]">Prioridade</span>
                <NativeSelect
                  value={company.priority}
                  onChange={(e) => patch({ priority: e.target.value as CrmPriority })}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[#737373]">
              {company.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.city}</span>}
              {company.segment && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{company.segment}</span>}
              {company.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{company.phone}</span>}
              {company.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{company.email}</span>}
              {company.linkedContractorUserId && (
                <span className="flex items-center gap-1 text-green-700"><Link2 className="w-3.5 h-3.5" />Contratante cadastrado</span>
              )}
            </div>

            {/* Contatos */}
            <section>
              <h4 className="font-semibold text-sm text-[#1d1d1b] mb-2">Contatos</h4>
              <div className="space-y-1.5">
                {company.contacts.length === 0 && <p className="text-xs text-[#737373]">Nenhum contato.</p>}
                {company.contacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm bg-[#f7f7f7]/60 rounded-md px-2.5 py-1.5">
                    <span className="font-medium">{c.name}</span>
                    {c.role && <span className="text-xs text-[#737373]">{c.role}</span>}
                    {c.phone && <span className="text-xs text-[#737373]">· {c.phone}</span>}
                    <button
                      className="ml-auto text-[#737373] hover:text-red-600"
                      onClick={() => m.deleteContact.mutate(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input className="h-8" placeholder="Nome" value={cName} onChange={(e) => setCName(e.target.value)} />
                <Input className="h-8" placeholder="Cargo" value={cRole} onChange={(e) => setCRole(e.target.value)} />
                <Input className="h-8" placeholder="Telefone" value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                <Button size="sm" variant="outline" onClick={addContact}><Plus className="w-4 h-4" /></Button>
              </div>
            </section>

            {/* Tarefas */}
            <section>
              <h4 className="font-semibold text-sm text-[#1d1d1b] mb-2">Tarefas</h4>
              <div className="space-y-1.5">
                {company.tasks.length === 0 && <p className="text-xs text-[#737373]">Nenhuma tarefa.</p>}
                {company.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm bg-[#f7f7f7]/60 rounded-md px-2.5 py-1.5">
                    <button
                      onClick={() => m.updateTask.mutate({ id: t.id, dto: { done: !t.done } })}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${t.done ? "bg-green-600 border-green-600 text-white" : "border-[#c4c4c4]"}`}
                    >
                      {t.done && <Check className="w-3 h-3" />}
                    </button>
                    <span className={t.done ? "line-through text-[#a3a3a3]" : ""}>{t.title}</span>
                    <Badge variant={PRIORITY_META[t.priority].variant} className="text-[10px] px-1.5 py-0">
                      {PRIORITY_META[t.priority].label}
                    </Badge>
                    {t.dueAt && <span className="text-xs text-[#737373]">{new Date(t.dueAt).toLocaleDateString("pt-BR")}</span>}
                    <button className="ml-auto text-[#737373] hover:text-red-600" onClick={() => m.deleteTask.mutate(t.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input className="h-8 flex-1" placeholder="Nova tarefa" value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
                <NativeSelect className="h-8 w-24" value={tPriority} onChange={(e) => setTPriority(e.target.value as CrmPriority)}>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </NativeSelect>
                <Input className="h-8 w-36" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
                <Button size="sm" variant="outline" onClick={addTask}><Plus className="w-4 h-4" /></Button>
              </div>
            </section>

            {/* Histórico / anotações */}
            <section>
              <h4 className="font-semibold text-sm text-[#1d1d1b] mb-2">Histórico</h4>
              <div className="flex gap-2 mb-2">
                <textarea
                  className="flex-1 rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 resize-none"
                  rows={2}
                  placeholder="Registrar uma interação (ligação, retorno, observação)…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button size="sm" className="bg-[#eca826] text-white hover:bg-[#d4951e] self-end" onClick={addNote}>
                  Registrar
                </Button>
              </div>
              <div className="space-y-2">
                {company.crmNotes.length === 0 && <p className="text-xs text-[#737373]">Sem registros ainda.</p>}
                {company.crmNotes.map((n) => (
                  <div key={n.id} className="border-l-2 border-[#eca826]/40 pl-3 py-0.5">
                    <p className="text-sm text-[#1d1d1b] whitespace-pre-wrap">{n.body}</p>
                    <span className="text-[11px] text-[#a3a3a3]">{fmtDate(n.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end border-t border-[#f0f0f0] pt-3">
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (!confirm("Remover esta empresa do pipeline? Esta ação não pode ser desfeita.")) return;
                  try {
                    await m.deleteCompany.mutateAsync(id);
                    toast.success("Empresa removida.");
                    onOpenChange(false);
                  } catch {
                    toast.error("Não foi possível remover.");
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remover empresa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

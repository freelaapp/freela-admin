"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCreateCampaign,
  usePreviewExternalList,
} from "@/modules/admin/application/use-admin-referrals";
import {
  detectColumnMapping,
  normalizeTemplatePlaceholders,
  renderPreview,
  rowsToContacts,
  toApiContacts,
  type ColumnMapping,
  type ContactField,
  type SpreadsheetContact,
} from "@/modules/admin/application/spreadsheet-contacts";
import {
  EXTERNAL_LIST_AUDIENCE,
  readAlreadyRegistered,
  type CampaignDetail,
  type ExternalListPreview,
  type RegisteredRole,
} from "@/modules/admin/infrastructure/referrals-api";

const ROLE_LABEL: Record<RegisteredRole, string> = {
  provider: "freelancer",
  contractor: "contratante",
  both: "freelancer e contratante",
  unknown: "conta",
};

/** Teto da API por chamada. */
const MAX_CONTACTS = 5000;
/** A API separa as variantes do WhatsApp por uma linha só com `---`. */
const VARIANT_SEPARATOR = "\n---\n";
const PREVIEW_ROWS = 5;

/**
 * Textos de partida para lista fria. Diferem dos da base (que falam "seu
 * cadastro já está pronto"): aqui a pessoa nunca ouviu falar da gente, e
 * fingir intimidade é o que gera denúncia.
 */
const DEFAULT_VARIANTS = [
  `Oi {primeiro_nome}, tudo bem? Aqui é do Freela Serviços.

A gente conecta bares, restaurantes e eventos a garçons, cozinheiros, bartenders e auxiliares que atendem no mesmo dia. Você publica a vaga, escolhe quem se candidatou e paga só pelo serviço.

Posso te mostrar como funciona?`,
  `Olá {primeiro_nome}! Freela Serviços aqui.

Faltou alguém na equipe? Temos profissionais prontos pra cobrir o turno — sem depender de indicação de conhecido. Cadastro leva 2 minutos e a vaga sai na hora.

Quer o link pra publicar a primeira?`,
  `Oi {primeiro_nome}, aqui é do Freela Serviços.

Estabelecimentos da sua região já resolvem falta de equipe pela plataforma. Se fizer sentido pra você, te explico em 1 minuto como publicar uma vaga e receber candidatura no mesmo dia.

Pode ser?`,
];

const FIELD_LABEL: Record<ContactField, string> = {
  name: "Nome",
  phone: "Telefone / WhatsApp",
  email: "E-mail",
};

/** A1, B2… como o Excel mostra, para o operador achar a coluna. */
function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

interface ParsedSheet {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: unknown[][];
}

/**
 * Lê a planilha no navegador. `xlsx` entra por import dinâmico: são ~400 KB
 * que só quem sobe planilha precisa baixar.
 */
async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: true, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não tem nenhuma aba.");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });
  const [headerRow = [], ...rows] = matrix;
  return {
    fileName: file.name,
    sheetName,
    headers: headerRow.map((h) => (h == null ? "" : String(h))),
    rows,
  };
}

const DEFAULT_RHYTHM = {
  // Metade do ritmo da campanha de base: número frio + lista fria é o pior
  // cenário para o WhatsApp.
  messagesPerHour: 10,
  dailyCap: 60,
  windowStartHour: 9,
  windowEndHour: 18,
  weekdaysOnly: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (detail: CampaignDetail) => void;
}

export function ExternalListDialog({ open, onOpenChange, onCreated }: Props) {
  const previewList = usePreviewExternalList();
  const createCampaign = useCreateCampaign();

  const [name, setName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [parsing, setParsing] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, phone: null, email: null });
  const [preview, setPreview] = useState<ExternalListPreview | null>(null);
  // Marcado por padrão: lista fria é para quem NÃO conhece a plataforma;
  // mandar "vem conhecer" para quem já tem conta é o que gera denúncia.
  const [skipRegistered, setSkipRegistered] = useState(true);
  const [variants, setVariants] = useState<string[]>(DEFAULT_VARIANTS);
  const [rhythm, setRhythm] = useState(DEFAULT_RHYTHM);
  const [showAllInvalid, setShowAllInvalid] = useState(false);

  const parsed = useMemo(
    () =>
      sheet ? rowsToContacts(sheet.rows, mapping) : { contacts: [] as SpreadsheetContact[], emptyRows: 0 },
    [sheet, mapping],
  );
  const contacts = parsed.contacts;
  const tooMany = contacts.length > MAX_CONTACTS;
  const hasSource = mapping.phone != null || mapping.email != null;

  const registered = preview ? readAlreadyRegistered(preview) : null;
  // Só dá para pular quem já tem cadastro se a API disser QUAIS linhas são
  // (versão antiga mandava só a contagem: aí avisa, mas não pula).
  const canSkipRegistered = registered?.rows !== null && (registered?.count ?? 0) > 0;
  const skipping = skipRegistered && canSkipRegistered;

  /** Quantos de fato vão para a campanha. */
  const willSend = preview
    ? Math.max(0, preview.valid - (skipping ? (registered?.count ?? 0) : 0))
    : 0;
  // A API responderia EMPTY_AUDIENCE; melhor barrar aqui com explicação.
  const allRegistered = Boolean(preview) && skipping && willSend === 0;

  const reset = () => {
    setName("");
    setSheet(null);
    setMapping({ name: null, phone: null, email: null });
    setPreview(null);
    setSkipRegistered(true);
    setVariants(DEFAULT_VARIANTS);
    setRhythm(DEFAULT_RHYTHM);
    setShowAllInvalid(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setPreview(null);
    try {
      const result = await parseSpreadsheetFile(file);
      if (result.headers.length === 0) {
        toast.error("A planilha está vazia ou sem linha de cabeçalho.");
        return;
      }
      setSheet(result);
      setMapping(detectColumnMapping(result.headers));
      if (!name.trim()) {
        setName(file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não consegui ler o arquivo.");
    } finally {
      setParsing(false);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await previewList.mutateAsync(toApiContacts(contacts));
      setPreview(result);
      setShowAllInvalid(false);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const handleCreate = async () => {
    if (!sheet || !preview) return;
    try {
      // Quem pula é a API (`skipRegistered`): ela cruza de novo com `users`
      // na hora de criar e deixa o rastro em `audienceFilters`. Filtrar aqui
      // mandaria uma lista já recortada, sem registro do que ficou de fora.
      const created = await createCampaign.mutateAsync({
        name: name.trim(),
        audience: EXTERNAL_LIST_AUDIENCE,
        contacts: toApiContacts(contacts),
        listFileName: sheet.fileName,
        skipRegistered: skipping,
        whatsappTemplate: variants
          .map((v) => normalizeTemplatePlaceholders(v).trim())
          .filter(Boolean)
          .join(VARIANT_SEPARATOR),
        ...rhythm,
      });
      reset();
      onCreated(created);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    }
  };

  const invalidToShow = preview
    ? showAllInvalid
      ? preview.invalid
      : preview.invalid.slice(0, 10)
    : [];

  /** `row` da API é a posição no array enviado; traduz para a linha do Excel. */
  const lineOf = (row: number) => contacts[row - 1]?.line ?? row;

  const canCreate =
    Boolean(name.trim()) &&
    Boolean(preview) &&
    willSend > 0 &&
    !allRegistered &&
    !tooMany &&
    variants.some((v) => v.trim()) &&
    !createCampaign.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} className="max-w-3xl">
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha por planilha</DialogTitle>
          <DialogDescription>
            Suba um .xlsx, .xls ou .csv com nome, telefone e/ou e-mail. A lista é conferida
            antes de criar e a campanha nasce parada — nada dispara até você mandar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div
            className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            data-testid="cold-outreach-warning"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Disparo frio.</strong> Essas pessoas não pediram contato — é o cenário em
              que o WhatsApp mais bloqueia número. Use ritmo baixo, janela comercial e mensagens
              diferentes entre si. O número é o mesmo da confirmação de vaga e do suporte.
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-name">Nome da campanha</Label>
            <Input
              id="ext-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lista feira gastronômica — ago/2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-file">Planilha</Label>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="ext-file"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {sheet ? "Trocar arquivo" : "Escolher arquivo"}
              </label>
              <input
                id="ext-file"
                data-testid="ext-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="sr-only"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {sheet && (
                <span className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{sheet.fileName}</span>
                  <span className="text-neutral-500">
                    · aba “{sheet.sheetName}” · {sheet.rows.length} linha
                    {sheet.rows.length === 1 ? "" : "s"}
                  </span>
                </span>
              )}
            </div>
          </div>

          {sheet && (
            <>
              <div className="space-y-2">
                <Label>Colunas</Label>
                <p className="text-xs text-neutral-500">
                  Detectadas pelo cabeçalho. Se alguma ficou errada ou em branco, escolha aqui.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(FIELD_LABEL) as ContactField[]).map((field) => (
                    <div key={field} className="space-y-1">
                      <span className="text-xs font-medium text-neutral-600">
                        {FIELD_LABEL[field]}
                      </span>
                      <NativeSelect
                        data-testid={`mapping-${field}`}
                        value={mapping[field] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setMapping({ ...mapping, [field]: value === "" ? null : Number(value) });
                          setPreview(null);
                        }}
                      >
                        <option value="">— não usar —</option>
                        {sheet.headers.map((header, index) => (
                          <option key={index} value={index}>
                            {columnLetter(index)} · {header || "(sem título)"}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
                </div>
                {!hasSource && (
                  <p className="text-xs text-red-600">
                    Escolha pelo menos a coluna de telefone ou a de e-mail.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Prévia (primeiras {Math.min(PREVIEW_ROWS, contacts.length)} linhas)</Label>
                <div className="overflow-x-auto rounded-md border border-neutral-200">
                  <table className="w-full text-xs" data-testid="sheet-preview">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">Linha</th>
                        <th className="px-2 py-1.5 text-left font-medium">Nome</th>
                        <th className="px-2 py-1.5 text-left font-medium">Telefone</th>
                        <th className="px-2 py-1.5 text-left font-medium">E-mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, PREVIEW_ROWS).map((c) => (
                        <tr key={c.line} className="border-t border-neutral-100">
                          <td className="px-2 py-1.5 tabular-nums text-neutral-500">{c.line}</td>
                          <td className="px-2 py-1.5">{c.name ?? "—"}</td>
                          <td className="px-2 py-1.5 font-mono">{c.phone ?? "—"}</td>
                          <td className="px-2 py-1.5">{c.email ?? "—"}</td>
                        </tr>
                      ))}
                      {contacts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-3 text-center text-neutral-500">
                            Nenhuma linha com dado nas colunas escolhidas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-neutral-500">
                  {contacts.length} contato{contacts.length === 1 ? "" : "s"} com algum dado
                  {parsed.emptyRows > 0 && ` · ${parsed.emptyRows} linha(s) vazia(s) ignorada(s)`}
                  . Telefones são convertidos para +55 DDD número.
                </p>
                {tooMany && (
                  <p className="text-xs text-red-600">
                    Máximo de {MAX_CONTACTS.toLocaleString("pt-BR")} contatos por campanha.
                    Divida a planilha.
                  </p>
                )}
              </div>

              {/* Conferir ANTES de criar: a lista é congelada na criação. */}
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    {preview ? (
                      <span className="text-neutral-600">Lista conferida na API.</span>
                    ) : (
                      <span className="text-neutral-600">
                        Confira a lista: a API valida telefone/e-mail, tira repetidos e diz
                        quem já tem cadastro.
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="preview-button"
                    disabled={
                      previewList.isPending || contacts.length === 0 || !hasSource || tooMany
                    }
                    onClick={handlePreview}
                  >
                    {previewList.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : preview ? (
                      "Conferir de novo"
                    ) : (
                      "Conferir lista"
                    )}
                  </Button>
                </div>

                {preview && (
                  <div className="mt-3 space-y-3" data-testid="preview-result">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat label="Válidos" value={preview.valid} tone="ok" />
                      <Stat label="Inválidos" value={preview.invalid.length} tone={preview.invalid.length ? "bad" : "muted"} />
                      <Stat label="Repetidos removidos" value={preview.duplicates} tone="muted" />
                      <Stat label="Já cadastrados" value={registered?.count ?? 0} tone={registered?.count ? "warn" : "muted"} />
                    </div>
                    <p className="text-xs text-neutral-600">
                      {preview.byChannel.whatsapp} por WhatsApp · {preview.byChannel.email} por
                      e-mail (quem não tem telefone).
                    </p>

                    {(registered?.count ?? 0) > 0 && !canSkipRegistered && (
                      <div
                        className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900"
                        data-testid="registered-notice"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {registered?.count} já {registered?.count === 1 ? "tem" : "têm"} cadastro
                          na plataforma e {registered?.count === 1 ? "vai" : "vão"} receber a
                          mensagem mesmo assim — o texto fala de conhecer a plataforma, não de “seu cadastro”.
                        </span>
                      </div>
                    )}

                    {canSkipRegistered && (
                      <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            data-testid="skip-registered"
                            className="mt-0.5"
                            checked={skipRegistered}
                            onChange={(event) => setSkipRegistered(event.target.checked)}
                          />
                          <span>
                            Pular quem já tem cadastro ({registered?.count}).{" "}
                            <span className="text-neutral-500">
                              Desmarcado, eles recebem a mensagem mesmo assim.
                            </span>
                          </span>
                        </label>
                        <ul
                          className="max-h-32 space-y-0.5 overflow-y-auto pl-6 text-xs text-neutral-700"
                          data-testid="registered-rows"
                        >
                          {(registered?.rows ?? []).map((item) => {
                            const contact = contacts[item.row - 1];
                            return (
                              <li key={`${item.row}-${item.userId}`}>
                                <span className="font-mono text-neutral-500">
                                  linha {contact?.line ?? item.row}
                                </span>{" "}
                                — {contact?.name || contact?.phone || contact?.email || "(sem nome)"}
                                <span className="text-neutral-500">
                                  {" "}
                                  · já é {ROLE_LABEL[item.role] ?? item.role}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {allRegistered && (
                      <div
                        className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800"
                        data-testid="all-registered"
                      >
                        Todos os contatos válidos já têm cadastro — com “pular” marcado, a
                        campanha ficaria vazia. Desmarque para enviar mesmo assim, ou troque a
                        planilha.
                      </div>
                    )}

                    {preview.invalid.length > 0 && (
                      <div className="rounded-md border border-red-200 bg-white p-2">
                        <p className="mb-1 text-xs font-medium text-red-700">
                          Linhas que ficam de fora
                        </p>
                        <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-neutral-700">
                          {invalidToShow.map((item, index) => (
                            <li key={`${item.row}-${index}`}>
                              <span className="font-mono text-neutral-500">
                                linha {lineOf(item.row)}
                              </span>{" "}
                              — {item.reason}
                            </li>
                          ))}
                        </ul>
                        {preview.invalid.length > invalidToShow.length && (
                          <button
                            type="button"
                            className="mt-1 text-xs underline"
                            onClick={() => setShowAllInvalid(true)}
                          >
                            Ver todas ({preview.invalid.length})
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-sm font-medium" data-testid="will-send">
                      Vão entrar na campanha: {willSend} contato{willSend === 1 ? "" : "s"}.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Mensagens do WhatsApp</Label>
            <p className="text-xs text-neutral-500">
              Três variantes rodam alternadas. Use <code>{"{nome}"}</code> ou{" "}
              <code>{"{primeiro_nome}"}</code>; a frase de descadastro (“responda SAIR”) é
              acrescentada automaticamente.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {variants.map((text, index) => (
                <div key={index} className="space-y-1">
                  <textarea
                    data-testid={`variant-${index}`}
                    className="min-h-36 w-full rounded-md border border-neutral-300 p-2 text-xs"
                    value={text}
                    onChange={(event) => {
                      const next = [...variants];
                      next[index] = event.target.value;
                      setVariants(next);
                    }}
                  />
                  <pre className="whitespace-pre-wrap rounded-md bg-neutral-100 p-2 text-[11px] text-neutral-600">
                    {renderPreview(text, contacts[0]?.name ?? "José da Silva") || "(vazia — não será usada)"}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ext-rate">Mensagens por hora</Label>
              <Input
                id="ext-rate"
                type="number"
                min={1}
                max={60}
                value={rhythm.messagesPerHour}
                onChange={(event) =>
                  setRhythm({ ...rhythm, messagesPerHour: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-cap">Teto por dia</Label>
              <Input
                id="ext-cap"
                type="number"
                min={1}
                max={1000}
                value={rhythm.dailyCap}
                onChange={(event) => setRhythm({ ...rhythm, dailyCap: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-start">Começa às (BRT)</Label>
              <Input
                id="ext-start"
                type="number"
                min={0}
                max={23}
                value={rhythm.windowStartHour}
                onChange={(event) =>
                  setRhythm({ ...rhythm, windowStartHour: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-end">Termina às (BRT)</Label>
              <Input
                id="ext-end"
                type="number"
                min={1}
                max={24}
                value={rhythm.windowEndHour}
                onChange={(event) =>
                  setRhythm({ ...rhythm, windowEndHour: Number(event.target.value) })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rhythm.weekdaysOnly}
              onChange={(event) => setRhythm({ ...rhythm, weekdaysOnly: event.target.checked })}
            />
            Só em dias úteis
          </label>

          {rhythm.messagesPerHour > 20 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Em lista fria, acima de 20 por hora o risco de bloqueio do número é alto.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate} data-testid="create-button">
            {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar (sem disparar)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "bad" | "warn" | "muted";
}) {
  const color = {
    ok: "text-emerald-700",
    bad: "text-red-700",
    warn: "text-amber-700",
    muted: "text-neutral-700",
  }[tone];
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { usePreviewExternalList } from "@/modules/admin/application/use-admin-referrals";
import {
  detectColumnMapping,
  rowsToContacts,
  toApiContacts,
  type ContactField,
  type SpreadsheetContact,
} from "@/modules/admin/application/spreadsheet-contacts";
import {
  readAlreadyRegistered,
  type RegisteredRole,
} from "@/modules/admin/infrastructure/referrals-api";
import {
  MAX_EXTERNAL_CONTACTS,
  selectionFromPicker,
  type ExternalPickerState,
  type ParsedSheet,
} from "../_lib/campaign-wizard";

const ROLE_LABEL: Record<RegisteredRole, string> = {
  provider: "freelancer",
  contractor: "contratante",
  both: "freelancer e contratante",
  unknown: "conta",
};

const PREVIEW_ROWS = 5;

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

/**
 * Lê a planilha no navegador. `xlsx` entra por import dinâmico: são ~400 KB que só quem
 * sobe planilha precisa baixar.
 */
async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: true,
    cellDates: false,
  });
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

interface Props {
  value: ExternalPickerState;
  onChange: (next: ExternalPickerState) => void;
  /** Nome do arquivo sem extensão, para sugerir o nome da campanha. */
  onFileName?: (name: string) => void;
}

/**
 * Planilha do passo 1 (só a avulsa): arquivo, colunas, prévia, conferência na API
 * (válidos, inválidos, repetidos, já cadastrados, já saíram) e "pular quem já tem conta".
 */
export function ExternalListPicker({ value, onChange, onFileName }: Props) {
  const previewList = usePreviewExternalList();
  const [parsing, setParsing] = useState(false);
  const [showAllInvalid, setShowAllInvalid] = useState(false);
  const { sheet, mapping, preview, skipRegistered } = value;

  const parsed = useMemo(
    () =>
      sheet
        ? rowsToContacts(sheet.rows, mapping)
        : { contacts: [] as SpreadsheetContact[], emptyRows: 0 },
    [sheet, mapping],
  );
  const contacts = parsed.contacts;
  const tooMany = contacts.length > MAX_EXTERNAL_CONTACTS;
  const hasSource = mapping.phone != null || mapping.email != null;
  const registered = preview ? readAlreadyRegistered(preview) : null;
  const canSkipRegistered =
    registered?.rows !== null && (registered?.count ?? 0) > 0;
  const selection = selectionFromPicker(value);
  const willSend = selection?.willSend ?? 0;
  const allRegistered =
    Boolean(preview) && Boolean(selection?.skipRegistered) && willSend === 0;
  const excluded = preview?.excludedByOptOut ?? 0;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parseSpreadsheetFile(file);
      if (result.headers.length === 0) {
        toast.error("A planilha está vazia ou sem linha de cabeçalho.");
        return;
      }
      onChange({
        ...value,
        sheet: result,
        mapping: detectColumnMapping(result.headers),
        preview: null,
      });
      onFileName?.(file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não consegui ler o arquivo.",
      );
    } finally {
      setParsing(false);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await previewList.mutateAsync(toApiContacts(contacts));
      onChange({ ...value, preview: result });
      setShowAllInvalid(false);
    } catch (error) {
      toast.error(
        getAxiosErrorMessage(error, "Não foi possível conferir a lista."),
      );
    }
  };

  const invalidToShow = preview
    ? showAllInvalid
      ? preview.invalid
      : preview.invalid.slice(0, 10)
    : [];
  /** `row` da API é a posição no array enviado; traduz para a linha do Excel. */
  const lineOf = (row: number) => contacts[row - 1]?.line ?? row;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wz-file">Planilha</Label>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="wz-file"
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 text-sm hover:bg-neutral-50"
          >
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {sheet ? "Trocar arquivo" : "Escolher arquivo"}
          </label>
          <input
            id="wz-file"
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
            <span className="flex min-w-0 items-center gap-1.5 break-all text-sm text-neutral-700">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{sheet.fileName}</span>
              <span className="text-neutral-500">
                · aba “{sheet.sheetName}” · {sheet.rows.length} linha
                {sheet.rows.length === 1 ? "" : "s"}
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          .xlsx, .xls ou .csv com nome, telefone e/ou e-mail.
        </p>
      </div>

      {sheet && (
        <>
          <div className="space-y-2">
            <Label>Colunas</Label>
            <p className="text-xs text-neutral-500">
              Detectadas pelo cabeçalho. Se alguma ficou errada ou em branco,
              escolha aqui.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(Object.keys(FIELD_LABEL) as ContactField[]).map((field) => (
                <div key={field} className="space-y-1">
                  <span className="text-xs font-medium text-neutral-600">
                    {FIELD_LABEL[field]}
                  </span>
                  <NativeSelect
                    data-testid={`mapping-${field}`}
                    className="min-h-11"
                    value={mapping[field] ?? ""}
                    onChange={(event) => {
                      const next = event.target.value;
                      onChange({
                        ...value,
                        mapping: {
                          ...mapping,
                          [field]: next === "" ? null : Number(next),
                        },
                        preview: null,
                      });
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
            <Label>
              Prévia (primeiras {Math.min(PREVIEW_ROWS, contacts.length)}{" "}
              linhas)
            </Label>
            <div className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="w-full text-xs" data-testid="sheet-preview">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Linha</th>
                    <th className="px-2 py-1.5 text-left font-medium">Nome</th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      Telefone
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">
                      E-mail
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, PREVIEW_ROWS).map((c) => (
                    <tr key={c.line} className="border-t border-neutral-100">
                      <td className="px-2 py-1.5 tabular-nums text-neutral-500">
                        {c.line}
                      </td>
                      <td className="px-2 py-1.5">{c.name ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">
                        {c.phone ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">{c.email ?? "—"}</td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-center text-neutral-500"
                      >
                        Nenhuma linha com dado nas colunas escolhidas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500">
              {contacts.length} contato{contacts.length === 1 ? "" : "s"} com
              algum dado
              {parsed.emptyRows > 0 &&
                ` · ${parsed.emptyRows} linha(s) vazia(s) ignorada(s)`}
              . Telefones são convertidos para +55 DDD número.
            </p>
            {tooMany && (
              <p className="text-xs text-red-600">
                Máximo de {MAX_EXTERNAL_CONTACTS.toLocaleString("pt-BR")}{" "}
                contatos por campanha. Divida a planilha.
              </p>
            )}
          </div>

          {/* Conferir ANTES de criar: a lista é congelada na criação. */}
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-600">
                {preview
                  ? "Lista conferida na API."
                  : "Confira a lista: a API valida telefone/e-mail, tira repetidos e diz quem já tem cadastro ou já saiu."}
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                data-testid="check-list-button"
                disabled={
                  previewList.isPending ||
                  contacts.length === 0 ||
                  !hasSource ||
                  tooMany
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
                  <Stat
                    label="Inválidos"
                    value={preview.invalid.length}
                    tone={preview.invalid.length ? "bad" : "muted"}
                  />
                  <Stat
                    label="Repetidos removidos"
                    value={preview.duplicates}
                    tone="muted"
                  />
                  <Stat
                    label="Já cadastrados"
                    value={registered?.count ?? 0}
                    tone={registered?.count ? "warn" : "muted"}
                  />
                </div>
                <p className="text-xs text-neutral-600">
                  {preview.byChannel.whatsapp} por WhatsApp ·{" "}
                  {preview.byChannel.email} por e-mail (quem não tem telefone).
                </p>
                {excluded > 0 && (
                  <p className="text-xs text-amber-800">
                    {excluded === 1
                      ? "1 já pediu para não receber (fica de fora)."
                      : `${excluded} já pediram para não receber (ficam de fora).`}
                  </p>
                )}

                {(registered?.count ?? 0) > 0 && !canSkipRegistered && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {registered?.count} já{" "}
                      {registered?.count === 1 ? "tem" : "têm"} cadastro na
                      plataforma e {registered?.count === 1 ? "vai" : "vão"}{" "}
                      receber a mensagem mesmo assim.
                    </span>
                  </div>
                )}

                {canSkipRegistered && (
                  <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-2">
                    <label className="flex min-h-11 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        data-testid="skip-registered"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={skipRegistered}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            skipRegistered: event.target.checked,
                          })
                        }
                      />
                      <span>
                        Pular quem já tem cadastro ({registered?.count}).{" "}
                        <span className="text-neutral-500">
                          Desmarcado, eles recebem a mensagem mesmo assim.
                        </span>
                      </span>
                    </label>
                    <ul className="max-h-32 space-y-0.5 overflow-y-auto pl-6 text-xs text-neutral-700">
                      {(registered?.rows ?? []).map((item) => {
                        const contact = contacts[item.row - 1];
                        return (
                          <li key={`${item.row}-${item.userId}`}>
                            <span className="font-mono text-neutral-500">
                              linha {contact?.line ?? item.row}
                            </span>{" "}
                            —{" "}
                            {contact?.name ||
                              contact?.phone ||
                              contact?.email ||
                              "(sem nome)"}
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
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                    Todos os contatos válidos já têm cadastro — com “pular”
                    marcado, a campanha ficaria vazia. Desmarque para enviar
                    mesmo assim, ou troque a planilha.
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
                        className="mt-1 min-h-11 text-xs underline"
                        onClick={() => setShowAllInvalid(true)}
                      >
                        Ver todas ({preview.invalid.length})
                      </button>
                    )}
                  </div>
                )}

                <p className="text-sm font-medium" data-testid="will-send">
                  Vão entrar na campanha: {willSend} contato
                  {willSend === 1 ? "" : "s"}.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
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
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

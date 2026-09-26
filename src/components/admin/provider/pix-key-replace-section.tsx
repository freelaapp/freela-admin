"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/ui/native-select";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  replaceProviderPixKey,
  type PixKeyKind,
  type ReplacePixKeyResult,
} from "@/modules/admin/infrastructure/pix-keys-api";

const TIPOS: { value: PixKeyKind; label: string; placeholder: string }[] = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "telefone", label: "Celular", placeholder: "(11) 99999-9999" },
  { value: "email", label: "E-mail", placeholder: "nome@email.com" },
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "aleatoria", label: "Aleatória", placeholder: "Cole a chave aleatória" },
];

/**
 * "Trocar chave Pix" pelo suporte (freelancer que não consegue cadastrar pelo
 * app, ou cuja chave não existe no Pix e o repasse falhou).
 *
 * Fica dentro do modal de detalhes do freelancer, não num segundo diálogo por
 * cima. A API grava a chave nos dois módulos e já tenta criar a subconta na
 * Woovi: o resultado mostra na hora se o Pix aceitou a chave — é a checagem que
 * antes só acontecia no dia do repasse.
 */
export function PixKeyReplaceSection({ providerGlobalId }: { providerGlobalId: string }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<PixKeyKind>("cpf");
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ReplacePixKeyResult | null>(null);

  const placeholder = TIPOS.find((t) => t.value === tipo)?.placeholder ?? "";
  const podeEnviar = valor.trim().length >= 3 && !enviando;

  async function salvar() {
    if (!podeEnviar) return;
    setEnviando(true);
    setResultado(null);
    try {
      const r = await replaceProviderPixKey(providerGlobalId, tipo, valor.trim());
      setResultado(r);
      if (r.subaccountReady) toast.success("Chave Pix trocada e aceita pelo Pix.");
      else toast.warning("Chave gravada, mas o Pix recusou. Veja o motivo abaixo.");
    } catch (e) {
      toast.error(getAxiosErrorMessage(e, "Não foi possível trocar a chave Pix."));
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e5e5] px-3 py-1.5 text-sm text-[#1d1d1b] hover:bg-[#f7f7f7] cursor-pointer"
      >
        <KeyRound className="w-4 h-4 text-[#737373]" />
        Trocar chave Pix
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#e5e5e5] p-3">
      <p className="text-sm font-medium text-[#1d1d1b] flex items-center gap-1.5">
        <KeyRound className="w-4 h-4 text-[#737373]" />
        Trocar chave Pix padrão
      </p>
      <p className="text-xs text-[#737373]">
        Substitui a chave que recebe os repasses (Empresa e Casa) e confere com o Pix na hora.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <NativeSelect
          aria-label="Tipo de chave"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as PixKeyKind);
            setResultado(null);
          }}
          disabled={enviando}
          className="sm:w-36"
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
        <input
          aria-label="Valor da chave"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setResultado(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
          }}
          placeholder={placeholder}
          disabled={enviando}
          className="h-9 flex-1 rounded-md border border-[#e5e5e5] px-3 text-sm outline-none focus:border-[#eca826]"
        />
      </div>

      {resultado && (
        <div
          role="status"
          className={
            resultado.subaccountReady
              ? "flex items-start gap-2 rounded-md bg-green-50 p-2 text-sm text-green-800"
              : "flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900"
          }
        >
          {resultado.subaccountReady ? (
            <>
              <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" />
              <span>O Pix aceitou a chave. Os próximos repasses vão para ela.</span>
            </>
          ) : (
            <>
              <TriangleAlert className="mt-0.5 w-4 h-4 shrink-0" />
              <span>
                Chave gravada, mas o Pix recusou: {resultado.subaccountError ?? "motivo não informado"}.
                Peça ao freelancer outra chave (o CPF costuma funcionar).
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setResultado(null);
            setValor("");
          }}
          disabled={enviando}
          className="rounded-md px-3 py-1.5 text-sm text-[#737373] hover:bg-[#f7f7f7] cursor-pointer disabled:opacity-40"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={!podeEnviar}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#eca826] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#d9961c] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Trocar chave
        </button>
      </div>
    </div>
  );
}

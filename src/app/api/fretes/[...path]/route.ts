import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy server-side para a API do Freela Fretes.
 *
 * Existe por um motivo de segurança, não de conveniência: aquela API autentica
 * por uma CHAVE ESTÁTICA (`x-admin-key`) que dá acesso a todos os cadastros —
 * CPF, CNH, telefone e e-mail de motorista. Se o navegador chamasse direto, a
 * chave apareceria no devtools de qualquer pessoa com acesso ao painel. Aqui
 * ela fica no servidor e nunca é enviada ao cliente.
 *
 * Autorização: o chamador precisa mandar o Bearer do admin, que é validado
 * contra o `GET /v1/admins/me` do api-freela. Sem isso, esta rota seria um
 * buraco aberto no nosso domínio para ler a base inteira de cadastros.
 *
 * Envs (server-only, sem `NEXT_PUBLIC_`):
 * - `FRETES_API_URL`        base da API de fretes (ex.: https://…/)
 * - `FRETES_ADMIN_API_KEY`  valor de `ADMIN_API_KEY` daquela API
 */

/** Só estas rotas são repassadas — proxy aberto viraria porta dos fundos. */
const ALLOWED_PATHS = new Set(["v1/registrations/drivers", "v1/registrations/companies"]);

const ADMIN_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(
  /\/+$/,
  "",
);

/** Valida o Bearer do chamador contra o api-freela. Retorna o papel do admin. */
async function assertAdmin(req: NextRequest): Promise<{ ok: boolean; status: number }> {
  const authorization = req.headers.get("authorization");
  if (!authorization) return { ok: false, status: 401 };

  try {
    const res = await fetch(`${ADMIN_API_URL}/admins/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
    });
    return { ok: res.ok, status: res.ok ? 200 : res.status };
  } catch {
    // API de admin fora do ar: nega. Falhar fechado é o certo aqui — liberar
    // por indisponibilidade exporia os cadastros.
    return { ok: false, status: 503 };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = path.join("/");

  if (!ALLOWED_PATHS.has(target)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Rota não disponível." } },
      { status: 404 },
    );
  }

  const auth = await assertAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sessão de admin inválida." } },
      { status: auth.status },
    );
  }

  const baseUrl = process.env.FRETES_API_URL?.replace(/\/+$/, "");
  const adminKey = process.env.FRETES_ADMIN_API_KEY;
  if (!baseUrl || !adminKey) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message: "Integração com Fretes não configurada (FRETES_API_URL/FRETES_ADMIN_API_KEY).",
        },
      },
      { status: 503 },
    );
  }

  const search = req.nextUrl.search;
  try {
    const upstream = await fetch(`${baseUrl}/${target}${search}`, {
      headers: { "x-admin-key": adminKey },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "API de Fretes indisponível." } },
      { status: 502 },
    );
  }
}

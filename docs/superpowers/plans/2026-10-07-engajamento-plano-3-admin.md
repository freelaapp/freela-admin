# Engajamento — Plano 3: tela `/engajamento` no freela-admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à diretoria, ao comercial e ao suporte a página "Engajamento" no freela-admin: quem abre o app, quem se candidata, quem publica vaga, por período, cidade, produto e canal. A página tem listas com contato para reativar, busca de uma empresa ou freelancer com a ficha dela, e exportação em PDF e Excel.

**Architecture:** Camadas do admin, no molde de `admin-api.ts` + `use-admin-metrics.ts`:
- **Infra:** `engagement-api.ts` (client `createAuthedClient("/v1/admin/engagement")` + tipos que espelham a API, com datas em string), `engagement-xlsx.ts` (escreve o arquivo com `xlsx`), `engagement-pdf.ts` (monta os 2 PDFs com `jsPDF`) e `svg-to-png.ts` (gráfico → imagem).
- **Aplicação (funções puras e testáveis):** `engagement-filters.ts` (filtros ↔ URL), `engagement-format.ts` (números, datas de Brasília, rótulos), `engagement-metrics.ts` (definição de cada número com rótulo e ajuda da spec §3) e `engagement-export.ts` (dados → linhas de planilha e tabelas de PDF). Os hooks ficam em `use-engagement.ts`.
- **Tela:** `src/app/(auth)/engajamento/` (página, 2 fichas e `_components/`).

Desvios conscientes da spec §5.3: os hooks ficam num arquivo só (`use-engagement.ts`) em vez de `use-engagement-*.ts`, e os builders de exportação também (`engagement-export.ts`) em vez de uma pasta. São poucos e andam juntos.

As fichas só usam o **período**, porque a API ignora cidade, produto e canal nelas (`toEngagementFilters(q).window`). Por isso a barra das fichas mostra só o período, mas o link de volta leva todos os filtros.

**Tech Stack:**
- Next.js 15 (App Router, páginas `"use client"`), Tailwind v4, TanStack Query 5 (`keepPreviousData`);
- Recharts 2.15, jspdf 4, xlsx 0.18.5, sonner, lucide-react 1.x;
- Vitest 3 + Testing Library (jsdom, `globals`, jest-dom), alias `@` → `src`.

**Spec:** `api-freela/.wt/engagement-dashboard/docs/superpowers/specs/2026-10-07-dashboard-engajamento-design.md` (§5 tela e exportação; §3 definições, que viram rótulos e textos de ajuda). Contrato da API já pronto no PR #569 (`api-freela/src/common/engagement-reports/engagement.types.ts`, `admin-engagement.controller.ts`, `engagement-filters.ts`).

## Global Constraints

- **Máquina trava com carga:**
  - testes **um arquivo por vez**, em baixa prioridade: `nice -n 15 npx vitest run <arquivo> --maxWorkers=1 --minWorkers=1`;
  - **nunca** a suíte inteira, nunca em paralelo com outra coisa pesada;
  - typecheck **só no fim**, sozinho: `nice -n 15 npx tsc --noEmit -p tsconfig.json`. Se falhar por erro antigo, compare com `origin/main` e corrija só os erros novos;
  - **sem** `yarn build`/`next build` local (a Vercel builda no push);
  - lint só nos caminhos tocados: `nice -n 15 npx eslint <caminhos>`;
  - caminhos com `(auth)` vão sempre entre aspas no shell.
- **node_modules:** o worktree usa um symlink para o `node_modules` do checkout principal (Task 0). Nada de `yarn install` no worktree.
- **Commits** sempre com autor freelaapp, porque a Vercel só publica a `main` se o autor do último commit for o freelaapp:

  ```bash
  git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "<mensagem>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  **Entrega sem `gh pr merge`.** Depois que o PR #569 da API for mergeado e estiver no ar, o dono publica com fast-forward (`git push origin feat/engajamento:main`, via `!`) e confere o deployment na Vercel (Task 9).
- **Contrato da API (PR #569):**
  - `overview` responde `{ data: EngagementOverview }`;
  - as listas respondem `{ data: rows[], meta: { total, page, limit, truncated } }`;
  - as fichas respondem `{ data }`;
  - os erros vêm como `{ error: { code, message } }`.
  - As datas chegam como **string ISO**. A comparação está em `period.previousStart/previousEnd/previousLabel` (não existe chave `previousPeriod`).
  - `document` da empresa é só CNPJ: a API nunca devolve CPF.
  - `opened*`, `series[].freelancersOpened/contractorsOpened` e `byCity[].freelancersOpened` podem vir `null` (antes de a medição começar, 07/10/2026).
  - Query string: `period`, `from`/`to` (`YYYY-MM-DD`, só no `custom`, `to` inclusivo), `city`, `uf`, `product`, `channel`. Nas listas também vão `segment`, `search`, `includeNoAccess=true`, `page`, `limit` (até 100) e `export=1` (até 20.000 linhas, com `meta.truncated`).
  - Permissões: `overview` é aberto a qualquer admin; lista e ficha de freelancer exigem `FREELANCERS`; lista e ficha de empresa exigem `COMPANIES`. Sem a área, a API responde 403.
- **Brasília = UTC−3 fixo** (a mesma regra da API). Um instante ISO vira data com −3 h; um dia puro (`"2026-10-07"`, ex.: `measuredSince` e `bucket`) só é reformatado, sem fuso.
- **"—" para sem dado, nunca 0.**
  - Na tela e no PDF, `null` vira "—", e a comparação vira "sem comparação".
  - No Excel, `null` vira célula **vazia**.
- **Toda tela responsiva** (regra do dono):
  - 1 coluna no celular;
  - filtros quebram linha e recolhem no celular;
  - tabelas viram cartões abaixo de `md`.
- Textos da tela em português simples, no tom do admin.
- **Dados pessoais:**
  - o PDF do painel tem só agregados;
  - o PDF da empresa (para o cliente) **não** tem telefone, e-mail nem CNPJ/CPF de ninguém;
  - o Excel das listas e das fichas tem contatos (uso interno) e só aparece para quem tem a área.
- **PDF com helvetica = WinAnsi:** nada de "−" (U+2212), "≤" ou "≥". Acentos, "—", "·" e "…" funcionam.
- **Padrões do repo:**
  - `*-api.ts` sem Zod (só interfaces TS), devolvendo `res.data.data`;
  - testes colocados ao lado (`*.test.ts(x)`);
  - página com `useSearchParams` dentro de `<Suspense>`;
  - `router.replace(…, { scroll: false })` para a URL;
  - não importar código de outras telas (dashboard, pipeline): helpers próprios.

## Review Focus

1. **Período que começa antes da medição** (`opened` = `null`) → os cartões mostram "—" e "sem comparação", o funil mostra "—" sem %, o PDF escreve "—" e o Excel deixa a célula vazia. Nada vira 0. Testes:
   - Task 2: `engagement-format.test.ts` e `engagement-metrics.test.ts` ("antes da medição");
   - Task 3: `engagement-export.test.ts` ("aberturas ficam VAZIAS");
   - Task 4: `engagement-pdf.test.ts`;
   - Task 5: `metric-grid.test.tsx` e `funnel.test.tsx`.
2. **URL com parâmetro inválido ou faltando** (`?periodo=xpto&de=2026-13-40&aba=nada`) → cai nos padrões, e a página não quebra. Personalizado incompleto ou invertido → nenhuma consulta sai, e a barra diz o que falta. Testes:
   - Task 2: `engagement-filters.test.ts`;
   - Task 6: `use-engagement.test.tsx` ("personalizado incompleto não dispara");
   - Task 7: `_tests/page.test.tsx` ("URL inválida…" e "data apagada…").
3. **Admin sem `FREELANCERS`/`COMPANIES`** → as listas, a busca e as fichas daquele lado somem (e a rota da ficha redireciona pelo `useAreaGuard`), mas a visão geral continua funcionando. Testes:
   - Task 6: `entity-search.test.tsx`;
   - Task 7: `_tests/page.test.tsx` ("sem FREELANCERS/COMPANIES");
   - Task 8: os dois `_tests/page.test.tsx` das fichas.
4. **Exportação com mais de 20.000 linhas** → o arquivo sai com as primeiras 20.000, um aviso visível (toast) e uma nota na aba Filtros. Testes:
   - Task 3: `engagement-export.test.ts` ("corte da exportação");
   - Task 6: `people-table.test.tsx` ("mais de 20.000").
5. **Dados pessoais e fórmula no Excel** → o PDF da empresa nunca contém o telefone, o e-mail ou o documento da empresa, e as células de texto que começam com `=`, `+`, `-` ou `@` são neutralizadas. Testes:
   - Task 3: `engagement-export.test.ts` ("relatório do cliente") e `engagement-xlsx.test.ts`;
   - Task 4: `engagement-pdf.test.ts` ("NUNCA leva telefone").

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/modules/admin/infrastructure/engagement-api.ts` (+ `.test.ts`) | tipos espelhados da API, query string, chamadas |
| `src/modules/admin/application/engagement.test-fixtures.ts` | cenário de setembro/2026 usado por todos os testes |
| `src/modules/admin/application/engagement-format.ts` (+ teste) | números pt-BR, variação, datas de Brasília, rótulos, WhatsApp, nome de arquivo |
| `src/modules/admin/application/engagement-filters.ts` (+ teste) | presets, padrões, URL ↔ filtros, validação do personalizado, links das fichas, descrição dos filtros |
| `src/modules/admin/application/engagement-metrics.ts` (+ teste) | definições dos números (rótulo, ajuda, formato, sentido bom), funis, séries, números das fichas |
| `src/modules/admin/application/engagement-export.ts` (+ teste) | abas do Excel e tabelas do PDF (puras) |
| `src/modules/admin/infrastructure/engagement-xlsx.ts` (+ teste) | `downloadSheets` com `xlsx`, nomes de aba e anti-fórmula |
| `src/modules/admin/infrastructure/engagement-pdf.ts` (+ teste) | PDF do painel e relatório da empresa para o cliente |
| `src/modules/admin/infrastructure/svg-to-png.ts` (+ teste) | SVG do Recharts → PNG para o PDF |
| `src/modules/admin/application/use-engagement.ts` (+ `.test.tsx`) | hooks react-query (visão geral, listas, fichas) |
| `src/app/(auth)/engajamento/_components/states.tsx` | `Spinner` e `ErrorBox` |
| `src/app/(auth)/engajamento/_components/contact.tsx` | telefone (link do WhatsApp) e e-mail |
| `src/app/(auth)/engajamento/_components/filter-bar.tsx` (+ teste) | período, datas, cidade com busca, produto, canal, botões de exportar |
| `src/app/(auth)/engajamento/_components/metric-grid.tsx` (+ teste) | cartões com variação e quebra Empresa × Casa |
| `src/app/(auth)/engajamento/_components/funnel.tsx` (+ teste) | funil em barras |
| `src/app/(auth)/engajamento/_components/series-chart.tsx` | gráfico no tempo (tela) + versão fixa para o PDF |
| `src/app/(auth)/engajamento/_components/city-table.tsx` (+ teste) | tabela por cidade (cartões no celular) |
| `src/app/(auth)/engajamento/_components/measurement-notice.tsx` (+ teste) | aviso "Aberturas medidas desde…" |
| `src/app/(auth)/engajamento/_components/use-debounced.ts` | atraso da busca |
| `src/app/(auth)/engajamento/_components/people-table.tsx` (+ teste) | lista paginada com segmento, busca, WhatsApp e Excel |
| `src/app/(auth)/engajamento/_components/entity-search.tsx` (+ teste) | busca global de empresa ou freelancer |
| `src/app/(auth)/engajamento/_components/use-detail-filters.ts` | filtros da ficha na URL e link de volta |
| `src/app/(auth)/engajamento/_components/detail-parts.tsx` | voltar, resumo, números com anterior, dias por canal |
| `src/app/(auth)/engajamento/page.tsx` + `_tests/page.test.tsx` | página com abas |
| `src/app/(auth)/engajamento/freelancer/[id]/page.tsx` + `_tests/page.test.tsx` | ficha do freelancer |
| `src/app/(auth)/engajamento/empresa/[id]/page.tsx` + `_tests/page.test.tsx` | ficha da empresa + relatório para o cliente |
| `src/components/shared/admin-layout.tsx` (mod.) | item "Engajamento" no menu |

---

### Task 0: Worktree pronto

**Files:** nenhum código.

- [ ] **Step 1: Conferir o branch e ligar o `node_modules`**

```bash
cd /home/doutor/coding/freela/freela-admin/.wt/engajamento
git status -sb                      # ## feat/engajamento...origin/main, limpo
git fetch origin && git merge-base --is-ancestor origin/main HEAD && echo "base ok"
ln -s /home/doutor/coding/freela/freela-admin/node_modules node_modules
ls node_modules/jspdf/package.json node_modules/xlsx/package.json
```

Esperado: `base ok` e os dois `package.json` listados. O `node_modules` está no `.gitignore` (`/node_modules`), então o symlink não entra em commit.

- [ ] **Step 2: Fumaça do Vitest num teste existente (prova que o symlink funciona)**

```bash
nice -n 15 npx vitest run src/components/shared/status-badge.test.tsx --maxWorkers=1 --minWorkers=1
```

Esperado: `Test Files  1 passed (1)`.

---

### Task 1: Client e tipos da API

**Files:**
- Create: `src/modules/admin/infrastructure/engagement-api.ts`
- Create: `src/modules/admin/infrastructure/engagement-api.test.ts`

**Interfaces:**
- Consumes: `createAuthedClient` (`@/modules/shared/infrastructure/authed-client`).
- Produces:
  - Tipos `EngagementPeriodPreset`, `EngagementProduct`, `EngagementChannel`, `ModuleKey`, `EngagementStatus`, `SeriesUnit`, `FreelancerSegment`, `ContractorSegment`, `Metric`, `EngagementPeriod`, `SeriesPoint`, `CityRow`, `CityOption`, `EngagementOverview`, `FreelancerListRow`, `ContractorListRow`, `PeriodPair`, `ChannelDays`, `FreelancerDetail`, `ContractorDetail`.
  - Tipos da tela: `EngagementFilters`, `EngagementListParams` e `ListPage<T> { rows; total; page; limit; truncated }`.
  - `engagementQuery(f)`, `engagementPeriodQuery(f)` e `engagementListQuery(f, p)`.
  - `getEngagementOverview(f)`, `listEngagementFreelancers(f, p)`, `listEngagementContractors(f, p)`, `getFreelancerEngagement(userId, f)` e `getContractorEngagement(userId, f)`.

- [ ] **Step 1: Teste que falha**

`src/modules/admin/infrastructure/engagement-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de campaign-templates-api.test.ts (vi.hoisted evita o hoisting trap).
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get }),
}));

import {
  engagementListQuery,
  engagementQuery,
  getContractorEngagement,
  getEngagementOverview,
  listEngagementFreelancers,
  type EngagementFilters,
} from "./engagement-api";

const BASE: EngagementFilters = {
  period: "this_month",
  from: "2026-09-08",
  to: "2026-10-07",
  city: "",
  uf: "",
  product: "all",
  channel: "all",
};

beforeEach(() => get.mockReset());

describe("engagementQuery", () => {
  it("o padrão não manda nada (a API já cai no mês corrente)", () => {
    expect(engagementQuery(BASE)).toEqual({});
  });

  it("from/to só no personalizado", () => {
    expect(engagementQuery({ ...BASE, period: "7d" })).toEqual({ period: "7d" });
    expect(engagementQuery({ ...BASE, period: "custom", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("cidade, UF, produto e canal quando escolhidos", () => {
    expect(
      engagementQuery({ ...BASE, city: "Juiz de Fora", uf: "MG", product: "home_services", channel: "app" }),
    ).toEqual({ city: "Juiz de Fora", uf: "MG", product: "home_services", channel: "app" });
  });
});

describe("engagementListQuery", () => {
  it("página, limite, segmento, busca aparada e contas sem acesso", () => {
    expect(
      engagementListQuery(BASE, {
        segment: "opened_no_apply",
        search: "  ana ",
        includeNoAccess: true,
        page: 2,
        limit: 25,
      }),
    ).toEqual({ segment: "opened_no_apply", search: "ana", includeNoAccess: "true", page: "2", limit: "25" });
  });

  it("exportação manda export=1 e nem página nem limite", () => {
    expect(engagementListQuery(BASE, { page: 3, limit: 25, exportAll: true })).toEqual({ export: "1" });
  });
});

describe("chamadas", () => {
  it("overview devolve o miolo do envelope", async () => {
    get.mockResolvedValue({ data: { data: { measuredSince: null } } });
    await expect(getEngagementOverview({ ...BASE, period: "30d" })).resolves.toEqual({ measuredSince: null });
    expect(get).toHaveBeenCalledWith("/overview", { params: { period: "30d" } });
  });

  it("lista junta linhas e meta, inclusive o corte da exportação", async () => {
    get.mockResolvedValue({
      data: { data: [{ userId: "u1" }], meta: { total: 25000, page: 1, limit: 20000, truncated: true } },
    });
    await expect(listEngagementFreelancers(BASE, { exportAll: true })).resolves.toEqual({
      rows: [{ userId: "u1" }],
      total: 25000,
      page: 1,
      limit: 20000,
      truncated: true,
    });
    expect(get).toHaveBeenCalledWith("/freelancers", { params: { export: "1" } });
  });

  it("ficha codifica o id e manda só o período (a API ignora o resto nas fichas)", async () => {
    get.mockResolvedValue({ data: { data: { ok: true } } });
    await getContractorEngagement("a/b c", {
      ...BASE,
      period: "last_month",
      city: "Gramado",
      uf: "RS",
      channel: "web",
    });
    expect(get).toHaveBeenCalledWith("/contractors/a%2Fb%20c", { params: { period: "last_month" } });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-api.test.ts --maxWorkers=1 --minWorkers=1
```

Esperado: FAIL com `Failed to resolve import "./engagement-api"`.

- [ ] **Step 3: Implementar**

`src/modules/admin/infrastructure/engagement-api.ts`:

```ts
import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Dashboard de engajamento (spec 2026-10-07 §4–§5). Os tipos espelham
 * `api-freela/src/common/engagement-reports/engagement.types.ts`, com as datas
 * como string ISO (é o que chega pelo JSON). Sem Zod, como os outros *-api.ts.
 */
const engagementApi = createAuthedClient("/v1/admin/engagement");

// ─── Tipos da API ───────────────────────────────────────────────────────────

export type EngagementPeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "custom";
export type EngagementProduct = "all" | "bars_restaurants" | "home_services";
export type EngagementChannel = "all" | "app" | "web";
export type ModuleKey = "bars_restaurants" | "home_services";
export type EngagementStatus = "active" | "cooling" | "stopped" | "never";
export type SeriesUnit = "day" | "week" | "month";
export type FreelancerSegment =
  | "opened_no_apply"
  | "applied"
  | "active"
  | "cooling"
  | "stopped"
  | "never";
export type ContractorSegment =
  | "opened_no_publish"
  | "published"
  | "active"
  | "cooling"
  | "stopped"
  | "never";

/** `null` = sem dado (ex.: aberturas antes de a medição começar). Nunca tratar como 0. */
export interface Metric {
  current: number | null;
  previous: number | null;
  /** Só nos números de vaga (contam linhas de cada produto). */
  byModule?: { barsRestaurants: number; homeServices: number };
}

/** Janela resolvida pela API. `end` e `previousEnd` são exclusivos. */
export interface EngagementPeriod {
  preset: EngagementPeriodPreset;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  label: string;
  previousLabel: string;
}

export interface SeriesPoint {
  /** "YYYY-MM-DD" do começo do balde (dia, semana a partir da segunda, ou mês). */
  bucket: string;
  vacanciesPublished: number;
  vacanciesCompleted: number;
  candidacies: number;
  freelancersOpened: number | null;
  contractorsOpened: number | null;
}

export interface CityRow {
  city: string;
  uf: string | null;
  vacanciesPublished: number;
  candidacies: number;
  avgCandidaciesPerVacancy: number | null;
  /** null = sem medição de aberturas na janela. */
  freelancersOpened: number | null;
}

export interface CityOption {
  city: string;
  uf: string | null;
  label: string;
}

export interface EngagementOverview {
  period: EngagementPeriod;
  /** "YYYY-MM-DD" do 1º dia com aberturas registradas; null = ainda sem medição. */
  measuredSince: string | null;
  openedAvailable: { current: boolean; previous: boolean };
  freelancers: {
    baseTotal: Metric;
    baseWithAccess: Metric;
    baseNew: Metric;
    opened: Metric;
    openedNoApply: Metric;
    applied: Metric;
    candidacies: Metric;
    avgCandidaciesPerApplicant: Metric;
    accepted: Metric;
    completed: Metric;
  };
  contractors: {
    baseTotal: Metric;
    baseNew: Metric;
    opened: Metric;
    openedNoPublish: Metric;
    published: Metric;
    vacancies: Metric;
    completed: Metric;
  };
  vacancies: {
    published: Metric;
    completed: Metric;
    cancelledByContractor: Metric;
    cancelledByAdmin: Metric;
    cancelledBySystem: Metric;
    noCandidate: Metric;
    candidacies: Metric;
    avgCandidaciesPerVacancy: Metric;
    withCandidatePct: Metric;
    medianHoursToFirstCandidacy: Metric;
  };
  series: { unit: SeriesUnit; points: SeriesPoint[] };
  byCity: CityRow[];
  filterOptions: { cities: CityOption[] };
}

export interface FreelancerListRow {
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  products: ModuleKey[];
  hasAccess: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lastCandidacyAt: string | null;
  candidaciesInPeriod: number;
  completedInPeriod: number;
  openedInPeriod: boolean;
  status: EngagementStatus;
}

export interface ContractorListRow {
  userId: string;
  name: string;
  /** Só CNPJ: a API nunca devolve CPF. */
  document: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  uf: string | null;
  products: ModuleKey[];
  hasAccess: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  lastVacancyAt: string | null;
  vacanciesInPeriod: number;
  completedInPeriod: number;
  openedInPeriod: boolean;
  status: EngagementStatus;
}

export interface PeriodPair {
  current: number;
  previous: number;
}

export type ChannelDays = Record<"app" | "web" | "other", number>;

export interface FreelancerDetail {
  period: EngagementPeriod;
  summary: {
    userId: string;
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    uf: string | null;
    products: ModuleKey[];
    hasAccess: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    lastCandidacyAt: string | null;
    status: EngagementStatus;
  };
  numbers: {
    candidacies: PeriodPair;
    accepted: PeriodPair;
    completed: PeriodPair;
    activeDays: PeriodPair;
  };
  activeDaysByChannel: ChannelDays;
  candidacies: Array<{
    candidacyId: string;
    vacancyId: string;
    module: ModuleKey;
    companyName: string | null;
    serviceType: string | null;
    title: string | null;
    vacancyDate: string | null;
    status: string;
    createdAt: string;
    completed: boolean;
  }>;
}

export interface ContractorDetail {
  period: EngagementPeriod;
  summary: {
    userId: string;
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    uf: string | null;
    products: ModuleKey[];
    hasAccess: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    lastVacancyAt: string | null;
    status: EngagementStatus;
  };
  numbers: {
    published: PeriodPair;
    completed: PeriodPair;
    cancelled: PeriodPair;
    noCandidate: PeriodPair;
    candidaciesReceived: PeriodPair;
    distinctHired: PeriodPair;
    contractedCents: PeriodPair;
    activeDays: PeriodPair;
    avgCandidaciesPerVacancy: { current: number | null; previous: number | null };
  };
  activeDaysByChannel: ChannelDays;
  vacancies: Array<{
    vacancyId: string;
    module: ModuleKey;
    serviceType: string | null;
    title: string | null;
    vacancyDate: string | null;
    city: string | null;
    createdAt: string;
    status: string;
    jobStatus: string | null;
    candidates: number;
    workerFirstNames: string[];
  }>;
}

// ─── Tipos da tela ──────────────────────────────────────────────────────────

/**
 * Filtros como a tela guarda (e escreve na URL). `city`/`uf` vazios = todas as
 * cidades. `from`/`to` só valem no personalizado.
 */
export interface EngagementFilters {
  period: EngagementPeriodPreset;
  from: string;
  to: string;
  city: string;
  uf: string;
  product: EngagementProduct;
  channel: EngagementChannel;
}

export interface EngagementListParams {
  segment?: string | null;
  search?: string;
  includeNoAccess?: boolean;
  page?: number;
  limit?: number;
  /** Exportação: a API devolve até 20.000 linhas de uma vez (`meta.truncated` se cortou). */
  exportAll?: boolean;
}

export interface ListPage<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  truncated: boolean;
}

interface ListEnvelope<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; truncated: boolean };
}

// ─── Query string ───────────────────────────────────────────────────────────

/** Só manda o que foge do padrão da API (mês corrente, tudo). `from`/`to` só no personalizado. */
export function engagementQuery(f: EngagementFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.period !== "this_month") q.period = f.period;
  if (f.period === "custom") {
    q.from = f.from;
    q.to = f.to;
  }
  if (f.city) q.city = f.city;
  if (f.uf) q.uf = f.uf;
  if (f.product !== "all") q.product = f.product;
  if (f.channel !== "all") q.channel = f.channel;
  return q;
}

/** Fichas: a API só usa o período, então cidade/produto/canal nem vão (e não refazem a consulta). */
export function engagementPeriodQuery(f: EngagementFilters): Record<string, string> {
  return engagementQuery({ ...f, city: "", uf: "", product: "all", channel: "all" });
}

export function engagementListQuery(
  f: EngagementFilters,
  p: EngagementListParams,
): Record<string, string> {
  const q = engagementQuery(f);
  if (p.segment) q.segment = p.segment;
  const search = p.search?.trim();
  if (search) q.search = search;
  if (p.includeNoAccess) q.includeNoAccess = "true";
  if (p.exportAll) {
    q.export = "1";
  } else {
    if (p.page) q.page = String(p.page);
    if (p.limit) q.limit = String(p.limit);
  }
  return q;
}

// ─── Chamadas ───────────────────────────────────────────────────────────────

export async function getEngagementOverview(f: EngagementFilters): Promise<EngagementOverview> {
  const res = await engagementApi.get<{ data: EngagementOverview }>("/overview", {
    params: engagementQuery(f),
  });
  return res.data.data;
}

async function getList<T>(
  path: string,
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<T>> {
  const res = await engagementApi.get<ListEnvelope<T>>(path, { params: engagementListQuery(f, p) });
  const { data, meta } = res.data;
  return { rows: data, total: meta.total, page: meta.page, limit: meta.limit, truncated: meta.truncated };
}

export function listEngagementFreelancers(
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<FreelancerListRow>> {
  return getList<FreelancerListRow>("/freelancers", f, p);
}

export function listEngagementContractors(
  f: EngagementFilters,
  p: EngagementListParams,
): Promise<ListPage<ContractorListRow>> {
  return getList<ContractorListRow>("/contractors", f, p);
}

export async function getFreelancerEngagement(
  userId: string,
  f: EngagementFilters,
): Promise<FreelancerDetail> {
  const res = await engagementApi.get<{ data: FreelancerDetail }>(
    `/freelancers/${encodeURIComponent(userId)}`,
    { params: engagementPeriodQuery(f) },
  );
  return res.data.data;
}

export async function getContractorEngagement(
  userId: string,
  f: EngagementFilters,
): Promise<ContractorDetail> {
  const res = await engagementApi.get<{ data: ContractorDetail }>(
    `/contractors/${encodeURIComponent(userId)}`,
    { params: engagementPeriodQuery(f) },
  );
  return res.data.data;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-api.test.ts --maxWorkers=1 --minWorkers=1
```

Esperado: `Test Files  1 passed (1)` e `Tests  8 passed (8)`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/infrastructure/engagement-api.ts src/modules/admin/infrastructure/engagement-api.test.ts
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): client e tipos da API de engajamento" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Fixtures, formatos, filtros na URL e definições dos números

**Files:**
- Create: `src/modules/admin/application/engagement.test-fixtures.ts`
- Create: `src/modules/admin/application/engagement-format.ts` + `engagement-format.test.ts`
- Create: `src/modules/admin/application/engagement-filters.ts` + `engagement-filters.test.ts`
- Create: `src/modules/admin/application/engagement-metrics.ts` + `engagement-metrics.test.ts`

**Interfaces:**
- Consumes: os tipos da Task 1.
- Produces:
  - **Fixtures:** `SAMPLE_OVERVIEW`, `SAMPLE_OVERVIEW_BEFORE_MEASUREMENT`, `SAMPLE_FREELANCER_ROW`, `SAMPLE_CONTRACTOR_ROW`, `SAMPLE_FREELANCER_DETAIL` e `SAMPLE_CONTRACTOR_DETAIL`.
  - **Formato:**
    - `type ValueKind = "int" | "decimal" | "pct" | "hours" | "brl"` (`brl` em centavos) e `type EngagementSide = "freelancer" | "contractor"`;
    - `DASH`, `formatValue(v, kind)`, `pctChange(c, p)`, `signedPct(p)`, `deltaInfo(m, kind, higherIsBetter) → { text, color }`;
    - `statusLabel(status, side)`, `STATUS_BADGE`, `FREELANCER_SEGMENTS`, `CONTRACTOR_SEGMENTS`, `PRODUCT_LABEL`, `productsLabel(list)`, `candidacyStatusLabel(s)`, `vacancySituation(status, jobStatus)`;
    - `dateBR(v)`, `dateTimeBR(v)`, `lastDayBR(endIso)`, `brasiliaDayOf(iso)`, `bucketLabel(key, unit)`, `waLink(phone)` e `fileSlug(text)`.
  - **Filtros:**
    - `PERIOD_PRESETS`, `PRODUCT_OPTIONS`, `CHANNEL_OPTIONS`, `ENGAGEMENT_TABS`, `type EngagementTab`, `parseEngagementTab(v)`, `MAX_CUSTOM_DAYS`;
    - `isoDayBrasilia(daysAgo, now)`, `isValidIsoDay(s)`, `defaultFilters(now)`, `filtersFromSearchParams(sp, now)`, `filtersToSearchParams(f, extra)`, `withQuery(path, sp)`;
    - `customRangeError(f)`, `isFilterReady(f)`, `fichaHref(side, userId, f)`;
    - `type FilterEntry { label; value }`, `periodText(f, period)`, `filterEntries(f, period)` e `describeFilters(f, period)`.
  - **Números:**
    - `interface MetricDef { key; label; help; kind; higherIsBetter; opened?; icon; pick(o) → Metric }`;
    - `FREELANCER_METRICS`, `CONTRACTOR_METRICS`, `VACANCY_METRICS`, `OVERVIEW_HIGHLIGHTS`, `ALL_METRIC_GROUPS`;
    - `type SeriesKey`, `SERIES_LINES`, `interface FunnelStep { label; value }`, `freelancerFunnel(o)`, `contractorFunnel(o)`, `funnelBars(steps) → { label; value; width; share }[]`;
    - `interface DetailNumberDef<D>`, `FREELANCER_DETAIL_NUMBERS`, `CONTRACTOR_DETAIL_NUMBERS` e `CLIENT_REPORT_NUMBERS`.

- [ ] **Step 1: Fixtures (cenário de setembro/2026, coerente entre si)**

`src/modules/admin/application/engagement.test-fixtures.ts`:

```ts
import type {
  ContractorDetail,
  ContractorListRow,
  EngagementOverview,
  FreelancerDetail,
  FreelancerListRow,
  Metric,
  SeriesPoint,
} from "../infrastructure/engagement-api";

/**
 * Cenário fixo de setembro/2026 para os testes do engajamento. Os números
 * fecham entre si: 3 vagas (2 Empresa + 1 Casa), 2 com candidato, 2
 * candidaturas (média 0,67), 2 concluídas; a série soma o mesmo.
 * O nome não termina em `.test.ts` de propósito: o Vitest não o roda.
 */
const m = (current: number | null, previous: number | null): Metric => ({ current, previous });
const split = (current: number, previous: number, bars: number, casa: number): Metric => ({
  current,
  previous,
  byModule: { barsRestaurants: bars, homeServices: casa },
});

const SEPT_POINTS: SeriesPoint[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  return {
    bucket: `2026-09-${String(day).padStart(2, "0")}`,
    vacanciesPublished: day === 5 ? 2 : day === 12 ? 1 : 0,
    vacanciesCompleted: day === 6 || day === 13 ? 1 : 0,
    candidacies: day === 5 || day === 12 ? 1 : 0,
    freelancersOpened: day === 5 ? 3 : day === 12 ? 2 : 0,
    contractorsOpened: day === 5 ? 2 : day === 12 ? 1 : 0,
  };
});

export const SAMPLE_OVERVIEW: EngagementOverview = {
  period: {
    preset: "custom",
    start: "2026-09-01T03:00:00.000Z",
    end: "2026-10-01T03:00:00.000Z",
    previousStart: "2026-08-02T03:00:00.000Z",
    previousEnd: "2026-09-01T03:00:00.000Z",
    label: "01/09/2026 a 30/09/2026",
    previousLabel: "02/08/2026 a 31/08/2026",
  },
  measuredSince: "2026-07-20",
  openedAvailable: { current: true, previous: true },
  freelancers: {
    baseTotal: m(150210, 150190),
    baseWithAccess: m(412, 398),
    baseNew: m(20, 12),
    opened: m(4, 3),
    openedNoApply: m(2, 2),
    applied: m(2, 1),
    candidacies: m(2, 1),
    avgCandidaciesPerApplicant: m(1, 1),
    accepted: m(2, 1),
    completed: m(2, 1),
  },
  contractors: {
    baseTotal: m(820, 815),
    baseNew: m(5, 3),
    opened: m(3, 2),
    openedNoPublish: m(1, 1),
    published: m(2, 1),
    vacancies: m(3, 1),
    completed: m(2, 1),
  },
  vacancies: {
    published: split(3, 1, 2, 1),
    completed: split(2, 1, 2, 0),
    cancelledByContractor: split(1, 0, 1, 0),
    cancelledByAdmin: split(0, 0, 0, 0),
    cancelledBySystem: split(0, 1, 0, 0),
    noCandidate: split(1, 0, 0, 1),
    candidacies: split(2, 1, 2, 0),
    avgCandidaciesPerVacancy: m(0.67, 1),
    withCandidatePct: m(66.7, 100),
    medianHoursToFirstCandidacy: m(15, 4),
  },
  series: { unit: "day", points: SEPT_POINTS },
  byCity: [
    {
      city: "Juiz de Fora",
      uf: "MG",
      vacanciesPublished: 3,
      candidacies: 2,
      avgCandidaciesPerVacancy: 0.67,
      freelancersOpened: 4,
    },
  ],
  filterOptions: {
    cities: [
      { city: "Juiz de Fora", uf: "MG", label: "Juiz de Fora - MG" },
      { city: "Gramado", uf: "RS", label: "Gramado - RS" },
    ],
  },
};

/** O mesmo mês visto com a medição começando só em 07/10/2026: "abriram" = null. */
export const SAMPLE_OVERVIEW_BEFORE_MEASUREMENT: EngagementOverview = {
  ...SAMPLE_OVERVIEW,
  measuredSince: "2026-10-07",
  openedAvailable: { current: false, previous: false },
  freelancers: { ...SAMPLE_OVERVIEW.freelancers, opened: m(null, null), openedNoApply: m(null, null) },
  contractors: { ...SAMPLE_OVERVIEW.contractors, opened: m(null, null), openedNoPublish: m(null, null) },
  series: {
    unit: "day",
    points: SEPT_POINTS.map((p) => ({ ...p, freelancersOpened: null, contractorsOpened: null })),
  },
  byCity: SAMPLE_OVERVIEW.byCity.map((c) => ({ ...c, freelancersOpened: null })),
};

export const SAMPLE_FREELANCER_ROW: FreelancerListRow = {
  userId: "u-f1",
  name: "Ana Souza",
  phone: "(32) 99876-5432",
  email: "ana@exemplo.com",
  city: "Juiz de Fora",
  uf: "MG",
  products: ["bars_restaurants"],
  hasAccess: true,
  createdAt: "2026-05-24T13:00:00.000Z",
  lastSeenAt: "2026-09-28T15:00:00.000Z",
  lastCandidacyAt: "2026-09-20T12:00:00.000Z",
  candidaciesInPeriod: 2,
  completedInPeriod: 1,
  openedInPeriod: true,
  status: "cooling",
};

export const SAMPLE_CONTRACTOR_ROW: ContractorListRow = {
  userId: "u-c1",
  name: "Bar do Zé",
  document: "12.345.678/0001-90",
  phone: "(32) 3215-0000",
  email: "contato@bardoze.com.br",
  city: "Juiz de Fora",
  uf: "MG",
  products: ["bars_restaurants"],
  hasAccess: true,
  createdAt: "2026-03-10T13:00:00.000Z",
  lastSeenAt: "2026-09-30T20:00:00.000Z",
  lastVacancyAt: "2026-09-12T14:00:00.000Z",
  vacanciesInPeriod: 3,
  completedInPeriod: 2,
  openedInPeriod: true,
  status: "cooling",
};

export const SAMPLE_FREELANCER_DETAIL: FreelancerDetail = {
  period: SAMPLE_OVERVIEW.period,
  summary: {
    userId: "u-f1",
    name: "Ana Souza",
    phone: "(32) 99876-5432",
    email: "ana@exemplo.com",
    city: "Juiz de Fora",
    uf: "MG",
    products: ["bars_restaurants"],
    hasAccess: true,
    createdAt: "2026-05-24T13:00:00.000Z",
    lastSeenAt: "2026-09-28T15:00:00.000Z",
    lastCandidacyAt: "2026-09-20T12:00:00.000Z",
    status: "cooling",
  },
  numbers: {
    candidacies: { current: 2, previous: 1 },
    accepted: { current: 1, previous: 0 },
    completed: { current: 1, previous: 0 },
    activeDays: { current: 5, previous: 2 },
  },
  activeDaysByChannel: { app: 4, web: 1, other: 0 },
  candidacies: [
    {
      candidacyId: "cd-1",
      vacancyId: "v-1",
      module: "bars_restaurants",
      companyName: "Bar do Zé",
      serviceType: "Garçom",
      title: "Garçom para sábado",
      vacancyDate: "2026-09-06T21:00:00.000Z",
      status: "ACCEPTED",
      createdAt: "2026-09-05T14:00:00.000Z",
      completed: true,
    },
    {
      candidacyId: "cd-2",
      vacancyId: "v-2",
      module: "bars_restaurants",
      companyName: "Bar do Zé",
      serviceType: "Garçom",
      title: null,
      vacancyDate: "2026-09-13T21:00:00.000Z",
      status: "NOT_SELECTED",
      createdAt: "2026-09-12T15:00:00.000Z",
      completed: false,
    },
  ],
};

export const SAMPLE_CONTRACTOR_DETAIL: ContractorDetail = {
  period: SAMPLE_OVERVIEW.period,
  summary: {
    userId: "u-c1",
    name: "Bar do Zé",
    document: "12.345.678/0001-90",
    phone: "(32) 3215-0000",
    email: "contato@bardoze.com.br",
    city: "Juiz de Fora",
    uf: "MG",
    products: ["bars_restaurants"],
    hasAccess: true,
    createdAt: "2026-03-10T13:00:00.000Z",
    lastSeenAt: "2026-09-30T20:00:00.000Z",
    lastVacancyAt: "2026-09-12T14:00:00.000Z",
    status: "cooling",
  },
  numbers: {
    published: { current: 3, previous: 1 },
    completed: { current: 2, previous: 1 },
    cancelled: { current: 1, previous: 0 },
    noCandidate: { current: 1, previous: 0 },
    candidaciesReceived: { current: 2, previous: 1 },
    distinctHired: { current: 2, previous: 1 },
    contractedCents: { current: 36000, previous: 18000 },
    activeDays: { current: 6, previous: 3 },
    avgCandidaciesPerVacancy: { current: 0.67, previous: 1 },
  },
  activeDaysByChannel: { app: 2, web: 4, other: 0 },
  vacancies: [
    {
      vacancyId: "v-1",
      module: "bars_restaurants",
      serviceType: "Garçom",
      title: "Garçom para sábado",
      vacancyDate: "2026-09-06T21:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-05T13:00:00.000Z",
      status: "CLOSED",
      jobStatus: "COMPLETED",
      candidates: 1,
      workerFirstNames: ["Ana"],
    },
    {
      vacancyId: "v-2",
      module: "bars_restaurants",
      serviceType: "Cozinheiro",
      title: null,
      vacancyDate: "2026-09-13T21:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-12T13:00:00.000Z",
      status: "CLOSED",
      jobStatus: "COMPLETED",
      candidates: 1,
      workerFirstNames: ["Bruno"],
    },
    {
      vacancyId: "v-3",
      module: "bars_restaurants",
      serviceType: "Barman",
      title: null,
      vacancyDate: "2026-09-20T21:00:00.000Z",
      city: "Juiz de Fora",
      createdAt: "2026-09-12T14:00:00.000Z",
      status: "CANCELLED_BY_CONTRACTOR",
      jobStatus: null,
      candidates: 0,
      workerFirstNames: [],
    },
  ],
};
```

- [ ] **Step 2: Testes que falham**

`src/modules/admin/application/engagement-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  brasiliaDayOf,
  bucketLabel,
  candidacyStatusLabel,
  dateBR,
  dateTimeBR,
  deltaInfo,
  fileSlug,
  formatValue,
  lastDayBR,
  pctChange,
  productsLabel,
  signedPct,
  statusLabel,
  vacancySituation,
  waLink,
} from "./engagement-format";

// O Intl separa "R$" do número com espaço inquebrável (U+00A0).
const plain = (s: string) => s.replace(/ /g, " ");

describe("formatValue", () => {
  it("sem dado vira travessão, nunca 0", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue(undefined, "pct")).toBe("—");
    expect(formatValue(Number.NaN, "decimal")).toBe("—");
  });

  it("formatos pt-BR", () => {
    expect(formatValue(150210)).toBe("150.210");
    expect(formatValue(0)).toBe("0");
    expect(formatValue(0.67, "decimal")).toBe("0,67");
    expect(formatValue(66.7, "pct")).toBe("66,7%");
    expect(formatValue(15, "hours")).toBe("15 h");
    expect(formatValue(0.5, "hours")).toBe("30 min");
    expect(plain(formatValue(12345678, "brl"))).toBe("R$ 123.456,78");
  });
});

describe("variação", () => {
  it("pctChange e signedPct", () => {
    expect(pctChange(3, 1)).toBe(200);
    expect(pctChange(0.67, 1)).toBe(-33);
    expect(pctChange(4, 0)).toBeNull();
    expect(pctChange(null, 1)).toBeNull();
    expect(signedPct(200)).toBe("+200%");
    expect(signedPct(-33)).toBe("-33%");
    expect(signedPct(0)).toBe("0%");
    expect(signedPct(null)).toBe("—");
  });

  it("antes da medição (um dos lados null) → sem comparação, cinza", () => {
    expect(deltaInfo({ current: 4, previous: null }, "int")).toEqual({
      text: "sem comparação",
      color: "text-[#737373]",
    });
    expect(deltaInfo({ current: null, previous: null }, "int")).toEqual({
      text: "sem comparação",
      color: "text-[#737373]",
    });
  });

  it("anterior 0 → sem base / sem movimento", () => {
    expect(deltaInfo({ current: 4, previous: 0 }, "int").text).toBe("anterior: 0 · sem base");
    expect(deltaInfo({ current: 0, previous: 0 }, "int").text).toBe("anterior: 0 · sem movimento");
  });

  it("a cor segue o que é bom para o indicador", () => {
    expect(deltaInfo({ current: 4, previous: 3 }, "int")).toEqual({
      text: "anterior: 3 · +33%",
      color: "text-green-500",
    });
    expect(deltaInfo({ current: 15, previous: 4 }, "hours", false)).toEqual({
      text: "anterior: 4 h · +275%",
      color: "text-red-500",
    });
    expect(deltaInfo({ current: 0.67, previous: 1 }, "decimal")).toEqual({
      text: "anterior: 1 · -33%",
      color: "text-red-500",
    });
    expect(deltaInfo({ current: 2, previous: 2 }, "int")).toEqual({
      text: "anterior: 2 · 0%",
      color: "text-[#737373]",
    });
  });
});

describe("rótulos", () => {
  it("status muda com o lado (gênero e 'nunca')", () => {
    expect(statusLabel("active", "freelancer")).toBe("Ativo");
    expect(statusLabel("active", "contractor")).toBe("Ativa");
    expect(statusLabel("stopped", "contractor")).toBe("Parada");
    expect(statusLabel("never", "freelancer")).toBe("Nunca se candidatou");
    expect(statusLabel("never", "contractor")).toBe("Nunca publicou");
  });

  it("produtos, candidatura e situação da vaga", () => {
    expect(productsLabel(["bars_restaurants", "home_services"])).toBe("Empresa + Casa");
    expect(productsLabel([])).toBe("—");
    expect(candidacyStatusLabel("NOT_SELECTED")).toBe("Não selecionado");
    expect(candidacyStatusLabel("XYZ")).toBe("XYZ");
    expect(vacancySituation("CLOSED", "COMPLETED")).toBe("Concluída");
    expect(vacancySituation("CANCELLED_BY_CONTRACTOR", null)).toBe("Cancelada pela empresa");
    expect(vacancySituation("OPEN", null)).toBe("Aberta");
  });
});

describe("datas em Brasília", () => {
  it("instante ISO usa UTC−3; dia puro só é reformatado", () => {
    expect(dateBR("2026-10-01T02:59:00.000Z")).toBe("30/09/2026");
    expect(dateBR("2026-10-07")).toBe("07/10/2026");
    expect(dateBR(null)).toBe("—");
    expect(dateBR("ontem")).toBe("—");
    expect(dateTimeBR(new Date("2026-10-07T15:04:00.000Z"))).toBe("07/10/2026 12:04");
    expect(lastDayBR("2026-10-01T03:00:00.000Z")).toBe("30/09/2026");
    expect(brasiliaDayOf("2026-09-01T03:00:00.000Z")).toBe("2026-09-01");
  });

  it("rótulo dos baldes da série", () => {
    expect(bucketLabel("2026-09-05", "day")).toBe("05/09");
    expect(bucketLabel("2026-07-06", "week")).toBe("sem. 06/07");
    expect(bucketLabel("2026-09-01", "month")).toBe("set/26");
  });
});

describe("WhatsApp e nome de arquivo", () => {
  it("põe o 55 só quando falta; menos de 10 dígitos não vira link", () => {
    expect(waLink("(32) 99876-5432")).toBe("https://wa.me/5532998765432");
    expect(waLink("+55 54 99999-0000")).toBe("https://wa.me/5554999990000");
    expect(waLink("3215-0000")).toBeNull();
    expect(waLink(null)).toBeNull();
  });

  it("fileSlug", () => {
    expect(fileSlug("Bar do Zé")).toBe("bar-do-ze");
    expect(fileSlug("01/09/2026 a 30/09/2026")).toBe("01-09-2026-a-30-09-2026");
    expect(fileSlug("!!!")).toBe("engajamento");
  });
});
```

`src/modules/admin/application/engagement-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { EngagementFilters } from "../infrastructure/engagement-api";
import { SAMPLE_OVERVIEW } from "./engagement.test-fixtures";
import {
  customRangeError,
  defaultFilters,
  describeFilters,
  fichaHref,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFilterReady,
  isoDayBrasilia,
  parseEngagementTab,
  withQuery,
} from "./engagement-filters";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const sp = (qs: string) => new URLSearchParams(qs);

describe("isoDayBrasilia", () => {
  it("usa o dia de Brasília (00:30 UTC ainda é o dia anterior)", () => {
    expect(isoDayBrasilia(0, new Date("2026-10-08T00:30:00.000Z"))).toBe("2026-10-07");
    expect(isoDayBrasilia(29, NOW)).toBe("2026-09-08");
  });
});

describe("URL ↔ filtros", () => {
  it("URL vazia = mês corrente, tudo; personalizado já sugere os últimos 30 dias", () => {
    expect(filtersFromSearchParams(sp(""), NOW)).toEqual({
      period: "this_month",
      from: "2026-09-08",
      to: "2026-10-07",
      city: "",
      uf: "",
      product: "all",
      channel: "all",
    });
  });

  it("valores inválidos voltam ao padrão sem quebrar", () => {
    const f = filtersFromSearchParams(
      sp("periodo=xpto&de=2026-13-40&ate=ontem&produto=bar&canal=tv&uf=Minas"),
      NOW,
    );
    expect(f).toEqual(defaultFilters(NOW));
  });

  it("personalizado com data inexistente cai na data padrão e continua pronto", () => {
    const f = filtersFromSearchParams(sp("periodo=custom&de=2026-02-30&ate=2026-09-30"), NOW);
    expect(f.period).toBe("custom");
    expect(f.from).toBe("2026-09-08");
    expect(f.to).toBe("2026-09-30");
    expect(isFilterReady(f)).toBe(true);
  });

  it("UF sem cidade é ignorada", () => {
    expect(filtersFromSearchParams(sp("uf=MG"), NOW).uf).toBe("");
  });

  it("ida e volta preserva tudo e só escreve o que foge do padrão", () => {
    const f: EngagementFilters = {
      period: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
      city: "Juiz de Fora",
      uf: "MG",
      product: "bars_restaurants",
      channel: "app",
    };
    const qs = filtersToSearchParams(f, { aba: "freelancers" });
    expect(qs.toString()).toBe(
      "periodo=custom&de=2026-09-01&ate=2026-09-30&cidade=Juiz+de+Fora&uf=MG&produto=bars_restaurants&canal=app&aba=freelancers",
    );
    expect(filtersFromSearchParams(qs, NOW)).toEqual(f);
    expect(filtersToSearchParams(defaultFilters(NOW)).toString()).toBe("");
    expect(withQuery("/engajamento", filtersToSearchParams(defaultFilters(NOW)))).toBe("/engajamento");
  });
});

describe("período personalizado incompleto não pode consultar", () => {
  const base = defaultFilters(NOW);

  it.each([
    [{ ...base, period: "custom" as const, from: "" }, "Escolha a data inicial e a final."],
    [
      { ...base, period: "custom" as const, from: "2026-09-30", to: "2026-09-01" },
      "A data inicial precisa ser antes da final.",
    ],
    [
      { ...base, period: "custom" as const, from: "2024-01-01", to: "2026-09-30" },
      "Escolha um período de até 2 anos.",
    ],
  ])("caso %#", (f, msg) => {
    expect(customRangeError(f)).toBe(msg);
    expect(isFilterReady(f)).toBe(false);
  });

  it("presets estão sempre prontos, mesmo com data apagada", () => {
    expect(isFilterReady({ ...base, period: "7d", from: "" })).toBe(true);
  });
});

describe("textos e links", () => {
  it("describeFilters sem resposta usa o rótulo do preset", () => {
    const f = { ...defaultFilters(NOW), city: "Gramado", uf: "RS", product: "home_services" as const };
    expect(describeFilters(f)).toBe(
      "Período: Este mês · Cidade: Gramado - RS · Produto: Só Casa · Canal: App + site",
    );
  });

  it("com a resposta usa o rótulo da API; personalizado sem resposta mostra as datas", () => {
    const f = { ...defaultFilters(NOW), period: "custom" as const, from: "2026-09-01", to: "2026-09-30" };
    expect(describeFilters(f, SAMPLE_OVERVIEW.period)).toContain("Período: 01/09/2026 a 30/09/2026");
    expect(describeFilters(f)).toContain("Período: 01/09/2026 a 30/09/2026");
  });

  it("fichaHref codifica o id e leva filtros + aba", () => {
    expect(fichaHref("contractor", "u/1", { ...defaultFilters(NOW), period: "7d" })).toBe(
      "/engajamento/empresa/u%2F1?periodo=7d&aba=empresas",
    );
    expect(fichaHref("freelancer", "u-f1", defaultFilters(NOW))).toBe(
      "/engajamento/freelancer/u-f1?aba=freelancers",
    );
  });

  it("aba inválida cai na visão geral", () => {
    expect(parseEngagementTab("empresas")).toBe("empresas");
    expect(parseEngagementTab("nada")).toBe("visao-geral");
    expect(parseEngagementTab(null)).toBe("visao-geral");
  });
});
```

`src/modules/admin/application/engagement-metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "./engagement.test-fixtures";
import {
  ALL_METRIC_GROUPS,
  CLIENT_REPORT_NUMBERS,
  CONTRACTOR_DETAIL_NUMBERS,
  OVERVIEW_HIGHLIGHTS,
  SERIES_LINES,
  contractorFunnel,
  freelancerFunnel,
  funnelBars,
} from "./engagement-metrics";

const ALL = ALL_METRIC_GROUPS.flatMap((g) => g.metrics);

describe("definições dos números", () => {
  it("cada grupo tem rótulos únicos, ajuda e valor no fixture", () => {
    for (const g of ALL_METRIC_GROUPS) {
      const labels = g.metrics.map((d) => d.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const d of g.metrics) {
        expect(d.help.length).toBeGreaterThan(20);
        expect(d.pick(SAMPLE_OVERVIEW)).toHaveProperty("current");
      }
    }
  });

  it("onde subir é ruim, a cor inverte", () => {
    expect(ALL.filter((d) => !d.higherIsBetter).map((d) => d.label)).toEqual([
      "Abriram e não se candidataram",
      "Abriram e não publicaram",
      "Canceladas pela empresa",
      "Canceladas pelo admin",
      "Canceladas pelo sistema",
      "Sem candidato",
      "Tempo até a 1ª candidatura",
    ]);
  });

  it("as aberturas são marcadas para ganhar o aviso de medição", () => {
    expect(ALL.filter((d) => d.opened).map((d) => d.key)).toEqual([
      "freelancers.opened",
      "freelancers.openedNoApply",
      "contractors.opened",
      "contractors.openedNoPublish",
    ]);
  });

  it("os destaques da visão geral dizem de quem é o número", () => {
    expect(OVERVIEW_HIGHLIGHTS.map((d) => d.label)).toEqual([
      "Freelancers que abriram",
      "Abriram e não se candidataram",
      "Freelancers que se candidataram",
      "Empresas que abriram",
      "Empresas que publicaram vaga",
      "Vagas publicadas",
      "Vagas concluídas",
      "Candidaturas por vaga",
    ]);
  });

  it("séries e relatório do cliente", () => {
    expect(SERIES_LINES.map((l) => l.key)).toEqual([
      "vacanciesPublished",
      "vacanciesCompleted",
      "candidacies",
      "freelancersOpened",
      "contractorsOpened",
    ]);
    expect(CLIENT_REPORT_NUMBERS.map((d) => d.key)).not.toContain("activeDays");
    expect(
      CONTRACTOR_DETAIL_NUMBERS.find((d) => d.key === "contractedCents")?.pick(SAMPLE_CONTRACTOR_DETAIL),
    ).toEqual({ current: 36000, previous: 18000 });
  });
});

describe("funis", () => {
  it("% sobre o 1º passo e largura sobre o maior", () => {
    const bars = funnelBars(freelancerFunnel(SAMPLE_OVERVIEW));
    expect(bars.map((b) => b.value)).toEqual([4, 2, 2, 2]);
    expect(bars.map((b) => b.share)).toEqual([100, 50, 50, 50]);
    expect(bars.map((b) => b.width)).toEqual([100, 50, 50, 50]);
    expect(funnelBars(contractorFunnel(SAMPLE_OVERVIEW)).map((b) => b.share)).toEqual([100, 67, 67]);
  });

  it("antes da medição: 1º passo sem número → sem %, e a barra dele vazia", () => {
    const bars = funnelBars(freelancerFunnel(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT));
    expect(bars[0]).toMatchObject({ value: null, share: null, width: 0 });
    expect(bars.map((b) => b.share)).toEqual([null, null, null, null]);
    expect(bars.map((b) => b.width)).toEqual([0, 100, 100, 100]);
  });
});
```

- [ ] **Step 3: Rodar os três e ver falhar**

```bash
for f in engagement-format engagement-filters engagement-metrics; do
  nice -n 15 npx vitest run "src/modules/admin/application/$f.test.ts" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
done
```

Esperado: os três com `Failed to resolve import "./engagement-…"` e `Test Files  1 failed (1)`.

- [ ] **Step 4: Implementar os formatos**

`src/modules/admin/application/engagement-format.ts`:

```ts
import type {
  ContractorSegment,
  EngagementStatus,
  FreelancerSegment,
  ModuleKey,
  SeriesUnit,
} from "../infrastructure/engagement-api";

/**
 * Formatos e rótulos do engajamento. Funções puras: a tela, o Excel e o PDF
 * usam as mesmas, para o número nunca sair diferente em cada lugar.
 */
export type ValueKind = "int" | "decimal" | "pct" | "hours" | "brl";
export type EngagementSide = "freelancer" | "contractor";

/** Sem dado (ex.: aberturas antes da medição). Nunca mostrar 0 no lugar. */
export const DASH = "—";

const BRT_OFFSET_MS = 3 * 3_600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const ONE = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NEUTRAL = "text-[#737373]";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `brl` recebe CENTAVOS (a API manda `contractedCents`). */
export function formatValue(v: number | null | undefined, kind: ValueKind = "int"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  switch (kind) {
    case "int":
      return INT.format(v);
    case "decimal":
      return DEC.format(v);
    case "pct":
      return `${ONE.format(v)}%`;
    case "hours":
      return v < 1 ? `${INT.format(Math.round(v * 60))} min` : `${ONE.format(v)} h`;
    case "brl":
      return BRL.format(v / 100);
  }
}

/** Variação em % com 1 casa; null quando falta um lado ou o anterior é 0. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** "+12%", "-5%", "0%". Sinal ASCII: o "−" (U+2212) não existe na fonte do PDF. */
export function signedPct(p: number | null): string {
  if (p === null) return DASH;
  const r = Math.round(p);
  const sign = r > 0 ? "+" : r < 0 ? "-" : "";
  return `${sign}${INT.format(Math.abs(r))}%`;
}

export interface DeltaInfo {
  text: string;
  color: string;
}

/**
 * Comparação do cartão, com as mesmas cores do dashboard. `higherIsBetter=false`
 * inverte (ex.: vaga sem candidato). Empate fica neutro.
 */
export function deltaInfo(
  m: { current: number | null; previous: number | null },
  kind: ValueKind,
  higherIsBetter = true,
): DeltaInfo {
  const { current, previous } = m;
  if (current === null || previous === null) return { text: "sem comparação", color: NEUTRAL };
  const prev = `anterior: ${formatValue(previous, kind)}`;
  if (previous === 0) {
    return { text: `${prev} · ${current === 0 ? "sem movimento" : "sem base"}`, color: NEUTRAL };
  }
  if (current === previous) return { text: `${prev} · 0%`, color: NEUTRAL };
  const up = current > previous;
  return {
    text: `${prev} · ${signedPct(pctChange(current, previous))}`,
    color: up === higherIsBetter ? "text-green-500" : "text-red-500",
  };
}

// ─── Rótulos ────────────────────────────────────────────────────────────────

export function statusLabel(status: EngagementStatus, side: EngagementSide): string {
  const fem = side === "contractor";
  switch (status) {
    case "active":
      return fem ? "Ativa" : "Ativo";
    case "cooling":
      return "Esfriando";
    case "stopped":
      return fem ? "Parada" : "Parado";
    case "never":
      return fem ? "Nunca publicou" : "Nunca se candidatou";
  }
}

export const STATUS_BADGE: Record<EngagementStatus, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  cooling: "warning",
  stopped: "destructive",
  never: "muted",
};

export const FREELANCER_SEGMENTS: { id: FreelancerSegment | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "opened_no_apply", label: "Abriram e não se candidataram" },
  { id: "applied", label: "Se candidataram" },
  { id: "active", label: "Ativos" },
  { id: "cooling", label: "Esfriando" },
  { id: "stopped", label: "Parados" },
  { id: "never", label: "Nunca se candidataram" },
];

export const CONTRACTOR_SEGMENTS: { id: ContractorSegment | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "opened_no_publish", label: "Abriram e não publicaram" },
  { id: "published", label: "Publicaram vaga" },
  { id: "active", label: "Ativas" },
  { id: "cooling", label: "Esfriando" },
  { id: "stopped", label: "Paradas" },
  { id: "never", label: "Nunca publicaram" },
];

export const PRODUCT_LABEL: Record<ModuleKey, string> = {
  bars_restaurants: "Empresa",
  home_services: "Casa",
};

export function productsLabel(list: ModuleKey[]): string {
  return list.length ? list.map((p) => PRODUCT_LABEL[p]).join(" + ") : DASH;
}

const CANDIDACY_STATUS: Record<string, string> = {
  PENDING: "Aguardando",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  CANCELLED_BY_CONTRACTOR: "Cancelada pela empresa",
  WITHDRAWN: "Desistiu",
  NOT_SELECTED: "Não selecionado",
};

export function candidacyStatusLabel(status: string): string {
  return CANDIDACY_STATUS[status] ?? status;
}

/** Situação da vaga em uma palavra, olhando primeiro o serviço (job). */
export function vacancySituation(status: string, jobStatus: string | null): string {
  if (jobStatus === "COMPLETED") return "Concluída";
  if (status === "CANCELLED_BY_CONTRACTOR") return "Cancelada pela empresa";
  if (status === "CANCELLED") return "Cancelada";
  if (jobStatus === "IN_PROGRESS") return "Em andamento";
  if (jobStatus === "SCHEDULED") return "Agendada";
  if (jobStatus === "CANCELLED") return "Serviço cancelado";
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Fechada";
  return status;
}

// ─── Datas (Brasília = UTC−3 fixo, como a API) ──────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

function toBrasilia(value: string | Date): Date | null {
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isNaN(t) ? null : new Date(t - BRT_OFFSET_MS);
}

/** "DD/MM/AAAA" em Brasília. Um dia puro ("2026-10-07") só é reformatado, sem fuso. */
export function dateBR(value: string | Date | null | undefined): string {
  if (!value) return DASH;
  if (typeof value === "string" && ISO_DAY.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const b = toBrasilia(value);
  if (!b) return DASH;
  return `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}/${b.getUTCFullYear()}`;
}

export function dateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return DASH;
  const b = toBrasilia(value);
  if (!b) return DASH;
  return `${pad(b.getUTCDate())}/${pad(b.getUTCMonth() + 1)}/${b.getUTCFullYear()} ${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

/** Último dia (inclusivo) de uma janela `[start, end)`. */
export function lastDayBR(endIso: string): string {
  return dateBR(new Date(Date.parse(endIso) - 1));
}

/** Dia de Brasília ("YYYY-MM-DD") de um instante ISO; "" se inválido. */
export function brasiliaDayOf(iso: string): string {
  const b = toBrasilia(iso);
  return b ? b.toISOString().slice(0, 10) : "";
}

/** Eixo do gráfico: "05/09" (dia), "sem. 06/07" (semana), "set/26" (mês). */
export function bucketLabel(key: string, unit: SeriesUnit): string {
  const [y, m, d] = key.split("-");
  if (unit === "month") return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
  if (unit === "week") return `sem. ${d}/${m}`;
  return `${d}/${m}`;
}

// ─── Contato e arquivo ──────────────────────────────────────────────────────

/** Link do WhatsApp. Número sem DDI (10–11 dígitos) ganha 55; menos de 10 dígitos não dá link. */
export function waLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

export function fileSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "engajamento";
}
```

- [ ] **Step 5: Implementar os filtros**

`src/modules/admin/application/engagement-filters.ts`:

```ts
import type {
  EngagementChannel,
  EngagementFilters,
  EngagementPeriod,
  EngagementPeriodPreset,
  EngagementProduct,
} from "../infrastructure/engagement-api";
import { dateBR, type EngagementSide } from "./engagement-format";

/**
 * Filtros do engajamento e o espelho deles na URL (chaves em português:
 * periodo, de, ate, cidade, uf, produto, canal, aba). Valor inválido na URL
 * cai no padrão: um link velho ou digitado errado nunca quebra a página.
 */

export const PERIOD_PRESETS: { id: EngagementPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

export const PRODUCT_OPTIONS: { id: EngagementProduct; label: string }[] = [
  { id: "all", label: "Empresa + Casa" },
  { id: "bars_restaurants", label: "Só Empresa" },
  { id: "home_services", label: "Só Casa" },
];

export const CHANNEL_OPTIONS: { id: EngagementChannel; label: string }[] = [
  { id: "all", label: "App + site" },
  { id: "app", label: "Só app" },
  { id: "web", label: "Só site" },
];

export const ENGAGEMENT_TABS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "freelancers", label: "Freelancers" },
  { id: "empresas", label: "Empresas" },
  { id: "vagas", label: "Vagas" },
] as const;
export type EngagementTab = (typeof ENGAGEMENT_TABS)[number]["id"];

export function parseEngagementTab(value: string | null | undefined): EngagementTab {
  return ENGAGEMENT_TABS.find((t) => t.id === value)?.id ?? "visao-geral";
}

/** Mesmo teto da API (`MAX_CUSTOM_DAYS`): acima disso ela devolve 400. */
export const MAX_CUSTOM_DAYS = 731;
const DAY_MS = 86_400_000;
const BRT_OFFSET_MS = 3 * 3_600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" de hoje (ou de N dias atrás) em Brasília. */
export function isoDayBrasilia(daysAgo = 0, now: Date = new Date()): string {
  return new Date(now.getTime() - daysAgo * DAY_MS - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Dia que existe no calendário (2026-02-30 não passa). */
export function isValidIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Mês corrente; o personalizado já vem sugerido com os últimos 30 dias. */
export function defaultFilters(now: Date = new Date()): EngagementFilters {
  return {
    period: "this_month",
    from: isoDayBrasilia(29, now),
    to: isoDayBrasilia(0, now),
    city: "",
    uf: "",
    product: "all",
    channel: "all",
  };
}

interface ParamReader {
  get(name: string): string | null;
}

function pick<T extends string>(value: string | null, options: readonly { id: T }[], fallback: T): T {
  return options.find((o) => o.id === value)?.id ?? fallback;
}

export function filtersFromSearchParams(sp: ParamReader, now: Date = new Date()): EngagementFilters {
  const base = defaultFilters(now);
  const de = sp.get("de");
  const ate = sp.get("ate");
  const city = (sp.get("cidade") ?? "").trim().slice(0, 80);
  const uf = (sp.get("uf") ?? "").trim().toUpperCase();
  return {
    period: pick(sp.get("periodo"), PERIOD_PRESETS, base.period),
    from: isValidIsoDay(de) ? de : base.from,
    to: isValidIsoDay(ate) ? ate : base.to,
    city,
    uf: city && /^[A-Z]{2}$/.test(uf) ? uf : "",
    product: pick(sp.get("produto"), PRODUCT_OPTIONS, base.product),
    channel: pick(sp.get("canal"), CHANNEL_OPTIONS, base.channel),
  };
}

/** Só escreve o que foge do padrão (URL curta); `extra` entra no fim (ex.: `aba`). */
export function filtersToSearchParams(
  f: EngagementFilters,
  extra: Record<string, string> = {},
): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.period !== "this_month") sp.set("periodo", f.period);
  if (f.period === "custom") {
    if (f.from) sp.set("de", f.from);
    if (f.to) sp.set("ate", f.to);
  }
  if (f.city) sp.set("cidade", f.city);
  if (f.city && f.uf) sp.set("uf", f.uf);
  if (f.product !== "all") sp.set("produto", f.product);
  if (f.channel !== "all") sp.set("canal", f.channel);
  for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
  return sp;
}

export function withQuery(path: string, sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

/** O que falta no personalizado, em linguagem simples; null = pode consultar. */
export function customRangeError(f: EngagementFilters): string | null {
  if (f.period !== "custom") return null;
  if (!isValidIsoDay(f.from) || !isValidIsoDay(f.to)) return "Escolha a data inicial e a final.";
  if (f.from > f.to) return "A data inicial precisa ser antes da final.";
  const days = (Date.parse(`${f.to}T00:00:00Z`) - Date.parse(`${f.from}T00:00:00Z`)) / DAY_MS + 1;
  if (days > MAX_CUSTOM_DAYS) return "Escolha um período de até 2 anos.";
  return null;
}

/** Personalizado incompleto não consulta: a API cairia no padrão com o rótulo errado. */
export function isFilterReady(f: EngagementFilters): boolean {
  return customRangeError(f) === null;
}

/** Link da ficha levando os filtros e a aba de volta. */
export function fichaHref(side: EngagementSide, userId: string, f: EngagementFilters): string {
  const seg = side === "freelancer" ? "freelancer" : "empresa";
  const aba = side === "freelancer" ? "freelancers" : "empresas";
  return withQuery(`/engajamento/${seg}/${encodeURIComponent(userId)}`, filtersToSearchParams(f, { aba }));
}

export interface FilterEntry {
  label: string;
  value: string;
}

/** Rótulo do período: o da API quando já chegou; senão o do preset (ou as datas). */
export function periodText(f: EngagementFilters, period?: EngagementPeriod | null): string {
  if (period) return period.label;
  if (f.period === "custom") return `${dateBR(f.from)} a ${dateBR(f.to)}`;
  return PERIOD_PRESETS.find((p) => p.id === f.period)?.label ?? f.period;
}

export function filterEntries(f: EngagementFilters, period?: EngagementPeriod | null): FilterEntry[] {
  return [
    { label: "Período", value: periodText(f, period) },
    { label: "Cidade", value: f.city ? (f.uf ? `${f.city} - ${f.uf}` : f.city) : "Todas" },
    { label: "Produto", value: PRODUCT_OPTIONS.find((o) => o.id === f.product)?.label ?? f.product },
    { label: "Canal", value: CHANNEL_OPTIONS.find((o) => o.id === f.channel)?.label ?? f.channel },
  ];
}

/** "Período: … · Cidade: … · Produto: … · Canal: …" (cabeçalho do PDF, resumo no celular). */
export function describeFilters(f: EngagementFilters, period?: EngagementPeriod | null): string {
  return filterEntries(f, period)
    .map((e) => `${e.label}: ${e.value}`)
    .join(" · ");
}
```

- [ ] **Step 6: Implementar as definições dos números (rótulos e ajuda da spec §3)**

`src/modules/admin/application/engagement-metrics.ts`:

```ts
import type { ElementType } from "react";
import {
  Activity,
  Ban,
  Briefcase,
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  EyeOff,
  Hourglass,
  Inbox,
  Percent,
  Send,
  Smartphone,
  Store,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type {
  ContractorDetail,
  EngagementOverview,
  FreelancerDetail,
  Metric,
  SeriesPoint,
} from "../infrastructure/engagement-api";
import type { ValueKind } from "./engagement-format";

/**
 * Cada número do painel em um lugar só: rótulo, ajuda (spec §3), formato e
 * sentido bom. Cartões, Excel e PDF leem daqui.
 */
export interface MetricDef {
  key: string;
  label: string;
  help: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  /** Número de "abriram": "—" antes da medição; a ajuda ganha "Medido desde…". */
  opened?: boolean;
  icon: ElementType;
  pick: (o: EngagementOverview) => Metric;
}

// ─── Freelancers (§3.1) ─────────────────────────────────────────────────────

const F_BASE_TOTAL: MetricDef = {
  key: "freelancers.baseTotal",
  label: "Freelancers na base",
  help: "Cadastrados até o fim do período, contados uma vez mesmo atuando nos dois produtos. Inclui quem nunca ativou a conta (importados).",
  kind: "int",
  higherIsBetter: true,
  icon: Users,
  pick: (o) => o.freelancers.baseTotal,
};
const F_WITH_ACCESS: MetricDef = {
  key: "freelancers.baseWithAccess",
  label: "Com acesso à conta",
  help: "Da base, quantos já ativaram a conta (têm senha, login Google ou Apple). Os outros são contas importadas que nunca entraram.",
  kind: "int",
  higherIsBetter: true,
  icon: UserCheck,
  pick: (o) => o.freelancers.baseWithAccess,
};
const F_NEW: MetricDef = {
  key: "freelancers.baseNew",
  label: "Novos no período",
  help: "Freelancers que se cadastraram dentro do período.",
  kind: "int",
  higherIsBetter: true,
  icon: UserPlus,
  pick: (o) => o.freelancers.baseNew,
};
const F_OPENED: MetricDef = {
  key: "freelancers.opened",
  label: "Abriram o app ou site",
  help: "Freelancers que usaram o app ou o site pelo menos uma vez no período, no canal escolhido.",
  kind: "int",
  higherIsBetter: true,
  opened: true,
  icon: Smartphone,
  pick: (o) => o.freelancers.opened,
};
const F_OPENED_NO_APPLY: MetricDef = {
  key: "freelancers.openedNoApply",
  label: "Abriram e não se candidataram",
  help: "Abriram no período e não fizeram nenhuma candidatura nele. São os mais fáceis de reativar.",
  kind: "int",
  higherIsBetter: false,
  opened: true,
  icon: EyeOff,
  pick: (o) => o.freelancers.openedNoApply,
};
const F_APPLIED: MetricDef = {
  key: "freelancers.applied",
  label: "Se candidataram",
  help: "Freelancers com pelo menos uma candidatura feita no período, em qualquer produto.",
  kind: "int",
  higherIsBetter: true,
  icon: Send,
  pick: (o) => o.freelancers.applied,
};
const F_CANDIDACIES: MetricDef = {
  key: "freelancers.candidacies",
  label: "Candidaturas feitas",
  help: "Total de candidaturas criadas no período pelos freelancers.",
  kind: "int",
  higherIsBetter: true,
  icon: Inbox,
  pick: (o) => o.freelancers.candidacies,
};
const F_AVG: MetricDef = {
  key: "freelancers.avgCandidaciesPerApplicant",
  label: "Candidaturas por freelancer",
  help: "Média de candidaturas de quem se candidatou no período.",
  kind: "decimal",
  higherIsBetter: true,
  icon: Activity,
  pick: (o) => o.freelancers.avgCandidaciesPerApplicant,
};
const F_ACCEPTED: MetricDef = {
  key: "freelancers.accepted",
  label: "Foram aceitos",
  help: "Freelancers com pelo menos uma candidatura aceita no período.",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.freelancers.accepted,
};
const F_COMPLETED: MetricDef = {
  key: "freelancers.completed",
  label: "Concluíram um serviço",
  help: "Freelancers com pelo menos um serviço concluído no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.freelancers.completed,
};

// ─── Empresas (§3.2) ────────────────────────────────────────────────────────

const C_BASE_TOTAL: MetricDef = {
  key: "contractors.baseTotal",
  label: "Empresas na base",
  help: "Contratantes cadastrados até o fim do período, somando os dois produtos (cada um contado uma vez).",
  kind: "int",
  higherIsBetter: true,
  icon: Building2,
  pick: (o) => o.contractors.baseTotal,
};
const C_NEW: MetricDef = {
  key: "contractors.baseNew",
  label: "Novas no período",
  help: "Empresas e contratantes que se cadastraram dentro do período.",
  kind: "int",
  higherIsBetter: true,
  icon: UserPlus,
  pick: (o) => o.contractors.baseNew,
};
const C_OPENED: MetricDef = {
  key: "contractors.opened",
  label: "Abriram o app ou site",
  help: "Empresas que usaram o app ou o site pelo menos uma vez no período, no canal escolhido.",
  kind: "int",
  higherIsBetter: true,
  opened: true,
  icon: Smartphone,
  pick: (o) => o.contractors.opened,
};
const C_OPENED_NO_PUBLISH: MetricDef = {
  key: "contractors.openedNoPublish",
  label: "Abriram e não publicaram",
  help: "Empresas que abriram no período e não criaram nenhuma vaga nele.",
  kind: "int",
  higherIsBetter: false,
  opened: true,
  icon: EyeOff,
  pick: (o) => o.contractors.openedNoPublish,
};
const C_PUBLISHED: MetricDef = {
  key: "contractors.published",
  label: "Publicaram vaga",
  help: "Empresas com pelo menos uma vaga criada no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Store,
  pick: (o) => o.contractors.published,
};
const C_VACANCIES: MetricDef = {
  key: "contractors.vacancies",
  label: "Vagas criadas por elas",
  help: "Total de vagas que as empresas criaram no período.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.contractors.vacancies,
};
const C_COMPLETED: MetricDef = {
  key: "contractors.completed",
  label: "Concluíram contratação",
  help: "Empresas com pelo menos um serviço concluído no período.",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.contractors.completed,
};

// ─── Vagas (§3.3) ───────────────────────────────────────────────────────────

const V_PUBLISHED: MetricDef = {
  key: "vacancies.published",
  label: "Vagas publicadas",
  help: "Vagas criadas no período, sem as excluídas. No Empresa, uma vaga com vários serviços conta como uma.",
  kind: "int",
  higherIsBetter: true,
  icon: Briefcase,
  pick: (o) => o.vacancies.published,
};
const V_COMPLETED: MetricDef = {
  key: "vacancies.completed",
  label: "Vagas concluídas",
  help: "Serviços concluídos no período, pela data de término (mesma regra do dashboard).",
  kind: "int",
  higherIsBetter: true,
  icon: CircleCheck,
  pick: (o) => o.vacancies.completed,
};
const V_CANCEL_CONTRACTOR: MetricDef = {
  key: "vacancies.cancelledByContractor",
  label: "Canceladas pela empresa",
  help: "Vagas criadas no período que a própria empresa cancelou.",
  kind: "int",
  higherIsBetter: false,
  icon: CircleX,
  pick: (o) => o.vacancies.cancelledByContractor,
};
const V_CANCEL_ADMIN: MetricDef = {
  key: "vacancies.cancelledByAdmin",
  label: "Canceladas pelo admin",
  help: "Vagas criadas no período que a equipe cancelou pelo painel.",
  kind: "int",
  higherIsBetter: false,
  icon: Ban,
  pick: (o) => o.vacancies.cancelledByAdmin,
};
const V_CANCEL_SYSTEM: MetricDef = {
  key: "vacancies.cancelledBySystem",
  label: "Canceladas pelo sistema",
  help: "Vagas criadas no período canceladas automaticamente, sem registro de cancelamento pelo admin.",
  kind: "int",
  higherIsBetter: false,
  icon: Ban,
  pick: (o) => o.vacancies.cancelledBySystem,
};
const V_NO_CANDIDATE: MetricDef = {
  key: "vacancies.noCandidate",
  label: "Sem candidato",
  help: "Vagas publicadas no período que não receberam nenhuma candidatura.",
  kind: "int",
  higherIsBetter: false,
  icon: Hourglass,
  pick: (o) => o.vacancies.noCandidate,
};
const V_CANDIDACIES: MetricDef = {
  key: "vacancies.candidacies",
  label: "Candidaturas recebidas",
  help: "Candidaturas nas vagas publicadas no período (todas as linhas, mesmo numa vaga com vários serviços).",
  kind: "int",
  higherIsBetter: true,
  icon: Inbox,
  pick: (o) => o.vacancies.candidacies,
};
const V_AVG: MetricDef = {
  key: "vacancies.avgCandidaciesPerVacancy",
  label: "Candidaturas por vaga",
  help: "Candidaturas das vagas publicadas no período divididas pelo número dessas vagas.",
  kind: "decimal",
  higherIsBetter: true,
  icon: Activity,
  pick: (o) => o.vacancies.avgCandidaciesPerVacancy,
};
const V_WITH_CANDIDATE: MetricDef = {
  key: "vacancies.withCandidatePct",
  label: "Vagas com candidato",
  help: "Parte das vagas publicadas no período que recebeu pelo menos uma candidatura.",
  kind: "pct",
  higherIsBetter: true,
  icon: Percent,
  pick: (o) => o.vacancies.withCandidatePct,
};
const V_MEDIAN_HOURS: MetricDef = {
  key: "vacancies.medianHoursToFirstCandidacy",
  label: "Tempo até a 1ª candidatura",
  help: "Mediana do tempo entre publicar a vaga e chegar a primeira candidatura, nas vagas do período que receberam alguma.",
  kind: "hours",
  higherIsBetter: false,
  icon: Clock,
  pick: (o) => o.vacancies.medianHoursToFirstCandidacy,
};

export const FREELANCER_METRICS: MetricDef[] = [
  F_BASE_TOTAL,
  F_WITH_ACCESS,
  F_NEW,
  F_OPENED,
  F_OPENED_NO_APPLY,
  F_APPLIED,
  F_CANDIDACIES,
  F_AVG,
  F_ACCEPTED,
  F_COMPLETED,
];

export const CONTRACTOR_METRICS: MetricDef[] = [
  C_BASE_TOTAL,
  C_NEW,
  C_OPENED,
  C_OPENED_NO_PUBLISH,
  C_PUBLISHED,
  C_VACANCIES,
  C_COMPLETED,
];

export const VACANCY_METRICS: MetricDef[] = [
  V_PUBLISHED,
  V_COMPLETED,
  V_CANCEL_CONTRACTOR,
  V_CANCEL_ADMIN,
  V_CANCEL_SYSTEM,
  V_NO_CANDIDATE,
  V_CANDIDACIES,
  V_AVG,
  V_WITH_CANDIDATE,
  V_MEDIAN_HOURS,
];

/** Visão geral: os dois lados juntos, então o rótulo diz de quem é o número. */
export const OVERVIEW_HIGHLIGHTS: MetricDef[] = [
  { ...F_OPENED, label: "Freelancers que abriram" },
  F_OPENED_NO_APPLY,
  { ...F_APPLIED, label: "Freelancers que se candidataram" },
  { ...C_OPENED, label: "Empresas que abriram" },
  { ...C_PUBLISHED, label: "Empresas que publicaram vaga" },
  V_PUBLISHED,
  V_COMPLETED,
  V_AVG,
];

export const ALL_METRIC_GROUPS: { title: string; metrics: MetricDef[] }[] = [
  { title: "Freelancers", metrics: FREELANCER_METRICS },
  { title: "Empresas", metrics: CONTRACTOR_METRICS },
  { title: "Vagas", metrics: VACANCY_METRICS },
];

// ─── Série no tempo (§3.4) ──────────────────────────────────────────────────

export type SeriesKey = Exclude<keyof SeriesPoint, "bucket">;

export const SERIES_LINES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "vacanciesPublished", label: "Vagas publicadas", color: "#eca826" },
  { key: "vacanciesCompleted", label: "Vagas concluídas", color: "#16a34a" },
  { key: "candidacies", label: "Candidaturas", color: "#737373" },
  { key: "freelancersOpened", label: "Freelancers que abriram", color: "#1d1d1b" },
  { key: "contractorsOpened", label: "Empresas que abriram", color: "#dc2626" },
];

// ─── Funis ──────────────────────────────────────────────────────────────────

export interface FunnelStep {
  label: string;
  value: number | null;
}

export function freelancerFunnel(o: EngagementOverview): FunnelStep[] {
  return [
    { label: "Abriram o app ou site", value: o.freelancers.opened.current },
    { label: "Se candidataram", value: o.freelancers.applied.current },
    { label: "Foram aceitos", value: o.freelancers.accepted.current },
    { label: "Concluíram um serviço", value: o.freelancers.completed.current },
  ];
}

export function contractorFunnel(o: EngagementOverview): FunnelStep[] {
  return [
    { label: "Abriram o app ou site", value: o.contractors.opened.current },
    { label: "Publicaram vaga", value: o.contractors.published.current },
    { label: "Concluíram contratação", value: o.contractors.completed.current },
  ];
}

export interface FunnelBar extends FunnelStep {
  /** 0–100, sobre o maior valor conhecido. */
  width: number;
  /** % sobre o 1º passo; null se o 1º passo não tem número ou é 0. */
  share: number | null;
}

export function funnelBars(steps: FunnelStep[]): FunnelBar[] {
  const max = Math.max(0, ...steps.map((s) => s.value ?? 0));
  const first = steps[0]?.value ?? null;
  return steps.map((s) => ({
    ...s,
    width: s.value === null || max === 0 ? 0 : Math.round((s.value / max) * 100),
    share: s.value === null || first === null || first === 0 ? null : Math.round((s.value / first) * 100),
  }));
}

// ─── Números das fichas ─────────────────────────────────────────────────────

export interface DetailNumberDef<D> {
  key: string;
  label: string;
  kind: ValueKind;
  higherIsBetter: boolean;
  icon: ElementType;
  pick: (d: D) => { current: number | null; previous: number | null };
}

export const FREELANCER_DETAIL_NUMBERS: DetailNumberDef<FreelancerDetail>[] = [
  { key: "candidacies", label: "Candidaturas", kind: "int", higherIsBetter: true, icon: Inbox, pick: (d) => d.numbers.candidacies },
  { key: "accepted", label: "Candidaturas aceitas", kind: "int", higherIsBetter: true, icon: CircleCheck, pick: (d) => d.numbers.accepted },
  { key: "completed", label: "Serviços concluídos", kind: "int", higherIsBetter: true, icon: Briefcase, pick: (d) => d.numbers.completed },
  { key: "activeDays", label: "Dias em que abriu o app ou site", kind: "int", higherIsBetter: true, icon: Smartphone, pick: (d) => d.numbers.activeDays },
];

export const CONTRACTOR_DETAIL_NUMBERS: DetailNumberDef<ContractorDetail>[] = [
  { key: "published", label: "Vagas publicadas", kind: "int", higherIsBetter: true, icon: Briefcase, pick: (d) => d.numbers.published },
  { key: "completed", label: "Vagas concluídas", kind: "int", higherIsBetter: true, icon: CircleCheck, pick: (d) => d.numbers.completed },
  { key: "cancelled", label: "Vagas canceladas", kind: "int", higherIsBetter: false, icon: CircleX, pick: (d) => d.numbers.cancelled },
  { key: "noCandidate", label: "Vagas sem candidato", kind: "int", higherIsBetter: false, icon: Hourglass, pick: (d) => d.numbers.noCandidate },
  { key: "candidaciesReceived", label: "Candidaturas recebidas", kind: "int", higherIsBetter: true, icon: Inbox, pick: (d) => d.numbers.candidaciesReceived },
  { key: "avgCandidaciesPerVacancy", label: "Candidaturas por vaga", kind: "decimal", higherIsBetter: true, icon: Activity, pick: (d) => d.numbers.avgCandidaciesPerVacancy },
  { key: "distinctHired", label: "Freelancers contratados", kind: "int", higherIsBetter: true, icon: Users, pick: (d) => d.numbers.distinctHired },
  { key: "contractedCents", label: "Valor contratado", kind: "brl", higherIsBetter: true, icon: Wallet, pick: (d) => d.numbers.contractedCents },
  { key: "activeDays", label: "Dias em que abriu o app ou site", kind: "int", higherIsBetter: true, icon: Smartphone, pick: (d) => d.numbers.activeDays },
];

/** Relatório para o cliente: os números da vaga, sem os dias de acesso (uso interno). */
export const CLIENT_REPORT_NUMBERS = CONTRACTOR_DETAIL_NUMBERS.filter((d) => d.key !== "activeDays");
```

- [ ] **Step 7: Rodar os três e ver passar**

```bash
for f in engagement-format engagement-filters engagement-metrics; do
  nice -n 15 npx vitest run "src/modules/admin/application/$f.test.ts" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
done
```

Esperado: `Test Files  1 passed (1)` nos três (format 12 testes, filters 14, metrics 7).

- [ ] **Step 8: Commit**

```bash
git add src/modules/admin/application/engagement.test-fixtures.ts \
        src/modules/admin/application/engagement-format.ts src/modules/admin/application/engagement-format.test.ts \
        src/modules/admin/application/engagement-filters.ts src/modules/admin/application/engagement-filters.test.ts \
        src/modules/admin/application/engagement-metrics.ts src/modules/admin/application/engagement-metrics.test.ts
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): filtros na URL, formatos e definições dos números" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Planilhas do painel, das listas e das fichas

**Files:**
- Create: `src/modules/admin/application/engagement-export.ts` + `engagement-export.test.ts`
- Create: `src/modules/admin/infrastructure/engagement-xlsx.ts` + `engagement-xlsx.test.ts`

**Interfaces:**
- Consumes: Tasks 1 e 2; `sanitizeCsvValue` (`@/lib/csv`).
- Produces:
  - Tipos `Cell = string | number | null`, `Sheet { name; rows: Cell[][] }` e `PdfTable { title; head; rows: string[][] }`.
  - `measurementText(o)`.
  - `overviewSheets(o, entries, generatedAt)`, com as abas Filtros, Resumo, Série e Cidades.
  - `freelancerListSheets(page, entries, segment, generatedAt)` e `contractorListSheets(…)`, com as abas Filtros e Lista.
  - `freelancerDetailSheets(d, entries, generatedAt)` (Filtros, Resumo, Candidaturas) e `contractorDetailSheets(…)` (Filtros, Resumo, Vagas).
  - Tabelas do PDF: `overviewSummaryTables(o)`, `overviewFunnelLines(o)`, `cityTable(o, limit)` e `contractorReportTables(d)`.
  - Do xlsx: `safeSheetName(name, used)`, `sanitizeCells(rows)` e `downloadSheets(filename, sheets)`.

- [ ] **Step 1: Testes que falham**

`src/modules/admin/application/engagement-export.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FilterEntry } from "./engagement-filters";
import {
  cityTable,
  contractorListSheets,
  contractorReportTables,
  freelancerDetailSheets,
  freelancerListSheets,
  overviewSheets,
  overviewSummaryTables,
} from "./engagement-export";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_CONTRACTOR_ROW,
  SAMPLE_FREELANCER_DETAIL,
  SAMPLE_FREELANCER_ROW,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "./engagement.test-fixtures";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const ENTRIES: FilterEntry[] = [
  { label: "Período", value: "01/09/2026 a 30/09/2026" },
  { label: "Cidade", value: "Todas" },
];
const plain = (s: unknown) => String(s).replace(/ /g, " ");
const find = (rows: unknown[][], first: string, second?: string) =>
  rows.find((r) => r[0] === first && (second === undefined || r[1] === second));

describe("Excel do painel", () => {
  it("4 abas e filtros com a data de geração em Brasília", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW);
    expect(sheets.map((s) => s.name)).toEqual(["Filtros", "Resumo", "Série", "Cidades"]);
    expect(sheets[0].rows).toContainEqual(["Período", "01/09/2026 a 30/09/2026"]);
    expect(sheets[0].rows).toContainEqual(["Comparado com", "02/08/2026 a 31/08/2026"]);
    expect(sheets[0].rows).toContainEqual(["Gerado em", "07/10/2026 12:00"]);
  });

  it("Resumo: número fica número; variação em %", () => {
    const resumo = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW)[1].rows;
    expect(resumo[0]).toEqual(["Grupo", "Indicador", "Atual", "Anterior", "Variação (%)"]);
    expect(find(resumo, "Vagas", "Vagas publicadas")).toEqual(["Vagas", "Vagas publicadas", 3, 1, 200]);
    expect(find(resumo, "Vagas", "Vagas com candidato (%)")).toEqual([
      "Vagas",
      "Vagas com candidato (%)",
      66.7,
      100,
      -33.3,
    ]);
  });

  it("antes da medição: aberturas ficam VAZIAS (null), nunca 0", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT, ENTRIES, NOW);
    expect(find(sheets[1].rows, "Freelancers", "Abriram o app ou site")).toEqual([
      "Freelancers",
      "Abriram o app ou site",
      null,
      null,
      null,
    ]);
    expect(sheets[2].rows).toHaveLength(31);
    expect(sheets[2].rows[1]).toEqual(["01/09/2026", 0, 0, 0, null, null]);
    expect(sheets[3].rows[1]).toEqual(["Juiz de Fora", "MG", 3, 2, 0.67, null]);
  });
});

describe("Excel das listas", () => {
  it("lista de freelancers com contato e link do WhatsApp", () => {
    const page = { rows: [SAMPLE_FREELANCER_ROW], total: 1, page: 1, limit: 20000, truncated: false };
    const [filtros, lista] = freelancerListSheets(page, ENTRIES, "Abriram e não se candidataram", NOW);
    expect(filtros.rows).toContainEqual(["Segmento", "Abriram e não se candidataram"]);
    expect(filtros.rows.some((r) => r[0] === "Atenção")).toBe(false);
    expect(lista.rows[0].slice(0, 4)).toEqual(["Nome", "Telefone", "WhatsApp", "E-mail"]);
    expect(lista.rows[1].slice(0, 4)).toEqual([
      "Ana Souza",
      "(32) 99876-5432",
      "https://wa.me/5532998765432",
      "ana@exemplo.com",
    ]);
  });

  it("corte da exportação vira aviso na aba Filtros", () => {
    const page = { rows: [SAMPLE_CONTRACTOR_ROW], total: 25000, page: 1, limit: 20000, truncated: true };
    const [filtros, lista] = contractorListSheets(page, ENTRIES, "Todas", NOW);
    expect(plain(find(filtros.rows, "Atenção")?.[1])).toContain("25.000");
    expect(lista.rows[0].slice(0, 2)).toEqual(["Empresa", "CNPJ"]);
    expect(lista.rows[1][1]).toBe("12.345.678/0001-90");
  });
});

describe("Excel da ficha", () => {
  it("resumo, números com anterior e candidaturas", () => {
    const [, resumo, cands] = freelancerDetailSheets(SAMPLE_FREELANCER_DETAIL, ENTRIES, NOW);
    expect(resumo.rows).toContainEqual(["Status", "Esfriando"]);
    expect(resumo.rows).toContainEqual(["Candidaturas", 2, 1, 100]);
    expect(cands.rows[1]).toEqual([
      "05/09/2026",
      "06/09/2026",
      "Bar do Zé",
      "Garçom para sábado",
      "Empresa",
      "Aceita",
      "Sim",
    ]);
  });
});

describe("tabelas do PDF", () => {
  it("antes da medição: '—' nas aberturas (nunca '0')", () => {
    const [freelas] = overviewSummaryTables(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT);
    expect(freelas.rows.find((r) => r[0] === "Abriram o app ou site")).toEqual([
      "Abriram o app ou site",
      "—",
      "—",
      "—",
    ]);
    expect(cityTable(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT).rows[0]).toEqual([
      "Juiz de Fora - MG",
      "3",
      "2",
      "0,67",
      "—",
    ]);
  });

  it("relatório do cliente: números e vagas, sem contato nem documento", () => {
    const { numbers, vacancies } = contractorReportTables(SAMPLE_CONTRACTOR_DETAIL);
    expect(numbers.rows.map((r) => r[0])).toEqual([
      "Vagas publicadas",
      "Vagas concluídas",
      "Vagas canceladas",
      "Vagas sem candidato",
      "Candidaturas recebidas",
      "Candidaturas por vaga",
      "Freelancers contratados",
      "Valor contratado",
    ]);
    expect(plain(numbers.rows[7][1])).toBe("R$ 360,00");
    expect(vacancies.rows[0]).toEqual(["06/09/2026", "Garçom para sábado", "Juiz de Fora", "1", "Concluída", "Ana"]);
    expect(vacancies.rows[2]).toEqual(["20/09/2026", "Barman", "Juiz de Fora", "0", "Cancelada pela empresa", "—"]);
    const all = JSON.stringify({ numbers, vacancies });
    const s = SAMPLE_CONTRACTOR_DETAIL.summary;
    for (const secret of [s.phone, s.email, s.document]) expect(all).not.toContain(String(secret));
  });
});
```

`src/modules/admin/infrastructure/engagement-xlsx.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Captura o que iria para a planilha: o teste confere as células, não o arquivo.
const { aoa, names, writeFile } = vi.hoisted(() => ({
  aoa: [] as unknown[][][],
  names: [] as string[],
  writeFile: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (rows: unknown[][]) => {
      aoa.push(rows);
      return { rows };
    },
    book_append_sheet: (_wb: unknown, _ws: unknown, name: string) => {
      names.push(name);
    },
  },
  writeFile,
}));

import { downloadSheets, safeSheetName, sanitizeCells } from "./engagement-xlsx";

beforeEach(() => {
  aoa.length = 0;
  names.length = 0;
  writeFile.mockReset();
});

describe("sanitizeCells", () => {
  it("texto que vira fórmula ganha apóstrofo; número, vazio e telefone passam", () => {
    expect(
      sanitizeCells([['=HYPERLINK("http://x")', "@soma", "+5532998765432", "-12,5", "Ana", 42, null]]),
    ).toEqual([["'=HYPERLINK(\"http://x\")", "'@soma", "+5532998765432", "-12,5", "Ana", 42, null]]);
  });
});

describe("safeSheetName", () => {
  it("tira caracteres proibidos, corta em 31 e não repete", () => {
    const used = new Set<string>();
    expect(safeSheetName("Resumo: atual/anterior [set]", used)).toBe("Resumo atual anterior set");
    expect(safeSheetName("Lista", used)).toBe("Lista");
    expect(safeSheetName("lista", used)).toBe("lista 2");
    expect(safeSheetName("x".repeat(40), used)).toHaveLength(31);
  });
});

describe("downloadSheets", () => {
  it("monta o arquivo com as abas na ordem e sanitizado", async () => {
    await downloadSheets("engajamento-setembro", [
      { name: "Filtros", rows: [["Filtro", "Valor"]] },
      { name: "Lista", rows: [["Nome"], ["=cmd|' /C calc'!A0"]] },
    ]);
    expect(names).toEqual(["Filtros", "Lista"]);
    expect(aoa[1][1][0]).toBe("'=cmd|' /C calc'!A0");
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), "engajamento-setembro.xlsx");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
nice -n 15 npx vitest run src/modules/admin/application/engagement-export.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-xlsx.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
```

Esperado: `Failed to resolve import "./engagement-export"` e `… "./engagement-xlsx"`, com `Test Files  1 failed (1)` nos dois.

- [ ] **Step 3: Implementar os builders (puros)**

`src/modules/admin/application/engagement-export.ts`:

```ts
import type {
  ChannelDays,
  ContractorDetail,
  ContractorListRow,
  EngagementOverview,
  FreelancerDetail,
  FreelancerListRow,
  ListPage,
} from "../infrastructure/engagement-api";
import type { FilterEntry } from "./engagement-filters";
import {
  DASH,
  PRODUCT_LABEL,
  candidacyStatusLabel,
  dateBR,
  dateTimeBR,
  formatValue,
  pctChange,
  productsLabel,
  signedPct,
  statusLabel,
  vacancySituation,
  waLink,
  type ValueKind,
} from "./engagement-format";
import {
  ALL_METRIC_GROUPS,
  CLIENT_REPORT_NUMBERS,
  CONTRACTOR_DETAIL_NUMBERS,
  FREELANCER_DETAIL_NUMBERS,
  SERIES_LINES,
  contractorFunnel,
  freelancerFunnel,
  funnelBars,
  type DetailNumberDef,
  type FunnelStep,
} from "./engagement-metrics";

/**
 * Dados → linhas de planilha e tabelas de PDF (spec §5.2). Funções puras: o
 * código que chama `xlsx`/`jspdf` só desenha o que sai daqui.
 */

/** Número fica número (soma no Excel); null = célula vazia (sem dado, nunca 0). */
export type Cell = string | number | null;

export interface Sheet {
  name: string;
  rows: Cell[][];
}

export interface PdfTable {
  title: string;
  head: string[];
  rows: string[][];
}

const UNIT_SUFFIX: Partial<Record<ValueKind, string>> = { pct: " (%)", hours: " (horas)", brl: " (R$)" };

/** brl chega em centavos; a planilha leva reais. */
function cellValue(v: number | null, kind: ValueKind): Cell {
  if (v === null) return null;
  return kind === "brl" ? v / 100 : v;
}

const yesNo = (b: boolean) => (b ? "Sim" : "Não");

function filtersRows(entries: FilterEntry[], generatedAt: Date, extra: [string, Cell][] = []): Cell[][] {
  return [
    ["Filtro", "Valor"],
    ...entries.map((e): Cell[] => [e.label, e.value]),
    ...extra,
    ["Gerado em", dateTimeBR(generatedAt)],
  ];
}

export function measurementText(o: Pick<EngagementOverview, "measuredSince">): string {
  return o.measuredSince
    ? `Aberturas medidas desde ${dateBR(o.measuredSince)}`
    : "Aberturas ainda sem medição";
}

// ─── Excel do painel ────────────────────────────────────────────────────────

export function overviewSheets(o: EngagementOverview, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const resumo: Cell[][] = [["Grupo", "Indicador", "Atual", "Anterior", "Variação (%)"]];
  for (const g of ALL_METRIC_GROUPS) {
    for (const def of g.metrics) {
      const m = def.pick(o);
      resumo.push([
        g.title,
        `${def.label}${UNIT_SUFFIX[def.kind] ?? ""}`,
        cellValue(m.current, def.kind),
        cellValue(m.previous, def.kind),
        pctChange(m.current, m.previous),
      ]);
    }
  }
  const first = o.series.unit === "day" ? "Dia" : o.series.unit === "week" ? "Semana (início)" : "Mês (início)";
  const serie: Cell[][] = [
    [first, ...SERIES_LINES.map((l) => l.label)],
    ...o.series.points.map((p): Cell[] => [dateBR(p.bucket), ...SERIES_LINES.map((l) => p[l.key])]),
  ];
  const cidades: Cell[][] = [
    ["Cidade", "UF", "Vagas publicadas", "Candidaturas", "Candidaturas por vaga", "Freelancers que abriram"],
    ...o.byCity.map((c): Cell[] => [
      c.city,
      c.uf,
      c.vacanciesPublished,
      c.candidacies,
      c.avgCandidaciesPerVacancy,
      c.freelancersOpened,
    ]),
  ];
  return [
    {
      name: "Filtros",
      rows: filtersRows(entries, generatedAt, [
        ["Comparado com", o.period.previousLabel],
        ["Medição", measurementText(o)],
      ]),
    },
    { name: "Resumo", rows: resumo },
    { name: "Série", rows: serie },
    { name: "Cidades", rows: cidades },
  ];
}

// ─── Excel das listas ───────────────────────────────────────────────────────

function listExtra(segment: string, page: ListPage<unknown>): [string, Cell][] {
  const extra: [string, Cell][] = [
    ["Segmento", segment],
    ["Linhas na lista", page.total],
  ];
  if (page.truncated) {
    extra.push([
      "Atenção",
      `A lista tem ${formatValue(page.total)} linhas; este arquivo traz só as primeiras ${formatValue(page.rows.length)}. Use um filtro mais estreito (cidade, segmento ou período) para ver o resto.`,
    ]);
  }
  return extra;
}

export function freelancerListSheets(
  page: ListPage<FreelancerListRow>,
  entries: FilterEntry[],
  segment: string,
  generatedAt: Date,
): Sheet[] {
  const head: Cell[] = [
    "Nome",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Cidade",
    "UF",
    "Produtos",
    "Status",
    "Última atividade conhecida",
    "Última candidatura",
    "Candidaturas no período",
    "Concluídos no período",
    "Abriu no período",
    "Tem acesso",
    "Cadastro",
  ];
  const rows = page.rows.map((r): Cell[] => [
    r.name,
    r.phone,
    waLink(r.phone),
    r.email,
    r.city,
    r.uf,
    productsLabel(r.products),
    statusLabel(r.status, "freelancer"),
    dateBR(r.lastSeenAt),
    dateBR(r.lastCandidacyAt),
    r.candidaciesInPeriod,
    r.completedInPeriod,
    yesNo(r.openedInPeriod),
    yesNo(r.hasAccess),
    dateBR(r.createdAt),
  ]);
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt, listExtra(segment, page)) },
    { name: "Lista", rows: [head, ...rows] },
  ];
}

export function contractorListSheets(
  page: ListPage<ContractorListRow>,
  entries: FilterEntry[],
  segment: string,
  generatedAt: Date,
): Sheet[] {
  const head: Cell[] = [
    "Empresa",
    "CNPJ",
    "Telefone",
    "WhatsApp",
    "E-mail",
    "Cidade",
    "UF",
    "Produtos",
    "Status",
    "Última atividade conhecida",
    "Última vaga",
    "Vagas no período",
    "Concluídas no período",
    "Abriu no período",
    "Tem acesso",
    "Cadastro",
  ];
  const rows = page.rows.map((r): Cell[] => [
    r.name,
    r.document,
    r.phone,
    waLink(r.phone),
    r.email,
    r.city,
    r.uf,
    productsLabel(r.products),
    statusLabel(r.status, "contractor"),
    dateBR(r.lastSeenAt),
    dateBR(r.lastVacancyAt),
    r.vacanciesInPeriod,
    r.completedInPeriod,
    yesNo(r.openedInPeriod),
    yesNo(r.hasAccess),
    dateBR(r.createdAt),
  ]);
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt, listExtra(segment, page)) },
    { name: "Lista", rows: [head, ...rows] },
  ];
}

// ─── Excel das fichas ───────────────────────────────────────────────────────

function numbersRows<D>(defs: DetailNumberDef<D>[], d: D): Cell[][] {
  return [
    ["Indicador", "No período", "Período anterior", "Variação (%)"],
    ...defs.map((def): Cell[] => {
      const p = def.pick(d);
      return [
        `${def.label}${UNIT_SUFFIX[def.kind] ?? ""}`,
        cellValue(p.current, def.kind),
        cellValue(p.previous, def.kind),
        pctChange(p.current, p.previous),
      ];
    }),
  ];
}

function channelRows(c: ChannelDays): Cell[][] {
  return [
    ["Dias em que abriu, por canal", null],
    ["App", c.app],
    ["Site", c.web],
    ["Outros", c.other],
  ];
}

export function freelancerDetailSheets(d: FreelancerDetail, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const s = d.summary;
  const resumo: Cell[][] = [
    ["Campo", "Valor"],
    ["Nome", s.name],
    ["Telefone", s.phone],
    ["WhatsApp", waLink(s.phone)],
    ["E-mail", s.email],
    ["Cidade", s.city],
    ["UF", s.uf],
    ["Produtos", productsLabel(s.products)],
    ["Status", statusLabel(s.status, "freelancer")],
    ["Última atividade conhecida", dateBR(s.lastSeenAt)],
    ["Última candidatura", dateBR(s.lastCandidacyAt)],
    ["Cadastro", dateBR(s.createdAt)],
    ["Tem acesso", yesNo(s.hasAccess)],
    [],
    ...numbersRows(FREELANCER_DETAIL_NUMBERS, d),
    [],
    ...channelRows(d.activeDaysByChannel),
  ];
  const cands: Cell[][] = [
    ["Candidatura em", "Data da vaga", "Empresa", "Cargo", "Produto", "Situação", "Concluiu"],
    ...d.candidacies.map((c): Cell[] => [
      dateBR(c.createdAt),
      dateBR(c.vacancyDate),
      c.companyName,
      c.title ?? c.serviceType,
      PRODUCT_LABEL[c.module],
      candidacyStatusLabel(c.status),
      yesNo(c.completed),
    ]),
  ];
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt) },
    { name: "Resumo", rows: resumo },
    { name: "Candidaturas", rows: cands },
  ];
}

export function contractorDetailSheets(d: ContractorDetail, entries: FilterEntry[], generatedAt: Date): Sheet[] {
  const s = d.summary;
  const resumo: Cell[][] = [
    ["Campo", "Valor"],
    ["Empresa", s.name],
    ["CNPJ", s.document],
    ["Telefone", s.phone],
    ["WhatsApp", waLink(s.phone)],
    ["E-mail", s.email],
    ["Cidade", s.city],
    ["UF", s.uf],
    ["Produtos", productsLabel(s.products)],
    ["Status", statusLabel(s.status, "contractor")],
    ["Última atividade conhecida", dateBR(s.lastSeenAt)],
    ["Última vaga", dateBR(s.lastVacancyAt)],
    ["Cadastro", dateBR(s.createdAt)],
    ["Tem acesso", yesNo(s.hasAccess)],
    [],
    ...numbersRows(CONTRACTOR_DETAIL_NUMBERS, d),
    [],
    ...channelRows(d.activeDaysByChannel),
  ];
  const vagas: Cell[][] = [
    ["Publicada em", "Data da vaga", "Cargo", "Cidade", "Produto", "Candidatos", "Situação", "Quem trabalhou"],
    ...d.vacancies.map((v): Cell[] => [
      dateBR(v.createdAt),
      dateBR(v.vacancyDate),
      v.title ?? v.serviceType,
      v.city,
      PRODUCT_LABEL[v.module],
      v.candidates,
      vacancySituation(v.status, v.jobStatus),
      v.workerFirstNames.join(", ") || null,
    ]),
  ];
  return [
    { name: "Filtros", rows: filtersRows(entries, generatedAt) },
    { name: "Resumo", rows: resumo },
    { name: "Vagas", rows: vagas },
  ];
}

// ─── Tabelas do PDF (texto pronto; "—" no lugar de sem dado) ────────────────

export function overviewSummaryTables(o: EngagementOverview): PdfTable[] {
  return ALL_METRIC_GROUPS.map((g) => ({
    title: g.title,
    head: ["Indicador", "Atual", "Anterior", "Variação"],
    rows: g.metrics.map((def) => {
      const m = def.pick(o);
      return [
        def.label,
        formatValue(m.current, def.kind),
        formatValue(m.previous, def.kind),
        signedPct(pctChange(m.current, m.previous)),
      ];
    }),
  }));
}

export function overviewFunnelLines(o: EngagementOverview): { title: string; lines: string[] }[] {
  const toLines = (steps: FunnelStep[]) =>
    funnelBars(steps).map((b) => `${b.label}: ${formatValue(b.value)}${b.share === null ? "" : ` (${b.share}%)`}`);
  return [
    { title: "Funil de freelancers", lines: toLines(freelancerFunnel(o)) },
    { title: "Funil de empresas", lines: toLines(contractorFunnel(o)) },
  ];
}

export function cityTable(o: EngagementOverview, limit = 15): PdfTable {
  return {
    title: "Cidades com mais vagas",
    head: ["Cidade", "Vagas", "Candidaturas", "Cand. por vaga", "Freelas que abriram"],
    rows: o.byCity.slice(0, limit).map((c) => [
      c.uf ? `${c.city} - ${c.uf}` : c.city,
      formatValue(c.vacanciesPublished),
      formatValue(c.candidacies),
      formatValue(c.avgCandidaciesPerVacancy, "decimal"),
      formatValue(c.freelancersOpened),
    ]),
  };
}

/**
 * Relatório para o cliente (spec §5.2): só números e vagas da empresa, com o
 * 1º nome de quem trabalhou. NUNCA telefone, e-mail ou documento: este
 * builder não lê `summary.phone/email/document`.
 */
export function contractorReportTables(d: ContractorDetail): { numbers: PdfTable; vacancies: PdfTable } {
  return {
    numbers: {
      title: "Resumo do período",
      head: ["Indicador", "No período", "Período anterior"],
      rows: CLIENT_REPORT_NUMBERS.map((def) => {
        const p = def.pick(d);
        return [def.label, formatValue(p.current, def.kind), formatValue(p.previous, def.kind)];
      }),
    },
    vacancies: {
      title: "Vagas do período",
      head: ["Data", "Cargo", "Cidade", "Candidatos", "Situação", "Quem trabalhou"],
      rows: d.vacancies.map((v) => [
        dateBR(v.vacancyDate ?? v.createdAt),
        v.title ?? v.serviceType ?? DASH,
        v.city ?? DASH,
        formatValue(v.candidates),
        vacancySituation(v.status, v.jobStatus),
        v.workerFirstNames.length ? v.workerFirstNames.join(", ") : DASH,
      ]),
    },
  };
}
```

- [ ] **Step 4: Implementar o escritor de Excel**

`src/modules/admin/infrastructure/engagement-xlsx.ts`:

```ts
import { sanitizeCsvValue } from "@/lib/csv";
import type { Cell, Sheet } from "@/modules/admin/application/engagement-export";

/**
 * Escreve o .xlsx no navegador. O `xlsx` entra por import dinâmico (como em
 * campanhas/external-list-picker.tsx) para não pesar o carregamento da página.
 */
const MAX_SHEET_NAME = 31;

/** Nome de aba válido no Excel: sem \ / ? * : [ ], até 31 caracteres e sem repetir. */
export function safeSheetName(name: string, used: Set<string>): string {
  const clean =
    name
      .replace(/[\\/?*:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SHEET_NAME) || "Aba";
  let candidate = clean;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n++}`;
    candidate = `${clean.slice(0, MAX_SHEET_NAME - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Texto que começa com = + - @ vira texto puro (anti-fórmula); número e vazio passam intactos. */
export function sanitizeCells(rows: Cell[][]): Cell[][] {
  return rows.map((r) => r.map((c) => (typeof c === "string" ? sanitizeCsvValue(c) : c)));
}

export async function downloadSheets(filename: string, sheets: Sheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sanitizeCells(s.rows)), safeSheetName(s.name, used));
  }
  XLSX.writeFile(wb, filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
nice -n 15 npx vitest run src/modules/admin/application/engagement-export.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-xlsx.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
```

Esperado: `Test Files  1 passed (1)` nos dois (export 8 testes, xlsx 3).

- [ ] **Step 6: Commit**

```bash
git add src/modules/admin/application/engagement-export.ts src/modules/admin/application/engagement-export.test.ts \
        src/modules/admin/infrastructure/engagement-xlsx.ts src/modules/admin/infrastructure/engagement-xlsx.test.ts
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): planilhas do painel, das listas e das fichas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: PDF do painel, relatório da empresa e gráfico em PNG

**Files:**
- Create: `src/modules/admin/infrastructure/engagement-pdf.ts` + `engagement-pdf.test.ts`
- Create: `src/modules/admin/infrastructure/svg-to-png.ts` + `svg-to-png.test.ts`

**Interfaces:**
- Consumes: as tabelas do PDF da Task 3, `SERIES_LINES` e os formatos.
- Produces:
  - `buildOverviewPdf(o, filtersText, chartPng | null, generatedAt): jsPDF`;
  - `buildContractorReportPdf(d, generatedAt): jsPDF`, que pega o período de `d.period` e não recebe filtros de propósito, porque a ficha só usa o período e o cliente não precisa ver filtro interno;
  - `svgToPngDataUrl(svg | null, scale = 2): Promise<string | null>`.

  Quem chama faz o `.save(nome)`.

- [ ] **Step 1: Testes que falham**

`src/modules/admin/infrastructure/engagement-pdf.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "@/modules/admin/application/engagement.test-fixtures";

// Mesmo jeito de contractor-report-pdf.test.ts: o fake grava o TEXTO escrito
// no PDF (o que o leitor vê), não a renderização.
const { textCalls, imageCalls } = vi.hoisted(() => ({
  textCalls: [] as string[],
  imageCalls: [] as unknown[][],
}));

vi.mock("jspdf", () => {
  class FakeJsPDF {
    text(text: string) {
      textCalls.push(text);
    }
    addImage(...args: unknown[]) {
      imageCalls.push(args);
    }
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    line() {}
    addPage() {}
    setPage() {}
    getNumberOfPages() {
      return 1;
    }
    getTextWidth() {
      return 0;
    }
    save() {}
  }
  return { jsPDF: FakeJsPDF };
});

import { buildContractorReportPdf, buildOverviewPdf } from "./engagement-pdf";

const NOW = new Date("2026-10-07T15:00:00.000Z");

beforeEach(() => {
  textCalls.length = 0;
  imageCalls.length = 0;
});

describe("PDF do painel", () => {
  it("cabeçalho, filtros, tabelas, cidades e rodapé", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "Período: 01/09/2026 a 30/09/2026 · Cidade: Todas", null, NOW);
    expect(textCalls).toContain("Engajamento na Freela");
    expect(textCalls).toContain("Período: 01/09/2026 a 30/09/2026 · Cidade: Todas");
    expect(textCalls).toContain("Vagas publicadas");
    expect(textCalls).toContain("Juiz de Fora - MG");
    expect(textCalls).toContain("Se candidataram: 2 (50%)");
    expect(textCalls.some((t) => t.includes("gerado em 07/10/2026 12:00 · página 1 de 1"))).toBe(true);
    expect(imageCalls).toHaveLength(0);
  });

  it("antes da medição: aviso e '—' (nunca 0) nas aberturas", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT, "x", null, NOW);
    expect(textCalls.some((t) => t.startsWith("Aberturas medidas desde 07/10/2026"))).toBe(true);
    const i = textCalls.indexOf("Abriram o app ou site");
    expect(textCalls.slice(i + 1, i + 4)).toEqual(["—", "—", "—"]);
  });

  it("com o PNG do gráfico, desenha a imagem e a legenda", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "x", "data:image/png;base64,AAA", NOW);
    expect(imageCalls).toHaveLength(1);
    expect(imageCalls[0].slice(0, 2)).toEqual(["data:image/png;base64,AAA", "PNG"]);
    expect(textCalls).toContain("Evolução no período");
    expect(textCalls).toContain("Freelancers que abriram");
  });

  it("só caracteres que a fonte do PDF tem (sem − ≤ ≥)", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "x", null, NOW);
    expect(textCalls.join("\n")).not.toMatch(/[−≤≥]/);
  });
});

describe("relatório para o cliente", () => {
  it("tem o nome, os números e as vagas da empresa", () => {
    buildContractorReportPdf(SAMPLE_CONTRACTOR_DETAIL, NOW);
    expect(textCalls).toContain("Bar do Zé");
    expect(textCalls).toContain("Relatório de vagas · 01/09/2026 a 30/09/2026");
    expect(textCalls).toContain("Garçom para sábado");
    expect(textCalls).toContain("Ana");
    expect(textCalls).toContain("Cancelada pela empresa");
  });

  it("NUNCA leva telefone, e-mail ou documento", () => {
    buildContractorReportPdf(SAMPLE_CONTRACTOR_DETAIL, NOW);
    const all = textCalls.join("\n");
    const s = SAMPLE_CONTRACTOR_DETAIL.summary;
    for (const secret of [s.phone, s.email, s.document]) expect(all).not.toContain(String(secret));
    expect(all).not.toContain("@");
    expect(all).not.toMatch(/3215/);
    expect(all).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  });
});
```

`src/modules/admin/infrastructure/svg-to-png.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { svgToPngDataUrl } from "./svg-to-png";

const makeSvg = () => document.createElementNS("http://www.w3.org/2000/svg", "svg");

function stubImage(outcome: "load" | "error") {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        void value;
        setTimeout(() => (outcome === "load" ? this.onload?.() : this.onerror?.()), 0);
      }
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("svgToPngDataUrl", () => {
  it("sem gráfico → null", async () => {
    expect(await svgToPngDataUrl(null)).toBeNull();
  });

  it("gráfico sem tamanho (jsdom, fora do layout) → null", async () => {
    expect(await svgToPngDataUrl(makeSvg())).toBeNull();
  });

  it("imagem que não carrega → null, sem lançar", async () => {
    const svg = makeSvg();
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: 720, height: 300 } as DOMRect);
    stubImage("error");
    expect(await svgToPngDataUrl(svg)).toBeNull();
  });

  it("caminho feliz: desenha no canvas em escala e devolve o PNG", async () => {
    const svg = makeSvg();
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({ width: 720, height: 300 } as DOMRect);
    stubImage("load");
    const ctx = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAA");
    expect(await svgToPngDataUrl(svg, 2)).toBe("data:image/png;base64,AAA");
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 600);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-pdf.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
nice -n 15 npx vitest run src/modules/admin/infrastructure/svg-to-png.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
```

Esperado: `Failed to resolve import "./engagement-pdf"` e `… "./svg-to-png"`, `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar a conversão do gráfico**

`src/modules/admin/infrastructure/svg-to-png.ts`:

```ts
/**
 * Converte o <svg> do Recharts em PNG (data URL) para o PDF. Qualquer falha
 * (sem gráfico, tamanho zero, imagem que não carrega, canvas indisponível)
 * devolve null: o PDF sai sem o gráfico, mas sai.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("svg-image"));
    img.src = src;
  });
}

export async function svgToPngDataUrl(svg: SVGSVGElement | null, scale = 2): Promise<string | null> {
  if (!svg) return null;
  try {
    const rect = svg.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (!width || !height) return null;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implementar os PDFs**

`src/modules/admin/infrastructure/engagement-pdf.ts`:

```ts
import { jsPDF } from "jspdf";
import {
  cityTable,
  contractorReportTables,
  measurementText,
  overviewFunnelLines,
  overviewSummaryTables,
  type PdfTable,
} from "@/modules/admin/application/engagement-export";
import { dateBR, dateTimeBR, lastDayBR } from "@/modules/admin/application/engagement-format";
import { SERIES_LINES } from "@/modules/admin/application/engagement-metrics";
import type { ContractorDetail, EngagementOverview } from "./engagement-api";

/**
 * PDFs do engajamento (spec §5.2), montados com jsPDF, não com captura de tela.
 * Fonte helvetica = WinAnsi: nada de "−" (U+2212), "≤" ou "≥"; acentos, "—",
 * "·" e "…" funcionam. Mesmo visual do relatório de contratante (faixa
 * laranja, zebra). A4 retrato, em mm.
 */
const PW = 210;
const PH = 297;
const L = 14;
const W = PW - 2 * L;
const ROW_H = 6.5;
const BOTTOM = PH - 22;
const TOP = 18;
/** Tamanho do gráfico de exportação (series-chart.tsx), para manter a proporção. */
const CHART_W_PX = 720;
const CHART_H_PX = 300;

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 27];
const MUTED: Rgb = [115, 115, 115];
const WARN: Rgb = [161, 98, 7];

function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class PdfWriter {
  readonly doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  y = TOP;

  /** Corta com "…" o que não cabe na largura. */
  fit(text: string, wmm: number, size: number): string {
    this.doc.setFontSize(size);
    let s = String(text);
    if (this.doc.getTextWidth(s) <= wmm) return s;
    while (s.length > 1 && this.doc.getTextWidth(`${s}…`) > wmm) s = s.slice(0, -1);
    return `${s}…`;
  }

  wrap(text: string, wmm: number, size: number): string[] {
    this.doc.setFontSize(size);
    const lines: string[] = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && this.doc.getTextWidth(next) > wmm) {
        lines.push(cur);
        cur = word;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  color([r, g, b]: Rgb): void {
    this.doc.setTextColor(r, g, b);
  }

  header(title: string, subtitle: string): void {
    const d = this.doc;
    d.setFillColor(238, 168, 38);
    d.rect(0, 0, PW, 26, "F");
    this.color(INK);
    d.setFont("helvetica", "bold");
    d.text(this.fit(title, W, 16), L, 12);
    d.setFont("helvetica", "normal");
    d.text(this.fit(subtitle, W, 10), L, 20);
    this.y = 34;
  }

  paragraph(text: string, size = 9, rgb: Rgb = MUTED): void {
    this.doc.setFont("helvetica", "normal");
    for (const line of this.wrap(text, W, size)) {
      this.ensure(5);
      this.doc.setFontSize(size);
      this.color(rgb);
      this.doc.text(line, L, this.y);
      this.y += size * 0.45 + 1;
    }
    this.y += 2;
  }

  sectionTitle(text: string): void {
    this.ensure(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11.5);
    this.color(INK);
    this.doc.text(text, L, this.y);
    this.y += 6;
  }

  lines(texts: string[]): void {
    this.doc.setFont("helvetica", "normal");
    for (const t of texts) {
      this.ensure(5);
      this.doc.setFontSize(9);
      this.color(INK);
      this.doc.text(this.fit(t, W, 9), L, this.y);
      this.y += 5;
    }
    this.y += 3;
  }

  table(t: PdfTable, widths: number[], right: boolean[]): void {
    const d = this.doc;
    const xs: number[] = [];
    widths.reduce((x, w) => {
      xs.push(x);
      return x + w;
    }, L);
    const row = (cells: string[], bold: boolean) => {
      d.setFont("helvetica", bold ? "bold" : "normal");
      this.color(INK);
      cells.forEach((c, i) => {
        const s = this.fit(c, widths[i] - 2, 8.5);
        if (right[i]) d.text(s, xs[i] + widths[i] - 1, this.y, { align: "right" });
        else d.text(s, xs[i] + 1, this.y);
      });
      this.y += ROW_H;
    };
    const head = () => {
      d.setFillColor(238, 168, 38);
      d.rect(L, this.y - 4.5, W, ROW_H, "F");
      row(t.head, true);
    };
    this.ensure(12 + ROW_H * 2);
    this.sectionTitle(t.title);
    head();
    if (t.rows.length === 0) {
      d.setFont("helvetica", "normal");
      d.setFontSize(8.5);
      this.color(MUTED);
      d.text("Nada no período.", L + 1, this.y);
      this.y += ROW_H;
    }
    t.rows.forEach((cells, i) => {
      if (this.y + ROW_H > BOTTOM) {
        d.addPage();
        this.y = TOP;
        head();
      }
      if (i % 2 === 1) {
        d.setFillColor(248, 248, 245);
        d.rect(L, this.y - 4.5, W, ROW_H, "F");
      }
      row(cells, false);
    });
    this.y += 4;
  }

  image(png: string, wpx: number, hpx: number): void {
    const h = (W * hpx) / wpx;
    this.ensure(h + 4);
    this.doc.addImage(png, "PNG", L, this.y, W, h);
    this.y += h + 4;
  }

  legend(items: { label: string; color: string }[]): void {
    const d = this.doc;
    this.ensure(8);
    let x = L;
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    for (const it of items) {
      const [r, g, b] = hexRgb(it.color);
      d.setFillColor(r, g, b);
      d.rect(x, this.y - 2.6, 3, 3, "F");
      this.color(INK);
      d.text(it.label, x + 4.5, this.y);
      x += 4.5 + d.getTextWidth(it.label) + 6;
    }
    this.y += 7;
  }

  footer(left: string): void {
    const d = this.doc;
    const pages = d.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      d.setPage(p);
      d.setFont("helvetica", "normal");
      d.setTextColor(150, 150, 150);
      d.text(this.fit(`${left} · página ${p} de ${pages}`, W, 7.5), L, PH - 8);
    }
  }
}

/** PDF do painel: só agregados (pode ir para diretoria e investidor). */
export function buildOverviewPdf(
  o: EngagementOverview,
  filtersText: string,
  chartPng: string | null,
  generatedAt: Date,
): jsPDF {
  const w = new PdfWriter();
  w.header("Engajamento na Freela", `${o.period.label} · comparado com ${o.period.previousLabel}`);
  w.paragraph(filtersText);
  if (!o.openedAvailable.current || !o.openedAvailable.previous) {
    w.paragraph(
      `${measurementText(o)}. Sem medição, os números de "abriram" aparecem como — (não é zero).`,
      8.5,
      WARN,
    );
  }
  for (const t of overviewSummaryTables(o)) w.table(t, [92, 30, 30, 30], [false, true, true, true]);
  for (const f of overviewFunnelLines(o)) {
    w.sectionTitle(f.title);
    w.lines(f.lines);
  }
  if (chartPng) {
    w.ensure(12 + (W * CHART_H_PX) / CHART_W_PX + 12);
    w.sectionTitle("Evolução no período");
    w.image(chartPng, CHART_W_PX, CHART_H_PX);
    w.legend(SERIES_LINES);
  }
  w.table(cityTable(o), [70, 25, 30, 27, 30], [false, true, true, true, true]);
  w.footer(`Freela · Engajamento · ${o.period.label} · gerado em ${dateTimeBR(generatedAt)}`);
  return w.doc;
}

/**
 * Relatório para enviar à empresa: números e vagas dela no período, com o 1º
 * nome de quem trabalhou. Sem telefone, e-mail ou documento de ninguém.
 */
export function buildContractorReportPdf(d: ContractorDetail, generatedAt: Date): jsPDF {
  const w = new PdfWriter();
  const range = `${dateBR(d.period.start)} a ${lastDayBR(d.period.end)}`;
  w.header(d.summary.name, `Relatório de vagas · ${range}`);
  w.paragraph(`Período: ${d.period.label}. Comparado com: ${d.period.previousLabel}.`);
  const { numbers, vacancies } = contractorReportTables(d);
  w.table(numbers, [102, 40, 40], [false, true, true]);
  w.table(vacancies, [22, 50, 34, 22, 30, 24], [false, false, false, true, false, false]);
  w.footer(`Freela · ${d.summary.name} · ${range} · gerado em ${dateTimeBR(generatedAt)}`);
  return w.doc;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
nice -n 15 npx vitest run src/modules/admin/infrastructure/engagement-pdf.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
nice -n 15 npx vitest run src/modules/admin/infrastructure/svg-to-png.test.ts --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
```

Esperado: `Test Files  1 passed (1)` nos dois (pdf 6 testes, svg 4).

- [ ] **Step 6: Commit**

```bash
git add src/modules/admin/infrastructure/engagement-pdf.ts src/modules/admin/infrastructure/engagement-pdf.test.ts \
        src/modules/admin/infrastructure/svg-to-png.ts src/modules/admin/infrastructure/svg-to-png.test.ts
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): PDF do painel e relatório da empresa para o cliente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Peças da tela (estados, contato, barra de filtros, cartões, funil, gráfico, cidades, aviso)

**Files:**
- Create: `src/app/(auth)/engajamento/_components/states.tsx`
- Create: `src/app/(auth)/engajamento/_components/contact.tsx`
- Create: `src/app/(auth)/engajamento/_components/filter-bar.tsx` + `filter-bar.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/metric-grid.tsx` + `metric-grid.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/funnel.tsx` + `funnel.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/city-table.tsx` + `city-table.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/measurement-notice.tsx` + `measurement-notice.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/series-chart.tsx` (sem teste próprio: o `ResponsiveContainer` do Recharts precisa de `ResizeObserver`, que o jsdom não tem. As páginas o mocam, e a conversão para PNG já tem teste na Task 4)

**Interfaces:**
- Consumes: Tasks 1, 2 e 4; `KpiCard` (`@/components/shared/kpi-card`), `Input`, `NativeSelect`, `Button` e `cn`.
- Produces:
  - `Spinner({ className? })` e `ErrorBox({ message?, onRetry })`;
  - `Contact({ phone, email })`;
  - `FilterBar({ filters, onChange, cities, periodOnly?, actions? })`;
  - `MetricGrid({ overview, metrics, product })`;
  - `Funnel({ title, steps })`;
  - `CityTable({ rows, limit? })`;
  - `measurementNotice(measuredSince, period)` e `MeasurementNotice({ measuredSince, period })`;
  - `SeriesChart({ series, lines? })` e `SeriesChartForExport` (forwardRef para a `<div>` que contém o `<svg>`).

- [ ] **Step 1: Testes que falham**

`src/app/(auth)/engajamento/_components/filter-bar.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";
import { FilterBar } from "./filter-bar";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const F = defaultFilters(NOW);
const CITIES = SAMPLE_OVERVIEW.filterOptions.cities;

describe("FilterBar", () => {
  it("troca o período", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...F, period: "7d" });
  });

  it("personalizado: mostra as datas e diz o que falta", () => {
    render(<FilterBar filters={{ ...F, period: "custom", from: "" }} onChange={vi.fn()} cities={CITIES} />);
    expect((screen.getByLabelText("Data inicial") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a data inicial e a final.");
  });

  it("cidade digitada igual a uma opção vira filtro (cidade + UF); apagar volta a todas", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "gramado - rs" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, city: "Gramado", uf: "RS" });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, city: "", uf: "" });
  });

  it("produto e canal", () => {
    const onChange = vi.fn();
    render(<FilterBar filters={F} onChange={onChange} cities={CITIES} />);
    fireEvent.change(screen.getByLabelText("Produto"), { target: { value: "home_services" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, product: "home_services" });
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "app" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...F, channel: "app" });
  });

  it("na ficha mostra só o período", () => {
    render(<FilterBar filters={F} onChange={vi.fn()} cities={CITIES} periodOnly />);
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Produto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mês passado" })).toBeInTheDocument();
  });

  it("os botões de exportação entram na barra", () => {
    render(
      <FilterBar
        filters={F}
        onChange={vi.fn()}
        cities={CITIES}
        actions={<button type="button">Exportar PDF</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeInTheDocument();
  });
});
```

`src/app/(auth)/engajamento/_components/metric-grid.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FREELANCER_METRICS, VACANCY_METRICS } from "@/modules/admin/application/engagement-metrics";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "@/modules/admin/application/engagement.test-fixtures";
import { MetricGrid } from "./metric-grid";

// KpiCard: Card > (cabeçalho com o título) + valor + quebra + comparação.
const card = (title: string) => screen.getByText(title).parentElement?.parentElement as HTMLElement;

describe("MetricGrid", () => {
  it("antes da medição: aberturas com '—' e 'sem comparação' (nunca 0)", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW_BEFORE_MEASUREMENT} metrics={FREELANCER_METRICS} product="all" />);
    const c = card("Abriram o app ou site");
    expect(within(c).getByText("—")).toBeInTheDocument();
    expect(within(c).getByText("sem comparação")).toBeInTheDocument();
    expect(within(c).queryByText("0")).not.toBeInTheDocument();
  });

  it("a ajuda das aberturas diz desde quando há medição", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={FREELANCER_METRICS} product="all" />);
    expect(screen.getByLabelText("Sobre: Abriram o app ou site")).toHaveAttribute(
      "title",
      expect.stringContaining("Medido desde 20/07/2026"),
    );
  });

  it("variação e quebra Empresa × Casa nas vagas", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={VACANCY_METRICS} product="all" />);
    const c = card("Vagas publicadas");
    expect(within(c).getByText("3")).toBeInTheDocument();
    expect(within(c).getByText("anterior: 1 · +200%")).toBeInTheDocument();
    expect(within(c).getByText("Empresa")).toBeInTheDocument();
    expect(within(c).getByText("Casa")).toBeInTheDocument();
  });

  it("com um produto só, sem a quebra", () => {
    render(<MetricGrid overview={SAMPLE_OVERVIEW} metrics={VACANCY_METRICS} product="bars_restaurants" />);
    expect(within(card("Vagas publicadas")).queryByText("Empresa")).not.toBeInTheDocument();
  });
});
```

`src/app/(auth)/engajamento/_components/funnel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { freelancerFunnel } from "@/modules/admin/application/engagement-metrics";
import {
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "@/modules/admin/application/engagement.test-fixtures";
import { Funnel } from "./funnel";

describe("Funnel", () => {
  it("mostra o valor e o % sobre o 1º passo", () => {
    render(<Funnel title="Funil de freelancers" steps={freelancerFunnel(SAMPLE_OVERVIEW)} />);
    expect(screen.getByText("Funil de freelancers")).toBeInTheDocument();
    expect(screen.getByText("(100%)")).toBeInTheDocument();
    expect(screen.getAllByText("(50%)")).toHaveLength(3);
  });

  it("antes da medição: '—' no 1º passo e nenhum %", () => {
    render(<Funnel title="Funil" steps={freelancerFunnel(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT)} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
```

`src/app/(auth)/engajamento/_components/city-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAMPLE_OVERVIEW_BEFORE_MEASUREMENT } from "@/modules/admin/application/engagement.test-fixtures";
import { CityTable } from "./city-table";

describe("CityTable", () => {
  it("a cidade aparece na tabela (desktop) e no cartão (celular); sem medição mostra '—'", () => {
    render(<CityTable rows={SAMPLE_OVERVIEW_BEFORE_MEASUREMENT.byCity} />);
    expect(screen.getAllByText("Juiz de Fora - MG")).toHaveLength(2);
    expect(screen.getAllByText("0,67")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("sem vaga no período", () => {
    render(<CityTable rows={[]} />);
    expect(screen.getByText("Nenhuma vaga publicada no período.")).toBeInTheDocument();
  });
});
```

`src/app/(auth)/engajamento/_components/measurement-notice.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";
import { MeasurementNotice, measurementNotice } from "./measurement-notice";

const P = SAMPLE_OVERVIEW.period;

describe("aviso de medição", () => {
  it("período e comparação medidos: sem aviso", () => {
    expect(measurementNotice("2026-07-20", P)).toBeNull();
  });

  it("começa antes da medição: diz desde quando e explica o '—'", () => {
    const t = measurementNotice("2026-10-07", P);
    expect(t).toContain("Aberturas medidas desde 07/10/2026");
    expect(t).toContain("não é zero");
  });

  it("sem medição nenhuma", () => {
    expect(measurementNotice(null, P)).toContain("ainda não estão sendo medidas");
  });

  it("o componente só aparece quando há aviso", () => {
    const { rerender } = render(<MeasurementNotice measuredSince="2026-07-20" period={P} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    rerender(<MeasurementNotice measuredSince="2026-10-07" period={P} />);
    expect(screen.getByRole("note")).toHaveTextContent("Aberturas medidas desde 07/10/2026");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
for f in filter-bar metric-grid funnel city-table measurement-notice; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/_components/$f.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
done
```

Esperado: os cinco com `Failed to resolve import "./…"` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar estados e contato**

`src/app/(auth)/engajamento/_components/states.tsx`:

```tsx
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={cn("flex h-[60vh] items-center justify-center", className)}>
      <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
    </div>
  );
}

export function ErrorBox({
  message = "Não foi possível carregar os números.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 sm:flex-row sm:items-center"
    >
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
```

`src/app/(auth)/engajamento/_components/contact.tsx`:

```tsx
import { Mail, MessageCircle, Phone } from "lucide-react";
import { waLink } from "@/modules/admin/application/engagement-format";

/** Telefone vira link do WhatsApp (com 55 quando falta); e-mail vira mailto. */
export function Contact({ phone, email }: { phone: string | null; email: string | null }) {
  const wa = waLink(phone);
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs">
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-green-700 hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          {phone}
        </a>
      ) : phone ? (
        <span className="inline-flex items-center gap-1 text-[#737373]">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {phone}
        </span>
      ) : (
        <span className="text-[#a3a3a3]">sem telefone</span>
      )}
      {email && (
        <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1 text-[#737373] hover:underline">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implementar a barra de filtros**

`src/app/(auth)/engajamento/_components/filter-bar.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  CHANNEL_OPTIONS,
  PERIOD_PRESETS,
  PRODUCT_OPTIONS,
  customRangeError,
  describeFilters,
} from "@/modules/admin/application/engagement-filters";
import type {
  CityOption,
  EngagementChannel,
  EngagementFilters,
  EngagementProduct,
} from "@/modules/admin/infrastructure/engagement-api";

interface FilterBarProps {
  filters: EngagementFilters;
  onChange: (next: EngagementFilters) => void;
  /** Opções já canonizadas pela API (`overview.filterOptions.cities`). */
  cities: CityOption[];
  /** Fichas: só o período (a API ignora cidade, produto e canal nelas). */
  periodOnly?: boolean;
  /** Botões de exportação, no fim da barra. */
  actions?: React.ReactNode;
}

// Mesmo visual dos presets do dashboard.
const pill = (active: boolean) =>
  cn(
    "h-8 rounded-md px-3 text-sm transition-colors",
    active ? "bg-[#eca826] font-semibold text-[#1d1d1b]" : "text-[#737373] hover:bg-[#f7f7f7]",
  );
const DATE_INPUT = "h-9 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm";

function cityLabel(city: string, uf: string): string {
  return city ? (uf ? `${city} - ${uf}` : city) : "";
}

/**
 * Cidade com busca: campo com sugestões (datalist nativo, funciona no celular).
 * Só vira filtro quando o texto bate com uma opção; apagar volta a "todas".
 */
function CityPicker({
  cities,
  city,
  uf,
  onPick,
}: {
  cities: CityOption[];
  city: string;
  uf: string;
  onPick: (c: CityOption | null) => void;
}) {
  const listId = useId();
  const current = cityLabel(city, uf);
  const [text, setText] = useState(current);
  const [shown, setShown] = useState(current);
  // O filtro mudou por fora (URL, outro controle): o texto acompanha.
  // É o padrão "ajustar estado durante o render" da documentação do React.
  if (shown !== current) {
    setShown(current);
    setText(current);
  }
  const match = (v: string) => cities.find((c) => c.label.toLowerCase() === v.trim().toLowerCase()) ?? null;
  return (
    <>
      <Input
        list={listId}
        aria-label="Cidade"
        placeholder="Todas as cidades"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (!v.trim()) {
            onPick(null);
            return;
          }
          const hit = match(v);
          if (hit) onPick(hit);
        }}
        onBlur={() => {
          if (text.trim() && !match(text)) setText(current);
        }}
        className="h-9 md:w-56"
      />
      <datalist id={listId}>
        {cities.map((c) => (
          <option key={c.label} value={c.label} />
        ))}
      </datalist>
    </>
  );
}

export function FilterBar({ filters, onChange, cities, periodOnly = false, actions }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<EngagementFilters>) => onChange({ ...filters, ...patch });
  const rangeError = customRangeError(filters);
  const summary = periodOnly ? describeFilters(filters).split(" · ")[0] : describeFilters(filters);

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-3 md:sticky md:top-0 md:z-20">
      {/* Celular: os filtros ficam recolhidos atrás de um resumo. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm text-[#1d1d1b] md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[#eca826]" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <span className="shrink-0 text-xs font-semibold text-[#eca826]">{open ? "Fechar" : "Filtros"}</span>
      </button>

      <div
        className={cn(
          open ? "flex" : "hidden",
          "mt-3 flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-center",
        )}
      >
        <div
          role="group"
          aria-label="Período"
          className="inline-flex flex-wrap self-start rounded-lg border border-[#e5e5e5] bg-white p-0.5"
        >
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={filters.period === p.id}
              onClick={() => set({ period: p.id })}
              className={pill(filters.period === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {filters.period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Data inicial"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className={DATE_INPUT}
            />
            <span className="text-sm text-[#737373]">até</span>
            <input
              type="date"
              aria-label="Data final"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className={DATE_INPUT}
            />
            {rangeError && (
              <span role="alert" className="text-xs font-medium text-red-600">
                {rangeError}
              </span>
            )}
          </div>
        )}

        {!periodOnly && (
          <>
            <CityPicker
              cities={cities}
              city={filters.city}
              uf={filters.uf}
              onPick={(c) => set({ city: c?.city ?? "", uf: c?.uf ?? "" })}
            />
            <NativeSelect
              aria-label="Produto"
              value={filters.product}
              onChange={(e) => set({ product: e.target.value as EngagementProduct })}
              className="h-9 py-0 md:w-auto"
            >
              {PRODUCT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Canal"
              value={filters.channel}
              onChange={(e) => set({ channel: e.target.value as EngagementChannel })}
              className="h-9 py-0 md:w-auto"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </>
        )}

        {actions && <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implementar cartões, funil, cidades, aviso e gráfico**

`src/app/(auth)/engajamento/_components/metric-grid.tsx`:

```tsx
import { KpiCard } from "@/components/shared/kpi-card";
import { dateBR, deltaInfo, formatValue } from "@/modules/admin/application/engagement-format";
import type { MetricDef } from "@/modules/admin/application/engagement-metrics";
import type { EngagementOverview, EngagementProduct } from "@/modules/admin/infrastructure/engagement-api";

/** 1 coluna no celular, 2 no tablet, 4 no desktop. */
export function MetricGrid({
  overview,
  metrics,
  product,
}: {
  overview: EngagementOverview;
  metrics: MetricDef[];
  product: EngagementProduct;
}) {
  const since = overview.measuredSince;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((def) => {
        const m = def.pick(overview);
        const delta = deltaInfo(m, def.kind, def.higherIsBetter);
        // Quebra só quando a API manda o par e o filtro é "Empresa + Casa".
        const breakdown =
          product === "all" && m.byModule
            ? [
                { label: "Empresa", value: formatValue(m.byModule.barsRestaurants, def.kind) },
                { label: "Casa", value: formatValue(m.byModule.homeServices, def.kind) },
              ]
            : undefined;
        const help = def.opened
          ? `${def.help} ${since ? `Medido desde ${dateBR(since)}; antes disso aparece "—".` : `Ainda sem medição; aparece "—".`}`
          : def.help;
        return (
          <KpiCard
            key={def.key}
            title={def.label}
            value={formatValue(m.current, def.kind)}
            icon={def.icon}
            meta={delta.text}
            metaColor={delta.color}
            help={help}
            breakdown={breakdown}
          />
        );
      })}
    </div>
  );
}
```

`src/app/(auth)/engajamento/_components/funnel.tsx`:

```tsx
import { formatValue } from "@/modules/admin/application/engagement-format";
import { funnelBars, type FunnelStep } from "@/modules/admin/application/engagement-metrics";

export function Funnel({ title, steps }: { title: string; steps: FunnelStep[] }) {
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      <ol className="space-y-3">
        {funnelBars(steps).map((b) => (
          <li key={b.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#1d1d1b]">{b.label}</span>
              <span className="shrink-0 font-semibold text-[#1d1d1b]">
                {formatValue(b.value)}
                {b.share !== null && <span className="ml-1 text-xs font-normal text-[#737373]">({b.share}%)</span>}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#f7f7f7]">
              <div className="h-full rounded-full bg-[#eca826]" style={{ width: `${b.width}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`src/app/(auth)/engajamento/_components/city-table.tsx`:

```tsx
import { formatValue } from "@/modules/admin/application/engagement-format";
import type { CityRow } from "@/modules/admin/infrastructure/engagement-api";

const place = (c: CityRow) => (c.uf ? `${c.city} - ${c.uf}` : c.city);

/** Tabela no desktop, cartões no celular. Já vem ordenada por vagas pela API. */
export function CityTable({ rows, limit = 20 }: { rows: CityRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        Por cidade
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-[#737373]">
        Ordenado por vagas publicadas no período (até {limit} cidades).
      </p>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#737373]">Nenhuma vaga publicada no período.</p>
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                <th className="py-2 font-medium">Cidade</th>
                <th className="py-2 text-right font-medium">Vagas publicadas</th>
                <th className="py-2 text-right font-medium">Candidaturas</th>
                <th className="py-2 text-right font-medium">Candidaturas por vaga</th>
                <th className="py-2 text-right font-medium">Freelancers que abriram</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={place(c)} className="border-b border-[#f0f0f0] last:border-0">
                  <td className="py-2 text-[#1d1d1b]">{place(c)}</td>
                  <td className="py-2 text-right">{formatValue(c.vacanciesPublished)}</td>
                  <td className="py-2 text-right">{formatValue(c.candidacies)}</td>
                  <td className="py-2 text-right">{formatValue(c.avgCandidaciesPerVacancy, "decimal")}</td>
                  <td className="py-2 text-right">{formatValue(c.freelancersOpened)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-2 md:hidden">
            {shown.map((c) => (
              <li key={place(c)} className="rounded-lg border border-[#e5e5e5] p-3">
                <p className="font-medium text-[#1d1d1b]">{place(c)}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-[#737373]">Vagas publicadas</dt>
                  <dd className="text-right font-semibold">{formatValue(c.vacanciesPublished)}</dd>
                  <dt className="text-[#737373]">Candidaturas</dt>
                  <dd className="text-right font-semibold">{formatValue(c.candidacies)}</dd>
                  <dt className="text-[#737373]">Por vaga</dt>
                  <dd className="text-right font-semibold">{formatValue(c.avgCandidaciesPerVacancy, "decimal")}</dd>
                  <dt className="text-[#737373]">Freelancers que abriram</dt>
                  <dd className="text-right font-semibold">{formatValue(c.freelancersOpened)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

`src/app/(auth)/engajamento/_components/measurement-notice.tsx`:

```tsx
import { Info } from "lucide-react";
import { brasiliaDayOf, dateBR } from "@/modules/admin/application/engagement-format";
import type { EngagementPeriod } from "@/modules/admin/infrastructure/engagement-api";

/**
 * Aviso de medição (spec §5.1). A janela anterior começa antes da atual, então
 * basta olhar `previousStart`: se ela começa antes de `measuredSince`, algum
 * número de "abriram" (o atual ou o anterior) fica sem dado.
 */
export function measurementNotice(measuredSince: string | null, period: EngagementPeriod): string | null {
  if (!measuredSince) {
    return 'As aberturas do app e do site ainda não estão sendo medidas. Os números de "abriram" aparecem como — (não é zero).';
  }
  if (brasiliaDayOf(period.previousStart) >= measuredSince) return null;
  return `Aberturas medidas desde ${dateBR(measuredSince)}. Antes disso não há medição: os números de "abriram" aparecem como — (não é zero), e a comparação com o período anterior pode ficar sem número.`;
}

export function MeasurementNotice({
  measuredSince,
  period,
}: {
  measuredSince: string | null;
  period: EngagementPeriod;
}) {
  const text = measurementNotice(measuredSince, period);
  if (!text) return null;
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </div>
  );
}
```

`src/app/(auth)/engajamento/_components/series-chart.tsx`:

```tsx
"use client";

import { forwardRef } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketLabel } from "@/modules/admin/application/engagement-format";
import { SERIES_LINES, type SeriesKey } from "@/modules/admin/application/engagement-metrics";
import type { EngagementOverview } from "@/modules/admin/infrastructure/engagement-api";

type Series = EngagementOverview["series"];

function chartRows(series: Series) {
  return series.points.map((p) => ({ ...p, label: bucketLabel(p.bucket, series.unit) }));
}

function pickLines(keys?: SeriesKey[]) {
  return keys ? SERIES_LINES.filter((l) => keys.includes(l.key)) : SERIES_LINES;
}

/** Gráfico da tela, na largura da coluna. Sem dado (null) vira buraco na linha, nunca 0. */
export function SeriesChart({ series, lines }: { series: Series; lines?: SeriesKey[] }) {
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        Evolução no período
      </h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows(series)} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" stroke="#737373" fontSize={12} minTickGap={16} />
            <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {pickLines(lines).map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Cópia de tamanho fixo (720×300), que a página monta fora da tela só para
 * virar PNG no PDF. Assim o PDF não depende da aba aberta nem da largura do
 * celular. Sem animação, para a captura não pegar a linha pela metade. A
 * legenda vai como texto no PDF (a do Recharts é HTML, fica fora do SVG).
 */
export const SeriesChartForExport = forwardRef<HTMLDivElement, { series: Series }>(
  function SeriesChartForExport({ series }, ref) {
    return (
      <div ref={ref} style={{ width: 720, height: 300, background: "#ffffff" }}>
        <LineChart width={720} height={300} data={chartRows(series)} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" stroke="#737373" fontSize={12} minTickGap={16} />
          <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
          {SERIES_LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>
    );
  },
);
```

- [ ] **Step 6: Rodar e ver passar**

```bash
for f in filter-bar metric-grid funnel city-table measurement-notice; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/_components/$f.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
done
```

Esperado: `Test Files  1 passed (1)` nos cinco (6, 4, 2, 2 e 4 testes).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/engajamento/_components/states.tsx" "src/app/(auth)/engajamento/_components/contact.tsx" \
        "src/app/(auth)/engajamento/_components/filter-bar.tsx" "src/app/(auth)/engajamento/_components/filter-bar.test.tsx" \
        "src/app/(auth)/engajamento/_components/metric-grid.tsx" "src/app/(auth)/engajamento/_components/metric-grid.test.tsx" \
        "src/app/(auth)/engajamento/_components/funnel.tsx" "src/app/(auth)/engajamento/_components/funnel.test.tsx" \
        "src/app/(auth)/engajamento/_components/city-table.tsx" "src/app/(auth)/engajamento/_components/city-table.test.tsx" \
        "src/app/(auth)/engajamento/_components/measurement-notice.tsx" "src/app/(auth)/engajamento/_components/measurement-notice.test.tsx" \
        "src/app/(auth)/engajamento/_components/series-chart.tsx"
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): barra de filtros, cartões, funis, gráfico e cidades" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Hooks, lista com contato e busca de empresa ou freelancer

**Files:**
- Create: `src/modules/admin/application/use-engagement.ts` + `use-engagement.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/use-debounced.ts`
- Create: `src/app/(auth)/engajamento/_components/people-table.tsx` + `people-table.test.tsx`
- Create: `src/app/(auth)/engajamento/_components/entity-search.tsx` + `entity-search.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 a 5.
- Produces:
  - `type PeopleRow = FreelancerListRow | ContractorListRow`;
  - `useEngagementOverview(f)` e `useEngagementPeople(side, f, params, enabled = true)`, que só consultam quando `isFilterReady(f)`, com `keepPreviousData` e `staleTime` de 30 s;
  - `useFreelancerEngagement(userId, f)` e `useContractorEngagement(userId, f)`;
  - `useDebounced(value, ms)`;
  - `PeopleTable({ side, filters, entries })`;
  - `EntitySearch({ filters, canFreelancers, canCompanies })`.

  Um hook só (`useEngagementPeople`) atende os dois lados, para a lista e a busca chamarem a mesma coisa.

- [ ] **Step 1: Testes que falham**

`src/modules/admin/application/use-engagement.test.tsx`:

```tsx
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get: vi.fn() }),
}));
vi.mock("../infrastructure/engagement-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infrastructure/engagement-api")>();
  return {
    ...actual,
    getEngagementOverview: vi.fn(),
    listEngagementFreelancers: vi.fn(),
    listEngagementContractors: vi.fn(),
    getFreelancerEngagement: vi.fn(),
    getContractorEngagement: vi.fn(),
  };
});

import {
  getEngagementOverview,
  listEngagementContractors,
  listEngagementFreelancers,
} from "../infrastructure/engagement-api";
import { defaultFilters } from "./engagement-filters";
import { SAMPLE_OVERVIEW } from "./engagement.test-fixtures";
import { useEngagementOverview, useEngagementPeople } from "./use-engagement";

const NOW = new Date("2026-10-07T15:00:00.000Z");

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useEngagementOverview", () => {
  it("personalizado incompleto não dispara a consulta", () => {
    const { result } = renderHook(
      () => useEngagementOverview({ ...defaultFilters(NOW), period: "custom", from: "" }),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(getEngagementOverview).not.toHaveBeenCalled();
  });

  it("filtro pronto consulta e devolve a visão geral", async () => {
    vi.mocked(getEngagementOverview).mockResolvedValue(SAMPLE_OVERVIEW);
    const { result } = renderHook(() => useEngagementOverview(defaultFilters(NOW)), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(SAMPLE_OVERVIEW));
  });
});

describe("useEngagementPeople", () => {
  it("sem a área (enabled=false) não chama a API", () => {
    renderHook(() => useEngagementPeople("freelancer", defaultFilters(NOW), { page: 1, limit: 25 }, false), {
      wrapper,
    });
    expect(listEngagementFreelancers).not.toHaveBeenCalled();
  });

  it("empresas chamam a lista de empresas", async () => {
    vi.mocked(listEngagementContractors).mockResolvedValue({ rows: [], total: 0, page: 1, limit: 25, truncated: false });
    renderHook(() => useEngagementPeople("contractor", defaultFilters(NOW), { page: 1, limit: 25 }), { wrapper });
    await waitFor(() =>
      expect(listEngagementContractors).toHaveBeenCalledWith(expect.objectContaining({ period: "this_month" }), {
        page: 1,
        limit: 25,
      }),
    );
    expect(listEngagementFreelancers).not.toHaveBeenCalled();
  });
});
```

`src/app/(auth)/engajamento/_components/people-table.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_FREELANCER_ROW } from "@/modules/admin/application/engagement.test-fixtures";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

const { useEngagementPeople, listEngagementFreelancers, listEngagementContractors, downloadSheets, toast } =
  vi.hoisted(() => ({
    useEngagementPeople: vi.fn(),
    listEngagementFreelancers: vi.fn(),
    listEngagementContractors: vi.fn(),
    downloadSheets: vi.fn(),
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  }));

vi.mock("@/modules/admin/application/use-engagement", () => ({ useEngagementPeople }));
vi.mock("@/modules/admin/infrastructure/engagement-api", () => ({
  listEngagementFreelancers,
  listEngagementContractors,
}));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./use-debounced", () => ({ useDebounced: <T,>(v: T) => v }));

import { PeopleTable } from "./people-table";

const F: EngagementFilters = {
  ...defaultFilters(new Date("2026-10-07T15:00:00.000Z")),
  period: "custom",
  from: "2026-09-01",
  to: "2026-09-30",
};

const result = (rows: unknown[], total = rows.length) => ({
  data: { rows, total, page: 1, limit: 25, truncated: false },
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
});

beforeEach(() => vi.clearAllMocks());

describe("PeopleTable", () => {
  it("linha com link para a ficha (levando os filtros), status e WhatsApp", () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW]));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    expect(screen.getAllByRole("link", { name: "Ana Souza" })[0]).toHaveAttribute(
      "href",
      "/engajamento/freelancer/u-f1?periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers",
    );
    expect(screen.getAllByText("Esfriando").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("link", { name: /99876-5432/ })[0]).toHaveAttribute(
      "href",
      "https://wa.me/5532998765432",
    );
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  });

  it("página, segmento e contas sem acesso vão para a consulta; trocar filtro volta à página 1", () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW], 60));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ page: 2, limit: 25 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Abriram e não se candidataram" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ segment: "opened_no_apply", page: 1 }),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Incluir contas sem acesso" }));
    expect(useEngagementPeople).toHaveBeenLastCalledWith(
      "freelancer",
      F,
      expect.objectContaining({ includeNoAccess: true, page: 1 }),
    );
  });

  it("exportação com mais de 20.000 linhas: arquivo com as primeiras 20.000 e aviso", async () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW], 25000));
    const rows = Array.from({ length: 20000 }, (_, i) => ({ ...SAMPLE_FREELANCER_ROW, userId: `u-${i}` }));
    listEngagementFreelancers.mockResolvedValue({ rows, total: 25000, page: 1, limit: 20000, truncated: true });
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar lista/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    expect(listEngagementFreelancers).toHaveBeenCalledWith(
      F,
      expect.objectContaining({ exportAll: true, segment: null }),
    );
    const [filename, sheets] = downloadSheets.mock.calls[0];
    expect(filename).toBe("engajamento-freelancers-todos");
    expect(sheets[1].rows).toHaveLength(20001);
    expect(JSON.stringify(sheets[0].rows)).toContain("25.000");
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("primeiras 20.000"));
  });

  it("falha na exportação vira aviso de erro", async () => {
    useEngagementPeople.mockReturnValue(result([SAMPLE_FREELANCER_ROW]));
    listEngagementFreelancers.mockRejectedValue(new Error("rede"));
    render(<PeopleTable side="freelancer" filters={F} entries={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar lista/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível exportar a lista. Tente de novo."),
    );
    expect(downloadSheets).not.toHaveBeenCalled();
  });

  it("lista vazia: mensagem e exportar desligado", () => {
    useEngagementPeople.mockReturnValue(result([]));
    render(<PeopleTable side="contractor" filters={F} entries={[]} />);
    expect(screen.getByText("Ninguém neste segmento com esses filtros.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar lista/ })).toBeDisabled();
  });
});
```

`src/app/(auth)/engajamento/_components/entity-search.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters } from "@/modules/admin/application/engagement-filters";
import { SAMPLE_FREELANCER_ROW } from "@/modules/admin/application/engagement.test-fixtures";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

const { useEngagementPeople } = vi.hoisted(() => ({ useEngagementPeople: vi.fn() }));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useEngagementPeople }));
vi.mock("./use-debounced", () => ({ useDebounced: <T,>(v: T) => v }));

import { EntitySearch } from "./entity-search";

const F: EngagementFilters = {
  ...defaultFilters(new Date("2026-10-07T15:00:00.000Z")),
  period: "7d",
  city: "Gramado",
  uf: "RS",
};

beforeEach(() => {
  vi.clearAllMocks();
  useEngagementPeople.mockImplementation((side: string) =>
    side === "freelancer"
      ? { data: { rows: [SAMPLE_FREELANCER_ROW], total: 1, page: 1, limit: 5, truncated: false }, isLoading: false }
      : { data: undefined, isLoading: false },
  );
});

describe("EntitySearch", () => {
  it("só com FREELANCERS: busca só freelancers, sem prender à cidade, e leva à ficha com os filtros", () => {
    render(<EntitySearch filters={F} canFreelancers canCompanies={false} />);
    const input = screen.getByRole("textbox", { name: "Buscar freelancer" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ana" } });
    expect(screen.getByRole("link", { name: /Ana Souza/ })).toHaveAttribute(
      "href",
      "/engajamento/freelancer/u-f1?periodo=7d&cidade=Gramado&uf=RS&aba=freelancers",
    );
    expect(screen.queryByText("Empresas")).not.toBeInTheDocument();
    expect(useEngagementPeople).toHaveBeenCalledWith(
      "freelancer",
      expect.objectContaining({ period: "7d", city: "", uf: "" }),
      expect.objectContaining({ search: "ana", limit: 5, includeNoAccess: true }),
      true,
    );
    expect(useEngagementPeople).toHaveBeenCalledWith("contractor", expect.anything(), expect.anything(), false);
  });

  it("menos de 2 letras não busca", () => {
    render(<EntitySearch filters={F} canFreelancers canCompanies />);
    const input = screen.getByRole("textbox", { name: "Buscar empresa ou freelancer" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "a" } });
    expect(useEngagementPeople).not.toHaveBeenCalledWith("freelancer", expect.anything(), expect.anything(), true);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sem nenhuma das áreas, a busca some", () => {
    const { container } = render(<EntitySearch filters={F} canFreelancers={false} canCompanies={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
nice -n 15 npx vitest run src/modules/admin/application/use-engagement.test.tsx --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
for f in people-table entity-search; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/_components/$f.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
done
```

Esperado: os três com `Failed to resolve import "./…"` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar os hooks**

`src/modules/admin/application/use-engagement.ts`:

```ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  engagementListQuery,
  engagementPeriodQuery,
  engagementQuery,
  getContractorEngagement,
  getEngagementOverview,
  getFreelancerEngagement,
  listEngagementContractors,
  listEngagementFreelancers,
  type ContractorListRow,
  type EngagementFilters,
  type EngagementListParams,
  type FreelancerListRow,
  type ListPage,
} from "../infrastructure/engagement-api";
import { isFilterReady } from "./engagement-filters";
import type { EngagementSide } from "./engagement-format";

/**
 * Hooks do engajamento, no padrão de use-admin-metrics: personalizado
 * incompleto não consulta (a API cairia no padrão e a tela mostraria o mês com
 * o rótulo do intervalo), e os números anteriores ficam na tela enquanto o
 * filtro novo carrega.
 */
const STALE_MS = 30_000;

export type PeopleRow = FreelancerListRow | ContractorListRow;

export function useEngagementOverview(f: EngagementFilters) {
  return useQuery({
    queryKey: ["admin", "engagement", "overview", engagementQuery(f)],
    queryFn: () => getEngagementOverview(f),
    enabled: isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** Lista de um lado. `enabled=false` quando o admin não tem a área (a API daria 403). */
export function useEngagementPeople(
  side: EngagementSide,
  f: EngagementFilters,
  params: EngagementListParams,
  enabled = true,
) {
  return useQuery<ListPage<PeopleRow>>({
    queryKey: ["admin", "engagement", side, engagementListQuery(f, params)],
    queryFn: () =>
      side === "freelancer" ? listEngagementFreelancers(f, params) : listEngagementContractors(f, params),
    enabled: enabled && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** Fichas: a chave usa só o período, porque é o único filtro que a API aplica nelas. */
export function useFreelancerEngagement(userId: string, f: EngagementFilters) {
  return useQuery({
    queryKey: ["admin", "engagement", "freelancer-detail", userId, engagementPeriodQuery(f)],
    queryFn: () => getFreelancerEngagement(userId, f),
    enabled: Boolean(userId) && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

export function useContractorEngagement(userId: string, f: EngagementFilters) {
  return useQuery({
    queryKey: ["admin", "engagement", "contractor-detail", userId, engagementPeriodQuery(f)],
    queryFn: () => getContractorEngagement(userId, f),
    enabled: Boolean(userId) && isFilterReady(f),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}
```

`src/app/(auth)/engajamento/_components/use-debounced.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** Mesmo helper local de carteiras/page.tsx: espera o usuário parar de digitar. */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 4: Implementar a lista com contato**

`src/app/(auth)/engajamento/_components/people-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { contractorListSheets, freelancerListSheets } from "@/modules/admin/application/engagement-export";
import { fichaHref, type FilterEntry } from "@/modules/admin/application/engagement-filters";
import {
  CONTRACTOR_SEGMENTS,
  FREELANCER_SEGMENTS,
  STATUS_BADGE,
  dateBR,
  fileSlug,
  formatValue,
  productsLabel,
  statusLabel,
  type EngagementSide,
} from "@/modules/admin/application/engagement-format";
import { useEngagementPeople, type PeopleRow } from "@/modules/admin/application/use-engagement";
import {
  listEngagementContractors,
  listEngagementFreelancers,
  type EngagementFilters,
  type EngagementListParams,
  type FreelancerListRow,
} from "@/modules/admin/infrastructure/engagement-api";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { Contact } from "./contact";
import { ErrorBox, Spinner } from "./states";
import { useDebounced } from "./use-debounced";

const PAGE_SIZE = 25;
const PAGER_BTN =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e5e5e5] transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-40";

interface PeopleTableProps {
  side: EngagementSide;
  filters: EngagementFilters;
  /** Filtros já descritos, para a aba "Filtros" do Excel. */
  entries: FilterEntry[];
}

function isFreelancerRow(row: PeopleRow): row is FreelancerListRow {
  return "lastCandidacyAt" in row;
}

/** O que muda entre os lados: a última ação e o contador do período. */
function facts(row: PeopleRow) {
  return isFreelancerRow(row)
    ? { lastLabel: "Última candidatura", last: row.lastCandidacyAt, countLabel: "Candidaturas", count: row.candidaciesInPeriod }
    : { lastLabel: "Última vaga", last: row.lastVacancyAt, countLabel: "Vagas", count: row.vacanciesInPeriod };
}

function place(row: PeopleRow): string {
  return [row.city, row.uf].filter(Boolean).join(" - ") || "—";
}

/** Busca a lista inteira (até 20.000) com os mesmos filtros e monta as abas. */
async function buildListExport(
  side: EngagementSide,
  filters: EngagementFilters,
  params: EngagementListParams,
  entries: FilterEntry[],
  segment: string,
) {
  const now = new Date();
  if (side === "freelancer") {
    const res = await listEngagementFreelancers(filters, params);
    return {
      sheets: freelancerListSheets(res, entries, segment, now),
      shown: res.rows.length,
      total: res.total,
      truncated: res.truncated,
    };
  }
  const res = await listEngagementContractors(filters, params);
  return {
    sheets: contractorListSheets(res, entries, segment, now),
    shown: res.rows.length,
    total: res.total,
    truncated: res.truncated,
  };
}

function NameCell({ row, side, filters }: { row: PeopleRow; side: EngagementSide; filters: EngagementFilters }) {
  return (
    <div className="min-w-0">
      <Link
        href={fichaHref(side, row.userId, filters)}
        className="font-medium text-[#1d1d1b] hover:text-[#eca826] hover:underline"
      >
        {row.name}
      </Link>
      {!row.hasAccess && (
        <Badge variant="muted" className="ml-2 align-middle">
          sem acesso
        </Badge>
      )}
      {!isFreelancerRow(row) && row.document && <p className="text-xs text-[#737373]">CNPJ {row.document}</p>}
    </div>
  );
}

export function PeopleTable({ side, filters, entries }: PeopleTableProps) {
  const segments = side === "freelancer" ? FREELANCER_SEGMENTS : CONTRACTOR_SEGMENTS;
  const [segment, setSegment] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [includeNoAccess, setIncludeNoAccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const term = useDebounced(search.trim(), 400);

  // Trocar filtro, segmento ou busca volta à página 1 sem efeito colateral:
  // a página guardada só vale para a combinação em que foi escolhida.
  const listKey = JSON.stringify([filters, segment, term, includeNoAccess]);
  const [pageState, setPageState] = useState({ key: listKey, page: 1 });
  const page = pageState.key === listKey ? pageState.page : 1;
  const goTo = (p: number) => setPageState({ key: listKey, page: p });

  const params: EngagementListParams = {
    segment: segment === "all" ? null : segment,
    search: term,
    includeNoAccess,
    page,
    limit: PAGE_SIZE,
  };
  const query = useEngagementPeople(side, filters, params);
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const segmentText = segments.find((s) => s.id === segment)?.label ?? segments[0].label;
  const noun = side === "freelancer" ? "freelancers" : "empresas";

  async function exportList() {
    setExporting(true);
    try {
      const out = await buildListExport(side, filters, { ...params, exportAll: true }, entries, segmentText);
      await downloadSheets(`engajamento-${noun}-${fileSlug(segmentText)}`, out.sheets);
      if (out.truncated) {
        toast.warning(
          `A lista tem ${formatValue(out.total)} linhas. O arquivo traz só as primeiras ${formatValue(out.shown)}: use um filtro mais estreito para ver o resto.`,
        );
      } else {
        toast.success(`Lista exportada (${formatValue(out.shown)} linhas).`);
      }
    } catch {
      toast.error("Não foi possível exportar a lista. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          {side === "freelancer" ? "Lista de freelancers" : "Lista de empresas"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={exportList}
          disabled={exporting || total === 0}
          className="self-start sm:self-auto"
        >
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar lista (Excel)
        </Button>
      </div>

      <div role="group" aria-label="Segmento" className="mt-3 flex flex-wrap gap-1.5">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={segment === s.id}
            onClick={() => setSegment(s.id)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs transition-colors",
              segment === s.id
                ? "border-[#eca826] bg-[#eca826] font-semibold text-[#1d1d1b]"
                : "border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
          <Input
            aria-label="Buscar na lista"
            placeholder={
              side === "freelancer"
                ? "Nome, e-mail, telefone ou CPF"
                : "Nome, razão social, CNPJ, e-mail ou telefone"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#737373]">
          <Switch
            checked={includeNoAccess}
            onCheckedChange={setIncludeNoAccess}
            aria-label="Incluir contas sem acesso"
          />
          Incluir contas sem acesso
        </label>
      </div>

      {query.isError && !query.data ? (
        <div className="mt-4">
          <ErrorBox message="Não foi possível carregar a lista." onRetry={() => query.refetch()} />
        </div>
      ) : query.isLoading ? (
        <Spinner className="h-40" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#737373]">Ninguém neste segmento com esses filtros.</p>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">{side === "freelancer" ? "Nome" : "Empresa"}</th>
                  <th className="py-2 pr-3 font-medium">Cidade</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Última atividade</th>
                  <th className="py-2 pr-3 font-medium">{side === "freelancer" ? "Última candidatura" : "Última vaga"}</th>
                  <th className="py-2 pr-3 text-right font-medium">{side === "freelancer" ? "Candidaturas" : "Vagas"}</th>
                  <th className="py-2 pr-3 text-right font-medium">Concluídos</th>
                  <th className="py-2 font-medium">Contato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const x = facts(r);
                  return (
                    <tr key={r.userId} className="border-b border-[#f0f0f0] align-top last:border-0">
                      <td className="py-2 pr-3">
                        <NameCell row={r} side={side} filters={filters} />
                      </td>
                      <td className="py-2 pr-3 text-[#1d1d1b]">
                        {place(r)}
                        <p className="text-xs text-[#737373]">{productsLabel(r.products)}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={STATUS_BADGE[r.status]}>{statusLabel(r.status, side)}</Badge>
                      </td>
                      <td className="py-2 pr-3">{dateBR(r.lastSeenAt)}</td>
                      <td className="py-2 pr-3">{dateBR(x.last)}</td>
                      <td className="py-2 pr-3 text-right">{formatValue(x.count)}</td>
                      <td className="py-2 pr-3 text-right">{formatValue(r.completedInPeriod)}</td>
                      <td className="py-2">
                        <Contact phone={r.phone} email={r.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="mt-4 space-y-2 md:hidden">
            {rows.map((r) => {
              const x = facts(r);
              return (
                <li key={r.userId} className="rounded-lg border border-[#e5e5e5] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <NameCell row={r} side={side} filters={filters} />
                    <Badge variant={STATUS_BADGE[r.status]} className="shrink-0">
                      {statusLabel(r.status, side)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#737373]">
                    {place(r)} · {productsLabel(r.products)}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Última atividade</dt>
                    <dd className="text-right">{dateBR(r.lastSeenAt)}</dd>
                    <dt className="text-[#737373]">{x.lastLabel}</dt>
                    <dd className="text-right">{dateBR(x.last)}</dd>
                    <dt className="text-[#737373]">{x.countLabel} no período</dt>
                    <dd className="text-right">{formatValue(x.count)}</dd>
                    <dt className="text-[#737373]">Concluídos no período</dt>
                    <dd className="text-right">{formatValue(r.completedInPeriod)}</dd>
                  </dl>
                  <div className="mt-2">
                    <Contact phone={r.phone} email={r.email} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-col items-center justify-between gap-2 text-sm text-[#737373] sm:flex-row">
            <span>{`Mostrando ${from}–${to} de ${formatValue(total)}`}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(Math.max(1, page - 1))}
                disabled={page <= 1 || query.isFetching}
                aria-label="Página anterior"
                title="Página anterior"
                className={PAGER_BTN}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[#1d1d1b]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goTo(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || query.isFetching}
                aria-label="Próxima página"
                title="Próxima página"
                className={PAGER_BTN}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Implementar a busca global**

`src/app/(auth)/engajamento/_components/entity-search.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fichaHref } from "@/modules/admin/application/engagement-filters";
import type { EngagementSide } from "@/modules/admin/application/engagement-format";
import { useEngagementPeople } from "@/modules/admin/application/use-engagement";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";
import { useDebounced } from "./use-debounced";

interface EntitySearchProps {
  filters: EngagementFilters;
  canFreelancers: boolean;
  canCompanies: boolean;
}

/**
 * "Buscar empresa ou freelancer" (spec §5.1): só nos lados que o admin pode
 * ver. A busca não fica presa à cidade/produto escolhidos (procurar alguém
 * pelo nome não deve depender do filtro), mas o link da ficha leva todos os
 * filtros na URL.
 */
export function EntitySearch({ filters, canFreelancers, canCompanies }: EntitySearchProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const term = useDebounced(text.trim(), 350);
  const active = term.length >= 2;
  const searchFilters: EngagementFilters = { ...filters, city: "", uf: "", product: "all", channel: "all" };
  const params = { search: term, includeNoAccess: true, page: 1, limit: 5 };
  const freelancers = useEngagementPeople("freelancer", searchFilters, params, canFreelancers && active);
  const companies = useEngagementPeople("contractor", searchFilters, params, canCompanies && active);

  if (!canFreelancers && !canCompanies) return null;

  const label =
    canFreelancers && canCompanies
      ? "Buscar empresa ou freelancer"
      : canFreelancers
        ? "Buscar freelancer"
        : "Buscar empresa";
  const groups: { title: string; side: EngagementSide; q: typeof freelancers }[] = [];
  if (canFreelancers) groups.push({ title: "Freelancers", side: "freelancer", q: freelancers });
  if (canCompanies) groups.push({ title: "Empresas", side: "contractor", q: companies });

  return (
    <div className="relative w-full md:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]" />
      <Input
        aria-label={label}
        placeholder={`${label} (nome, e-mail, telefone ou documento)`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Espera o clique no resultado acontecer antes de fechar.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="pl-9"
      />
      {open && active && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white p-2 shadow-lg">
          {groups.map((g) => {
            const rows = g.q.data?.rows ?? [];
            return (
              <div key={g.side} className="py-1">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  {g.title}
                </p>
                {g.q.isLoading ? (
                  <p className="px-2 py-1 text-sm text-[#737373]">Buscando…</p>
                ) : rows.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-[#737373]">Ninguém encontrado.</p>
                ) : (
                  rows.map((r) => (
                    <Link
                      key={r.userId}
                      href={fichaHref(g.side, r.userId, filters)}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#f7f7f7]"
                    >
                      <span className="truncate font-medium text-[#1d1d1b]">{r.name}</span>
                      <span className="shrink-0 text-xs text-[#737373]">
                        {[r.city, r.uf].filter(Boolean).join(" - ") || "—"}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
nice -n 15 npx vitest run src/modules/admin/application/use-engagement.test.tsx --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
for f in people-table entity-search; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/_components/$f.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
done
```

Esperado: `Test Files  1 passed (1)` nos três (hooks 4 testes, lista 5, busca 3).

- [ ] **Step 7: Commit**

```bash
git add src/modules/admin/application/use-engagement.ts src/modules/admin/application/use-engagement.test.tsx \
        "src/app/(auth)/engajamento/_components/use-debounced.ts" \
        "src/app/(auth)/engajamento/_components/people-table.tsx" "src/app/(auth)/engajamento/_components/people-table.test.tsx" \
        "src/app/(auth)/engajamento/_components/entity-search.tsx" "src/app/(auth)/engajamento/_components/entity-search.test.tsx"
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): hooks, lista com contato e busca de empresa/freelancer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Página `/engajamento` e item no menu

**Files:**
- Create: `src/app/(auth)/engajamento/page.tsx`
- Create: `src/app/(auth)/engajamento/_tests/page.test.tsx`
- Modify: `src/components/shared/admin-layout.tsx` (lista `navItems`)

**Interfaces:**
- Consumes: Tasks 1 a 6; `useAuth` (`hasPermission`, `isHydrated`), `PageHeader`, `Tabs*` (controlados) e `Button`.
- Produces: a rota `/engajamento`, com filtros e aba na URL (`periodo`, `de`, `ate`, `cidade`, `uf`, `produto`, `canal`, `aba`) e o item "Engajamento" no menu, logo depois do Dashboard.

- [ ] **Step 1: Teste que falha**

`src/app/(auth)/engajamento/_tests/page.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_OVERVIEW } from "@/modules/admin/application/engagement.test-fixtures";

const { replace, nav, auth, overviewHook, peopleHook, downloadSheets } = vi.hoisted(() => ({
  replace: vi.fn(),
  nav: { params: new URLSearchParams() },
  auth: { perms: [] as string[] },
  overviewHook: vi.fn(),
  peopleHook: vi.fn(),
  downloadSheets: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/engajamento",
  useSearchParams: () => nav.params,
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({
    isHydrated: true,
    isSuperAdmin: false,
    hasPermission: (p: string) => auth.perms.includes(p),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/admin/application/use-engagement", () => ({
  useEngagementOverview: overviewHook,
  useEngagementPeople: peopleHook,
}));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("@/modules/admin/infrastructure/engagement-pdf", () => ({ buildOverviewPdf: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/svg-to-png", () => ({ svgToPngDataUrl: vi.fn() }));
vi.mock("../_components/series-chart", () => ({
  SeriesChart: () => <p>grafico</p>,
  SeriesChartForExport: () => null,
}));
vi.mock("../_components/people-table", () => ({
  PeopleTable: ({ side }: { side: string }) => <p>lista-{side}</p>,
}));

import EngajamentoPage from "../page";

const ok = {
  data: SAMPLE_OVERVIEW,
  isLoading: false,
  isError: false,
  isPlaceholderData: false,
  isFetching: false,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = new URLSearchParams();
  auth.perms = [];
  overviewHook.mockReturnValue(ok);
  peopleHook.mockReturnValue({ data: undefined, isLoading: false });
});

describe("/engajamento", () => {
  it("URL inválida cai no padrão e a página abre na visão geral", () => {
    nav.params = new URLSearchParams("periodo=xpto&de=2026-13-40&aba=nada&produto=bar");
    render(<EngajamentoPage />);
    expect(overviewHook).toHaveBeenCalledWith(expect.objectContaining({ period: "this_month", product: "all" }));
    expect(screen.getByText("Funil de freelancers")).toBeInTheDocument();
    expect(screen.getByText("Funil de empresas")).toBeInTheDocument();
  });

  it("personalizado com a data apagada: pede as datas, esconde os números e a URL acompanha", () => {
    nav.params = new URLSearchParams("periodo=custom&de=2026-09-01&ate=2026-09-30");
    render(<EngajamentoPage />);
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "" } });
    expect(screen.getByText("Escolha as datas do período personalizado para ver os números.")).toBeInTheDocument();
    expect(screen.queryByText("Funil de freelancers")).not.toBeInTheDocument();
    expect(overviewHook).toHaveBeenLastCalledWith(expect.objectContaining({ period: "custom", from: "" }));
    expect(replace).toHaveBeenLastCalledWith("/engajamento?periodo=custom&ate=2026-09-30", { scroll: false });
  });

  it("sem FREELANCERS/COMPANIES: sem busca e sem listas, mas a visão geral funciona", () => {
    render(<EngajamentoPage />);
    expect(screen.queryByRole("textbox", { name: /Buscar/ })).not.toBeInTheDocument();
    expect(screen.getByText("Freelancers que abriram")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Freelancers" }));
    expect(screen.queryByText("lista-freelancer")).not.toBeInTheDocument();
    expect(screen.getByText(/A lista com contatos fica para quem tem acesso à área Freelancers/)).toBeInTheDocument();
    expect(replace).toHaveBeenLastCalledWith("/engajamento?aba=freelancers", { scroll: false });
  });

  it("com as duas áreas: busca e listas aparecem (a aba vem da URL)", () => {
    auth.perms = ["FREELANCERS", "COMPANIES"];
    nav.params = new URLSearchParams("aba=empresas");
    render(<EngajamentoPage />);
    expect(screen.getByRole("textbox", { name: "Buscar empresa ou freelancer" })).toBeInTheDocument();
    expect(screen.getByText("lista-contractor")).toBeInTheDocument();
  });

  it("erro com botão de tentar de novo", () => {
    const refetch = vi.fn();
    overviewHook.mockReturnValue({ ...ok, data: undefined, isError: true, refetch });
    render(<EngajamentoPage />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Exportar Excel gera as 4 abas do painel", async () => {
    render(<EngajamentoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    const [name, sheets] = downloadSheets.mock.calls[0];
    expect(name).toBe("engajamento-01-09-2026-a-30-09-2026");
    expect(sheets.map((s: { name: string }) => s.name)).toEqual(["Filtros", "Resumo", "Série", "Cidades"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
nice -n 15 npx vitest run "src/app/(auth)/engajamento/_tests/page.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
```

Esperado: `Failed to resolve import "../page"` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar a página**

`src/app/(auth)/engajamento/page.tsx`:

```tsx
"use client";

import { Suspense, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/modules/auth/application/use-auth";
import { overviewSheets } from "@/modules/admin/application/engagement-export";
import {
  ENGAGEMENT_TABS,
  describeFilters,
  filterEntries,
  filtersFromSearchParams,
  filtersToSearchParams,
  isFilterReady,
  parseEngagementTab,
  withQuery,
  type EngagementTab,
} from "@/modules/admin/application/engagement-filters";
import { fileSlug } from "@/modules/admin/application/engagement-format";
import {
  CONTRACTOR_METRICS,
  FREELANCER_METRICS,
  OVERVIEW_HIGHLIGHTS,
  VACANCY_METRICS,
  contractorFunnel,
  freelancerFunnel,
} from "@/modules/admin/application/engagement-metrics";
import { useEngagementOverview } from "@/modules/admin/application/use-engagement";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";
import { buildOverviewPdf } from "@/modules/admin/infrastructure/engagement-pdf";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { svgToPngDataUrl } from "@/modules/admin/infrastructure/svg-to-png";
import { CityTable } from "./_components/city-table";
import { EntitySearch } from "./_components/entity-search";
import { FilterBar } from "./_components/filter-bar";
import { Funnel } from "./_components/funnel";
import { MeasurementNotice } from "./_components/measurement-notice";
import { MetricGrid } from "./_components/metric-grid";
import { PeopleTable } from "./_components/people-table";
import { SeriesChart, SeriesChartForExport } from "./_components/series-chart";
import { ErrorBox, Spinner } from "./_components/states";

export default function EngajamentoPage() {
  // Filtros e aba ficam na URL (link compartilhável): useSearchParams pede Suspense no App Router.
  return (
    <Suspense fallback={<Spinner />}>
      <EngajamentoScreen />
    </Suspense>
  );
}

function NoAccessNote({ area }: { area: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">
      {`A lista com contatos fica para quem tem acesso à área ${area}. Os números acima valem para todo admin.`}
    </p>
  );
}

function EngajamentoScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermission, isHydrated } = useAuth();
  const canFreelancers = isHydrated && hasPermission("FREELANCERS");
  const canCompanies = isHydrated && hasPermission("COMPANIES");

  // A URL só é lida na entrada; depois o estado manda e a URL acompanha (replace).
  // Assim um personalizado com a data apagada fica "incompleto" na tela, em vez
  // de a URL sem `de` trazer de volta a data padrão.
  const [filters, setFilters] = useState<EngagementFilters>(() => filtersFromSearchParams(searchParams));
  const [tab, setTab] = useState<EngagementTab>(() => parseEngagementTab(searchParams.get("aba")));
  const sync = (f: EngagementFilters, t: EngagementTab) =>
    router.replace(withQuery(pathname, filtersToSearchParams(f, t === "visao-geral" ? {} : { aba: t })), {
      scroll: false,
    });
  const changeFilters = (f: EngagementFilters) => {
    setFilters(f);
    sync(f, tab);
  };
  const changeTab = (value: string) => {
    const t = parseEngagementTab(value);
    setTab(t);
    sync(filters, t);
  };

  const overview = useEngagementOverview(filters);
  const o = overview.data;
  const ready = isFilterReady(filters);
  const entries = filterEntries(filters, o?.period ?? null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  // Enquanto o filtro novo carrega, a tela ainda mostra os números anteriores:
  // exportar nessa hora misturaria o rótulo novo com o número velho.
  const exportDisabled = !o || !ready || overview.isPlaceholderData || exporting !== null;

  async function exportPdf() {
    if (!o) return;
    setExporting("pdf");
    try {
      const svg = chartRef.current?.querySelector("svg") ?? null;
      const png = await svgToPngDataUrl(svg);
      buildOverviewPdf(o, describeFilters(filters, o.period), png, new Date()).save(
        `engajamento-${fileSlug(o.period.label)}.pdf`,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  async function exportXlsx() {
    if (!o) return;
    setExporting("xlsx");
    try {
      await downloadSheets(`engajamento-${fileSlug(o.period.label)}`, overviewSheets(o, entries, new Date()));
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={exportPdf} disabled={exportDisabled}>
        {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Exportar PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportXlsx} disabled={exportDisabled}>
        {exporting === "xlsx" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Exportar Excel
      </Button>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Engajamento"
        description="Quem abre o app, quem se candidata e quem publica vaga, por período, cidade e produto."
      />
      <div className="mb-4">
        <EntitySearch filters={filters} canFreelancers={canFreelancers} canCompanies={canCompanies} />
      </div>
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={o?.filterOptions.cities ?? []}
        actions={actions}
      />

      {!ready ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">
          Escolha as datas do período personalizado para ver os números.
        </p>
      ) : overview.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : overview.isError && !o ? (
        <ErrorBox onRetry={() => overview.refetch()} />
      ) : o ? (
        <>
          <MeasurementNotice measuredSince={o.measuredSince} period={o.period} />
          <p className="mb-3 text-xs text-[#737373]">{`${o.period.label} · comparado com ${o.period.previousLabel}`}</p>
          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList className="mb-4 w-full justify-start overflow-x-auto md:w-auto">
              {ENGAGEMENT_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} type="button">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="visao-geral" className="space-y-6">
              <MetricGrid overview={o} metrics={OVERVIEW_HIGHLIGHTS} product={filters.product} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Funnel title="Funil de freelancers" steps={freelancerFunnel(o)} />
                <Funnel title="Funil de empresas" steps={contractorFunnel(o)} />
              </div>
              <SeriesChart series={o.series} />
              <CityTable rows={o.byCity} />
            </TabsContent>

            <TabsContent value="freelancers" className="space-y-6">
              <MetricGrid overview={o} metrics={FREELANCER_METRICS} product={filters.product} />
              <Funnel title="Funil de freelancers" steps={freelancerFunnel(o)} />
              {canFreelancers ? (
                <PeopleTable side="freelancer" filters={filters} entries={entries} />
              ) : (
                <NoAccessNote area="Freelancers" />
              )}
            </TabsContent>

            <TabsContent value="empresas" className="space-y-6">
              <MetricGrid overview={o} metrics={CONTRACTOR_METRICS} product={filters.product} />
              <Funnel title="Funil de empresas" steps={contractorFunnel(o)} />
              {canCompanies ? (
                <PeopleTable side="contractor" filters={filters} entries={entries} />
              ) : (
                <NoAccessNote area="Empresas" />
              )}
            </TabsContent>

            <TabsContent value="vagas" className="space-y-6">
              <MetricGrid overview={o} metrics={VACANCY_METRICS} product={filters.product} />
              <SeriesChart series={o.series} lines={["vacanciesPublished", "vacanciesCompleted", "candidacies"]} />
              <CityTable rows={o.byCity} />
            </TabsContent>
          </Tabs>

          {/* Gráfico fixo fora da tela, só para o PDF (independe da aba e da largura). */}
          <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0">
            <SeriesChartForExport ref={chartRef} series={o.series} />
          </div>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Item no menu**

Modify `src/components/shared/admin-layout.tsx`: na lista `navItems`, logo depois do Dashboard. O ícone `Activity` já é importado no arquivo, porque é usado em "Verificação de serviços"; confira com `grep -n "  Activity," src/components/shared/admin-layout.tsx`. O item fica sem `permission`, porque a visão geral é aberta a qualquer admin, e a própria página esconde listas, busca e fichas por permissão.

```diff
 const navItems: NavItem[] = [
   { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
+  { label: "Engajamento", icon: Activity, path: "/engajamento" },
   { label: "Freelancers", icon: Users, path: "/freelancers", permission: "FREELANCERS" },
```

- [ ] **Step 5: Rodar e ver passar**

```bash
nice -n 15 npx vitest run "src/app/(auth)/engajamento/_tests/page.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
grep -n '"/engajamento"' src/components/shared/admin-layout.tsx
```

Esperado: `Test Files  1 passed (1)` (6 testes) e a linha nova do menu.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/engajamento/page.tsx" "src/app/(auth)/engajamento/_tests/page.test.tsx" src/components/shared/admin-layout.tsx
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): página /engajamento e item no menu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Fichas de freelancer e de empresa (com o relatório para o cliente)

**Files:**
- Create: `src/app/(auth)/engajamento/_components/use-detail-filters.ts`
- Create: `src/app/(auth)/engajamento/_components/detail-parts.tsx`
- Create: `src/app/(auth)/engajamento/freelancer/[id]/page.tsx` + `freelancer/[id]/_tests/page.test.tsx`
- Create: `src/app/(auth)/engajamento/empresa/[id]/page.tsx` + `empresa/[id]/_tests/page.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 a 7; `useAreaGuard` (`@/modules/auth/application/use-area-guard`), que devolve `{ isChecking, allowed }` e redireciona para `/dashboard` quem não tem a área; `isAxiosError` (`axios`).
- Produces:
  - `useDetailFilters(tab) → { filters, changeFilters, backHref }`;
  - `BackLink`, `SummaryCard`, `NumbersGrid`, `ChannelDaysCard`;
  - as rotas `/engajamento/freelancer/[id]` (área FREELANCERS) e `/engajamento/empresa/[id]` (área COMPANIES).

- [ ] **Step 1: Testes que falham**

`src/app/(auth)/engajamento/freelancer/[id]/_tests/page.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_FREELANCER_DETAIL } from "@/modules/admin/application/engagement.test-fixtures";

const { guard, detailHook, downloadSheets } = vi.hoisted(() => ({
  guard: { allowed: true },
  detailHook: vi.fn(),
  downloadSheets: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "u-f1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/engajamento/freelancer/u-f1",
  useSearchParams: () => new URLSearchParams("periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers"),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: guard.allowed }),
}));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useFreelancerEngagement: detailHook }));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import FreelancerEngagementPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  guard.allowed = true;
  detailHook.mockReturnValue({
    data: SAMPLE_FREELANCER_DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
});

describe("ficha do freelancer", () => {
  it("sem FREELANCERS não consulta nem mostra a ficha (o guard redireciona)", () => {
    guard.allowed = false;
    render(<FreelancerEngagementPage />);
    expect(detailHook).not.toHaveBeenCalled();
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
  });

  it("mostra a pessoa, o WhatsApp, as candidaturas, só o filtro de período e a volta com os filtros", () => {
    render(<FreelancerEngagementPage />);
    expect(screen.getByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /99876-5432/ })).toHaveAttribute("href", "https://wa.me/5532998765432");
    expect(screen.getAllByText("Garçom para sábado").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute(
      "href",
      "/engajamento?periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers",
    );
    expect(detailHook).toHaveBeenCalledWith("u-f1", expect.objectContaining({ period: "custom", from: "2026-09-01" }));
  });

  it("Exportar Excel gera Filtros, Resumo e Candidaturas", async () => {
    render(<FreelancerEngagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    const [name, sheets] = downloadSheets.mock.calls[0];
    expect(name).toBe("engajamento-freelancer-ana-souza");
    expect(sheets.map((s: { name: string }) => s.name)).toEqual(["Filtros", "Resumo", "Candidaturas"]);
  });
});
```

`src/app/(auth)/engajamento/empresa/[id]/_tests/page.test.tsx`:

```tsx
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CONTRACTOR_DETAIL } from "@/modules/admin/application/engagement.test-fixtures";

const { guard, detailHook, pdf, save } = vi.hoisted(() => ({
  guard: { allowed: true },
  detailHook: vi.fn(),
  pdf: vi.fn(),
  save: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "u-c1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/engajamento/empresa/u-c1",
  useSearchParams: () => new URLSearchParams("periodo=last_month&cidade=Juiz+de+Fora&uf=MG&aba=empresas"),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: guard.allowed }),
}));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useContractorEngagement: detailHook }));
vi.mock("@/modules/admin/infrastructure/engagement-pdf", () => ({ buildContractorReportPdf: pdf }));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import ContractorEngagementPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  guard.allowed = true;
  pdf.mockReturnValue({ save });
  detailHook.mockReturnValue({
    data: SAMPLE_CONTRACTOR_DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
});

describe("ficha da empresa", () => {
  it("sem COMPANIES não consulta nem mostra a ficha (o guard redireciona)", () => {
    guard.allowed = false;
    render(<ContractorEngagementPage />);
    expect(detailHook).not.toHaveBeenCalled();
    expect(screen.queryByText("Bar do Zé")).not.toBeInTheDocument();
  });

  it("mostra números, vagas e a volta com todos os filtros", () => {
    render(<ContractorEngagementPage />);
    expect(screen.getByRole("heading", { name: "Bar do Zé" })).toBeInTheDocument();
    expect(screen.getByText("Vagas publicadas")).toBeInTheDocument();
    expect(screen.getAllByText("Garçom para sábado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cancelada pela empresa").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute(
      "href",
      "/engajamento?periodo=last_month&cidade=Juiz+de+Fora&uf=MG&aba=empresas",
    );
    expect(detailHook).toHaveBeenCalledWith("u-c1", expect.objectContaining({ period: "last_month" }));
  });

  it("relatório para o cliente gera o PDF da empresa e salva com nome e período", () => {
    render(<ContractorEngagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /Relatório para o cliente/ }));
    expect(pdf).toHaveBeenCalledWith(SAMPLE_CONTRACTOR_DETAIL, expect.any(Date));
    expect(save).toHaveBeenCalledWith("relatorio-bar-do-ze-2026-09-01.pdf");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
for p in freelancer empresa; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/$p/[id]/_tests/page.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Failed to resolve|Test Files"
done
```

Esperado: os dois com `Failed to resolve import "../page"` e `Test Files  1 failed (1)`.

- [ ] **Step 3: Implementar as peças das fichas**

`src/app/(auth)/engajamento/_components/use-detail-filters.ts`:

```ts
"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  withQuery,
} from "@/modules/admin/application/engagement-filters";
import type { EngagementFilters } from "@/modules/admin/infrastructure/engagement-api";

/**
 * Fichas: os filtros chegam na URL (vindos da lista ou da busca). Só o período
 * muda a consulta, mas a URL e o link de volta levam tudo, inclusive a aba.
 */
export function useDetailFilters(tab: "freelancers" | "empresas") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<EngagementFilters>(() => filtersFromSearchParams(searchParams));
  const changeFilters = (f: EngagementFilters) => {
    setFilters(f);
    router.replace(withQuery(pathname, filtersToSearchParams(f, { aba: tab })), { scroll: false });
  };
  const backHref = withQuery("/engajamento", filtersToSearchParams(filters, { aba: tab }));
  return { filters, changeFilters, backHref };
}
```

`src/app/(auth)/engajamento/_components/detail-parts.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  STATUS_BADGE,
  deltaInfo,
  formatValue,
  statusLabel,
  type EngagementSide,
} from "@/modules/admin/application/engagement-format";
import type { DetailNumberDef } from "@/modules/admin/application/engagement-metrics";
import type { ChannelDays, EngagementStatus } from "@/modules/admin/infrastructure/engagement-api";
import { Contact } from "./contact";

export function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#1d1d1b]">
      <ArrowLeft className="h-4 w-4" />
      Voltar para o engajamento
    </Link>
  );
}

export function SummaryCard({
  side,
  status,
  hasAccess,
  facts,
  phone,
  email,
}: {
  side: EngagementSide;
  status: EngagementStatus;
  hasAccess: boolean;
  facts: { label: string; value: string }[];
  phone: string | null;
  email: string | null;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[status]}>{statusLabel(status, side)}</Badge>
            {!hasAccess && <Badge variant="muted">sem acesso (conta importada)</Badge>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-3 sm:block">
                <dt className="text-[#737373]">{f.label}</dt>
                <dd className="text-[#1d1d1b]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Contact phone={phone} email={email} />
      </div>
    </Card>
  );
}

/** Números da ficha com o período anterior (mesma regra de cor dos cartões do painel). */
export function NumbersGrid<D>({ defs, detail }: { defs: DetailNumberDef<D>[]; detail: D }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {defs.map((def) => {
        const p = def.pick(detail);
        const delta = deltaInfo(p, def.kind, def.higherIsBetter);
        return (
          <KpiCard
            key={def.key}
            title={def.label}
            value={formatValue(p.current, def.kind)}
            icon={def.icon}
            meta={delta.text}
            metaColor={delta.color}
          />
        );
      })}
    </div>
  );
}

export function ChannelDaysCard({ days }: { days: ChannelDays }) {
  return (
    <Card className="p-4 md:p-5">
      <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Dias em que abriu, por canal</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="font-semibold">{formatValue(days.app)}</span> <span className="text-[#737373]">no app</span>
        </span>
        <span>
          <span className="font-semibold">{formatValue(days.web)}</span> <span className="text-[#737373]">no site</span>
        </span>
        <span>
          <span className="font-semibold">{formatValue(days.other)}</span> <span className="text-[#737373]">outros</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-[#737373]">Conta só a partir do início da medição de aberturas.</p>
    </Card>
  );
}
```

- [ ] **Step 4: Implementar a ficha do freelancer**

`src/app/(auth)/engajamento/freelancer/[id]/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { freelancerDetailSheets } from "@/modules/admin/application/engagement-export";
import { periodText } from "@/modules/admin/application/engagement-filters";
import {
  PRODUCT_LABEL,
  candidacyStatusLabel,
  dateBR,
  fileSlug,
  productsLabel,
} from "@/modules/admin/application/engagement-format";
import { FREELANCER_DETAIL_NUMBERS } from "@/modules/admin/application/engagement-metrics";
import { useFreelancerEngagement } from "@/modules/admin/application/use-engagement";
import type { FreelancerDetail } from "@/modules/admin/infrastructure/engagement-api";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { BackLink, ChannelDaysCard, NumbersGrid, SummaryCard } from "../../_components/detail-parts";
import { FilterBar } from "../../_components/filter-bar";
import { ErrorBox, Spinner } from "../../_components/states";
import { useDetailFilters } from "../../_components/use-detail-filters";

export default function FreelancerEngagementPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  if (isChecking || !allowed) return <Spinner />;
  return (
    <Suspense fallback={<Spinner />}>
      <FreelancerScreen />
    </Suspense>
  );
}

function FreelancerScreen() {
  const { id } = useParams<{ id: string }>();
  const { filters, changeFilters, backHref } = useDetailFilters("freelancers");
  const query = useFreelancerEngagement(id, filters);
  const d = query.data;
  const [exporting, setExporting] = useState(false);
  const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

  async function exportXlsx() {
    if (!d) return;
    setExporting(true);
    try {
      await downloadSheets(
        `engajamento-freelancer-${fileSlug(d.summary.name)}`,
        freelancerDetailSheets(d, [{ label: "Período", value: periodText(filters, d.period) }], new Date()),
      );
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }

  const place = d ? [d.summary.city, d.summary.uf].filter(Boolean).join(" - ") : "";
  return (
    <div>
      <BackLink href={backHref} />
      <PageHeader
        title={d?.summary.name ?? "Ficha do freelancer"}
        description={d ? `Freelancer${place ? ` · ${place}` : ""} · ${productsLabel(d.summary.products)}` : undefined}
      />
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={[]}
        periodOnly
        actions={
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!d || exporting || query.isPlaceholderData}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Exportar Excel
          </Button>
        }
      />
      {query.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : notFound ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">Freelancer não encontrado.</p>
      ) : query.isError && !d ? (
        <ErrorBox message="Não foi possível carregar a ficha." onRetry={() => query.refetch()} />
      ) : d ? (
        <FreelancerBody d={d} />
      ) : null}
    </div>
  );
}

function FreelancerBody({ d }: { d: FreelancerDetail }) {
  const s = d.summary;
  return (
    <div className="space-y-6">
      <SummaryCard
        side="freelancer"
        status={s.status}
        hasAccess={s.hasAccess}
        phone={s.phone}
        email={s.email}
        facts={[
          { label: "Última atividade conhecida", value: dateBR(s.lastSeenAt) },
          { label: "Última candidatura", value: dateBR(s.lastCandidacyAt) },
          { label: "Cadastro", value: dateBR(s.createdAt) },
        ]}
      />
      <NumbersGrid defs={FREELANCER_DETAIL_NUMBERS} detail={d} />
      <ChannelDaysCard days={d.activeDaysByChannel} />
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
        <h3 className="mb-3 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          Candidaturas no período
        </h3>
        {d.candidacies.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#737373]">Nenhuma candidatura no período.</p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">Candidatura em</th>
                  <th className="py-2 pr-3 font-medium">Data da vaga</th>
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Cargo</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 font-medium">Concluiu</th>
                </tr>
              </thead>
              <tbody>
                {d.candidacies.map((c) => (
                  <tr key={c.candidacyId} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="py-2 pr-3">{dateBR(c.createdAt)}</td>
                    <td className="py-2 pr-3">{dateBR(c.vacancyDate)}</td>
                    <td className="py-2 pr-3">{c.companyName ?? "—"}</td>
                    <td className="py-2 pr-3">{c.title ?? c.serviceType ?? "—"}</td>
                    <td className="py-2 pr-3">{PRODUCT_LABEL[c.module]}</td>
                    <td className="py-2 pr-3">{candidacyStatusLabel(c.status)}</td>
                    <td className="py-2">{c.completed ? "Sim" : "Não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {d.candidacies.map((c) => (
                <li key={c.candidacyId} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
                  <p className="font-medium text-[#1d1d1b]">{c.title ?? c.serviceType ?? "—"}</p>
                  <p className="text-xs text-[#737373]">
                    {c.companyName ?? "—"} · {PRODUCT_LABEL[c.module]}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Candidatura em</dt>
                    <dd className="text-right">{dateBR(c.createdAt)}</dd>
                    <dt className="text-[#737373]">Data da vaga</dt>
                    <dd className="text-right">{dateBR(c.vacancyDate)}</dd>
                    <dt className="text-[#737373]">Situação</dt>
                    <dd className="text-right">{candidacyStatusLabel(c.status)}</dd>
                    <dt className="text-[#737373]">Concluiu</dt>
                    <dd className="text-right">{c.completed ? "Sim" : "Não"}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Implementar a ficha da empresa**

`src/app/(auth)/engajamento/empresa/[id]/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { contractorDetailSheets } from "@/modules/admin/application/engagement-export";
import { periodText } from "@/modules/admin/application/engagement-filters";
import {
  PRODUCT_LABEL,
  brasiliaDayOf,
  dateBR,
  fileSlug,
  formatValue,
  productsLabel,
  vacancySituation,
} from "@/modules/admin/application/engagement-format";
import { CONTRACTOR_DETAIL_NUMBERS } from "@/modules/admin/application/engagement-metrics";
import { useContractorEngagement } from "@/modules/admin/application/use-engagement";
import type { ContractorDetail } from "@/modules/admin/infrastructure/engagement-api";
import { buildContractorReportPdf } from "@/modules/admin/infrastructure/engagement-pdf";
import { downloadSheets } from "@/modules/admin/infrastructure/engagement-xlsx";
import { BackLink, ChannelDaysCard, NumbersGrid, SummaryCard } from "../../_components/detail-parts";
import { FilterBar } from "../../_components/filter-bar";
import { ErrorBox, Spinner } from "../../_components/states";
import { useDetailFilters } from "../../_components/use-detail-filters";

export default function ContractorEngagementPage() {
  const { isChecking, allowed } = useAreaGuard("COMPANIES");
  if (isChecking || !allowed) return <Spinner />;
  return (
    <Suspense fallback={<Spinner />}>
      <ContractorScreen />
    </Suspense>
  );
}

function ContractorScreen() {
  const { id } = useParams<{ id: string }>();
  const { filters, changeFilters, backHref } = useDetailFilters("empresas");
  const query = useContractorEngagement(id, filters);
  const d = query.data;
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const notFound = isAxiosError(query.error) && query.error.response?.status === 404;
  const disabled = !d || exporting !== null || query.isPlaceholderData;

  /** Relatório para enviar à empresa: sem telefone, e-mail ou documento (Task 4). */
  function exportClientPdf() {
    if (!d) return;
    setExporting("pdf");
    try {
      buildContractorReportPdf(d, new Date()).save(
        `relatorio-${fileSlug(d.summary.name)}-${brasiliaDayOf(d.period.start)}.pdf`,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  async function exportXlsx() {
    if (!d) return;
    setExporting("xlsx");
    try {
      await downloadSheets(
        `engajamento-empresa-${fileSlug(d.summary.name)}`,
        contractorDetailSheets(d, [{ label: "Período", value: periodText(filters, d.period) }], new Date()),
      );
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente de novo.");
    } finally {
      setExporting(null);
    }
  }

  const place = d ? [d.summary.city, d.summary.uf].filter(Boolean).join(" - ") : "";
  return (
    <div>
      <BackLink href={backHref} />
      <PageHeader
        title={d?.summary.name ?? "Ficha da empresa"}
        description={d ? `Empresa${place ? ` · ${place}` : ""} · ${productsLabel(d.summary.products)}` : undefined}
      />
      <FilterBar
        filters={filters}
        onChange={changeFilters}
        cities={[]}
        periodOnly
        actions={
          <>
            <Button size="sm" onClick={exportClientPdf} disabled={disabled}>
              {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Relatório para o cliente (PDF)
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx} disabled={disabled}>
              {exporting === "xlsx" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Exportar Excel
            </Button>
          </>
        }
      />
      {query.isLoading ? (
        <Spinner className="h-[40vh]" />
      ) : notFound ? (
        <p className="rounded-xl border border-[#e5e5e5] bg-white p-5 text-sm text-[#737373]">Empresa não encontrada.</p>
      ) : query.isError && !d ? (
        <ErrorBox message="Não foi possível carregar a ficha." onRetry={() => query.refetch()} />
      ) : d ? (
        <ContractorBody d={d} />
      ) : null}
    </div>
  );
}

function ContractorBody({ d }: { d: ContractorDetail }) {
  const s = d.summary;
  return (
    <div className="space-y-6">
      <SummaryCard
        side="contractor"
        status={s.status}
        hasAccess={s.hasAccess}
        phone={s.phone}
        email={s.email}
        facts={[
          { label: "CNPJ", value: s.document ?? "—" },
          { label: "Última atividade conhecida", value: dateBR(s.lastSeenAt) },
          { label: "Última vaga", value: dateBR(s.lastVacancyAt) },
          { label: "Cadastro", value: dateBR(s.createdAt) },
        ]}
      />
      <NumbersGrid defs={CONTRACTOR_DETAIL_NUMBERS} detail={d} />
      <ChannelDaysCard days={d.activeDaysByChannel} />
      <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
        <h3 className="mb-3 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
          Vagas do período
        </h3>
        {d.vacancies.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#737373]">Nenhuma vaga publicada no período.</p>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th className="py-2 pr-3 font-medium">Publicada em</th>
                  <th className="py-2 pr-3 font-medium">Data da vaga</th>
                  <th className="py-2 pr-3 font-medium">Cargo</th>
                  <th className="py-2 pr-3 font-medium">Cidade</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 text-right font-medium">Candidatos</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 font-medium">Quem trabalhou</th>
                </tr>
              </thead>
              <tbody>
                {d.vacancies.map((v) => (
                  <tr key={v.vacancyId} className="border-b border-[#f0f0f0] last:border-0">
                    <td className="py-2 pr-3">{dateBR(v.createdAt)}</td>
                    <td className="py-2 pr-3">{dateBR(v.vacancyDate)}</td>
                    <td className="py-2 pr-3">{v.title ?? v.serviceType ?? "—"}</td>
                    <td className="py-2 pr-3">{v.city ?? "—"}</td>
                    <td className="py-2 pr-3">{PRODUCT_LABEL[v.module]}</td>
                    <td className="py-2 pr-3 text-right">{formatValue(v.candidates)}</td>
                    <td className="py-2 pr-3">{vacancySituation(v.status, v.jobStatus)}</td>
                    <td className="py-2">{v.workerFirstNames.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {d.vacancies.map((v) => (
                <li key={v.vacancyId} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
                  <p className="font-medium text-[#1d1d1b]">{v.title ?? v.serviceType ?? "—"}</p>
                  <p className="text-xs text-[#737373]">
                    {v.city ?? "—"} · {PRODUCT_LABEL[v.module]}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-[#737373]">Data da vaga</dt>
                    <dd className="text-right">{dateBR(v.vacancyDate)}</dd>
                    <dt className="text-[#737373]">Candidatos</dt>
                    <dd className="text-right">{formatValue(v.candidates)}</dd>
                    <dt className="text-[#737373]">Situação</dt>
                    <dd className="text-right">{vacancySituation(v.status, v.jobStatus)}</dd>
                    <dt className="text-[#737373]">Quem trabalhou</dt>
                    <dd className="text-right">{v.workerFirstNames.join(", ") || "—"}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
for p in freelancer empresa; do
  nice -n 15 npx vitest run "src/app/(auth)/engajamento/$p/[id]/_tests/page.test.tsx" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files|Tests "
done
```

Esperado: `Test Files  1 passed (1)` nos dois (3 testes cada).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/engajamento/_components/use-detail-filters.ts" "src/app/(auth)/engajamento/_components/detail-parts.tsx" \
        "src/app/(auth)/engajamento/freelancer" "src/app/(auth)/engajamento/empresa"
git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com commit -m "feat(engajamento): fichas de freelancer e empresa, com relatório para o cliente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação e entrega

**Files:** nenhum código novo (só correções que a verificação exigir).

- [ ] **Step 1: Lint dos caminhos tocados**

```bash
cd /home/doutor/coding/freela/freela-admin/.wt/engajamento
nice -n 15 npx eslint src/modules/admin/infrastructure/engagement-api.ts src/modules/admin/infrastructure/engagement-api.test.ts \
  src/modules/admin/infrastructure/engagement-xlsx.ts src/modules/admin/infrastructure/engagement-xlsx.test.ts \
  src/modules/admin/infrastructure/engagement-pdf.ts src/modules/admin/infrastructure/engagement-pdf.test.ts \
  src/modules/admin/infrastructure/svg-to-png.ts src/modules/admin/infrastructure/svg-to-png.test.ts \
  src/modules/admin/application/engagement.test-fixtures.ts \
  src/modules/admin/application/engagement-format.ts src/modules/admin/application/engagement-format.test.ts \
  src/modules/admin/application/engagement-filters.ts src/modules/admin/application/engagement-filters.test.ts \
  src/modules/admin/application/engagement-metrics.ts src/modules/admin/application/engagement-metrics.test.ts \
  src/modules/admin/application/engagement-export.ts src/modules/admin/application/engagement-export.test.ts \
  src/modules/admin/application/use-engagement.ts src/modules/admin/application/use-engagement.test.tsx \
  "src/app/(auth)/engajamento" src/components/shared/admin-layout.tsx
```

Esperado: sem erros. Se houver aviso de formatação, corrija e faça um commit `style(engajamento): lint`.

- [ ] **Step 2: Todos os testes do engajamento, um arquivo por vez**

```bash
for f in src/modules/admin/infrastructure/engagement-api.test.ts \
         src/modules/admin/application/engagement-format.test.ts \
         src/modules/admin/application/engagement-filters.test.ts \
         src/modules/admin/application/engagement-metrics.test.ts \
         src/modules/admin/application/engagement-export.test.ts \
         src/modules/admin/infrastructure/engagement-xlsx.test.ts \
         src/modules/admin/infrastructure/engagement-pdf.test.ts \
         src/modules/admin/infrastructure/svg-to-png.test.ts \
         src/modules/admin/application/use-engagement.test.tsx \
         "src/app/(auth)/engajamento/_components/filter-bar.test.tsx" \
         "src/app/(auth)/engajamento/_components/metric-grid.test.tsx" \
         "src/app/(auth)/engajamento/_components/funnel.test.tsx" \
         "src/app/(auth)/engajamento/_components/city-table.test.tsx" \
         "src/app/(auth)/engajamento/_components/measurement-notice.test.tsx" \
         "src/app/(auth)/engajamento/_components/people-table.test.tsx" \
         "src/app/(auth)/engajamento/_components/entity-search.test.tsx" \
         "src/app/(auth)/engajamento/_tests/page.test.tsx" \
         "src/app/(auth)/engajamento/freelancer/[id]/_tests/page.test.tsx" \
         "src/app/(auth)/engajamento/empresa/[id]/_tests/page.test.tsx"; do
  echo "== $f"
  nice -n 15 npx vitest run "$f" --maxWorkers=1 --minWorkers=1 2>&1 | grep -E "Test Files"
done
ls src/components/shared/ | grep -i "admin-layout.*test" || echo "sem teste do layout"
```

Esperado: `Test Files  1 passed (1)` em todos os 19. Se existir um teste do `admin-layout`, rode-o do mesmo jeito; ele deve continuar verde, ou ser ajustado se contar os itens do menu.

- [ ] **Step 3: Typecheck (sozinho, no fim)**

```bash
nice -n 15 npx tsc --noEmit -p tsconfig.json > .tsc.log 2>&1; echo "exit $?"
grep -c "error TS" .tsc.log
grep -E "engajamento|engagement|svg-to-png|admin-layout" .tsc.log || echo "nenhum erro nos arquivos do engajamento"
rm -f .tsc.log
```

Esperado: `nenhum erro nos arquivos do engajamento`. Se a contagem total não for 0, os erros estão em arquivos que este plano não tocou, ou seja, já existiam em `origin/main`. Não mexa neles. Corrija só o que aparecer no segundo `grep`.

- [ ] **Step 4: Conferir a cobertura da spec §5** (tabela "Cobertura da spec §5" no fim deste plano) e `git log --format='%h %an %s' origin/main..HEAD`.

Esperado: 8 commits, todos com autor `freelaapp`.

- [ ] **Step 5: Esperar a API estar no ar (sem ela, a página mostra erro)**

```bash
gh pr view 569 -R freelaapp/api-freela --json state,mergedAt --jq '{state, mergedAt}'
gh run list -R freelaapp/api-freela --branch main --limit 3
```

Esperado: `"state": "MERGED"` e o último run da `main` com `completed success` (o deploy da API é automático no push da `main`). Se o #569 ainda não estiver mergeado, **pare aqui** e avise o dono: publicar a tela antes da API faz `/engajamento` cair no "Não foi possível carregar os números".

- [ ] **Step 6: Publicar (o dono, via `!`)**

```bash
git fetch origin
git merge-base --is-ancestor origin/main feat/engajamento && echo "fast-forward ok"
```

Se não sair `fast-forward ok`, a `main` andou. Nesse caso:
1. Rode `git -c user.name=freelaapp -c user.email=freelaappservicos@gmail.com rebase origin/main` (assim autor e committer ficam freelaapp).
2. Repita o Step 2.
3. Confira de novo.

Com `fast-forward ok`, o dono roda:

```bash
! git -C /home/doutor/coding/freela/freela-admin/.wt/engajamento push origin feat/engajamento:main
```

**Nunca** use `gh pr merge` neste repo, porque a Vercel recusa o autor.

- [ ] **Step 7: Conferir o deployment na Vercel**

```bash
git log -1 --format='%an <%ae>' feat/engajamento
gh api repos/freelaapp/freela-admin/commits/$(git rev-parse feat/engajamento)/status --jq '{state, statuses: [.statuses[] | {context, state}]}'
```

Esperado:
- `freelaapp <freelaappservicos@gmail.com>`;
- `"state": "success"` com o contexto da Vercel. Pode levar uns minutos; repita até sair de `pending`.

Se der `failure`, o deploy antigo continua no ar. Nesse caso, abra o log na Vercel, corrija, faça um commit freelaapp e repita o Step 6.

- [ ] **Step 8: Conferência na tela em produção (manual)**
  - No celular (ou com o DevTools em 375 px):
    - os filtros ficam recolhidos atrás do resumo;
    - os cartões ficam em 1 coluna;
    - as tabelas de cidade, lista e fichas viram cartões;
    - as abas rolam de lado sem cortar a primeira.
  - No desktop: a barra de filtros fica presa no topo ao rolar.
  - "Este mês" (outubro/2026) mostra "Aberturas medidas desde 07/10/2026", e os números de "abriram" anteriores aparecem como "—".
  - **Exportar PDF:** acentos certos, gráfico presente, só agregados.
  - **Exportar Excel:** 4 abas, células sem dado vazias.
  - **Exportar lista (Excel)** de "Abriram e não se candidataram" de uma cidade: contatos e link do WhatsApp.
  - **Ficha da empresa → Relatório para o cliente (PDF):** sem telefone, e-mail ou CNPJ.
  - **Admin sem as áreas** (se houver uma conta assim): vê a visão geral, não vê busca nem listas, e a URL de uma ficha volta para `/dashboard`.

---

## Cobertura da spec §5

| Spec §5 | Onde |
|---|---|
| Página `/engajamento` no menu ao lado de Dashboard | Task 7 (página + `navItems`) |
| Responsiva: 1 coluna no celular, filtros recolhíveis | Task 5 (`FilterBar` recolhível, grids `grid-cols-1`), Tasks 5/6/8 (tabelas → cartões abaixo de `md`) |
| Barra fixa: período (presets + personalizado), cidade com busca, produto, canal, Exportar PDF/Excel | Task 5 (`FilterBar`, `md:sticky`, `CityPicker` com datalist), Task 7 (botões) |
| Aviso "Aberturas medidas desde DD/MM" e "—" nos dias sem medição | Task 5 (`MeasurementNotice`, `MetricGrid`, `Funnel`), Task 2 (`formatValue`/`deltaInfo`) |
| Busca global → fichas levando os filtros na URL | Task 6 (`EntitySearch`), Task 2 (`fichaHref`), Task 8 (`useDetailFilters`, `BackLink`) |
| Abas na query string: Visão geral, Freelancers, Empresas, Vagas | Task 7 (`aba`, `parseEngagementTab`) |
| Visão geral: cartões com variação, 2 funis, gráfico (Recharts), cidades | Tasks 5 e 7 |
| Freelancers/Empresas: cartões + funil + segmento → tabela paginada com WhatsApp e ficha → "Exportar lista (Excel)" | Task 6 (`PeopleTable`), Task 7 |
| Vagas: cartões, gráfico, cidades | Task 7 |
| Sem `FREELANCERS`/`COMPANIES`: listas, busca e fichas ocultas | Task 7 (`canFreelancers`/`canCompanies`), Task 6 (`EntitySearch`), Task 8 (`useAreaGuard`) |
| Excel do painel: Filtros (+ data/hora), Resumo (atual × anterior × variação), Série, Cidades | Task 3 (`overviewSheets`), Task 7 |
| Excel de lista: Filtros + Lista com contatos, via `export=1` (aviso de corte) | Task 3, Task 6 |
| PDF do painel com jsPDF: cabeçalho com filtros, cartões, funis, gráfico em PNG, cidades; só agregados | Task 4 (`buildOverviewPdf`, `svgToPngDataUrl`), Task 5 (`SeriesChartForExport`), Task 7 |
| PDF da empresa: números e vagas, 1º nome de quem trabalhou, sem telefone/CPF/e-mail, rodapé com período e geração | Task 3 (`contractorReportTables`), Task 4 (`buildContractorReportPdf`), Task 8 |
| Ficha do freelancer: só Excel | Task 8 |
| §5.3 client, hooks com `keepPreviousData`, builders puros, `_components/` | Tasks 1, 6, 3 e 5 (com os desvios de nome explicados no topo) |
| §6 testes do admin: builders de exportação, rótulos, URL, ocultar sem permissão | Tasks 2, 3, 4, 6, 7 e 8 |

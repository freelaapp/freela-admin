# Campanhas Automáticas — Plano 4: Admin UI (freela-admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma seção **"Campanhas automáticas"** no `freela-admin` para o operador **criar, editar, ligar/pausar** templates de campanha recorrente (agenda + público + canais + mensagem + imagem) — hoje só dá via API.

**Architecture:** Reusa ao máximo o que a página de campanhas de hoje já tem (`(auth)/campanhas/`): o recorte de público (audiência + cidades/módulo/raio + "Contar"), o editor de 3 variantes do WhatsApp (item #1), e o padrão de upload de imagem das propagandas (`ads-api.ts` + bloco do `AdDialog`). Novo: um client de API para os endpoints `/v1/admins/campaign-templates`, hooks, um diálogo criar/editar de template e uma lista.

**Tech Stack:** Next.js 15 (App Router), TanStack Query, Zod + react-hook-form, axios (`createAuthedClient`), Tailwind, Vitest. **Yarn** (não npm).

**Backend contract (já pronto na branch `feat/campanhas-automaticas` do api-freela — NÃO faz parte deste plano):**
- `GET /v1/admins/campaign-templates` → `{ data: CampaignTemplate[] }`
- `GET /v1/admins/campaign-templates/:id` → `{ data: CampaignTemplate }`
- `POST /v1/admins/campaign-templates` (corpo = CreateCampaignTemplateDto) → `{ data: CampaignTemplate }`
- `PUT /v1/admins/campaign-templates/:id` (corpo = CreateCampaignTemplateDto) → `{ data: CampaignTemplate }`
- `PATCH /v1/admins/campaign-templates/:id/enabled` (`{ enabled: boolean }`) → `{ data: CampaignTemplate }`
- `POST /v1/admins/campaign-templates/upload` (multipart `file`) → `{ data: { key, url } }`

Campos do template (create/update DTO): `name`, `scheduleKind: 'WEEKLY'|'DATED'`, `weekdays: number[]` (0=Dom..6=Sáb), `sendHour: 0-23`, `targetMonth: 1-12?`, `targetDay: 1-31?`, `targetYear?`, `leadDays: 0-60`, `audience` (um de `CONTRACTORS_NEVER_PUBLISHED|CONTRACTORS_DORMANT_90D|CONTRACTORS_ALL|CONTRACTORS_ACTIVE|PROVIDERS_NEVER_APPLIED|PROVIDERS_DORMANT_90D`), `audienceFilters?: { cities?, ufs?, modules? }`, `channels: ('PUSH'|'WHATSAPP')[]`, `whatsappTemplate?`, `pushTitle?`, `pushBody?`, `imageKey?`, `deepLink?`, `messagesPerHour?`, `dailyCap?`, `windowStartHour?`, `windowEndHour?`, `weekdaysOnly?`, `maxPerRun?`. O registro retornado ainda traz `id`, `enabled`, `lastRunFor`, `lastRunAt`, `createdAt`.

## Global Constraints

- **Yarn.** `yarn dev/build/lint/test/typecheck`. NUNCA `npm`.
- **Boundaries ESLint** (`module-contractor` × `module-freelancer` não se importam) — este código é `module-admin`/shared, sem essa restrição, mas siga o padrão de imports do repo.
- **`*.api.ts` valida a fronteira** — o novo client deve tipar as respostas (o repo usa Zod em `*.api.ts`; siga o padrão dos arquivos vizinhos — se `referrals-api.ts` não usar Zod, espelhe o estilo dele).
- **Autoria dos commits:** `freelaapp <freelaappservicos@gmail.com>` (convenção do repo web).
- **Testes:** Vitest, um arquivo por vez quando possível; `yarn typecheck` é o gate de tipos ao fim de cada task.
- **Reuso, não reescrita:** os controles de recorte de público e o editor de variantes JÁ existem em `(auth)/campanhas/page.tsx` — extraia/reuse em vez de duplicar quando fizer sentido.

---

### Task 1: client de API + hooks dos templates

**Files:**
- Create: `src/modules/admin/infrastructure/campaign-templates-api.ts`
- Create: `src/modules/admin/application/use-campaign-templates.ts`
- Test: `src/modules/admin/infrastructure/campaign-templates-api.test.ts`

**Interfaces:**
- Consumes: `createAuthedClient("/v1/admins")` (mesmo cliente que `referrals-api.ts` usa; abra-o para o padrão). Reusa `AudienceFilters` de `referrals-api.ts`.
- Produces:
  - Tipos `CampaignTemplate`, `CampaignScheduleKind`, `CampaignChannel`, `UpsertCampaignTemplatePayload` (espelhando o DTO acima).
  - `listCampaignTemplates()`, `getCampaignTemplate(id)`, `createCampaignTemplate(payload)`, `updateCampaignTemplate(id, payload)`, `setCampaignTemplateEnabled(id, enabled)`, `uploadCampaignTemplateImage(file)`.
  - Hooks: `useCampaignTemplates()`, `useCampaignTemplate(id)`, `useCreateCampaignTemplate()`, `useUpdateCampaignTemplate()`, `useSetCampaignTemplateEnabled()` (invalida a lista no onSuccess).

- [ ] **Step 1: Escrever o teste que falha** (`campaign-templates-api.test.ts`) — espelhe `referrals-api.test.ts`: mocke o axios client e asserte URL/método/corpo de cada função. Casos mínimos: `listCampaignTemplates` faz `GET /campaign-templates` e devolve `res.data.data`; `createCampaignTemplate` faz `POST /campaign-templates` com o payload; `setCampaignTemplateEnabled(id, true)` faz `PATCH /campaign-templates/${id}/enabled` com `{ enabled: true }`; `uploadCampaignTemplateImage(file)` faz `POST /campaign-templates/upload` multipart e devolve `{ key, url }`.
- [ ] **Step 2: Rodar e ver falhar** — `yarn test campaign-templates-api`.
- [ ] **Step 3: Implementar `campaign-templates-api.ts`** espelhando a estrutura de `referrals-api.ts` (mesmo `adminsRootApi = createAuthedClient("/v1/admins")`, mesmas assinaturas `res.data.data`). Reusar `AudienceFilters`/`CampaignAudience` de `referrals-api.ts` (importar) e estender `CampaignAudience` com `CONTRACTORS_ALL|CONTRACTORS_ACTIVE` se ele não os tiver (ou definir um tipo local `CampaignTemplateAudience`).
- [ ] **Step 4: Implementar os hooks** (`use-campaign-templates.ts`) espelhando `use-admin-referrals.ts` (mesmo padrão de `useQuery`/`useMutation` + `queryClient.invalidateQueries` no onSuccess; chave `['admin','campaign-templates']`).
- [ ] **Step 5: Rodar e ver passar** — `yarn test campaign-templates-api` + `yarn typecheck`.
- [ ] **Step 6: Commit** (autor freelaapp): `feat(campanhas): client de API + hooks dos templates de campanha automática`.

---

### Task 2: diálogo criar/editar template

**Files:**
- Create: `src/app/(auth)/campanhas-automaticas/_components/template-dialog.tsx`
- (talvez) Create: `src/app/(auth)/campanhas-automaticas/_components/image-upload-field.tsx` (extraído do bloco de upload do `AdDialog` em `(auth)/propagandas/page.tsx`)
- Test: helper puro se houver lógica testável (ex.: montar o payload / agenda legível) em `src/app/(auth)/campanhas-automaticas/_lib/template-form.test.ts`

**Interfaces:**
- Consumes: `useCreateCampaignTemplate`/`useUpdateCampaignTemplate`/`uploadCampaignTemplateImage` (Task 1); `usePreviewAudience`/`useAudienceOptions` de `use-admin-referrals` (reuso do "Contar" e das cidades); `renderPreview`/`normalizeTemplatePlaceholders` de `spreadsheet-contacts` (reuso do preview de variante, como no item #1).
- Produces: `<TemplateDialog open template? onOpenChange onSaved />` — cria (sem `template`) ou edita (com `template`).

- [ ] **Step 1: Form com react-hook-form + Zod**, schema co-locado (`templateSchema.ts`): `name`, `scheduleKind`, condicionalmente `weekdays`+`sendHour` (WEEKLY) ou `targetMonth`+`targetDay`+`targetYear?`+`leadDays` (DATED), `audience`, `audienceFilters`, `channels` (≥1), `whatsappTemplate` (obrig. se WHATSAPP), `pushTitle`+`pushBody` (obrig. se PUSH), `imageKey?`, `deepLink?`, ritmo, `maxPerRun?`. `isSubmitting` do RHF (nunca `useState` para loading).
- [ ] **Step 2: UI** — seções:
  - **Agenda:** toggle WEEKLY/DATED. WEEKLY = chips dos 7 dias + hora. DATED = mês/dia + "X dias antes" + checkbox "repetir todo ano" (marcado ⇒ `targetYear` null).
  - **Público:** reusar os controles de `(auth)/campanhas/page.tsx` (select de audiência incluindo os novos ALL/ACTIVE, cidades, módulo, raio) + botão "Contar" (`usePreviewAudience`).
  - **Canais:** toggles PUSH / WhatsApp.
  - **Mensagem WhatsApp:** as 3 variantes editáveis (reusar o bloco do item #1 — extrair um componente se ficar limpo). **Push:** título + corpo. **Imagem:** `ImageUploadField` (grava `imageKey`) + deep-link.
  - **Ritmo:** messagesPerHour/dailyCap/janela + `maxPerRun` (com os avisos anti-ban de hoje).
- [ ] **Step 3: Submit** monta o `UpsertCampaignTemplatePayload` e chama create/update. `onSaved` fecha e atualiza a lista. `toast` de sucesso/erro (`getAxiosErrorMessage`).
- [ ] **Step 4: `yarn typecheck` + `yarn lint`** no diálogo. Se extraiu um helper de payload/agenda-legível, testá-lo (Vitest).
- [ ] **Step 5: Commit** (freelaapp): `feat(campanhas): diálogo criar/editar de campanha automática (agenda, público, canais, mensagem, imagem)`.

---

### Task 3: página de lista + nav + ligar/pausar

**Files:**
- Create: `src/app/(auth)/campanhas-automaticas/page.tsx`
- Modify: `src/components/shared/admin-layout.tsx` (entrada de nav "Campanhas automáticas", perto de "Campanhas")

**Interfaces:**
- Consumes: `useCampaignTemplates`, `useSetCampaignTemplateEnabled` (Task 1); `TemplateDialog` (Task 2). Reusa `DataTable`/`PageHeader`/`Button` de `components/shared`.

- [ ] **Step 1: Página de lista** — `PageHeader` "Campanhas automáticas" + botão "Nova campanha automática" (abre `TemplateDialog`). `DataTable` com colunas: nome; agenda legível ("todo Sáb 09:00" / "Dia das Mães − 3 dias"); canais; ligado/pausado (badge); último run (`lastRunAt`); ações (Editar → abre o diálogo com o template; Ligar/Pausar → `useSetCampaignTemplateEnabled`). Guard de área igual à página de campanhas (`useAreaGuard("REFERRALS")`).
- [ ] **Step 2: Helper de agenda legível** — função pura `describeSchedule(template): string` (WEEKLY → dias+hora; DATED → data + lead + anual). Testar (Vitest) em `_lib/describe-schedule.test.ts` (é a única lógica não-trivial da página).
- [ ] **Step 3: Nav** — adicionar o item em `admin-layout.tsx` no mesmo padrão do link "Campanhas" (mesma permissão/área).
- [ ] **Step 4: `yarn typecheck` + `yarn lint` + `yarn test describe-schedule`**. Rodar `yarn build`? Não — pesado; o `typecheck` cobre tipos; o build real fica pro deploy do Vercel.
- [ ] **Step 5: Commit** (freelaapp): `feat(campanhas): página de campanhas automáticas + nav + ligar/pausar`.

---

## Self-Review (na escrita)
- **Cobertura do spec (§11 admin):** client+hooks → T1; diálogo (agenda/público/canais/mensagem/imagem/ritmo) → T2; lista + nav + ligar/pausar → T3. O "vínculo com runs" (cada ocorrência aparece na lista de campanhas de hoje ligada ao template) já vem do backend via `templateId`; exibir isso no detalhe é opcional e fica de fora deste plano (nice-to-have).
- **Reuso:** recorte de público + editor de variantes (item #1) + upload de imagem (propagandas) são reusados, não reescritos.
- **Sem backend aqui:** os endpoints já existem na branch do api-freela; este plano é 100% `freela-admin`.

## Riscos / a confirmar na execução
- Confirmar se `referrals-api.ts` usa Zod na validação de fronteira (espelhar o estilo real); se `CampaignAudience` de lá não tem ALL/ACTIVE, definir o tipo estendido no novo client.
- O `AudienceFilters`/preview de audiência (`usePreviewAudience`) hoje é tipado para as 4 audiências antigas — confirmar que aceita ALL/ACTIVE (o backend aceita; a tipagem do client web pode precisar estender).
- `yarn build` do admin é pesado localmente (máquina do dono) — usar `yarn typecheck` como gate e deixar o build pro Vercel.

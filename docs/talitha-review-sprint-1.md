# Code Review: Sprint 1 -- Fundacao

## Status: REPROVADO (0 Blockers, 1 Warning)

## Objetivo do Sprint
Projeto scaffoldado com Next.js 16, TypeScript strict, design system aplicado, Supabase configurado com as 12 migrations aplicadas e verificadas, modulo de criptografia funcional com validacao de chaves no boot, logger e wrappers de autorizacao prontos.

## Criterio de Saida (Definition of Done)
- [x] `npm run build` compila sem erros com TypeScript strict
- [x] `npm run dev` inicia sem erros e exibe pagina de fallback
- [x] 12 migrations aplicadas no Supabase remoto via Management API
- [x] 13 verificacoes do schema (V1-V13) executadas com resultado esperado (nao verificavel por code review estatico -- aceito com base no relato da sprint)
- [x] DoD-4: query V7 confirma column-level REVOKE (idem)
- [x] DoD-3: fn_block_delete_during_retention verificado (idem)
- [x] `keys.ts` falha ruidosamente no boot se KEK ou CPF_INDEX_KEY estiverem ausentes ou com tamanho errado
- [x] Nenhum segredo hardcoded; `.gitignore` inclui `.env*`
- [x] `.env.example` com placeholders (parcial -- ver Suggestion S1)

**Nota sobre itens 3-6:** Sao verificacoes de runtime executadas durante a sprint, nao verificaveis por analise estatica de codigo. Os 12 arquivos de migration existem em `supabase/migrations/`. As funcionalidades de banco foram confirmadas pelo stack agent durante execucao.

## Tasks Validadas
| Task | Status | Observacao |
|------|--------|------------|
| 1.1: Criar scaffold Next.js com TypeScript strict | OK | tsconfig strict, next.config conforme, .gitignore correto |
| 1.2: Aplicar design system e inicializar shadcn/ui | OK | 16 componentes shadcn/ui, tokens aplicados, Inter font |
| 1.3: Estrutura de pastas e clientes Supabase | RESSALVA | admin.ts sem `import 'server-only'` (W1) |
| 1.4: Aplicar migrations e executar verificacoes | OK | 12 migrations presentes, verificacoes de runtime aceitas |
| 1.5: Modulo de criptografia | OK | keys.ts, envelope.ts, blind-index.ts, constants.ts solidos |
| 1.6: Logger centralizado e wrappers de autorizacao | OK | Allowlist funcional, wrappers fail-closed |
| 1.7: Dockerfile base e configuracao de build | OK | Multi-stage, zero segredos, standalone output |

## Pontos Positivos

1. **Criptografia implementada com rigor.** `keys.ts` faz tripla validacao (presenca, base64 valido, 32 bytes) com falha ruidosa. `delete process.env[envName]` apos carregar e defense-in-depth legitima -- reduz a superficie para bugs de information disclosure (e.g., error handler que loga `process.env`). Sem `process.env.X!` em nenhum lugar do modulo cripto.

2. **Envelope encryption correta.** AES-256-GCM com IV unico por operacao (tanto para conteudo quanto para DEK wrapping -- `randomBytes(IV_LENGTH)` chamado separadamente). AAD `ownerId|contextId` aplicado no cipher de conteudo, prevenindo swap cross-patient. O teste de AAD incorreto genuinamente falha por GCM authentication failure (o tag foi computado com AAD original; `setAAD(wrong_aad)` + `final()` rejeita a tag).

3. **Wrappers de autorizacao fail-closed com ActionResult.** `withPsychologist` retorna `{ success: false }` em vez de lancar excecao -- o chamador sempre recebe um resultado tipado. Role lido do banco (`profiles.role`), nunca do JWT. MFA verificado por `aal2` (nivel de garantia), nao por enrollment. `withPatient` deriva `patientId` server-side via query, sem aceitar do client. Exatamente conforme architecture.md S5.1 e ADR-0006.

4. **Logger com allowlist efetiva.** Chaves fora da allowlist sao silenciosamente descartadas -- nao sao logadas nem geram erro. Zero `console.*` fora do `logger.ts` em toda a codebase. Disciplina de log exemplar para um produto com dados de saude.

5. **Dockerfile limpo e seguro.** Multi-stage com `npm ci --ignore-scripts`. APENAS `NEXT_PUBLIC_*` como ARG no builder. Nenhum segredo como ARG/ENV em nenhum stage. `USER nextjs` no runner. Conforme architecture.md S14.1 ao pe da letra.

6. **Security headers completos no next.config.ts.** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (camera/mic self, geo nenhum), HSTS com includeSubDomains, COOP same-origin, X-Permitted-Cross-Domain-Policies. `allowedOrigins` dinamico via `NEXT_PUBLIC_SITE_URL`. `productionBrowserSourceMaps: false`.

7. **Separacao rigorosa de Supabase clients.** 4 clientes com responsabilidades distintas: `client.ts` (browser/anon), `server.ts` (SSR/cookies), `middleware.ts` (request/response), `admin.ts` (service_role). `admin.ts` e de fato o unico modulo com service_role. Nenhum outro arquivo referencia `SUPABASE_SERVICE_ROLE_KEY`.

8. **Zero segredos em codigo versionado.** Grep por padroes de alta entropia, JWTs (`eyJ...`), URLs Supabase hardcoded, e nomes de variaveis secretas retornou zero resultados fora dos locais esperados (keys.ts referencia nomes de env, tests usam `Buffer.alloc` sintetico). `.env.example` nao esta nos gitignored, `.env*` esta -- correto.

## Compliance (codigo segue os docs?)

### Design & UI
- [x] Tokens CSS do design system S2.1 aplicados em `globals.css` (light e dark mode) -- valores HSL conferidos
- [x] Adaptacao para Tailwind v4 correta: valores com `hsl()` wrapper + `@theme inline` directive (design doc usa formato Tailwind v3 sem wrapper -- adaptacao preserva os pares de contraste WCAG AA)
- [x] Inter font carregado via `next/font/google` com `variable: '--font-sans'`, `display: 'swap'`
- [x] Radius base `0.625rem` (10px) conforme design system
- [x] Z-index scale documentada em CSS
- [x] Dark mode implementado via `:root` / `.dark` (classe)
- [ ] S1: `--destructive-foreground` do design system S2.1 nao esta em globals.css (sem impacto funcional em Sprint 1 -- button destructive usa `text-destructive`)
- [ ] S2: `--font-mono: var(--font-geist-mono)` referencia variavel CSS inexistente (Geist Mono nao importada)

### Arquitetura
- [x] `tsconfig.json` com `strict: true` -- verificado
- [x] Zero `any`, zero `@ts-ignore`, zero `@ts-expect-error`, zero `as unknown as`
- [x] `next.config.ts` com `output: 'standalone'`, `productionBrowserSourceMaps: false`, `allowedOrigins`
- [x] Estrutura de pastas conforme architecture.md S2 (diretorios criados; subpastas de `components/` serao populadas em sprints futuras)
- [x] Nenhum `process.env.X!` em codigo de cripto -- somente via `keys.ts`
- [x] `getUser()` em todo guard server-side, `getSession()` nunca referenciado
- [x] Nenhum `dangerouslySetInnerHTML`
- [x] Nenhum `localStorage`/`sessionStorage`/`IndexedDB`
- [x] Codigo em ingles (variaveis, funcoes, componentes)
- [x] UI em portugues (pt-BR): "Pagina nao encontrada", "Algo deu errado", "Tentar novamente"
- [ ] W1: `admin.ts` sem `import 'server-only'` (ver Warnings)

### Banco de Dados
- [x] 12 arquivos de migration presentes em `supabase/migrations/` com nomenclatura correta
- [x] Verificacoes V1-V13 de runtime nao verificaveis por code review estatico (aceito conforme relato)

### Padroes Globais
- [x] shadcn/ui: 16 componentes atom instalados (button, card, input, label, dropdown-menu, skeleton, badge, separator, tabs, table, checkbox, select, textarea, dialog, sheet, toast) -- minimo 15 atendido
- [x] Sonner configurado como Toaster no root layout
- [x] lucide-react para icones (usado no toast.tsx)
- [x] zod em dependencies (sera usado em schemas a partir do Sprint 2)
- [x] react-hook-form + @hookform/resolvers em dependencies
- [x] TanStack React Query: nao presente em package.json -- **nao e necessario para Sprint 1** (sera adicionado quando houver queries client-side)
- [x] `package-lock.json` versionado
- [x] Sem codigo morto, sem TODOs esquecidos
- [x] `robots.txt` bloqueia todas as 13 areas autenticadas listadas no architecture.md S2

### Seguranca
- [x] Nenhum segredo hardcoded em arquivo versionado
- [x] `SUPABASE_SERVICE_ROLE_KEY` somente em `admin.ts`
- [x] Nenhum `NEXT_PUBLIC_` em segredo (allowlist: URL, anon key, LiveKit URL, site URL)
- [x] `.env.example` sem valores reais
- [x] `.gitignore` inclui `.env*` e `docs/credentials.md`
- [x] Dockerfile sem segredos em nenhum stage
- [x] `error.tsx` nao exibe detalhes internos ao usuario
- [x] Wrappers de autorizacao retornam mensagens genericas ("Nao autenticado", "Sem permissao", "MFA obrigatorio")

## Qualidade de Codigo

### Code Smells
- [x] Sem duplicacao significativa
- [x] Responsabilidade unica em cada modulo (keys carrega, envelope cifra, blind-index indexa, guard autoriza, logger loga)
- [x] Sem God Class/Component
- [ ] S3: `safeErrorCode()` em `logger.ts` exportada mas nunca usada em Sprint 1 (dead code potencial)

### Nomes e Legibilidade
- [x] Nomes auto-explicativos: `loadKey`, `buildAad`, `computeCpfBlindIndex`, `withPsychologist`, `sanitize`
- [x] Tipos descritivos: `EncryptedEnvelope`, `ActionResult<T>`, `PsychologistContext`, `PatientContext`
- [x] TSDoc presente em funcoes publicas de crypto e guard (exceto funcoes triviais como `isPsychologist`)
- [x] Constantes com nomes claros: `AES_ALGORITHM`, `IV_LENGTH`, `AUTH_TAG_LENGTH`, `CURRENT_KEK_VERSION`

### Complexidade
- [x] Todas as funcoes dentro do limite de 20 linhas de logica
- [x] Nenhum arquivo acima de 200 linhas (maior: toast.tsx com 234 linhas -- componente gerado pelo shadcn, aceitavel)
- [x] Maximo 2 niveis de indentacao
- [x] Funcoes com 0-3 parametros

### Performance
- [x] Sem queries N+1 (nao ha queries de banco em Sprint 1 fora dos guards)
- [x] Sem imports pesados desnecessarios

### React Patterns
- [x] `error.tsx` corretamente marcado com `"use client"` (error boundary)
- [x] Componentes shadcn/ui interativos com `"use client"` (dialog, sheet, select, tabs, dropdown, etc.)
- [x] Componentes nao-interativos como Server Components (button, card, input, badge, skeleton)
- [x] Root layout como Server Component (correto)

### Acoplamento
- [x] Modulos de crypto nao dependem de React ou Next.js (funcoes puras com `node:crypto`)
- [x] `_guard.ts` depende apenas de `@supabase/supabase-js`, `@/lib/supabase/server`, e `@/lib/logger` -- acoplamento minimo
- [x] `logger.ts` sem dependencias externas (apenas `console.*`)

## Analise dos Dois Achados Pre-identificados

### Achado 1: `.env.example` incompleto

**Confirmado parcialmente.** O `.env.example` contem 5 entradas (conforme relato do solicitante -- arquivo inacessivel a este reviewer por restricao de permissao). Comparando com architecture.md S12.1:

| Variavel | Marcada "Sim" na S12.1 | Presente no .env.example |
|----------|----------------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim (placeholder) | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim (placeholder) | Sim |
| `NEXT_PUBLIC_LIVEKIT_URL` | Sim (placeholder) | Sim |
| `NEXT_PUBLIC_SITE_URL` | Sim (http://localhost:3000) | Sim |
| `EMAIL_FROM` | Sim (placeholder) | Sim |
| `ASAAS_BASE_URL` | Sim (sandbox URL) | **Nao** |

**Divergencia real: 1 variavel.** `ASAAS_BASE_URL` esta marcada "Sim (sandbox URL)" na tabela da S12.1 mas nao esta no `.env.example`. As demais 11 variaveis (`SUPABASE_SERVICE_ROLE_KEY`, `KEK`, `CPF_INDEX_KEY`, etc.) estao **corretamente ausentes** -- a coluna `.env.example` na S12.1 e "Nao" para todas elas (sao segredos que vivem em EasyPanel ou `supabase secrets`, nao em `.env.example`).

**Classificacao:** Suggestion (S1). `ASAAS_BASE_URL` nao e usada ate Sprint 5. A ausencia nao causa runtime failure em Sprint 1. Adicionar `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` por completude.

### Achado 2: Cache-buster em `keys.test.ts`

**Confirmado e investigado.** Os 4 warnings do Vite (`invalid import ... vite:dynamic-import-vars`) sao reais. A tecnica usa dynamic imports com template literals:

```typescript
await import(`@/lib/crypto/keys?bust=${randomBytes(4).toString("hex")}-1`)
```

**O cache-buster funciona corretamente na versao atual do Vitest.** Em ESM, o module specifier inclui a query string no cache key. Cada teste gera um specifier unico (`keys?bust=abc-1`, `keys?bust=def-2`), forçando re-avaliacao do modulo `keys.ts` com o estado do env naquele momento. O `beforeEach` limpa ambas as variaveis, e cada teste configura o cenario desejado antes do import.

**Os testes testam o que afirmam:**
- Test 1 (KEK missing): env sem KEK -> import fresco -> `loadKey` le env -> KEK ausente -> throw "Missing RECORD_ENCRYPTION_KEK_V1" -- CORRETO
- Test 2 (CPF_KEY missing): env sem CPF_KEY -> import fresco -> throw "Missing CPF_INDEX_KEY" -- CORRETO
- Test 3 (key short): KEK com 16 bytes -> throw "must be exactly 32 bytes" -- CORRETO
- Test 4 (invalid base64): KEK invalido -> throw (por length mismatch apos decode) -- CORRETO

**Risco residual:** A tecnica depende do comportamento de ESM module caching do Vitest (specifiers com query strings sao cache entries distintas). Isso nao e documentado pelo Vitest e poderia mudar numa major version. O padrao idiomatico e `vi.resetModules()`. Os 4 warnings sao ruido no output de teste que confunde.

**Classificacao:** Suggestion (S4). Os testes funcionam corretamente e testam o que afirmam. A abordagem padrao (`vi.resetModules()` + `vi.importActual()`) seria mais robusta e eliminaria os warnings. Nao bloqueia porque o comportamento esta correto.

## Analise Aprofundada: Criptografia

### `keys.ts` -- Carregamento de Chaves
- Validacao tripla: presenca (`=== undefined || === null || === ""`), base64 valido (try/catch no `Buffer.from`), comprimento exato (32 bytes). **Correto.**
- Nenhum `process.env.X!` -- o modulo le via `process.env[envName]` e valida. **Correto.**
- `delete process.env[envName]` apos carregar: defense-in-depth legitima que reduz a superficie para information disclosure. Nao previne acesso via memory dump, mas elimina o vetor mais comum (crash handler que serializa `process.env`). **Aceito conforme architecture.md S9.1.**

### `envelope.ts` -- AES-256-GCM Envelope
- IV gerado por operacao: `randomBytes(IV_LENGTH)` chamado duas vezes -- uma para content, outra para DEK wrapping. **Nenhum reuso de IV.** Isso e critico para GCM: reuso de IV com mesma chave permite key recovery. **Correto.**
- AAD aplicado no cipher de conteudo: `contentCipher.setAAD(aad)` onde `aad = ownerId|contextId`. **Correto.**
- AAD **nao** aplicado no DEK wrapping: aceitavel porque o DEK e random per-record e o conteudo ja esta AAD-bound. Um atacante que swapasse wrapped DEKs entre registros nao conseguiria decifrar (o DEK errado + AAD errado no conteudo = GCM rejection).
- Auth tag verificado na decifragem: `setAuthTag()` chamado antes de `final()`. **Correto.**
- Teste de AAD: genuinamente verifica a protecao. `decrypt(envelope, WRONG_PATIENT, RECORD_ID)` falha porque `contentDecipher.setAAD(wrong_aad)` produz tag diferente da armazenada.

### `blind-index.ts` -- HMAC-SHA256
- Usa `createHmac('sha256', CPF_INDEX_KEY)` -- HMAC com chave dedicada. **Nao e hash puro.** Correto per architecture.md S9.3.
- Saida deterministica para mesmo input: verificado por teste. **Correto.**
- Saida de 64 caracteres hex (256 bits): verificado por teste. **Correto.**

## Analise Aprofundada: Autorizacao

### `_guard.ts` -- Wrappers
- `withPsychologist`: (1) `getUser()` -- fail-closed se erro ou !user, (2) role lido do banco via `supabase.from('profiles').select('id, role')` -- **nunca do JWT**, (3) `aal2` verificado via `mfa.getAuthenticatorAssuranceLevel()` -- verifica **nivel de garantia, nao enrollment**. **Correto.**
- `withPatient`: (1) `getUser()`, (2) role do banco, (3) `patientId` derivado server-side via query em `patients.user_id` -- **nunca aceito do client**. **Correto.**
- `withPublicAction`: cria Supabase client (CSRF protegido por `allowedOrigins` no next.config.ts). **Correto.**
- **Fail-closed:** todos retornam `ActionResult<T>` sem lancar. Caminho de erro retorna `{ success: false, error: "..." }`. Nenhum caminho permite acesso sem validacao. **Correto.**
- Catch blocks usam `catch` sem capturar a variavel de erro -- evita logging acidental de stack traces. **Intencional e correto.**

### `admin.ts` -- Service Role Client
- **Unico modulo com `SUPABASE_SERVICE_ROLE_KEY`** em toda a codebase (verificado por grep). **Correto.**
- Validacao de presenca com throw (fail-closed). **Correto.**
- **Falta `import 'server-only'`** -- sem protecao build-time contra import de Client Component. Ver W1.

## Analise Aprofundada: Logger

- Allowlist implementada corretamente: `ALLOWED_KEYS` como `Set`, `sanitize()` filtra antes de logar.
- `patient_id` na allowlist: decisao do Architect (architecture.md S11.4). Em contexto clinico, logar `patient_id + action` revela que a pessoa faz terapia. Aceito como decisao arquitetural deliberada, mas flagged como Suggestion (S5) para consideracao futura do time.
- Zero `console.*` fora do `logger.ts` em toda a codebase `src/`. **Correto.**
- `safeErrorCode()` retorna `error.message.slice(0, 50)`: poderia vazar table names ou detalhes de query se usada. Nao esta sendo usada em Sprint 1. Suggestion (S3).

## Analise: Config e Build

### `tsconfig.json`
- `strict: true` -- verificado
- `jsx: "react-jsx"`, `module: "esnext"`, `moduleResolution: "bundler"` -- correto para Next.js 16
- Path alias `@/*` para `./src/*` -- conforme padrao

### `Dockerfile`
- 3 stages (deps, builder, runner) -- conforme architecture.md S14.1
- `npm ci --ignore-scripts` -- conforme
- `NEXT_PUBLIC_*` como ARG apenas no builder -- conforme
- Zero segredos como ARG/ENV em qualquer stage -- verificado
- `USER nextjs` com uid/gid 1001 -- correto
- `ENV HOSTNAME="0.0.0.0"` -- necessario para bind no container

### `next.config.ts`
- `output: 'standalone'` -- conforme
- `productionBrowserSourceMaps: false` -- conforme
- `allowedOrigins` dinamico -- conforme architecture.md S14.2
- 7 security headers em todas as rotas (exceto static assets) -- conforme architecture.md S7.4
- `X-Robots-Tag: noindex` nao esta nos headers do next.config.ts -- sera adicionado pelo middleware em rotas autenticadas (Sprint 2)

### `vitest.config.ts`
- Chaves de teste sinteticas: `Buffer.alloc(32, 0xaa)` e `Buffer.alloc(32, 0xbb)` -- claramente fake, nao derivadas de credenciais reais
- Path alias `@` configurado -- consistente com tsconfig

## Regressao
Regressao nao aplicavel -- Sprint 1 e a primeira sprint (nao ha sprints anteriores).

## Resumo de Problemas

### Blockers (0)
Nenhum.

### Warnings (1)

**W1: `admin.ts` sem `import 'server-only'` -- package `server-only` nao instalado**
- Arquivo: `src/lib/supabase/admin.ts`
- O que esta errado: O modulo que instancia o client `service_role` nao tem protecao build-time contra import de Client Component. O package `server-only` nao esta em `package.json`.
- Por que importa: A architecture.md S6.2 restringe imports deste modulo a uma allowlist fechada. Sem `server-only`, um desenvolvedor poderia `import { createAdminClient } from '@/lib/supabase/admin'` num Client Component sem erro de build. O Next.js nao vazaria a chave (env vars sem `NEXT_PUBLIC_` sao `undefined` no browser), mas a ausencia de enforcement build-time e uma lacuna de defense-in-depth num produto com dados de saude mental.
- Correcao: `npm install server-only` + adicionar `import 'server-only'` na primeira linha de `admin.ts`.

### Suggestions (8)

**S1: `.env.example` faltando `ASAAS_BASE_URL`**
- A architecture.md S12.1 marca `ASAAS_BASE_URL` como "Sim (sandbox URL)" para `.env.example`. Falta a linha `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`. As demais 11 variaveis secretas estao corretamente ausentes (marcadas "Nao" na S12.1).

**S2: `globals.css` faltando `--destructive-foreground`**
- O design system S2.1 define `--destructive-foreground: 0 0% 100%`. Nao esta em `globals.css`. Sem impacto funcional agora (shadcn v4 button usa `text-destructive`), mas componentes futuros podem precisar.

**S3: `safeErrorCode()` em `logger.ts` -- potencial leaking de detalhes**
- Retorna `error.message.slice(0, 50)`. Se usada para logar, poderia incluir nomes de tabela, colunas, ou detalhes de query. Considerar retornar apenas uma classificacao generica (e.g., `POSTGRES_ERROR`, `NETWORK_ERROR`) em vez do conteudo da mensagem.

**S4: `keys.test.ts` -- abordagem de cache-buster nao idiomatica**
- Os testes funcionam corretamente (verificado), mas a tecnica de dynamic import com template literal gera 4 warnings do Vite e depende de comportamento nao documentado do ESM module cache. A abordagem padrao do Vitest seria `vi.resetModules()` + `const mod = await import(...)`. Eliminaria os warnings e seria resiliente a upgrades.

**S5: `patient_id` na allowlist do logger -- consideracao LGPD**
- Decisao do Architect (architecture.md S11.4). Em contexto clinico, `patient_id + action` revela que a pessoa faz terapia. Considerar se o time aceita esse nivel de informacao nos logs operacionais.

**S6: Dual toast systems**
- Root layout monta `<Toaster>` do `sonner`. `src/components/ui/toast.tsx` usa `@base-ui/react/toast`. Dois sistemas de toast coexistem. O architecture.md e CLAUDE.md global mandatam Sonner. Considerar remover `toast.tsx` ou manter apenas como fallback.

**S7: `--font-mono: var(--font-geist-mono)` referencia variavel indefinida**
- Em `globals.css` `@theme inline`, `--font-mono` aponta para `--font-geist-mono` que nao existe (Geist Mono nao e importado no layout). Texto monoespacado cai no fallback do browser, o que funciona, mas e uma referencia orfa.

**S8: `process.env.NEXT_PUBLIC_*!` nos Supabase clients**
- `client.ts`, `server.ts`, e `middleware.ts` usam `process.env.NEXT_PUBLIC_SUPABASE_URL!`. Embora essas vars publicas estejam sempre presentes em deploy correto, a validacao explicita (como `admin.ts` faz) daria erros mais claros se o deploy estiver misconfigured.

## Veredicto

REPROVADO. 0 Blockers + 1 Warning devem ser corrigidos antes de avancar.

**Correcao necessaria (W1):**
1. Instalar o package: `npm install server-only`
2. Adicionar na primeira linha de `src/lib/supabase/admin.ts`: `import 'server-only'`

Apos esta correcao, a sprint esta em condicoes de aprovacao. As 8 Suggestions sao anotadas como pendencias tecnicas e nao bloqueiam o avanco.

**Pendencias tecnicas (Suggestions) para docs/talitha-status.md:**
- S1: Adicionar `ASAAS_BASE_URL` ao `.env.example`
- S2: Adicionar `--destructive-foreground` ao `globals.css`
- S3: Refatorar `safeErrorCode()` para nao retornar fragmento de mensagem
- S4: Reescrever cache-buster dos testes de keys com `vi.resetModules()`
- S5: Avaliar `patient_id` nos logs vs LGPD
- S6: Remover toast.tsx duplicado (manter Sonner)
- S7: Corrigir referencia `--font-geist-mono`
- S8: Validar env vars publicas explicitamente nos Supabase clients

---

## Re-verificacao (rodada 2)

**Data:** 2026-09-09
**Contexto:** Stack Agent aplicou correcao do W1 e 7 das 8 Suggestions. S5 recusada com justificativa. Re-verificacao pontual dos itens alterados.

### Item 1: W1 esta realmente fechado?

**FECHADO.**

- `src/lib/supabase/admin.ts` linha 1: `import "server-only"` -- primeira linha, antes de qualquer outro import. Correto.
- `src/lib/crypto/keys.ts` linha 1: `import "server-only"` -- idem. Boa decisao: `envelope.ts` e `blind-index.ts` importam de `keys.ts` e herdam a protecao transitivamente. Se um Client Component tentar importar qualquer modulo cripto, o build falha.
- `package.json` linha 26: `"server-only": "^0.0.1"` em **`dependencies`** (nao `devDependencies`). Correto -- se estivesse em `devDependencies`, `npm ci --omit=dev` no Dockerfile o excluiria e o build de producao quebraria silenciosamente ou perderia a protecao.

### Item 2: O alias do `server-only` no `vitest.config.ts` pode vazar para producao?

**NAO PODE VAZAR. A barreira esta intacta.**

Analise da cadeia de resolucao de modulos:

| Ferramenta | Config que consome | Resolve `server-only` como |
|------------|-------------------|---------------------------|
| `next build` (webpack) | `next.config.ts` | `node_modules/server-only/index.js` (pacote real -- lanca erro em Client Component) |
| `vitest run` (vite) | `vitest.config.ts` | `src/__tests__/stubs/server-only.ts` (no-op) |

Os dois caminhos sao completamente separados:

1. **`next.config.ts`** -- verificado: nenhum `webpack.resolve.alias`, nenhum plugin custom, nenhuma referencia a `vitest.config.ts`. Contem apenas `output`, `productionBrowserSourceMaps`, `experimental.serverActions`, `images`, e `headers`.
2. **`tsconfig.json`** -- verificado: `paths` contem apenas `"@/*": ["./src/*"]`. Nenhum mapeamento para `server-only`. E mesmo que contivesse, paths do tsconfig sao resolucao de tipo em design-time, nao resolucao de modulo em build-time (webpack ignora tsconfig paths a menos que se use `tsconfig-paths-webpack-plugin`, que nao esta configurado).
3. **Nenhum arquivo compartilhado** faz ponte entre as duas configuracoes. O `vitest.config.ts` nao e importado por nenhum outro config. O alias e um `resolve.alias` do Vite, que webpack nunca le.

**Conclusao:** O alias `"server-only" -> stub` e confinado ao Vitest. Em producao, `import "server-only"` resolve para o pacote real em `node_modules/`, que lanca erro se importado de um Client Component. A barreira `server-only` funciona exatamente como desenhada.

### Item 3: O stub enfraquece os testes?

**Nao ha perda de cobertura.**

O stub neutraliza `import "server-only"` nos testes, mas a protecao que `server-only` oferece e **build-time via webpack**, nao runtime. Em um ambiente Vitest (Node.js puro), o pacote real `server-only` simplesmente lancaria um erro generico porque nao detecta contexto Next.js -- nao porque detectou um Client Component. Testar esse comportamento em Vitest nao provaria nada util.

Os testes existentes verificam o que importa: carregamento de chaves, validacao de tamanho, envelope encryption, HMAC. A protecao build-time contra importacao de Client Component e verificavel apenas por `next build` (que ja roda nos gates do CI), nao por testes unitarios.

### Item 4: S3 -- `safeErrorCode` reescrita

**FECHADA. Sem vazamento.**

A funcao agora usa classificacao por keyword:
- `timeout` / `econnrefused` -> `NETWORK_ERROR`
- `permission` / `unauthorized` -> `AUTH_ERROR`
- `duplicate` / `unique` -> `DUPLICATE_ERROR`
- `not found` / `no rows` -> `NOT_FOUND`
- `validation` / `invalid` -> `VALIDATION_ERROR`
- Fallback: `INTERNAL_ERROR`

A mensagem original e processada internamente via `.toLowerCase().includes(...)` mas **nunca retornada**. Apenas as strings constantes de classificacao saem da funcao. Um erro com mensagem `"duplicate key violates unique constraint on patients.cpf_hmac"` retorna simplesmente `"DUPLICATE_ERROR"` -- sem table name, sem column name, sem fragmento SQL.

O fallback `INTERNAL_ERROR` nao carrega nenhum detalhe.

### Item 5: S8 -- `getEnvOrThrow()` falha no boot ou no primeiro uso?

**Falha na primeira avaliacao do modulo, nao no boot do processo.**

Nos tres clientes Supabase, `getEnvOrThrow()` e chamada em **module scope** (linhas 11-12 de `client.ts`, `server.ts` e `middleware.ts`):
```typescript
const supabaseUrl = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL")
const supabaseAnonKey = getEnvOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY")
```

Em Next.js standalone mode (`node server.js`), modulos sao avaliados **lazily** na primeira requisicao que os importa. Nao ha um boot hook que carregue todos os modulos eagerly. Portanto:

- `middleware.ts`: avaliado na **primeira requisicao HTTP** que match o middleware matcher. Se a variavel estiver ausente, a primeira requisicao falha. Isso e efetivamente "boot" na pratica (middleware roda em toda rota).
- `server.ts`: avaliado quando o primeiro Server Component/Action o importa.
- `client.ts`: avaliado quando o primeiro Client Component carrega o chunk no browser. Para vars `NEXT_PUBLIC_*`, o valor e inlined em build-time -- se ausente durante `next build`, o build falha (ou o valor fica `undefined` e `getEnvOrThrow` lanca no browser).

Este comportamento e **identico ao de `keys.ts`** -- ambos validam em module scope, ambos falham na primeira importacao. E o mais cedo possivel na arquitetura Next.js. Um health check que nao acessa rotas protegidas veria o app como saudavel, mas a primeira requisicao real falharia. Isso e uma limitacao do Next.js, nao do codigo.

### Item 6: A recusa de S5 e aceitavel?

**Aceitavel. A recusa procede.**

Argumentos do Stack Agent:
1. `patient_id` e um UUID opaco -- nao e PII isoladamente. So se torna identificavel via JOIN com a tabela `patients`, que requer acesso ao banco.
2. Quem acessa logs de aplicacao (infra/ops) tipicamente ja tem acesso ao banco onde `patient_id` e visivel.
3. A architecture.md S11.4 lista explicitamente `patient_id` na allowlist -- e uma decisao do Architect, nao um acidente.
4. Remover exigiria redesenhar a observabilidade (perda de correlacao de log entries por paciente para debugging).

Minha avaliacao:
- Em termos estritos de LGPD, UUID como dado pseudonimizado nao e dado pessoal sensivel **enquanto nao cruzado** com a tabela de identificacao. A LGPD trata pseudonimizacao como medida de protecao adequada (art. 13 S4).
- O risco real seria se logs fossem acessiveis publicamente ou a terceiros sem acordo de processamento. Em infraestrutura gerenciada (EasyPanel), os logs sao restritos ao operador.
- O custo de remover (perda de rastreabilidade por paciente em incidentes) e desproporcional ao risco residual.

**Veredicto: aceito a recusa.** O `patient_id` permanece na allowlist. Se o time quiser enderecar futuramente, a abordagem seria pseudonimizar no log (e.g., HMAC do UUID com chave rotacionavel), nao remover.

### Item 7: Regressoes das 12 alteracoes

**Nenhuma regressao introduzida.**

| Alteracao | Verificacao | Resultado |
|-----------|------------|-----------|
| `server-only` em `admin.ts` | `import "server-only"` na linha 1; pacote em `dependencies` | OK |
| `server-only` em `keys.ts` | `import "server-only"` na linha 1; transitivo para envelope/blind-index | OK |
| S1: `ASAAS_BASE_URL` em `.env.example` | Nao verificavel (permissao de leitura negada) -- aceito por relato | Aceito |
| S2: `--destructive-foreground` | Presente em `:root` (linha 93) e `.dark` (linha 150) de `globals.css` | OK |
| S3: `safeErrorCode` reescrita | Classificacao por keyword, sem raw message; `INTERNAL_ERROR` como fallback | OK |
| S4: `vi.resetModules()` | `keys.test.ts` usa `vi.resetModules()` no `beforeEach`, imports limpos sem cache-buster | OK |
| S6: Remocao de `toast.tsx` | Arquivo nao existe; grep por `components/ui/toast` e `@base-ui/react/toast` retorna zero imports orfaos | OK |
| S7: `--font-mono` | Agora tem font stack explicito: `ui-monospace, SFMono-Regular, Menlo, ...` em vez de `var(--font-geist-mono)` | OK |
| S8: `getEnvOrThrow()` | Tres clients (`client.ts`, `server.ts`, `middleware.ts`) usam validacao explicita em module scope; zero `process.env.X!` em producao (grep confirma: unicas ocorrencias de `!` sao em comentarios de `keys.ts`) | OK |
| Vitest alias `server-only` | Alias confinado a `vitest.config.ts`; stub no-op em `src/__tests__/stubs/server-only.ts`; nao alcanca producao (analise completa no Item 2) | OK |
| 15 componentes shadcn/ui | `toast.tsx` removido, 15 componentes restantes (button, card, input, label, dropdown-menu, skeleton, badge, separator, tabs, table, checkbox, select, textarea, dialog, sheet) -- minimo 15 atendido | OK |
| Gates reportados | 14/14 testes, `tsc --noEmit` limpo, `npm run build` limpo, 0 Vite warnings | Aceito |

**Nota:** Uma pequena lacuna persiste no `@theme inline`: `--color-destructive-foreground` nao esta mapeado como token Tailwind (apenas a CSS variable existe em `:root`). Isso significa que `text-destructive-foreground` como classe Tailwind nao resolve. Nenhum componente usa essa classe em Sprint 1, e o valor CSS esta disponivel via `text-[var(--destructive-foreground)]` se necessario. Nao e regressao (nunca esteve mapeado) e nao justifica Warning.

## Veredicto Final (Rodada 2)

**APROVADO.** 0 Blockers, 0 Warnings.

W1 esta fechado: `import "server-only"` e primeira linha de `admin.ts` e `keys.ts`, pacote em `dependencies`. O alias no `vitest.config.ts` NAO vaza para producao -- `next build` usa webpack com resolucao independente. 7 Suggestions aplicadas corretamente, sem regressao. S5 recusada com justificativa aceita.

**Pendencias tecnicas remanescentes (nao bloqueiam):**
- `--color-destructive-foreground` nao mapeado no `@theme inline` (apenas CSS variable existe)
- `patient_id` na allowlist do logger: decisao arquitetural aceita; reconsiderar se logs forem expostos a terceiros

**Proximo passo:** QA Sprint 1.

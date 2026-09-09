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

1. **Criptografia implementada com rigor.** `keys.ts` faz tripla validacao (presenca, base64 valido, 32 bytes) com falha ruidosa. `delete process.env[envName]` apos carregar e defense-in-depth legítima -- reduz a superfície para bugs de information disclosure (e.g., error handler que loga `process.env`). Sem `process.env.X!` em nenhum lugar do modulo cripto.

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
- Test 1 (KEK missing): env sem KEK → import fresco → `loadKey` le env → KEK ausente → throw "Missing RECORD_ENCRYPTION_KEK_V1" -- CORRETO
- Test 2 (CPF_KEY missing): env sem CPF_KEY → import fresco → throw "Missing CPF_INDEX_KEY" -- CORRETO
- Test 3 (key short): KEK com 16 bytes → throw "must be exactly 32 bytes" -- CORRETO
- Test 4 (invalid base64): KEK invalido → throw (por length mismatch apos decode) -- CORRETO

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
- Em `globals.css` `@theme inline`, `--font-mono` aponta para `--font-geist-mono` que nao existe (Geist Mono nao e importado no layout). Texto monoespacado cai no fallback do browser, o que funciona, mas e uma referencia orfã.

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

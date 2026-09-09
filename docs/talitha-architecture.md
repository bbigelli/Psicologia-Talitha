# Arquitetura: Talitha Psicologia

**Versao:** 1.1
**Data:** 2026-09-09
**Referencia:** `docs/talitha-prd.md`, `docs/talitha-security-review-prd.md`, `docs/talitha-security-review-architecture.md`, `docs/talitha-design-system.md`, `docs/talitha-navigation-flow.md`, `docs/talitha-user-stories.md`, `docs/decisions.md`

---

## 1. Stack

| Camada | Tecnologia | Versao/Observacao |
|--------|-----------|-------------------|
| Framework | Next.js 16 (App Router) | TypeScript strict; versao minima fixada contra CVE-2025-29927 (bypass de middleware) |
| Estilizacao | Tailwind CSS + shadcn/ui | CSS variables para tema, dark mode via classe |
| Icones | lucide-react | Unica lib de icones |
| Notificacoes | sonner | Toast |
| Graficos | recharts | Dashboard financeiro |
| Formularios | react-hook-form + zod | Schemas em `src/schemas/` |
| Estado do servidor | TanStack React Query | Cache, polling, mutations |
| Estado local | React Context | Auth, permissoes |
| Tabelas complexas | TanStack Table | Cobrancas, audit log, inadimplentes, recibos |
| Drawer mobile | Vaul | Portal do paciente, acoes contextuais |
| Backend | Supabase | Auth, Postgres + RLS, Edge Functions, Storage |
| Video | LiveKit Cloud | Free tier 5.000 min/mes |
| Pagamentos | Asaas | Sandbox -> Producao |
| Email transacional | Resend | Lembretes, convites, notificacoes |
| PDF | pdfkit ou pdf-lib | Recibo IRPF on-demand; **proibido** puppeteer/chromium (superficie de SSRF no processo com KEK) |
| Deploy | EasyPanel | Container Docker (standalone output) |

---

## 2. Estrutura de Pastas

```
talitha-psicologia/
├── CLAUDE.md                           # Regras especificas do projeto
├── Dockerfile                          # Multi-stage build (install -> build -> run)
├── next.config.ts                      # output: 'standalone', allowedOrigins, headers
├── tailwind.config.ts                  # Tokens do design system
├── tsconfig.json                       # strict: true
├── package.json                        # versao minima do Next.js fixada
├── package-lock.json                   # Versionado, nunca .gitignore
├── .env.example                        # Template sem valores reais
├── .gitignore                          # .env*, .env.local, .env.production
│
├── docs/                               # Documentos de planejamento (nao vao pro build)
│   ├── talitha-prd.md
│   ├── talitha-security-review-prd.md
│   ├── talitha-security-review-architecture.md
│   ├── talitha-architecture.md         # Este arquivo
│   ├── talitha-design-system.md
│   ├── talitha-wireframes.md
│   ├── talitha-navigation-flow.md
│   ├── talitha-user-stories.md
│   ├── talitha-status.md
│   ├── decisions.md
│   └── adr/                            # Architecture Decision Records
│       ├── ADR-0001-*.md ... ADR-0006-*.md
│
├── supabase/                           # Supabase local (CLI)
│   ├── config.toml
│   ├── migrations/                     # DDL SQL ordenado por timestamp
│   │   └── YYYYMMDDHHMMSS_*.sql
│   └── functions/                      # Edge Functions (Deno runtime)
│       ├── asaas-webhook/              # Webhook de pagamento (verify_jwt=false)
│       │   └── index.ts
│       ├── create-charge/              # Criar cobranca no Asaas (verify_jwt=true)
│       │   └── index.ts
│       ├── retry-charges/              # Cron: retentar cobrancas pending_creation (verify_jwt=false, CRON_SECRET)
│       │   └── index.ts
│       ├── issue-livekit-token/        # Emissao de token de sala (verify_jwt=true)
│       │   └── index.ts
│       ├── delete-livekit-room/        # Encerramento de sala (verify_jwt=true)
│       │   └── index.ts
│       ├── send-reminders/             # Cron: lembretes 24h e 1h (verify_jwt=false, CRON_SECRET)
│       │   └── index.ts
│       ├── billing-rules/              # Cron: regua de cobranca (verify_jwt=false, CRON_SECRET)
│       │   └── index.ts
│       └── anchor-audit-log/           # Cron semanal: ancora externa do hash chain (verify_jwt=false, CRON_SECRET)
│           └── index.ts
│
├── public/                             # Assets estaticos
│   └── robots.txt                      # Bloquear /portal, /dashboard, /pacientes, /financeiro,
│                                       # /agenda, /perfil, /sala, /convite, /confirmar,
│                                       # /termos, /onboarding, /mfa, /api
│
├── src/
│   ├── middleware.ts                    # UX guard + defense-in-depth (NAO e a fronteira de autorizacao)
│   │
│   ├── app/                            # App Router — rotas e layouts
│   │   ├── globals.css                 # Tokens CSS do design system
│   │   ├── layout.tsx                  # Root layout: Inter font, providers, metadata
│   │   ├── not-found.tsx               # 404 page
│   │   ├── error.tsx                   # Error boundary global (client component)
│   │   │
│   │   ├── (auth)/                     # Route group: telas publicas e de autenticacao
│   │   │   ├── layout.tsx              # AuthLayout
│   │   │   ├── login/page.tsx
│   │   │   ├── mfa/verify/page.tsx
│   │   │   ├── mfa/setup/page.tsx
│   │   │   ├── convite/[token]/page.tsx
│   │   │   ├── confirmar/[token]/page.tsx   # GET renderiza; POST (Server Action) executa
│   │   │   └── recuperar-senha/page.tsx
│   │   │
│   │   ├── (consent)/                  # Route group: fluxo de consentimento
│   │   │   ├── layout.tsx              # ConsentLayout
│   │   │   └── termos/
│   │   │       ├── atendimento/page.tsx
│   │   │       └── lgpd/page.tsx
│   │   │
│   │   ├── (psychologist)/             # Route group: painel da psicologa
│   │   │   ├── layout.tsx              # PsychologistLayout (reautoriza getUser+role)
│   │   │   ├── onboarding/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── agenda/page.tsx
│   │   │   ├── agenda/nova-sessao/page.tsx
│   │   │   ├── pacientes/page.tsx
│   │   │   ├── pacientes/novo/page.tsx
│   │   │   ├── pacientes/[id]/page.tsx         # runtime='nodejs', force-dynamic
│   │   │   ├── pacientes/[id]/evolucao/page.tsx # runtime='nodejs', force-dynamic
│   │   │   ├── financeiro/page.tsx
│   │   │   ├── financeiro/cobrancas/page.tsx
│   │   │   ├── financeiro/cobrancas/nova/page.tsx
│   │   │   ├── financeiro/assinaturas/page.tsx
│   │   │   ├── financeiro/inadimplentes/page.tsx
│   │   │   ├── financeiro/recibos/page.tsx
│   │   │   └── perfil/page.tsx
│   │   │
│   │   ├── (patient)/                  # Route group: portal do paciente
│   │   │   ├── layout.tsx              # PatientLayout (reautoriza getUser+role+consentimento)
│   │   │   └── portal/
│   │   │       ├── page.tsx
│   │   │       ├── compromissos/page.tsx
│   │   │       ├── anamnese/page.tsx
│   │   │       ├── pagamentos/page.tsx
│   │   │       ├── documentos/page.tsx
│   │   │       ├── perfil/page.tsx
│   │   │       └── dados/solicitar/page.tsx
│   │   │
│   │   ├── (video)/                    # Route group: sala de video
│   │   │   ├── layout.tsx              # VideoLayout
│   │   │   └── sala/[sessionId]/
│   │   │       ├── preflight/page.tsx
│   │   │       ├── espera/page.tsx
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                        # Route Handlers
│   │       ├── auth/callback/route.ts  # PKCE callback; valida redirect contra allowlist interna
│   │       └── receipts/[id]/download/route.ts  # runtime='nodejs', no-store
│   │
│   ├── components/                     # Componentes React (mesma estrutura da v1.0, omitida por brevidade)
│   │   ├── ui/                         # shadcn/ui atoms
│   │   ├── layouts/                    # Sidebar, header, bottom nav, skip-to-content
│   │   ├── auth/ consent/ schedule/ financial/ patients/ clinical/ video/ shared/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser client (anon key, RLS)
│   │   │   ├── server.ts              # Server client (@supabase/ssr, cookies)
│   │   │   ├── middleware.ts          # Middleware client
│   │   │   └── admin.ts              # UNICO modulo que instancia service_role client
│   │   │                              # Importacao fora da allowlist = reprovacao em code review
│   │   ├── actions/
│   │   │   ├── _guard.ts             # withPsychologist(fn), withPatient(fn), withPublicAction(fn)
│   │   │   ├── auth.ts
│   │   │   ├── patients.ts
│   │   │   ├── sessions.ts
│   │   │   ├── charges.ts
│   │   │   ├── clinical-records.ts
│   │   │   ├── anamnesis.ts
│   │   │   ├── consents.ts
│   │   │   ├── receipts.ts
│   │   │   └── profile.ts
│   │   ├── crypto/
│   │   │   ├── keys.ts               # Validacao e carregamento de KEK/CPF_INDEX_KEY no boot
│   │   │   ├── envelope.ts           # AES-256-GCM
│   │   │   ├── blind-index.ts        # HMAC-SHA256 para CPF
│   │   │   └── constants.ts
│   │   ├── email/
│   │   │   ├── client.ts
│   │   │   ├── templates.ts
│   │   │   └── send.ts
│   │   ├── logger.ts                  # UNICO ponto de log; allowlist de chaves serializaveis
│   │   │                              # console.* fora deste modulo = reprovacao em code review
│   │   ├── permissions.ts
│   │   ├── audit.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   │
│   ├── hooks/                          # (mesma estrutura da v1.0)
│   ├── schemas/                        # (mesma estrutura da v1.0)
│   ├── types/                          # (mesma estrutura da v1.0)
│   └── contexts/                       # (mesma estrutura da v1.0)
```

---

## 3. Padrao de Rotas

(Tabela identica a v1.0 com as seguintes adicoes/correcoes:)

- `/pacientes/[id]` e `/pacientes/[id]/evolucao`: adicionado `export const dynamic = 'force-dynamic'` e `export const fetchCache = 'force-no-store'`
- `GET /api/receipts/[id]/download`: responde com `Cache-Control: private, no-store, max-age=0`, `Content-Disposition: attachment`
- `/confirmar/[token]`: GET **apenas renderiza** tela de confirmacao; POST (Server Action publica) efetiva a acao

---

## 4. Fronteiras de Confianca

(Diagrama identico a v1.0 com adicao de `create-charge`, `retry-charges`, `anchor-audit-log` na camada Edge Functions, e `admin.ts` na camada Next.js.)

### 4.1–4.3 (Inalterados da v1.0)

### 4.4 Invariante critica: RLS nao e column-level

**RLS no Postgres e por linha, nao por coluna.** Uma policy `FOR UPDATE USING (patient_id = ...)` autoriza o usuario a escrever **qualquer coluna** daquela linha. Consequencia: se o paciente receber UPDATE em `sessions` (sua propria sessao), ele ganha escrita em `admitted_at` (auto-admissao), `payment_status` (fraude financeira), `status`, `scheduled_at` e `room_name` — derrubando todos os gates que existem para protege-los.

**Regra absoluta:** transicoes de estado sensiveis em tabelas acessiveis ao paciente **nunca** por UPDATE direto. Sempre por RPC `SECURITY DEFINER` de assinatura estreita que escreve exclusivamente as colunas autorizadas. O browser client do Supabase (anon key) nao recebe grant de UPDATE em tabelas com colunas sensiveis — o acesso e via RPC.

---

## 5. Padrao de Modulo de Dominio

(Esqueleto identico a v1.0.)

### 5.1 Exemplo ponta a ponta — Cadastrar paciente (corrigido)

```typescript
// 1. Schema (src/schemas/patient.ts) — inalterado

// 2. Server Action (src/lib/actions/patients.ts)
'use server'
import { withPsychologist } from './_guard'

export const createPatient = withPsychologist(async (ctx, input: CreatePatientInput) => {
  // ctx.user, ctx.profile ja verificados pelo wrapper
  const parsed = createPatientSchema.parse(input)

  // Gerar UUID do paciente ANTES de cifrar (AAD depende do patient_id)
  const patientId = crypto.randomUUID()

  // Cifrar CPF com o patientId ja definido
  const cpfHmac = computeBlindIndex(parsed.cpf)
  const cpfCiphertext = encryptField(parsed.cpf, patientId, 'cpf')

  // Inserir paciente via RPC (audit na mesma transacao)
  const { data, error } = await ctx.supabase.rpc('create_patient_with_audit', {
    p_id: patientId,
    // ... demais campos
  })

  // Enviar convite por email
  await sendInviteEmail(parsed.email, parsed.full_name, inviteToken)

  revalidatePath('/pacientes')
  return { success: true, patientId }
})

// 3. Wrapper (src/lib/actions/_guard.ts)
export function withPsychologist<T, R>(
  fn: (ctx: PsychologistContext, input: T) => Promise<R>
) {
  return async (input: T): Promise<R> => {
    const supabase = await createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new ActionError('Unauthorized')

    const profile = await getProfile(supabase, user.id)
    if (profile.role !== 'psychologist') throw new ActionError('Forbidden')

    // Verificar aal2 para acoes sobre dados clinicos
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel !== 'aal2') throw new ActionError('MFA required')

    return fn({ user, profile, supabase }, input)
  }
}
```

---

## 6. Padrao de Acesso a Dados

### 6.1 Quando usar cada abordagem

(Tabela identica a v1.0 com a seguinte correcao:)

| Cenario | Abordagem | Razao |
|---------|-----------|-------|
| Marcar presenca na sala de espera | RPC `SECURITY DEFINER` `enter_waiting_room(session_id)` | **Nunca UPDATE direto** — RLS nao e column-level (secao 4.4) |
| Admitir paciente | RPC `SECURITY DEFINER` `admit_patient(session_id)` | Idem — so psicologa, verifica role no banco |
| Cancelar/remarcar sessao | RPC `SECURITY DEFINER` `cancel_session(session_id)` | Verifica ownership, politica de prazo, e regras de estado |

### 6.2 Regras de acesso

1. **`SUPABASE_SERVICE_ROLE_KEY`** — allowlist fechada de uso. O client padrao de Server Actions e Route Handlers e o **client do usuario** (`@supabase/ssr`, RLS ativa). `service_role` permitido **apenas** em:
   - Criacao do auth user no convite (Server Action `createPatient`)
   - Leitura de sessao pela Edge Function `issue-livekit-token` (precisa verificar sessao de qualquer usuario)
   - Escrita transacional do webhook `asaas-webhook` (via funcao `SECURITY DEFINER`)
   - Edge Function `create-charge` (leitura do registro de cobranca)
   - Instanciado **exclusivamente** em `src/lib/supabase/admin.ts`. Importacao deste modulo fora da allowlist = reprovacao em code review
   - Preferir **RPC `SECURITY DEFINER` com JWT do usuario** a client `service_role` — mantem `auth.uid()` e o audit log correto

2. **`getUser()` sempre, `getSession()` nunca** em codigo server-side.

3. **Nenhum endpoint server aceita `patient_id`, `psychologist_id` ou `role` como parametro.** Sempre derivar de `getUser()`.

4. **React Query + RLS + lista de colunas:** queries do browser client sempre com **lista explicita de colunas** — `select('*')` **proibido** em tabelas com campos cifrados. Colunas de ciphertext/DEK/HMAC nao devem ser selecionaveis pelo client (REVOKE de coluna ou views sem elas).

---

## 7. Autenticacao e Autorizacao

### 7.1 Middleware (`src/middleware.ts`)

**O middleware e UX + defense-in-depth. NAO e a fronteira de autorizacao.** A fronteira esta nas Server Actions (wrappers), nos layouts (que reautorizam) e na RLS do banco. O middleware pode ser bypassado (classe CVE-2025-29927) e nao cobre Server Actions.

```
1. Criar supabase middleware client (refresh de cookies)
2. try { getUser() } catch { → Redirect /login } — fail-closed em QUALQUER erro

3. Se rota publica: → Permitir

4. Se nao autenticado: → Redirect /login

5. Obter role do user (profiles.role — fonte canonica)

6. Se role = psychologist:
   a. aal < aal2? → Redirect /mfa/verify (verifica NIVEL DE GARANTIA, nao enrollment)
   b. Fator TOTP nao cadastrado? → Redirect /mfa/setup
   c. Acessando /portal/*? → Redirect /dashboard
   d. Onboarding nao concluido? → Redirect /onboarding
   e. Permitir

7. Se role = patient:
   a. Consentimento nao vigente? → Redirect /termos/atendimento
   b. Acessando rotas da psicologa? → Redirect /portal
   c. Permitir

8. Role desconhecido ou erro de role: → Redirect /login + invalidar sessao

9. Adicionar headers de seguranca

matcher: excluir assets estaticos (/_next/static, /favicon.ico, etc.)
```

### 7.2 Guards de rota — defesa em camadas

**Toda pagina/layout de area protegida repete `getUser()` + role antes de qualquer query.** Toda Server Action usa wrapper obrigatorio (`withPsychologist` / `withPatient` / `withPublicAction`). O middleware e a primeira barreira, nao a unica.

| Camada | O que verifica | Falha |
|--------|---------------|-------|
| Middleware | Sessao, role, MFA, consentimento (UX) | Redirect |
| Layout do route group | `getUser()` + role + aal (reautorizacao) | Redirect |
| Server Action wrapper | `getUser()` + role + aal (fronteira real) | Throw error |
| RLS no Postgres | Policies por tabela | Query retorna vazio |
| RLS `aal2` em policies clinicas | `(auth.jwt()->>'aal') = 'aal2'` | Query retorna vazio |

### 7.3 MFA TOTP para a psicologa

- Gate de MFA: verifica **nivel de garantia (`aal2`)**, nao enrollment. Usar `mfa.getAuthenticatorAssuranceLevel()` ou claim `aal` do JWT.
- Uma sessao autenticada so-senha (`aal1`) **nao passa o gate**, mesmo que o TOTP esteja cadastrado.
- **Recuperacao de senha:** o link do Supabase cria sessao `aal1`. O middleware exige `aal2` antes de permitir acesso a qualquer rota protegida. A troca de senha so e efetivada apos MFA challenge, e a troca **revoga todas as outras sessoes** (JWT antigo continua valido ate refresh).
- Reautenticacao (MFA challenge) exigida em: `PURGE_RECORD`, `EXPORT_DATA`, `END_TREATMENT`, troca de senha.
- Recomendado: clausula `(auth.jwt()->>'aal') = 'aal2'` nas policies de `clinical_records`, `anamnesis`, `session_note_drafts` — versao fail-closed que sobrevive a bypass de middleware.

### 7.4 Headers HTTP de seguranca

```typescript
// next.config.ts
{
  experimental: {
    serverActions: {
      allowedOrigins: ['talitha.dominio.com.br'],  // dominio de producao
    },
  },
}
```

Headers (adicionados no middleware e/ou `next.config.ts`):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin` (global); `no-referrer` em `/confirmar/*` e `/convite/*`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Robots-Tag: noindex` (areas autenticadas)
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Permitted-Cross-Domain-Policies: none`
- CSP com nonce por request (ver AM4 do review)
- Para rotas que decifram (`/pacientes/[id]`, `/pacientes/[id]/evolucao`, `/api/receipts/*/download`): `Cache-Control: private, no-store, max-age=0, must-revalidate`

### 7.5 Bootstrap de roles

- **Psicologa:** provisionada por seed/migration. `profiles.role = 'psychologist'` e a **fonte canonica**. Espelhado em `app_metadata` por trigger (para caminho rapido do middleware). Signup publico desabilitado.
- **Paciente:** criado exclusivamente via convite. `profiles.role = 'patient'` definido na criacao.
- **`profiles.role`:** fonte canonica do role. RLS proibe UPDATE na coluna por qualquer usuario, inclusive o proprio. A RLS **nunca confia apenas no claim do JWT** — troca de role revoga sessoes.

---

## 8. Integracoes Externas

### 8.1 Asaas (Pagamentos)

**Segredos:**
- `ASAAS_API_KEY` — `supabase secrets`
- `ASAAS_WEBHOOK_TOKEN` — `supabase secrets`
- `ASAAS_BASE_URL` — `supabase secrets` — `https://api-sandbox.asaas.com/v3` em dev, `https://api.asaas.com/v3` em producao

**Edge Function `create-charge` (verify_jwt=true):**

Pre-condicoes (na ordem, falha → resposta generica):
1. `Authorization: Bearer <supabase JWT>` → `getUser(jwt)` → `uid`.
2. Verificar `profiles.role = 'psychologist'` **no banco** (nunca do JWT `user_metadata`).
3. Body contem **apenas** `charge_id` (uuid, zod). Nunca `patient_id`, `value`, `due_date`.
4. Carregar o registro `charges` pelo `charge_id` com `status = 'pending_creation'`; verificar que `charges.psychologist_id` corresponde ao `uid`.
5. Derivar paciente, valor, vencimento **do registro no banco** — nunca do body.
6. Criar customer no Asaas se necessario; criar cobranca.
7. Atualizar `charges.status` e `charges.asaas_payment_id`.
8. Registrar `CREATE_CHARGE` no audit log com ator.
9. Resposta generica em qualquer falha.

**Fluxo de cobranca (corrigido):**
1. Server Action (`withPsychologist`) valida input, grava `charges` com `status = 'pending_creation'`.
2. Server Action chama `supabase.functions.invoke('create-charge', { body: { charge_id } })`.
3. Edge Function lê o registro, chama o Asaas, atualiza o status.
4. Falha do Asaas → charge permanece `pending_creation`; toast generico ao usuario.

**Edge Function `retry-charges` (verify_jwt=false, CRON_SECRET):**
- Cron a cada 15 min. Carrega charges `pending_creation` com `created_at` > 5 min e < 24h.
- Tenta criar no Asaas; atualiza status.
- Apos 3 falhas: notificar psicologa por email.

**Webhook (Edge Function `asaas-webhook`):** (identico a v1.0)

**Quando o Asaas esta fora do ar:**
- Cobranca fica com `status = 'pending_creation'` e `retry-charges` tenta automaticamente.

### 8.2 LiveKit Cloud (Video)

(Identico a v1.0 com a seguinte correcao na sala de espera:)

**Sala de espera:** estado no Postgres (`sessions.waiting_since`, `sessions.admitted_at`), **fora do LiveKit**. Nenhum token emitido antes da admissao. **Transicoes de estado por RPC `SECURITY DEFINER`** — nunca UPDATE direto (secao 4.4):
- `enter_waiting_room(p_session_id)` — escreve **apenas** `waiting_since`; verifica ownership por `auth.uid()`
- `admit_patient(p_session_id)` — escreve **apenas** `admitted_at`; exige `role = 'psychologist'`

Paciente faz polling do proprio registro sob RLS. Realtime apenas para a psicologa.

### 8.3 Resend (Email Transacional)

**Segredos (corrigido — duas chaves distintas):**
- `RESEND_API_KEY_APP` — EasyPanel env — emails user-initiated (convite, notificacao)
- `RESEND_API_KEY_CRON` — `supabase secrets` — emails cron-based (lembretes, regua)
- `EMAIL_FROM` — EasyPanel env + `supabase secrets` — remetente neutro configuravel

(Restante identico a v1.0: allowlist de assuntos, politica de conteudo, anti-spoofing.)

**`/confirmar/[token]` — link de acao em email (corrigido):**
- GET **apenas renderiza** uma tela de confirmacao com informacao minima (data e hora, sem nome do paciente) e um formulario com botao.
- POST (Server Action publica) efetiva a acao e marca `used_at` na mesma transacao.
- Tokens **por acao**: um para confirmar, outro para cancelar — nunca um token que aceite `action` como parametro.
- Cancelamento por token respeita a politica de prazo; fora do prazo → a tela informa e redireciona ao portal.
- Headers: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.

---

## 9. Modulo de Criptografia

### 9.1 Carregamento de chaves (corrigido)

```typescript
// src/lib/crypto/keys.ts — executado na inicializacao do modulo
function loadKey(envName: string): Buffer {
  const raw = process.env[envName]
  if (!raw) throw new Error(`Missing ${envName} — server cannot start without encryption keys`)
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error(`${envName} must be exactly 32 bytes (got ${buf.length})`)
  delete process.env[envName]  // remover do env apos carregar
  return buf
}

export const KEK = loadKey('RECORD_ENCRYPTION_KEK_V1')
export const CPF_INDEX_KEY = loadKey('CPF_INDEX_KEY')

// Proibido: process.env.RECORD_ENCRYPTION_KEK_V1!
// Proibido: process.env.CPF_INDEX_KEY!
// Proibido: Buffer.from(process.env.X as any, 'base64')
```

Falha ruidosa no boot se chave ausente, tamanho errado ou base64 invalido. **Nunca `!` em leitura de env de chave.**

### 9.2 Campos cifrados (atualizado)

| Campo | Tabela | AAD |
|-------|--------|-----|
| Conteudo da evolucao | `clinical_records` | `patient_id \| record_id` |
| Campos da anamnese (medicacao, condicoes, contato emergencia) | `anamnesis` | `patient_id \| anamnesis_id` |
| CPF do paciente | `patients` | `patient_id \| 'cpf'` |
| **Rascunho de anotacoes da sessao** | `session_note_drafts` | `patient_id \| session_id` |

**Rascunho de anotacoes:** conteudo clinico — segue o envelope sem excecao. Auto-save por Server Action com `runtime='nodejs'`. RLS so para a psicologa. `DELETE` na transacao que grava a evolucao definitiva. Job de limpeza para rascunhos orfaos (sessoes encerradas ha mais de 7 dias).

### 9.3 Blind index para CPF (corrigido)

```typescript
// src/lib/crypto/blind-index.ts
import { createHmac } from 'node:crypto'
import { CPF_INDEX_KEY } from './keys'  // validado no boot, nunca process.env

export function computeCpfBlindIndex(cpf: string): string {
  return createHmac('sha256', CPF_INDEX_KEY).update(cpf).digest('hex')
}
```

### 9.4–9.6 (Inalterados da v1.0)

---

## 10. Audit Log

### 10.1 Camadas (identicas a v1.0)

Camada 4 (hash chain) — **ancora externa:** Edge Function `anchor-audit-log` (cron semanal, `CRON_SECRET`) exporta ultimo `row_hash` + contagem + timestamp para fora do banco (email a psicologa e/ou objeto em bucket privado versionado). Funcao de verificacao recalcula a cadeia entre duas ancoras.

### 10.2 Escrita (corrigido — duas funcoes)

**`log_audit`** — contexto de usuario autenticado:
- `actor_id := auth.uid()` — RAISE se NULL
- Chamada com JWT do usuario via client RLS

**`log_audit_system`** — contexto service_role/Edge Function:
- Recebe `p_actor_id uuid` (extraido pela Edge Function do JWT validado por `getUser(jwt)`) e `p_actor_source text`
- `actor_source` enum: `'user'`, `'edge_function'`, `'webhook'`, `'cron'`, `'anonymous'`
- Executavel **apenas** por `service_role` (`REVOKE` de `authenticated`/`anon`)
- `actor_id` nullable apenas quando `actor_source = 'anonymous'` (login falhado com email inexistente, webhook rejeitado)

Coluna `actor_source NOT NULL` em `audit_log`.

**IP e User-Agent:** derivados sempre de `headers()` no server / `req.headers` na Edge Function. Nunca do body. Regra de confianca do proxy: usar o ultimo hop confiavel de `x-forwarded-for`.

### 10.3 Sincrono vs assincrono (corrigido)

O caminho assincrono usa tabela de outbox (`audit_log_pending`) drenada por cron — **nunca** fire-and-forget em Server Action (perde o registro).

Alternativa aceita: tornar `VIEW_RECORD` sincrono (custo ~5ms, volume irrelevante neste produto).

### 10.4 Acoes registradas

(Identicas a v1.0, com adicao de: `SEARCH_RECORDS` (patient_id + contagem, **nunca o termo de busca** — o termo e conteudo clinico).)

---

## 11. Tratamento de Erros e Observabilidade

### 11.1–11.3 (Inalterados da v1.0)

### 11.4 Modulo de log

Modulo unico `src/lib/logger.ts` (+ equivalente Deno para Edge Functions) com **allowlist de chaves serializaveis**: `event_type`, `session_id`, `patient_id`, `action`, `status`, `error_code`, `user_id`, `payment_id`.

Gate de code review: `console.(log|error|warn|info)` fora de `logger.ts` = reprovacao.

Proibido logar objeto de erro inteiro (`PostgrestError`, resposta do Asaas, payload de webhook).

### 11.5 Login/reset — mensagens genericas

Nao revelar existencia de conta em telas publicas (login, reset, convite expirado). Mensagem sempre generica: "Se este email estiver cadastrado, voce recebera as instrucoes."

---

## 12. Variaveis de Ambiente

### 12.1 Tabela completa (corrigida)

| Variavel | Onde vive | Segredo? | Quem le | `.env.example` |
|----------|----------|----------|---------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | EasyPanel (ARG no builder) | Nao | Browser + server | Sim (placeholder) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | EasyPanel (ARG no builder) | Nao | Browser + server | Sim (placeholder) |
| `NEXT_PUBLIC_LIVEKIT_URL` | EasyPanel (ARG no builder) | Nao | Browser (LiveKit SDK) | Sim (placeholder) |
| `NEXT_PUBLIC_SITE_URL` | EasyPanel (ARG no builder) | Nao | Server (links em email) | Sim (`http://localhost:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **EasyPanel** (runtime only) | **Sim** | `admin.ts` (allowlist) | Nao |
| `RECORD_ENCRYPTION_KEK_V1` | **EasyPanel** (runtime only) | **Sim** | `keys.ts` | Nao |
| `CPF_INDEX_KEY` | **EasyPanel** (runtime only) | **Sim** | `keys.ts` | Nao |
| `RESEND_API_KEY_APP` | **EasyPanel** (runtime only) | **Sim** | `email/client.ts` | Nao |
| `EMAIL_FROM` | **EasyPanel** + `supabase secrets` | Nao | `email/send.ts`, Edge Functions | Sim (placeholder) |
| `ASAAS_API_KEY` | `supabase secrets` | **Sim** | Edge Functions Asaas | Nao |
| `ASAAS_WEBHOOK_TOKEN` | `supabase secrets` | **Sim** | `asaas-webhook` | Nao |
| `ASAAS_BASE_URL` | `supabase secrets` | Nao | Edge Functions Asaas | Sim (sandbox URL) |
| `LIVEKIT_API_KEY` | `supabase secrets` | **Sim** | `issue-livekit-token`, `delete-livekit-room` | Nao |
| `LIVEKIT_API_SECRET` | `supabase secrets` | **Sim** | `issue-livekit-token`, `delete-livekit-room` | Nao |
| `LIVEKIT_URL` | `supabase secrets` | Nao | `delete-livekit-room` (API call) | Nao |
| `SITE_URL` | `supabase secrets` | Nao | Edge Functions de cron (links do portal) | Nao |
| `RESEND_API_KEY_CRON` | `supabase secrets` | **Sim** | Edge Functions de cron | Nao |
| `CRON_SECRET` | `supabase secrets` (via Vault) | **Sim** | Edge Functions de cron | Nao |

### 12.2 Regras (atualizadas)

1–4: (inalteradas da v1.0)
5. **Separacao intencional:** KEK e CPF_INDEX_KEY exclusivamente no EasyPanel. Segredos de integracao (Asaas, LiveKit) exclusivamente em `supabase secrets`. `CRON_SECRET` **apenas** em `supabase secrets` via Vault (o job pg_cron le de `vault.decrypted_secrets`; nao fica em claro na definicao do job).
6. **Nenhum segredo como `ARG` ou `ENV` em nenhum stage do Dockerfile.** Segredos so como env de runtime injetada pelo EasyPanel no container em execucao. Gate: `docker history --no-trunc <imagem> | grep -E 'SERVICE_ROLE|KEK|CPF_INDEX|API_KEY|SECRET'` → 0 linhas.

---

## 13. Estrategia de Testes

### 13.1–13.2 (Inalterados da v1.0)

Adicao em `src/__tests__/lib/crypto/keys.test.ts`: chave ausente → throw; chave curta → throw; vetor conhecido de HMAC → valor esperado.

### 13.3 Teste de isolamento da sala (Gate 5.5)

(Identico a v1.0 com adicao:)

**Ambiente:** projeto Supabase dedicado a teste; script de seeding com `service_role` (test-only); geracao de TOTP no Playwright a partir do secret semeado; chave LiveKit de dev; `docs/credentials.md` no `.gitignore`.

---

## 14. Build e Deploy no EasyPanel

### 14.1 Dockerfile (corrigido)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Allowlist manual de pacotes que precisam de postinstall:
# (nenhum identificado ate o momento — acrescentar conforme necessario)

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# APENAS NEXT_PUBLIC_* como ARG — NENHUM segredo
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Run — segredos APENAS como env de runtime (EasyPanel injeta)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### 14.2 next.config.ts (atualizado)

```typescript
const nextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      allowedOrigins: [process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') || 'localhost:3000'],
    },
  },
}
```

### 14.3 Checklist de deploy (completo)

- [ ] `output: 'standalone'` no `next.config.ts`
- [ ] `package-lock.json` versionado
- [ ] `npm ci --ignore-scripts` no Dockerfile
- [ ] `NEXT_PUBLIC_*` como `ARG` no builder; **nenhum segredo como `ARG`/`ENV`**
- [ ] `docker history --no-trunc <imagem> | grep -E 'SERVICE_ROLE|KEK|CPF_INDEX|API_KEY|SECRET'` → 0 linhas
- [ ] Todas as env vars de runtime configuradas no EasyPanel (tabela da secao 12)
- [ ] As 3 chaves de criptografia verificadas: `KEK_V1` (32 bytes base64), `CPF_INDEX_KEY` (32 bytes base64), `RESEND_API_KEY_APP`
- [ ] `productionBrowserSourceMaps: false`
- [ ] `robots.txt` bloqueando todas as areas autenticadas
- [ ] CORS das Edge Functions restrito ao dominio de producao
- [ ] SPF + DKIM + DMARC `p=reject` no dominio de envio
- [ ] Supabase project em `sa-east-1` (Sao Paulo)
- [ ] Site URL e Redirect URLs configuradas no Dashboard do Supabase (restritas ao dominio de producao)
- [ ] `npm audit --audit-level=high` executado sem vulnerabilidades
- [ ] `allowedOrigins` no `next.config.ts` com o dominio de producao
- [ ] Custodia da KEK: 2 copias offline em locais distintos + **teste de restauracao executado e documentado**
- [ ] Plano de resposta a incidente (art. 48): documento operacional de uma pagina
- [ ] 2FA obrigatorio na conta EasyPanel; contas nomeadas sem login compartilhado
- [ ] Proxy do EasyPanel nao cacheia `/api/**` nem rotas autenticadas
- [ ] Versao do Next.js >= versao minima fixada (CVE-2025-29927)

---

## 15. Decisoes de Arquitetura

(Identico a v1.0 — detalhes nos ADRs em `docs/adr/`.)

---

## 16. Regras Tecnicas do Projeto

### Regras de codigo

1. `runtime='nodejs'` obrigatorio em toda rota/action que usa `node:crypto`
2. **Nenhuma** funcao server aceita `patient_id`, `psychologist_id` ou `role` como parametro
3. `getUser()` em todo codigo server-side — **nunca** `getSession()`
4. Validacao zod em toda boundary server
5. Um componente por arquivo; acima de 300 linhas, extrair
6. Proibido `dangerouslySetInnerHTML` em qualquer campo de prontuario/anamnese
7. Proibido `any`
8. Tipos inferidos de schemas zod — nunca duplicar

### Regras de seguranca

9. KEK exclusivamente no EasyPanel — mover para `supabase secrets` e reprovacao em code review
10. Nenhum segredo com prefixo `NEXT_PUBLIC_` fora da allowlist
11. Ciphertext de prontuario nunca sai do servidor
12. Conteudo clinico, CPF, tokens e payloads de webhook nunca em log (via `logger.ts`)
13. Erro de terceiro nunca literal ao client
14. Token LiveKit apenas em memoria (estado React)
15. Links de acao em email: token opaco no path, nunca dados em query string
16. **Proibido `localStorage`/`sessionStorage`/IndexedDB para qualquer campo clinico** (inclui rascunho de anotacoes)
17. **Plaintext clinico nunca entra em cache do Next.js** — `force-dynamic` + `no-store` em toda rota que decifra
18. **`select('*')` proibido** em tabelas com campos cifrados — sempre lista explicita de colunas
19. **Nenhum segredo como `ARG`/`ENV` em nenhum stage do Dockerfile**

### Regras de autorizacao

20. **Middleware e guard de layout NAO sao a fronteira de autorizacao** — Server Actions e a fronteira
21. **Toda Server Action exportada usa wrapper** (`withPsychologist`/`withPatient`/`withPublicAction`); gate: `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts` retorna vazio
22. **MFA e `aal2`, nao enrollment** — sessao so-senha nao passa o gate
23. **`profiles.role` e a fonte canonica do role** — espelhado em `app_metadata` por trigger; RLS nunca confia apenas no claim do JWT
24. **RLS nao e column-level** — transicoes de estado sensiveis sempre por RPC `SECURITY DEFINER`
25. **`service_role` apenas na allowlist** (secao 6.2); importacao de `admin.ts` fora da allowlist = reprovacao
26. Signup publico desabilitado; psicologa por seed/migration; paciente por convite
27. UI esconde, servidor protege
28. PKs UUID em toda tabela exposta em URL; proibido `bigserial`/`identity`
29. Toda tabela com RLS + ao menos uma policy; migration sem RLS = reprovacao

---

## 17. O que o Data Architect deve absorver

Requisitos estruturais impostos ao schema. Cada item e verificavel e nao deve ser omitido.

### Requisitos 1–17 (originais, com correcoes)

1. **Criptografia envelope** — colunas `content_ciphertext`, `content_iv`, `content_tag`, `dek_wrapped`, `dek_iv`, `dek_tag`, `kek_version` em `clinical_records`, `anamnesis` **e `session_note_drafts`**
2. **CPF cifrado + blind index** — `cpf_ciphertext`, `cpf_iv`, `cpf_tag`, `cpf_dek_wrapped`, `cpf_dek_iv`, `cpf_dek_tag`, `cpf_hmac` (UNIQUE) em `patients`. Colunas de ciphertext/DEK/HMAC: `REVOKE SELECT` para `authenticated` (ou expor views sem elas)
3. **Audit log 4 camadas** — RLS + FORCE, triggers de UPDATE/DELETE/TRUNCATE, REVOKE, hash chain com `prev_hash`/`row_hash` e **serializacao por `pg_advisory_xact_lock`** antes de ler o hash anterior
4. **Duas funcoes de audit log** — `log_audit` (contexto usuario, `actor_id := auth.uid()`, RAISE se NULL) e `log_audit_system` (contexto service_role, recebe `p_actor_id` e `p_actor_source` enum, executavel **apenas** por `service_role`). Coluna `actor_source NOT NULL` em `audit_log`; `actor_id` nullable apenas quando `actor_source = 'anonymous'`
5. **`sessions.room_name`** — `text UNIQUE NOT NULL DEFAULT ('s_' || encode(gen_random_bytes(16),'hex'))`, um por sessao, nunca reutilizado. **Trigger que regenera `room_name` e zera `waiting_since`/`admitted_at` quando `scheduled_at` muda** (remarcacao)
6. **`sessions.waiting_since`, `sessions.admitted_at`** — paciente e psicologa **nao recebem UPDATE** na tabela. `REVOKE UPDATE ON sessions FROM authenticated, anon`. Transicoes por RPC `SECURITY DEFINER`: `enter_waiting_room(p_session_id)` (escreve so `waiting_since`, valida ownership e janela) e `admit_patient(p_session_id)` (escreve so `admitted_at`, exige role psychologist). Mesmo padrao para cancelamento/remarcacao
7. **`payment_webhook_events`** — `asaas_event_id` PK. **Sem payload bruto** — colunas de allowlist apenas: `event_type`, `payment_id`, `status`, `value`, `due_date`, `received_at`, `processed_at`, `result`. CPF e nome completo **proibidos**
8. **`receipt_counters`** — contador transacional por ano com `SELECT ... FOR UPDATE`
9. **`receipts`** — `UNIQUE (charge_id)`, um recibo por cobranca
10. **Maquina de estados de pagamento** — monotonica, sem regressao indevida
11. **`consents`** — append-only; `purpose` enum por finalidade; `consent_text_hash`; `ip` (inet); `user_agent`; **todos os timestamps `timestamptz` UTC** (valor probatorio). **Sem `subject_type = 'guardian'`** (removido pela Emenda E1). Incluir coluna/tabela de **preferencia de comunicacao** (opt-out por canal/finalidade)
12. **`clinical_record_versions`** — tabela append-only para versionamento de evolucoes
13. **`profiles`** — `user_id` (FK auth.users), `role` (**fonte canonica**), `onboarding_completed`, `full_name`, `crp`, dados profissionais. Trigger espelha `role` em `app_metadata`. RLS proibe UPDATE da coluna `role` por qualquer usuario, inclusive o proprio. Policies clinicas incluem clausula `(auth.jwt()->>'aal') = 'aal2'`
14. **`retention_until`** — retenção fixa em 5 anos (Emenda E1); **nao modelar `is_minor_at_start` nem regra de 20 anos**. DELETE fisico bloqueado por trigger durante a retencao. Todos os campos com valor probatorio em `timestamptz` UTC
15. **PKs UUID** em toda tabela exposta em URL; proibido `bigserial`/`identity`
16. **RLS obrigatoria** em toda tabela; `rowsecurity = false` = 0 linhas na query de verificacao
17. **Supabase region `sa-east-1`** (Sao Paulo)

### Requisitos adicionais (18–32)

18. **`CHECK` de idade no banco:** `patients` com constraint que rejeita `date_of_birth` correspondente a menos de 18 anos na data de cadastro. Unico enforcement de E1 que sobrevive a RPC, seed e correcao manual
19. **Tabela `email_action_tokens`** — `id uuid PK`, `token_hash text UNIQUE NOT NULL`, `purpose enum('invite','confirm_attendance','cancel_attendance')`, `patient_id uuid`, `session_id uuid`, `expires_at timestamptz NOT NULL`, `used_at timestamptz`, `created_ip inet`, `created_at timestamptz`. Token **nunca** em claro; `used_at` marcado na mesma transacao da acao; um token por acao; TTL 72h para convite, horario da sessao para confirmacao. RLS sem nenhuma policy para `authenticated`/`anon` — acesso so por RPC `SECURITY DEFINER`
20. **Eliminacao seletiva por categoria** — cada categoria de dado marcada como retida por obrigacao regulatoria vs. eliminavel (secao 9 do Security Review do PRD). Telefone, preferencias de comunicacao e contato de emergencia sao eliminaveis/anonimizaveis sem tocar no prontuario; prontuario e identificacao minima sao congelaveis ate `retention_until`
21. **Tabela `data_subject_requests`** — `id uuid`, `patient_id`, `type enum('access','deletion','correction','portability')`, `requested_at`, `due_at` (15 dias), `status`, `decision text`, `legal_basis text`, `eliminated_categories jsonb`, `retained_categories jsonb`, `responded_at`, `artifact_expires_at`. Resposta fundamentada e requisito de conformidade
22. **Preferencia de comunicacao** — tabela ou colunas para opt-out por canal/finalidade, vinculadas ao consentimento opcional. Consultadas pela regua e pelos lembretes antes de cada envio
23. **Tabela `session_note_drafts`** — envelope completo (7 colunas de criptografia), AAD `patient_id|session_id`, RLS so para psicologa, nenhuma policy de SELECT para `patient`, `DELETE` na transacao que grava evolucao, job de limpeza para orfaos
24. **`log_audit_system`** — funcao separada (descrita no item 4). `REVOKE EXECUTE ON FUNCTION log_audit_system FROM authenticated, anon`
25. **Serializacao do hash chain** — `pg_advisory_xact_lock` (ou ancora de linha unica com `FOR UPDATE`) no trigger `BEFORE INSERT` do `audit_log`
26. **Caminho assincrono do audit log** — tabela `audit_log_pending` drenada por cron; ou tornar `VIEW_RECORD` sincrono (custo ~5ms)
27. **`REVOKE SELECT` de colunas cifradas** — `cpf_ciphertext`, `cpf_iv`, `cpf_tag`, `cpf_dek_*`, `cpf_hmac`, e equivalentes em `clinical_records`/`anamnesis`/`session_note_drafts`, nao selecionaveis por `authenticated`. Alternativa: views sem essas colunas
28. **RLS de `clinical_records`, `anamnesis`, `session_note_drafts`** — nenhuma policy concede SELECT de `clinical_records` a `patient`. `anamnesis`: paciente tem INSERT/UPDATE/SELECT da propria linha sem acesso a colunas de ciphertext; psicologa tem SELECT; ninguem tem DELETE durante retencao. Clausula `(auth.jwt()->>'aal') = 'aal2'` nas policies clinicas
29. **Idempotencia dos lembretes e da regua** — constraints `UNIQUE (session_id, reminder_type)` e `UNIQUE (charge_id, step)` como constraints de banco, nao verificacao na aplicacao
30. **`CRON_SECRET` no Vault** — `vault.decrypted_secrets` na chamada `net.http_post`; `timingSafeEqual` na Edge Function
31. **`charges`** — incluir `status` com enum que cobre `pending_creation` (para o fluxo `create-charge` / `retry-charges`), `psychologist_id` para ownership
32. **Verificacoes que o Data Architect deve deixar executaveis** — `rowsecurity=false` → 0 linhas; `relforcerowsecurity=false` para `audit_log` → 0 linhas; UPDATE/DELETE/TRUNCATE em `audit_log` como `service_role` → excecao do trigger; UPDATE em `sessions` como paciente → erro de permissao; SELECT de coluna de ciphertext como `authenticated` → erro de permissao; verificacao da cadeia de hash → funcao dedicada

---

## 18. Requisitos de implementacao para o Stack Agent

Condicoes de aprovacao em code review derivadas do Security Review da arquitetura. O Backlog deve transforma-las em criterios de Definition of Done.

1. **Wrapper de autorizacao em toda Server Action exportada.** Nenhuma action confia em guard de layout. Gate: `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts` retorna vazio.
2. **Modulo `logger.ts` unico com allowlist de chaves.** `console.*` fora dele reprova. Nunca logar objeto de erro do Postgres, resposta do Asaas ou payload de webhook.
3. **Validacao de chaves no boot com falha ruidosa.** Proibido `process.env.X!` em codigo de cripto. Usar `keys.ts`.
4. **`no-store` + `force-dynamic` em toda rota que decifra.** `Content-Disposition: attachment` no recibo.
5. **`/confirmar/[token]`: GET so renderiza, POST executa.** Tokens separados por acao.
6. **Browser client com lista explicita de colunas.** `select('*')` proibido onde houver ciphertext.
7. **Rate limiting:** login, reenvio de convite (3/paciente/hora), `issue-livekit-token` (10/usuario/min), `/confirmar/*`, solicitacao LGPD.
8. **Politica de senha:** minimo 10 + verificacao de senha vazada habilitada no Supabase Auth; timeout de inatividade.
9. **Alteracao de e-mail com double opt-in** no novo endereco + notificacao ao antigo; mensagens de login/reset genericas (nao revelar existencia de conta).
10. **PDF por lib JS pura** (`pdfkit` ou `pdf-lib`); proibido puppeteer/chromium. `npm ci --ignore-scripts` + `npm audit --audit-level=high` no gate de deploy.
11. **`x-forwarded-for` com regra de confianca do proxy** antes de virar evidencia de auditoria.
12. **Export LGPD:** geracao on-demand (como recibo), download autenticado, signed URL de vida curta se persistir, artefato expiravel, registrado em audit log.

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Arquitetura inicial |
| 1.1 | 2026-09-09 | Correcoes do Security Review: AC1 (create-charge), AC2 (RLS column-level/RPC), AA1-AA2 (middleware nao e fronteira/wrappers), AA3 (aal2), AA4 (validacao de chaves), AA5-AA7 (cache/Dockerfile/supply chain), AA8 (confirmar GET/POST), AA9 (allowlist service_role), AA10 (duas funcoes audit), AA11 (session notes cifradas), AA12 (risco residual ADR-0001). Reescrita da secao 17 (32 requisitos ao Data Architect). Nova secao 18 (12 requisitos ao Stack Agent) |

# Arquitetura: Talitha Psicologia

**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** `docs/talitha-prd.md`, `docs/talitha-security-review-prd.md`, `docs/talitha-design-system.md`, `docs/talitha-navigation-flow.md`, `docs/talitha-user-stories.md`, `docs/decisions.md`

---

## 1. Stack

| Camada | Tecnologia | Versao/Observacao |
|--------|-----------|-------------------|
| Framework | Next.js 16 (App Router) | TypeScript strict |
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
| Deploy | EasyPanel | Container Docker (standalone output) |

---

## 2. Estrutura de Pastas

```
talitha-psicologia/
├── CLAUDE.md                           # Regras especificas do projeto
├── Dockerfile                          # Multi-stage build (install -> build -> run)
├── next.config.ts                      # output: 'standalone', headers de seguranca
├── tailwind.config.ts                  # Tokens do design system
├── tsconfig.json                       # strict: true
├── package.json
├── package-lock.json                   # Versionado, nunca .gitignore
├── .env.example                        # Template sem valores reais
├── .gitignore                          # .env*, .env.local, .env.production
│
├── docs/                               # Documentos de planejamento (nao vao pro build)
│   ├── talitha-prd.md
│   ├── talitha-security-review-prd.md
│   ├── talitha-architecture.md         # Este arquivo
│   ├── talitha-design-system.md
│   ├── talitha-wireframes.md
│   ├── talitha-navigation-flow.md
│   ├── talitha-user-stories.md
│   ├── talitha-status.md
│   ├── decisions.md
│   └── adr/                            # Architecture Decision Records
│       ├── ADR-0001-*.md
│       └── ...
│
├── supabase/                           # Supabase local (CLI)
│   ├── config.toml
│   ├── migrations/                     # DDL SQL ordenado por timestamp
│   │   └── YYYYMMDDHHMMSS_*.sql
│   └── functions/                      # Edge Functions (Deno runtime)
│       ├── asaas-webhook/              # Webhook de pagamento (verify_jwt=false)
│       │   └── index.ts
│       ├── issue-livekit-token/        # Emissao de token de sala (verify_jwt=true)
│       │   └── index.ts
│       ├── delete-livekit-room/        # Encerramento de sala (verify_jwt=true)
│       │   └── index.ts
│       ├── send-reminders/             # Cron: lembretes 24h e 1h (verify_jwt=false, CRON_SECRET)
│       │   └── index.ts
│       └── billing-rules/              # Cron: regua de cobranca (verify_jwt=false, CRON_SECRET)
│           └── index.ts
│
├── public/                             # Assets estaticos
│   └── robots.txt                      # Bloquear /portal, /dashboard, /pacientes, /financeiro
│
├── src/
│   ├── middleware.ts                    # Auth guard, role routing, headers de seguranca
│   │
│   ├── app/                            # App Router — rotas e layouts
│   │   ├── globals.css                 # Tokens CSS do design system
│   │   ├── layout.tsx                  # Root layout: Inter font, providers, metadata
│   │   ├── not-found.tsx               # 404 page
│   │   ├── error.tsx                   # Error boundary global (client component)
│   │   │
│   │   ├── (auth)/                     # Route group: telas publicas e de autenticacao
│   │   │   ├── layout.tsx              # AuthLayout (centralizado, card, logo)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── mfa/
│   │   │   │   ├── verify/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── setup/
│   │   │   │       └── page.tsx
│   │   │   ├── convite/
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx        # Criar senha a partir do convite
│   │   │   ├── confirmar/
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx        # Acao de e-mail (confirmar/cancelar) sem sessao
│   │   │   └── recuperar-senha/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (consent)/                  # Route group: fluxo de consentimento
│   │   │   ├── layout.tsx              # ConsentLayout (sem nav, sem fuga)
│   │   │   └── termos/
│   │   │       ├── atendimento/
│   │   │       │   └── page.tsx        # Termo CFP (etapa 1)
│   │   │       └── lgpd/
│   │   │           └── page.tsx        # Consentimento LGPD segmentado (etapa 2)
│   │   │
│   │   ├── (psychologist)/             # Route group: painel da psicologa
│   │   │   ├── layout.tsx              # PsychologistLayout (sidebar + guard)
│   │   │   ├── onboarding/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # KPIs, grafico receita, cobrancas recentes
│   │   │   ├── agenda/
│   │   │   │   ├── page.tsx            # Visao semanal/diaria
│   │   │   │   └── nova-sessao/
│   │   │   │       └── page.tsx
│   │   │   ├── pacientes/
│   │   │   │   ├── page.tsx            # Lista de pacientes
│   │   │   │   ├── novo/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx        # Ficha com tabs (info/anamnese/historico/financeiro/log)
│   │   │   │       └── evolucao/
│   │   │   │           └── page.tsx    # Nova evolucao clinica (runtime='nodejs')
│   │   │   ├── financeiro/
│   │   │   │   ├── page.tsx            # Redirect para /financeiro/cobrancas
│   │   │   │   ├── cobrancas/
│   │   │   │   │   ├── page.tsx        # TanStack Table
│   │   │   │   │   └── nova/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── assinaturas/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── inadimplentes/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── recibos/
│   │   │   │       └── page.tsx
│   │   │   └── perfil/
│   │   │       └── page.tsx            # Perfil, CRP, e-Psi
│   │   │
│   │   ├── (patient)/                  # Route group: portal do paciente
│   │   │   ├── layout.tsx              # PatientLayout (header/bottom nav + guard)
│   │   │   └── portal/
│   │   │       ├── page.tsx            # Home: proximos compromissos + status
│   │   │       ├── compromissos/
│   │   │       │   └── page.tsx
│   │   │       ├── anamnese/
│   │   │       │   └── page.tsx
│   │   │       ├── pagamentos/
│   │   │       │   └── page.tsx
│   │   │       ├── documentos/
│   │   │       │   └── page.tsx
│   │   │       ├── perfil/
│   │   │       │   └── page.tsx        # Perfil + consentimentos + solicitacao LGPD
│   │   │       └── dados/
│   │   │           └── solicitar/
│   │   │               └── page.tsx
│   │   │
│   │   ├── (video)/                    # Route group: sala de video
│   │   │   ├── layout.tsx              # VideoLayout (fullscreen, dark, sem nav)
│   │   │   └── sala/
│   │   │       └── [sessionId]/
│   │   │           ├── preflight/
│   │   │           │   └── page.tsx    # Teste de dispositivos
│   │   │           ├── espera/
│   │   │           │   └── page.tsx    # Sala de espera (paciente)
│   │   │           └── page.tsx        # Sala de video
│   │   │
│   │   └── api/                        # Route Handlers
│   │       ├── auth/
│   │       │   └── callback/
│   │       │       └── route.ts        # Supabase Auth callback (PKCE)
│   │       └── receipts/
│   │           └── [id]/
│   │               └── download/
│   │                   └── route.ts    # PDF on-demand (runtime='nodejs', precisa KEK)
│   │
│   ├── components/                     # Componentes React
│   │   ├── ui/                         # shadcn/ui (atoms) — instalados via CLI
│   │   ├── layouts/                    # Organismos de layout
│   │   │   ├── psychologist-sidebar.tsx
│   │   │   ├── psychologist-header.tsx
│   │   │   ├── patient-header.tsx
│   │   │   ├── patient-bottom-nav.tsx
│   │   │   └── skip-to-content.tsx
│   │   ├── auth/                       # Componentes de autenticacao
│   │   │   ├── login-form.tsx
│   │   │   ├── mfa-code-input.tsx
│   │   │   ├── mfa-setup-wizard.tsx
│   │   │   └── create-password-form.tsx
│   │   ├── consent/                    # Consentimento
│   │   │   ├── consent-section.tsx
│   │   │   └── consent-flow.tsx
│   │   ├── schedule/                   # Agenda
│   │   │   ├── agenda-week-view.tsx
│   │   │   ├── agenda-day-view.tsx
│   │   │   ├── session-slot.tsx
│   │   │   └── new-session-form.tsx
│   │   ├── financial/                  # Financeiro
│   │   │   ├── kpi-card.tsx
│   │   │   ├── charges-table.tsx
│   │   │   ├── new-charge-form.tsx
│   │   │   ├── receipt-download-item.tsx
│   │   │   └── revenue-chart.tsx
│   │   ├── patients/                   # Pacientes
│   │   │   ├── patient-card.tsx
│   │   │   ├── patient-form.tsx
│   │   │   └── patient-tabs.tsx
│   │   ├── clinical/                   # Prontuario
│   │   │   ├── clinical-record-entry.tsx
│   │   │   ├── evolution-form.tsx
│   │   │   └── anamnesis-form.tsx
│   │   ├── video/                      # Sala de video
│   │   │   ├── video-room.tsx
│   │   │   ├── video-controls.tsx
│   │   │   ├── waiting-room-view.tsx
│   │   │   ├── waiting-list.tsx
│   │   │   ├── device-selector.tsx
│   │   │   ├── preflight-check.tsx
│   │   │   ├── reconnection-overlay.tsx
│   │   │   └── session-notes-panel.tsx
│   │   └── shared/                     # Componentes reutilizaveis
│   │       ├── status-badge.tsx
│   │       ├── search-bar.tsx
│   │       ├── empty-state.tsx
│   │       └── error-fallback.tsx
│   │
│   ├── lib/                            # Logica de infraestrutura e dominio
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser client (anon key, RLS)
│   │   │   ├── server.ts              # Server client (@supabase/ssr, cookies)
│   │   │   └── middleware.ts          # Middleware client (refresh, cookies)
│   │   ├── actions/                    # Server Actions (mutations)
│   │   │   ├── auth.ts                # Login, MFA verify, convite
│   │   │   ├── patients.ts            # CRUD pacientes
│   │   │   ├── sessions.ts            # CRUD agendamentos
│   │   │   ├── charges.ts             # Criar cobranca (chama Asaas via Edge Function)
│   │   │   ├── clinical-records.ts    # CRUD evolucoes (cifra/decifra com KEK)
│   │   │   ├── anamnesis.ts           # CRUD anamnese (cifra/decifra)
│   │   │   ├── consents.ts            # Registrar aceite/revogacao
│   │   │   ├── receipts.ts            # Consultar recibos
│   │   │   └── profile.ts             # Atualizar perfil, onboarding
│   │   ├── crypto/                     # Modulo de criptografia (runtime='nodejs')
│   │   │   ├── envelope.ts            # AES-256-GCM: encrypt, decrypt, wrapDek, unwrapDek
│   │   │   ├── blind-index.ts         # HMAC-SHA256 para CPF
│   │   │   └── constants.ts           # Tamanhos de IV, tag, DEK; nomes de env vars
│   │   ├── email/                      # Modulo de email (Resend SDK)
│   │   │   ├── client.ts              # Resend client
│   │   │   ├── templates.ts           # Templates com allowlist de assuntos
│   │   │   └── send.ts               # Envio com validacao de politica de conteudo
│   │   ├── permissions.ts             # can(), checkRole(), derivar patient_id de uid
│   │   ├── audit.ts                   # Wrapper para chamar fn log_audit() do Postgres
│   │   ├── constants.ts               # Allowlists, enums, limites
│   │   └── utils.ts                   # Funcoes puras (formatacao, mascaramento de CPF)
│   │
│   ├── hooks/                          # Custom hooks (client-side)
│   │   ├── use-auth.ts                # Sessao, user, role
│   │   ├── use-permissions.ts         # can() client-side (UX, nao seguranca)
│   │   ├── use-sessions.ts            # TanStack Query: agendamentos
│   │   ├── use-patients.ts            # TanStack Query: pacientes
│   │   ├── use-charges.ts             # TanStack Query: cobrancas
│   │   ├── use-waiting-room.ts        # Polling 3-5s do proprio registro sob RLS
│   │   ├── use-device-check.ts        # Permissoes de camera/mic
│   │   └── use-livekit.ts             # Conexao LiveKit + estado de midia
│   │
│   ├── schemas/                        # Schemas zod (validacao em toda boundary)
│   │   ├── auth.ts                    # Login, MFA, convite, senha
│   │   ├── patient.ts                 # Cadastro, edicao, validacao idade >= 18
│   │   ├── session.ts                 # Agendamento, cancelamento, remarcacao
│   │   ├── charge.ts                  # Cobranca: valor > 0, vencimento >= hoje
│   │   ├── clinical-record.ts         # Evolucao, anamnese
│   │   ├── consent.ts                 # Aceite, revogacao
│   │   ├── profile.ts                 # Onboarding, perfil
│   │   └── common.ts                  # uuid, cpf, crp, phone, date
│   │
│   ├── types/                          # TypeScript types/interfaces
│   │   ├── database.ts                # Gerado pelo Supabase CLI (supabase gen types)
│   │   ├── domain.ts                  # Tipos de dominio derivados dos schemas
│   │   ├── auth.ts                    # Role, UserProfile, Session
│   │   └── livekit.ts                 # Grants, token request/response
│   │
│   └── contexts/                       # React Context (estado global client-side)
│       ├── auth-context.tsx           # User, role, sessao
│       └── permissions-context.tsx    # Permissoes derivadas do role

```

### 2.1 Convencoes de nomenclatura

| Elemento | Padrao | Exemplo |
|----------|--------|---------|
| Arquivo | kebab-case | `clinical-record-entry.tsx` |
| Componente React | PascalCase | `ClinicalRecordEntry` |
| Hook | camelCase com `use` | `useWaitingRoom` |
| Server Action | camelCase | `createPatient`, `submitEvolution` |
| Schema zod | camelCase com `Schema` | `patientFormSchema` |
| Tipo/Interface | PascalCase | `PatientProfile`, `SessionStatus` |
| Constante | UPPER_SNAKE_CASE | `EMAIL_SUBJECTS`, `MAX_RETRY` |
| Variavel de ambiente | UPPER_SNAKE_CASE | `RECORD_ENCRYPTION_KEK_V1` |
| Edge Function | kebab-case (pasta) | `asaas-webhook/index.ts` |

---

## 3. Padrao de Rotas

### 3.1 Tabela de rotas

| URL | Arquivo | Layout | Guard | Runtime |
|-----|---------|--------|-------|---------|
| `/` | `app/page.tsx` (redirect) | - | - | edge |
| `/login` | `app/(auth)/login/page.tsx` | AuthLayout | publico | edge |
| `/mfa/verify` | `app/(auth)/mfa/verify/page.tsx` | AuthLayout | auth (pre-MFA) | edge |
| `/mfa/setup` | `app/(auth)/mfa/setup/page.tsx` | AuthLayout | auth (pre-MFA) | edge |
| `/convite/[token]` | `app/(auth)/convite/[token]/page.tsx` | AuthLayout | publico | edge |
| `/confirmar/[token]` | `app/(auth)/confirmar/[token]/page.tsx` | AuthLayout | publico (token opaco) | edge |
| `/recuperar-senha` | `app/(auth)/recuperar-senha/page.tsx` | AuthLayout | publico | edge |
| `/termos/atendimento` | `app/(consent)/termos/atendimento/page.tsx` | ConsentLayout | auth + patient | edge |
| `/termos/lgpd` | `app/(consent)/termos/lgpd/page.tsx` | ConsentLayout | auth + patient | edge |
| `/onboarding` | `app/(psychologist)/onboarding/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/dashboard` | `app/(psychologist)/dashboard/page.tsx` | PsychologistLayout | auth + psychologist + MFA + onboarding | edge |
| `/agenda` | `app/(psychologist)/agenda/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/agenda/nova-sessao` | `app/(psychologist)/agenda/nova-sessao/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/pacientes` | `app/(psychologist)/pacientes/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/pacientes/novo` | `app/(psychologist)/pacientes/novo/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/pacientes/[id]` | `app/(psychologist)/pacientes/[id]/page.tsx` | PsychologistLayout | auth + psychologist | **nodejs** |
| `/pacientes/[id]/evolucao` | `app/(psychologist)/pacientes/[id]/evolucao/page.tsx` | PsychologistLayout | auth + psychologist | **nodejs** |
| `/financeiro` | `app/(psychologist)/financeiro/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/financeiro/cobrancas` | `app/(psychologist)/financeiro/cobrancas/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/financeiro/cobrancas/nova` | `app/(psychologist)/financeiro/cobrancas/nova/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/financeiro/assinaturas` | `app/(psychologist)/financeiro/assinaturas/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/financeiro/inadimplentes` | `app/(psychologist)/financeiro/inadimplentes/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/financeiro/recibos` | `app/(psychologist)/financeiro/recibos/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/perfil` | `app/(psychologist)/perfil/page.tsx` | PsychologistLayout | auth + psychologist | edge |
| `/portal` | `app/(patient)/portal/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/compromissos` | `app/(patient)/portal/compromissos/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/anamnese` | `app/(patient)/portal/anamnese/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/pagamentos` | `app/(patient)/portal/pagamentos/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/documentos` | `app/(patient)/portal/documentos/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/perfil` | `app/(patient)/portal/perfil/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/portal/dados/solicitar` | `app/(patient)/portal/dados/solicitar/page.tsx` | PatientLayout | auth + patient + consentimento | edge |
| `/sala/[sessionId]/preflight` | `app/(video)/sala/[sessionId]/preflight/page.tsx` | VideoLayout | auth + owner da sessao | edge |
| `/sala/[sessionId]/espera` | `app/(video)/sala/[sessionId]/espera/page.tsx` | VideoLayout | auth + patient + owner | edge |
| `/sala/[sessionId]` | `app/(video)/sala/[sessionId]/page.tsx` | VideoLayout | auth + owner + admitido | edge |
| `POST /api/auth/callback` | `app/api/auth/callback/route.ts` | - | publico (PKCE) | edge |
| `GET /api/receipts/[id]/download` | `app/api/receipts/[id]/download/route.ts` | - | auth + owner | **nodejs** |

**Rotas com `runtime='nodejs'`:** apenas as que precisam de `node:crypto` para criptografia (prontuario, anamnese, recibo com CPF). Todas as demais usam o Edge Runtime padrao para menor latencia.

### 3.2 Route groups e layouts

| Route Group | Proposito | Layout | Guard aplicado no layout |
|-------------|-----------|--------|--------------------------|
| `(auth)` | Login, MFA, convite, confirmacao, reset | AuthLayout: card centralizado, logo, sem nav | Nenhum (publico) |
| `(consent)` | Termos CFP e LGPD | ConsentLayout: sem nav, sem links de fuga | Auth + patient |
| `(psychologist)` | Painel administrativo | PsychologistLayout: sidebar + header | Auth + psychologist + MFA + onboarding |
| `(patient)` | Portal do paciente | PatientLayout: header/bottom nav | Auth + patient + consentimento vigente |
| `(video)` | Pre-flight, espera, sala | VideoLayout: fullscreen, dark, sem nav | Auth + owner da sessao |

---

## 4. Fronteiras de Confianca

O sistema opera em 4 dominios de confianca distintos. Cada peca de dados e logica vive no dominio que oferece a protecao adequada.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER (nao confiavel)                                                 │
│  - Supabase client com anon key (RLS protege, nao o segredo)             │
│  - TanStack Query cache (dados ja filtrados por RLS)                     │
│  - LiveKit SDK (token em memoria, nunca localStorage)                    │
│  - React Context (role, permissoes — UX, nao seguranca)                  │
│  - Nenhum segredo, nenhum dado clinico em claro, nenhum CPF em claro     │
│  - Zod no form e pre-validacao de UX; NUNCA unica camada de validacao    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTPS (TLS)
┌──────────────────────────────┴───────────────────────────────────────────┐
│  NEXT.JS SERVER (confiavel — EasyPanel container)                        │
│  - Middleware: auth guard, role check, redirect, headers HTTP             │
│  - Server Components: busca de dados com supabase server client           │
│  - Server Actions: mutations, validacao zod server-side, audit log        │
│  - Route Handlers: auth callback, receipt PDF download                    │
│  - Modulo crypto: AES-256-GCM (encrypt/decrypt com KEK do EasyPanel)     │
│  - Email: Resend SDK (convite, notificacao — user-initiated)              │
│  - Segredos: SUPABASE_SERVICE_ROLE_KEY, KEK, CPF_INDEX_KEY, RESEND_API_KEY│
│  - Runtime: Node.js para rotas que cifram; Edge para as demais            │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTPS (Supabase client over TLS)
┌──────────────────────────────┴───────────────────────────────────────────┐
│  SUPABASE EDGE FUNCTIONS (confiavel — dominio Supabase)                  │
│  - asaas-webhook: validacao de token, re-consulta Asaas, conciliacao     │
│  - issue-livekit-token: 8 pre-condicoes, emissao de JWT LiveKit          │
│  - delete-livekit-room: encerramento de sala                             │
│  - send-reminders / billing-rules: cron com CRON_SECRET                  │
│  - Segredos: ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, LIVEKIT_API_KEY/SECRET │
│  - CRON_SECRET, RESEND_API_KEY (para cron-based emails)                  │
│  - Runtime: Deno                                                          │
│  - NUNCA tem acesso a KEK nem a CPF_INDEX_KEY                            │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ Conexao interna (pool)
┌──────────────────────────────┴───────────────────────────────────────────┐
│  SUPABASE POSTGRES (confiavel — dado em repouso)                         │
│  - RLS em TODAS as tabelas (0 tabelas sem RLS)                           │
│  - FORCE ROW LEVEL SECURITY no audit_log                                 │
│  - Triggers de bloqueio (UPDATE/DELETE/TRUNCATE no audit_log)            │
│  - REVOKE explicito                                                       │
│  - Funcoes SECURITY DEFINER para audit log e processamento de webhook    │
│  - Hash chain no audit_log                                                │
│  - Ciphertext de prontuario (ilegivel sem a KEK que esta no EasyPanel)   │
│  - Blind index de CPF (inutil sem CPF_INDEX_KEY que esta no EasyPanel)   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Por que a criptografia fica no Next.js (Node) e nao em Edge Function

1. **Separacao de dominio de confianca:** a KEK deve residir fora do Supabase (Security Review secao 3). Se a criptografia rodasse em Edge Function, a KEK teria que ir para `supabase secrets` — no mesmo dominio do dado. Um vazamento de `SUPABASE_SERVICE_ROLE_KEY` exporia dado E chave.
2. **Runtime:** AES-256-GCM com AAD customizado, IV explicito e envelope encryption exige `node:crypto`. O Edge Runtime do Next.js nao expoe `node:crypto` completo. Declarar `export const runtime = 'nodejs'` e requisito.
3. **Custo aceito:** rotas de prontuario usam Node runtime (cold start ~200ms vs ~50ms do Edge). Volume real (20-30 pacientes) absorve sem impacto perceptivel.

### 4.2 Por que o webhook do Asaas fica em Edge Function e nao em Route Handler

1. **Segredos no dominio correto:** `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` sao segredos de integracao de pagamento. Mantendo-os em `supabase secrets`, eles nao precisam cruzar para o EasyPanel. O webhook nao precisa da KEK (nao toca em prontuario).
2. **`verify_jwt = false` nativo:** Edge Functions do Supabase permitem desabilitar verificacao JWT por funcao. Um Route Handler no Next.js nao tem esse conceito — qualquer request chega.
3. **Isolamento:** a Edge Function tem escopo minimo de escrita (via funcao `SECURITY DEFINER` no Postgres) e nao compartilha memoria nem processo com o resto da aplicacao.
4. **Latencia:** Edge Functions do Supabase estao no mesmo datacenter do Postgres. O webhook valida, re-consulta o Asaas (rede externa) e escreve — tudo dentro do SLA de 2s.

### 4.3 Por que a emissao de token LiveKit fica em Edge Function

1. **Segredos:** `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` sao segredos de integracao que pertencem ao dominio Supabase (`supabase secrets`).
2. **Verificacao server-side:** as 8 pre-condicoes de emissao (secao 5 do Security Review) exigem consultar `sessions`, `patients`, `consents` — todas protegidas por RLS, mas a funcao precisa de `service_role` para verificar em nome do usuario. Edge Function com `verify_jwt = true` extrai o `uid` do JWT do Supabase Auth.
3. **Compatibilidade:** LiveKit Server SDK roda em Deno (validado em `docs/decisions.md`).

---

## 5. Padrao de Modulo de Dominio

Todo modulo segue o mesmo esqueleto. Exemplo concreto: **Modulo de Pacientes**.

```
1. Schema zod (src/schemas/patient.ts)
   - Define a forma dos dados + validacao
   - Exporta o schema E o tipo inferido (z.infer<typeof ...>)
   - Usado no client (form) E no server (Server Action)

2. Server Action (src/lib/actions/patients.ts)
   - Recebe FormData ou objeto tipado
   - Valida com o schema zod
   - Chama Supabase server client (com getUser() — nunca getSession())
   - Cifra campos sensiveis (CPF via envelope.ts + blind-index.ts)
   - Chama audit (log_audit) na mesma transacao se for escrita
   - Revalida cache (revalidatePath / revalidateTag)
   - Retorna resultado tipado ou erro

3. Hook TanStack Query (src/hooks/use-patients.ts)
   - useQuery para leitura (Supabase browser client, RLS filtra)
   - useMutation chamando Server Actions para escrita
   - Invalidacao de cache apos mutacao

4. Componentes (src/components/patients/*.tsx)
   - Server Components para listagens (fetch direto no server)
   - Client Components para forms e interacoes
   - Usam o hook e o schema
```

### 5.1 Exemplo ponta a ponta — Cadastrar paciente

```typescript
// 1. Schema (src/schemas/patient.ts)
export const createPatientSchema = z.object({
  full_name: z.string().min(3).max(200),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10,11}$/),
  cpf: z.string().refine(isValidCpf, 'CPF invalido'),
  date_of_birth: z.string().date().refine(
    (d) => differenceInYears(new Date(), new Date(d)) >= 18,
    'Paciente deve ter 18 anos ou mais'
  ),
})
export type CreatePatientInput = z.infer<typeof createPatientSchema>

// 2. Server Action (src/lib/actions/patients.ts)
'use server'
export async function createPatient(input: CreatePatientInput) {
  const parsed = createPatientSchema.parse(input)
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser() // NUNCA getSession()
  if (!user) throw new Error('Unauthorized')

  // Verificar role server-side
  const profile = await getProfile(supabase, user.id)
  if (profile.role !== 'psychologist') throw new Error('Forbidden')

  // Cifrar CPF
  const cpfHmac = computeBlindIndex(parsed.cpf)
  const cpfCiphertext = encryptField(parsed.cpf, patientId, 'cpf')

  // Inserir paciente (RLS + audit na mesma transacao via RPC)
  const { data, error } = await supabase.rpc('create_patient_with_audit', { ... })

  // Enviar convite por email
  await sendInviteEmail(parsed.email, parsed.full_name, inviteToken)

  revalidatePath('/pacientes')
  return { success: true, patientId: data.id }
}

// 3. Hook (src/hooks/use-patients.ts) — usado em Client Components
export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente cadastrado com sucesso')
    },
    onError: (err) => {
      toast.error('Nao foi possivel cadastrar o paciente. Tente novamente.')
    },
  })
}

// 4. Componente (src/components/patients/patient-form.tsx)
'use client'
export function PatientForm() {
  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
  })
  const mutation = useCreatePatient()
  // ... render form com react-hook-form
}
```

---

## 6. Padrao de Acesso a Dados

### 6.1 Quando usar cada abordagem

| Cenario | Abordagem | Cliente | Razao |
|---------|-----------|---------|-------|
| Buscar lista de pacientes (psicologa) | Server Component (async) | supabase server client | Dados sensiveis renderizados no server; RLS filtra |
| Buscar proximos compromissos (paciente) | Server Component ou TanStack Query | server ou browser client | RLS filtra automaticamente por `auth.uid()` |
| Polling da sala de espera (paciente) | TanStack Query com `refetchInterval: 3000` | browser client | Precisa de atualizacao periodica no client |
| Fila da sala de espera (psicologa) | Supabase Realtime | browser client | Realtime apenas para a psicologa, que ve todos |
| Criar/editar paciente | Server Action | supabase server client | Mutation com cifra de CPF e audit log |
| Registrar evolucao clinica | Server Action (`runtime='nodejs'`) | supabase server client | Cifra com KEK (node:crypto) |
| Ler evolucao clinica | Server Component (`runtime='nodejs'`) | supabase server client | Decifra com KEK; ciphertext nunca sai do server |
| Gerar cobranca no Asaas | Server Action → `supabase.functions.invoke` | supabase server → Edge Function | Asaas API key em supabase secrets |
| Download de recibo PDF | Route Handler (`runtime='nodejs'`) | supabase server client | Decifra CPF para o recibo; gera PDF on-demand |

### 6.2 Regras de acesso

1. **`SUPABASE_SERVICE_ROLE_KEY`** so aparece em:
   - Server Actions (quando precisa bypassar RLS para operacoes transacionais)
   - Route Handlers (receipt download)
   - Funcoes `SECURITY DEFINER` no Postgres (chamadas por Edge Functions)
   - **NUNCA** em `NEXT_PUBLIC_*`, **NUNCA** em componente client, **NUNCA** em log

2. **`getUser()` sempre, `getSession()` nunca** em codigo server-side. `getSession()` nao revalida o JWT e aceita sessao revogada.

3. **Nenhum endpoint server aceita `patient_id`, `psychologist_id` ou `role` como parametro.** Sempre derivar de `getUser()` → `auth.uid()` → resolver via query.

4. **React Query + RLS:** o browser client do Supabase usa a anon key. Todas as queries sao filtradas por RLS automaticamente. O React Query cacheia os dados ja filtrados — o cache nunca contem dado de outro usuario.

---

## 7. Autenticacao e Autorizacao

### 7.1 Middleware (`src/middleware.ts`)

O middleware roda em **toda** request (exceto assets estaticos). Logica:

```
1. Criar supabase middleware client (refresh de cookies)
2. Chamar supabase.auth.getUser() — revalida o JWT

3. Se rota publica (/login, /convite/*, /confirmar/*, /recuperar-senha, /api/auth/callback):
   → Permitir (se ja autenticado E rota de login, redirect para destino por role)

4. Se nao autenticado:
   → Redirect /login

5. Obter role do user (app_metadata.role ou profiles.role)

6. Se role = psychologist:
   a. MFA nao configurado? → Redirect /mfa/setup
   b. Acessando /portal/*? → Redirect /dashboard
   c. Onboarding nao concluido? → Redirect /onboarding
   d. Permitir

7. Se role = patient:
   a. Consentimento nao vigente? → Redirect /termos/atendimento (ou /termos/lgpd)
   b. Acessando /dashboard, /pacientes/*, /financeiro/*, /agenda/*? → Redirect /portal
   c. Permitir

8. Role desconhecido? → Redirect /login + invalidar sessao

9. Em TODAS as responses: adicionar headers de seguranca (ver 7.4)
```

### 7.2 Guards de rota por perfil

| Perfil | Rotas permitidas | Guard |
|--------|-----------------|-------|
| Nao autenticado | `/login`, `/convite/*`, `/confirmar/*`, `/recuperar-senha` | - |
| Psychologist (pre-MFA) | `/mfa/setup`, `/mfa/verify` | auth |
| Psychologist (pre-onboarding) | `/onboarding` | auth + MFA |
| Psychologist (completo) | `/dashboard`, `/agenda/*`, `/pacientes/*`, `/financeiro/*`, `/perfil`, `/sala/*` | auth + MFA + onboarding |
| Patient (pre-consentimento) | `/termos/*` | auth |
| Patient (completo) | `/portal/*`, `/sala/*` | auth + consentimento vigente |

Regra: **fail-closed**. Se qualquer verificacao falha, a rota e negada com redirect. Se o role e desconhecido, a sessao e invalidada.

### 7.3 MFA TOTP para a psicologa

- Supabase Auth nativo: `supabase.auth.mfa.enroll()`, `verify()`, `challenge()`
- Obrigatorio para `role = 'psychologist'` — bloqueante no middleware
- Opcional para `role = 'patient'` (fora do MVP)
- Recovery codes gerados no enrollment, exibidos uma vez
- Reautenticacao (MFA challenge) exigida em: `PURGE_RECORD`, `EXPORT_DATA`, `END_TREATMENT`

### 7.4 Headers HTTP de seguranca

Configurados no middleware e/ou `next.config.ts`:

```typescript
// next.config.ts — headers()
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Robots-Tag': 'noindex',  // Nas areas autenticadas
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js exige
    "style-src 'self' 'unsafe-inline'",  // Tailwind
    "img-src 'self' data: blob:",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.livekit.cloud https://api.resend.com`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join('; '),
}
```

### 7.5 Bootstrap de roles

- **Psicologa:** provisionada por seed/migration. Role em `profiles.role = 'psychologist'` (ou `app_metadata`). **Signup publico desabilitado** para este role. Nao existe auto-cadastro de psicologa.
- **Paciente:** criado exclusivamente via convite emitido pela psicologa. Server Action `createPatient` cria o user no Supabase Auth com `role = 'patient'` em `app_metadata`. O user nunca edita `app_metadata` via API.
- **Coluna `profiles.role`:** RLS proibe UPDATE na coluna por qualquer usuario, inclusive o proprio.

---

## 8. Integracoes Externas

### 8.1 Asaas (Pagamentos)

**Client:** Edge Functions `asaas-webhook` + chamadas ao Asaas via `supabase.functions.invoke` a partir de Server Actions.

**Segredos:**
- `ASAAS_API_KEY` — `supabase secrets` — chamadas `GET/POST /v3/payments`, `/v3/customers`, `/v3/subscriptions`
- `ASAAS_WEBHOOK_TOKEN` — `supabase secrets` — validacao do header `asaas-access-token`

**Fluxo de cobranca:**
1. Server Action (Next.js) → `supabase.functions.invoke('create-charge', { body })` se uma Edge Function dedicada existir, OU Server Action chama Asaas API diretamente com `ASAAS_API_KEY` injetado via `supabase.rpc()` que encapsula a chamada
2. Decisao: **Server Action chama Edge Function `create-charge`** que faz o request ao Asaas. Isso mantem a `ASAAS_API_KEY` exclusivamente no dominio Supabase.
3. Falha do Asaas → toast generico ao usuario ("Nao foi possivel criar a cobranca. Tente novamente em alguns minutos."); detalhe apenas no log server-side. Nunca mensagem literal do Asaas.
4. Retry: Server Action nao faz retry automatico. O usuario tenta novamente.

**Webhook (Edge Function `asaas-webhook`):**
1. Validar `asaas-access-token` com `timingSafeEqual` — **antes de qualquer parsing ou query**. Falha → 401.
2. Validar tamanho do body <= 64KB.
3. Validar frescor: rejeitar `dateCreated` > 7 dias com HTTP 200 + log (nao 4xx).
4. Idempotencia: `INSERT INTO payment_webhook_events ... ON CONFLICT (asaas_event_id) DO NOTHING RETURNING asaas_event_id`. Se nao retornou → 200 sem side-effect.
5. Re-consultar `GET /v3/payments/{id}` — payload **nao e autoritativo**.
6. Transacao unica: atualizar `charges`, `sessions.payment_status`, criar `receipt` (via funcao `SECURITY DEFINER`).
7. Numeracao de recibo: `SELECT ... FOR UPDATE` em `receipt_counters` na mesma transacao.
8. Maquina de estados monotonica: `paid` so regride para `refunded`/`chargeback`.
9. HTTP 200. Erro interno → 500 (Asaas faz retry; retry e seguro por idempotencia).

**Descricao de cobranca:** neutra — `Prestacao de servicos profissionais — Ref. MM/AAAA`. Natureza clinica so no recibo.

**Ao Asaas:** enviar apenas `name`, `cpfCnpj`, `email`, `mobilePhone`. Nunca dados clinicos.

**Quando o Asaas esta fora do ar:**
- Criar a cobranca localmente com `status = 'pending_creation'`
- Exibir aviso a psicologa: "Cobranca registrada. O envio ao paciente sera concluido automaticamente."
- Job de retentativa (Edge Function `retry-charges`, cron) tenta criar no Asaas a cada 15 min, ate 3 tentativas
- Apos 3 falhas: notificar psicologa por email

### 8.2 LiveKit Cloud (Video)

**Client:** Edge Function `issue-livekit-token` + LiveKit React SDK (`@livekit/components-react`) no browser.

**Segredos:**
- `LIVEKIT_API_KEY` — `supabase secrets`
- `LIVEKIT_API_SECRET` — `supabase secrets`
- `NEXT_PUBLIC_LIVEKIT_URL` — env publica (wss://...)

**Emissao de token (Edge Function `issue-livekit-token`):**

Pre-condicoes (na ordem, falha → 404 generico identico):
1. `Authorization: Bearer <supabase JWT>` → `getUser(jwt)` → `uid`
2. Body contem apenas `session_id` (uuid, zod). Nunca `roomName`, `patient_id`, `role`.
3. Carregar sessao com service_role.
4. Autorizacao: `uid == psychologist_id` OU `uid == patients.user_id`.
5. Janela temporal: `now()` entre `scheduled_at - 15min` e `scheduled_at + duration + 30min`.
6. Estado: `status NOT IN ('cancelled','completed','no_show')`.
7. Gate de compliance (paciente): consentimento CFP + LGPD vigentes nas versoes atuais.
8. Gate de admissao (paciente): `admitted_at IS NOT NULL`.

Grants:
- `room`: room_name exato da sessao (128 bits aleatorios, nunca wildcard)
- `canPublish: true`, `canSubscribe: true`
- `canPublishData: false` (anotacoes nunca por data channel)
- `canUpdateOwnMetadata: false`, `roomCreate: false`, `roomAdmin: false`
- `identity`: `auth.uid()` (nunca PII)
- `name`: primeiro nome apenas
- `metadata`: `{"role":"psychologist"}` ou `{"role":"patient"}`

TTL: 15 minutos. Token em memoria no client (estado React). Nunca `localStorage`, URL, cookie.

**Encerramento (Edge Function `delete-livekit-room`):**
- Chamada server-side ao encerrar sessao: `RoomServiceClient.deleteRoom(room_name)`
- Job de limpeza: rooms com idade > 2h sao deletados (protege free tier)

**Sala de espera:** estado no Postgres (`sessions.waiting_since`, `sessions.admitted_at`), **fora do LiveKit**. Nenhum token emitido antes da admissao. Paciente faz polling do proprio registro sob RLS. Realtime apenas para a psicologa.

**Reconexao:** LiveKit SDK tem reconnect nativo (< 30s). Apos 30s: UI mostra "Tentar Novamente" → solicita novo token → Edge Function revalida as 8 pre-condicoes.

### 8.3 Resend (Email Transacional)

**Client:** Resend SDK (`resend`) no Next.js + fetch para Resend API em Edge Functions de cron.

**Segredos:**
- `RESEND_API_KEY` — EasyPanel env (user-initiated emails) + `supabase secrets` (cron-based emails)

**Politica de conteudo (Security Review secao 8):**

Remetente: `"Talitha" <nao-responda@notificacoes.{dominio}>` — sem "psicologia", "psi", "terapia".

Allowlist de assuntos (nenhum assunto fora desta lista):

| Gatilho | Assunto aprovado |
|---------|------------------|
| Convite de primeiro acesso | `Seu acesso ao portal` |
| Lembrete 24h | `Lembrete do seu compromisso de amanha` |
| Lembrete 1h | `Seu compromisso comeca em 1 hora` |
| Confirmacao de presenca | `Confirmacao do seu compromisso` |
| Cobranca D-3 | `Aviso de vencimento` |
| Cobranca D+3 / D+7 | `Pagamento pendente` |
| Recibo disponivel | `Documento disponivel no seu portal` |
| Remarcacao/cancelamento | `Alteracao no seu compromisso` |
| Seguranca | `Atividade na sua conta` |

Regras:
- Preheader definido explicitamente em todo template (neutro)
- Corpo pode conter data/hora e valor (requer abrir o email)
- Nunca conteudo clinico (D1/D2), CPF completo, valores no assunto
- Nunca link direto a sala de video com token embutido
- Links de acao em email (confirmar presenca): token >= 128 bits, hash no banco, uso unico, expira no horario da sessao, escopo de uma acao, sem criar sessao autenticada
- Nome de arquivo de recibo: `recibo-{numero}.pdf` (neutro)

**Anti-spoofing:** SPF + DKIM + DMARC `p=reject` no dominio de envio (pendencia do dev — DNS).

**Cron (Edge Functions):**
- `send-reminders`: disparado por pg_cron, valida `CRON_SECRET` em header, consulta sessoes das proximas 24h/1h, envia via Resend API, idempotencia por (`session_id`, `reminder_type`)
- `billing-rules`: disparado diariamente, processa regua de cobranca (D-3, D+3, D+7, D+15), respeita opt-out, verifica status antes de enviar

---

## 9. Modulo de Criptografia

### 9.1 Visao geral (ADR-0001)

```
┌───────────────────────────────────────────────────┐
│                NEXT.JS SERVER (Node)               │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  src/lib/crypto/envelope.ts                  │  │
│  │                                               │  │
│  │  encrypt(plaintext, patientId, recordId):     │  │
│  │    1. gerar DEK (32 bytes aleatorios)         │  │
│  │    2. cifrar plaintext com DEK (AES-256-GCM)  │  │
│  │       IV = 12 bytes aleatorios                │  │
│  │       AAD = patientId + '|' + recordId        │  │
│  │    3. cifrar DEK com KEK (AES-256-GCM)        │  │
│  │       IV separado, AAD = 'dek_wrap'           │  │
│  │    4. retornar {ciphertext, iv, tag,          │  │
│  │                  dekWrapped, dekIv, dekTag,    │  │
│  │                  kekVersion}                   │  │
│  │                                               │  │
│  │  decrypt(envelope, patientId, recordId):      │  │
│  │    1. carregar KEK pelo kekVersion             │  │
│  │    2. decifrar DEK com KEK                    │  │
│  │    3. decifrar plaintext com DEK              │  │
│  │       verificar AAD = patientId + '|' + recordId│ │
│  │    4. retornar plaintext                      │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  KEK carregada de: process.env.RECORD_ENCRYPTION_  │
│  KEK_V1 (32 bytes base64, injetado pelo EasyPanel) │
└────────────────────────────────────────────────────┘
```

### 9.2 Campos cifrados

| Campo | Tabela | AAD |
|-------|--------|-----|
| Conteudo da evolucao | `clinical_records` | `patient_id \| record_id` |
| Campos da anamnese (medicacao, condicoes, contato emergencia) | `anamnesis` | `patient_id \| anamnesis_id` |
| CPF do paciente | `patients` | `patient_id \| 'cpf'` |

### 9.3 Blind index para CPF

```typescript
// src/lib/crypto/blind-index.ts
import { createHmac } from 'node:crypto'

export function computeCpfBlindIndex(cpf: string): string {
  const key = Buffer.from(process.env.CPF_INDEX_KEY!, 'base64')
  return createHmac('sha256', key).update(cpf).digest('hex')
}
```

- Coluna `patients.cpf_hmac` com `UNIQUE` constraint
- Permite verificar duplicidade sem decifrar
- **Nunca SHA-256 puro** — espaco de 10^11 e brute-forcavel

### 9.4 Busca no historico (decrypt-then-filter)

Busca textual no historico de evolucoes (US-403):
1. Server Action carrega todas as evolucoes do paciente (paginadas, ex: 20 por pagina)
2. Decifra cada uma server-side
3. Filtra pelo termo de busca em memoria
4. Retorna apenas os resultados (plaintext nunca sai do server como response — apenas o resultado formatado)
5. Volume real: 20-30 pacientes, ~50 sessoes/ano/paciente = ~1500 registros totais. Decrypt de 20 registros por pagina e sub-segundo.

### 9.5 Rotacao de KEK

1. Criar nova env `RECORD_ENCRYPTION_KEK_V2` no EasyPanel
2. Job (Server Action administrativa) re-wrapa cada DEK com a nova KEK, incrementa `kek_version`
3. Manter V1 disponivel ate 0 registros em V1
4. Remover V1 do EasyPanel

### 9.6 Crypto-shredding (eliminacao apos retencao)

Para eliminar um registro de forma eficaz apos `retention_until`:
1. Apagar o `dek_wrapped` da linha → ciphertext torna-se irrecuperavel
2. Apagar o `content_ciphertext` por boa pratica
3. Registrar `PURGE_RECORD` no audit log com reautenticacao MFA
4. Unico metodo honesto de eliminacao num Postgres com PITR/backup

---

## 10. Audit Log

### 10.1 Camadas (ADR-0004)

| Camada | Protege contra | Mecanismo |
|--------|---------------|-----------|
| 1. RLS + `FORCE ROW LEVEL SECURITY` | Cliente autenticado | Policies: SELECT so para psychologist; nenhuma policy de INSERT/UPDATE/DELETE |
| 2. Triggers de bloqueio | `service_role`, aplicacao com bug | `BEFORE UPDATE OR DELETE FOR EACH ROW` + `BEFORE TRUNCATE FOR EACH STATEMENT` → `RAISE EXCEPTION` |
| 3. `REVOKE` explicito | Grants excessivos | `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon, service_role` |
| 4. Hash chain | Superuser, insider do provedor | `prev_hash` + `row_hash` calculados no trigger `BEFORE INSERT`; ancora externa semanal |

### 10.2 Escrita

Funcao unica `SECURITY DEFINER` (`log_audit`):
- `actor_id` derivado de `auth.uid()` — nunca de parametro
- Parametros: `p_patient_id`, `p_action`, `p_target_id`, `p_ip`, `p_user_agent`, `p_metadata`
- `metadata jsonb` com allowlist de chaves; **proibido D1/D2/D5**

### 10.3 Sincrono vs assincrono

| Operacao | Log | Falha bloqueia? |
|----------|-----|-----------------|
| `VIEW_RECORD`, `VIEW_ANAMNESIS`, `VIEW_AUDIT_LOG` | Assincrono (retry) | Nao |
| `CREATE_RECORD`, `UPDATE_RECORD`, `PURGE_RECORD` | **Mesma transacao** | **Sim** |
| `ISSUE_ROOM_TOKEN`, `DENY_ROOM_TOKEN` | **Mesma transacao** | **Sim** |
| `ACCEPT_CONSENT`, `REVOKE_CONSENT` | **Mesma transacao** | **Sim** |
| `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE` | Assincrono | Nao |
| Demais acoes administrativas | Sincrono | Sim |

### 10.4 Acoes registradas

`VIEW_RECORD`, `CREATE_RECORD`, `UPDATE_RECORD`, `VIEW_ANAMNESIS`, `VIEW_AUDIT_LOG`, `ISSUE_ROOM_TOKEN`, `DENY_ROOM_TOKEN` (com motivo), `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE`, `ACCEPT_CONSENT`, `REVOKE_CONSENT`, `END_TREATMENT`, `PURGE_RECORD`, `EXPORT_DATA`, `LGPD_REQUEST`, `CANCEL_SESSION`, `RESCHEDULE_SESSION`, `CONFIRM_ATTENDANCE`, `CANCEL_CHARGE`, `CREATE_CHARGE`, `CREATE_SUBSCRIPTION`, `WEBHOOK_REJECTED`, `INVITE_SENT`, `INVITE_REDEEMED`, `REMINDER_SENT`, `SESSION_STARTED`, `SESSION_ENDED`.

---

## 11. Tratamento de Erros e Observabilidade

### 11.1 Error boundaries

- `src/app/error.tsx` — error boundary global (client component)
- Layouts de route group podem ter seu proprio `error.tsx` se necessario
- `src/app/not-found.tsx` — 404

### 11.2 Padrao de try/catch em Server Actions

```typescript
try {
  // operacao
} catch (error) {
  // Log server-side com detalhes (SEM conteudo clinico, CPF, tokens)
  console.error(`[ACTION] createPatient failed: ${error instanceof Error ? error.message : 'unknown'}`)
  // Retorno generico ao client
  return { error: 'Nao foi possivel completar a operacao. Tente novamente.' }
}
```

### 11.3 Toast (sonner)

- Sucesso: `toast.success('Paciente cadastrado com sucesso')`
- Erro: `toast.error('Nao foi possivel cadastrar o paciente. Tente novamente.')`
- Nunca mensagem tecnica, stack trace ou erro de terceiro ao usuario

### 11.4 O que NUNCA pode ser logado

| Proibido em logs | Razao |
|------------------|-------|
| Conteudo clinico (evolucao, anamnese) | D1/D2 — dado sensivel LGPD |
| CPF (completo ou parcial com 6+ digitos) | D5 — dado confidencial |
| Payload completo do webhook Asaas | Contem CPF, nome, valor |
| Token LiveKit | Credencial de midia |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave mestra |
| KEK, CPF_INDEX_KEY | Chaves de criptografia |
| `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | Segredos de integracao |
| Senha, refresh token, cookie de sessao | Credenciais |

**O que pode ser logado:** `event_type`, `payment_id`, `status`, `session_id`, `patient_id` (UUID, nao PII), `user_id`, `action`, `error.message` (generico).

### 11.5 Producao

- `productionBrowserSourceMaps: false` no `next.config.ts`
- Stack traces suprimidos em respostas ao client
- Logs estruturados com `console.error` (EasyPanel captura stdout/stderr)

---

## 12. Variaveis de Ambiente

### 12.1 Tabela completa

| Variavel | Onde vive | Segredo? | `.env.example` | Descricao |
|----------|----------|----------|-----------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | EasyPanel / `.env` | Nao | Sim (placeholder) | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | EasyPanel / `.env` | Nao | Sim (placeholder) | Chave anon (RLS protege) |
| `NEXT_PUBLIC_LIVEKIT_URL` | EasyPanel / `.env` | Nao | Sim (placeholder) | URL WebSocket do LiveKit Cloud |
| `NEXT_PUBLIC_SITE_URL` | EasyPanel / `.env` | Nao | Sim (`http://localhost:3000`) | URL do app (redirects, links em email) |
| `SUPABASE_SERVICE_ROLE_KEY` | **EasyPanel** | **Sim** | Nao | Operacoes server-side bypassing RLS |
| `RECORD_ENCRYPTION_KEK_V1` | **EasyPanel** | **Sim** | Nao | 32 bytes base64 — KEK de prontuario |
| `CPF_INDEX_KEY` | **EasyPanel** | **Sim** | Nao | Chave HMAC para blind index de CPF |
| `RESEND_API_KEY` | **EasyPanel** + `supabase secrets` | **Sim** | Nao | API key do Resend |
| `CRON_SECRET` | **EasyPanel** + `supabase secrets` | **Sim** | Nao | Autenticacao de cron jobs |
| `ASAAS_API_KEY` | `supabase secrets` | **Sim** | Nao | API key do Asaas |
| `ASAAS_WEBHOOK_TOKEN` | `supabase secrets` | **Sim** | Nao | Token de validacao do webhook |
| `LIVEKIT_API_KEY` | `supabase secrets` | **Sim** | Nao | API key do LiveKit |
| `LIVEKIT_API_SECRET` | `supabase secrets` | **Sim** | Nao | Secret do LiveKit |

### 12.2 Regras

1. **Nenhum segredo com prefixo `NEXT_PUBLIC_`.** Allowlist: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_SITE_URL`.
2. Gate de code review: `grep -rE 'NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|API_KEY|TOKEN|PASSWORD|KEK)'` deve retornar 0.
3. `.env`, `.env.local`, `.env.production` no `.gitignore`.
4. `.env.example` versionado com placeholders (ex: `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`).
5. **Separacao intencional:** KEK e CPF_INDEX_KEY **exclusivamente** no EasyPanel. Nunca em `supabase secrets`. Segredos de integracao (Asaas, LiveKit) **exclusivamente** em `supabase secrets`. Nunca no EasyPanel (exceto RESEND_API_KEY e CRON_SECRET que precisam estar em ambos).

---

## 13. Estrategia de Testes

### 13.1 Estrutura

```
src/
├── __tests__/                    # Testes unitarios e de integracao
│   ├── lib/
│   │   ├── crypto/
│   │   │   ├── envelope.test.ts  # Encrypt/decrypt, AAD, rotacao
│   │   │   └── blind-index.test.ts
│   │   ├── permissions.test.ts
│   │   └── email/
│   │       └── templates.test.ts # Allowlist de assuntos
│   └── schemas/
│       ├── patient.test.ts       # Validacao idade >= 18, CPF
│       └── charge.test.ts        # Valor > 0, vencimento >= hoje
├── e2e/                          # Testes E2E (Playwright)
│   ├── auth.spec.ts
│   ├── patient-crud.spec.ts
│   ├── video-isolation.spec.ts   # Gate 5.5 (a)-(g)
│   └── ...
```

### 13.2 Ferramentas

| Ferramenta | Uso |
|-----------|-----|
| Vitest | Testes unitarios: schemas zod, modulo crypto, permissoes, templates de email |
| Playwright | Testes E2E: fluxos completos, isolamento de sala, RBAC |

### 13.3 Teste de isolamento da sala (Gate 5.5 — bloqueante da sprint de video)

Com dois pacientes e duas sessoes no mesmo horario, Playwright executa:
- (a) Trocar `session_id` no request de token → deve falhar com 404
- (b) Apresentar token de A ao room de B → LiveKit rejeita
- (c) Assinar canal Realtime de B → retorna vazio (RLS)
- (d) GET da sessao de B por id → retorna vazio (RLS)
- (e) Pedir token antes da admissao (`admitted_at IS NULL`) → deve falhar
- (f) Pedir token 3h antes do horario → deve falhar
- (g) Pedir token com consentimento revogado → deve falhar

Todas devem falhar, e (a)/(b) devem gerar `DENY_ROOM_TOKEN` no audit log. Resultado documentado em `docs/talitha-qa-*.md`.

---

## 14. Build e Deploy no EasyPanel

### 14.1 Dockerfile (multi-stage)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci  # Nunca npm install — lockfile poisoning

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Run
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

### 14.2 next.config.ts

```typescript
const nextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
  // headers de seguranca — ver secao 7.4
  // ...
}
```

### 14.3 Checklist de deploy

- [ ] `output: 'standalone'` no `next.config.ts`
- [ ] `package-lock.json` versionado
- [ ] `npm ci` no Dockerfile (nao `npm install`)
- [ ] Todas as env vars configuradas no EasyPanel (tabela da secao 12)
- [ ] `productionBrowserSourceMaps: false`
- [ ] `robots.txt` bloqueando areas autenticadas
- [ ] CORS das Edge Functions restrito ao dominio de producao
- [ ] SPF + DKIM + DMARC `p=reject` no dominio de envio
- [ ] Supabase project em `sa-east-1` (Sao Paulo)

---

## 15. Decisoes de Arquitetura

Resumo — detalhes completos nos ADRs em `docs/adr/`.

| Decisao | ADR | Razao |
|---------|-----|-------|
| Criptografia envelope AES-256-GCM com KEK fora do Supabase | ADR-0001 | Separacao de dominio de confianca; vazamento de SERVICE_ROLE_KEY nao expoe prontuario |
| Sala de espera no Postgres, fora do LiveKit | ADR-0002 | Nenhuma credencial de midia antes da admissao; nao consome minutos do free tier |
| Webhook Asaas em Edge Function do Supabase | ADR-0003 | Segredos de pagamento no dominio Supabase; verify_jwt=false nativo; isolamento |
| Audit log com 4 camadas cumulativas | ADR-0004 | RLS nao protege contra service_role; cada camada cobre uma classe de ataque |
| Numeracao de recibo com contador transacional | ADR-0005 | Sequence do Postgres gera lacunas em rollback; US-406 exige sequencia sem lacunas |
| Server Components por padrao, Client Components explicitamente | ADR-0006 | Dados sensiveis renderizados no server; client so para interatividade |
| Server Actions para mutations, Edge Functions para integracoes | ADR-0006 | Mutations usam KEK (Next.js); integracoes usam secrets de terceiros (Supabase) |

---

## 16. Regras Tecnicas do Projeto

### Regras de codigo

1. `runtime='nodejs'` obrigatorio em toda rota/action que usa `node:crypto` (prontuario, anamnese, recibo PDF)
2. **Nenhuma** funcao server aceita `patient_id`, `psychologist_id` ou `role` como parametro — sempre `getUser()` → derivar
3. `getUser()` em todo codigo server-side — **nunca** `getSession()`
4. Validacao zod em toda boundary server (Server Action, Route Handler, Edge Function) — client-side e pre-validacao de UX, nunca unica camada
5. Um componente por arquivo; acima de 300 linhas, extrair
6. Proibido `dangerouslySetInnerHTML` em qualquer campo de prontuario/anamnese
7. Proibido `any` — tipar tudo; generics para tipos dinamicos
8. Tipos inferidos de schemas zod (`z.infer<typeof schema>`) — nunca duplicar

### Regras de seguranca

9. KEK exclusivamente no EasyPanel — mover para `supabase secrets` e motivo de reprovacao em code review
10. Nenhum segredo com prefixo `NEXT_PUBLIC_` fora da allowlist (secao 12.2)
11. Ciphertext de prontuario nunca sai do servidor — client recebe apenas plaintext renderizado em Server Component
12. Conteudo clinico, CPF, tokens e payloads de webhook nunca em log
13. Erro de terceiro (Asaas, Resend) nunca literal ao client — mensagem generica + log server-side
14. Token LiveKit apenas em memoria (estado React) — nunca localStorage, sessionStorage, URL, cookie
15. Links de acao em email: token opaco no path, nunca dados em query string

### Regras de RBAC

16. Role em `app_metadata` ou `profiles.role` com RLS que proibe UPDATE pelo usuario
17. Signup publico desabilitado; psicologa por seed/migration; paciente por convite
18. UI esconde, servidor protege — um usuario que bypassa a UI deve receber erro de permissao
19. PKs de entidades expostas em URL sao UUID (`gen_random_uuid()`); proibido `bigserial`/`identity`
20. Toda tabela em `public` com `ENABLE ROW LEVEL SECURITY` + ao menos uma policy; migration sem RLS = reprovacao

---

## 17. O que o Data Architect deve absorver

Lista de requisitos estruturais que este documento impoe ao schema:

1. **Criptografia envelope** — colunas `content_ciphertext`, `content_iv`, `content_tag`, `dek_wrapped`, `dek_iv`, `dek_tag`, `kek_version` em `clinical_records` e `anamnesis`
2. **CPF cifrado + blind index** — `cpf_ciphertext`, `cpf_iv`, `cpf_tag`, `cpf_dek_wrapped`, `cpf_dek_iv`, `cpf_dek_tag`, `cpf_hmac` (UNIQUE) em `patients`
3. **Audit log 4 camadas** — RLS + FORCE, triggers de UPDATE/DELETE/TRUNCATE, REVOKE, hash chain com `prev_hash`/`row_hash`
4. **Funcao SECURITY DEFINER `log_audit`** — actor_id de `auth.uid()`, nunca parametro
5. **`sessions.room_name`** — `text UNIQUE NOT NULL DEFAULT ('s_' || encode(gen_random_bytes(16),'hex'))`, um por sessao, nunca reutilizado
6. **`sessions.waiting_since`, `sessions.admitted_at`** — estados da sala de espera
7. **`payment_webhook_events`** — tabela de idempotencia com `asaas_event_id` PK
8. **`receipt_counters`** — contador transacional por ano com `SELECT ... FOR UPDATE`
9. **`receipts`** — `UNIQUE (charge_id)`, um recibo por cobranca
10. **Maquina de estados de pagamento** — monotonica, sem regressao indevida
11. **`consents`** — append-only, `subject_type`, `consent_text_hash`, `purpose` (enum por finalidade), `ip`, `user_agent`
12. **`clinical_record_versions`** — tabela append-only para versionamento de evolucoes
13. **`profiles.role`** — RLS proibindo UPDATE na coluna
14. **`retention_until`** — calculado por trigger (5 anos), DELETE fisico bloqueado durante retencao
15. **PKs UUID** em toda tabela exposta em URL; proibido `bigserial`/`identity`
16. **RLS obrigatoria** em toda tabela; `rowsecurity = false` = 0 linhas na query de verificacao
17. **Supabase region `sa-east-1`** (Sao Paulo) — transferencia internacional minimizada

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Arquitetura inicial: estrutura de pastas, fronteiras de confianca, padrao de modulo, integracoes (Asaas, LiveKit, Resend), criptografia envelope, audit log 4 camadas, RBAC, headers HTTP, variaveis de ambiente, testes, deploy |

# Backlog — Talitha Psicologia

> O Talitha Psicologia é uma plataforma web para psicóloga solo que atende exclusivamente online,
> substituindo ferramentas dispersas por um sistema integrado com 4 módulos: financeiro (Asaas),
> vídeo (LiveKit), agenda com lembretes e prontuário criptografado com recibos IRPF.
> O backlog está organizado em 8 sprints sequenciais — cada uma com objetivo claro, Definition of Done
> verificável e ponto de validação (QA). A Sprint 1 é obrigatoriamente de setup (não existe código).
> A ordem privilegia entrega de valor incremental: após a fundação e autenticação, o fluxo de pacientes
> e consentimento habilita a agenda, que por sua vez sustenta o financeiro e o vídeo. O prontuário e
> o dashboard fecham o MVP. A Sprint 8 consolida compliance, hardening e preparação para deploy.

**Sprints (ordem de execução):**
1. Sprint 1 — Fundação (objetivo: projeto scaffoldado, banco aplicado, criptografia funcional)
2. Sprint 2 — Autenticação & MFA (objetivo: psicóloga faz login com TOTP e completa onboarding)
3. Sprint 3 — Pacientes & Consentimento (objetivo: fluxo completo de convite → senha → termos → portal)
4. Sprint 4 — Agenda & Lembretes (objetivo: sessões recorrentes agendadas, lembretes por email)
5. Sprint 5 — Financeiro & Asaas (objetivo: cobranças, webhooks, régua e inadimplentes funcionando)
6. Sprint 6 — Sala de Vídeo & LiveKit (objetivo: sessão 1:1 com sala de espera e isolamento comprovado)
7. Sprint 7 — Prontuário & Registros Clínicos (objetivo: evolução cifrada, anamnese, viabilidade E6)
8. Sprint 8 — Dashboard, Recibos & Finalização (objetivo: KPIs, recibos IRPF, compliance LGPD, hardening)

**Gerado em:** 2026-09-09
**Baseado em:** PRD v1.0 (com emendas E1–E8), Stories v1.0 (36 stories), Architecture v1.1, Data Architecture v1.1, Design System v1.0, Wireframes v1.0, Navigation Flow v1.0, Security Reviews (PRD + Architecture + Schema), ADR-0001 a ADR-0006, CLAUDE.md, decisions.md

**Notas:**
- Stack: Next.js 16 (App Router) + TypeScript strict + Tailwind CSS + shadcn/ui + Supabase + LiveKit Cloud + Asaas + Resend
- Supabase já provisionado em sa-east-1; 12 migrations existem em `supabase/migrations/` e nunca foram aplicadas
- Credenciais completas disponíveis em `docs/credentials.md` (git-ignored)
- Regressão N1 (fn_block_delete_during_retention) considerada corrigida pelo Data Architect; verificação incluída na DoD da Sprint 1
- e-Psi removido (E5) — Resolução CFP 09/2024; viabilidade técnica (E6) é o novo item de conformidade
- Domínio de email não verificado — Resend envia via `onboarding@resend.dev` em dev/QA; domínio próprio é pré-requisito de deploy, não blocker de sprint
- Landing page pública fora do MVP (E4) — sprint complementar pós-MVP

---

## Sprint 1 — Fundação

**Objetivo da sprint:** Projeto scaffoldado com Next.js 16, TypeScript strict, design system aplicado, Supabase configurado com as 12 migrations aplicadas e verificadas, módulo de criptografia funcional com validação de chaves no boot, logger e wrappers de autorização prontos. Nada mais roda sem esta sprint.
**Pré-requisitos:** Nenhum (primeira sprint do projeto)
**Definition of Done:**
- `npm run build` compila sem erros com TypeScript strict
- `npm run dev` inicia sem erros e exibe página de fallback
- 12 migrations aplicadas no Supabase remoto via Management API
- 13 verificações do schema (V1–V13) executadas com resultado esperado
- DoD-4: query V7 confirma que `SELECT content_ciphertext FROM clinical_records` falha como `authenticated`
- DoD-3: `fn_block_delete_during_retention` funciona corretamente nas 3 tabelas sem `treatment_ended_at` (verificar que a correção do Data Architect foi aplicada; se não, criar migration corretiva)
- `keys.ts` falha ruidosamente no boot se KEK ou CPF_INDEX_KEY estiverem ausentes ou com tamanho errado
- Nenhum segredo hardcoded; `.env.example` com placeholders; `.gitignore` inclui `.env*`

**Riscos:**
- Default privileges do Supabase podem anular column-level GRANT (DoD-4 detecta e documenta correção)
- Migration pode falhar por incompatibilidade de extensão (pgcrypto, pg_net) — verificar disponibilidade antes de aplicar

### Task 1.1 — Criar scaffold Next.js com TypeScript strict
- **Tipo:** chore
- **Estimativa:** P
- **Prioridade:** alta
- **Dependências:** nenhuma
- **Stories cobertas:** nenhuma (infraestrutura)
- **Arquivos esperados:**
  - Criar: `package.json`, `tsconfig.json` (strict: true), `next.config.ts` (output: standalone, allowedOrigins, productionBrowserSourceMaps: false), `.gitignore`, `.env.example`
- **Resultado esperado:** `npx create-next-app@latest` com App Router + TypeScript. `tsconfig.json` com `strict: true`. `next.config.ts` conforme architecture.md §14.2. `.env.example` com placeholders para todas as variáveis da tabela 12.1.
- **Critérios de aceite:**
  - [ ] `npm run build` compila sem erros
  - [ ] `tsconfig.json` tem `strict: true`
  - [ ] `next.config.ts` tem `output: 'standalone'` e `productionBrowserSourceMaps: false`
  - [ ] `.env.example` lista todas as variáveis de architecture.md §12.1 (sem valores reais)
  - [ ] `.gitignore` inclui `.env*`, `.env.local`, `.env.production`

### Task 1.2 — Aplicar design system e inicializar shadcn/ui
- **Tipo:** chore
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.1
- **Stories cobertas:** nenhuma (infraestrutura visual)
- **Arquivos esperados:**
  - Criar: `src/app/globals.css` (tokens CSS do design system), `tailwind.config.ts` (tema customizado), `src/app/layout.tsx` (root layout com Inter font, providers, metadata), `src/components/ui/` (componentes shadcn/ui base: button, card, input, label, toast, dialog, dropdown-menu, sheet, skeleton, badge, separator, tabs, table, checkbox, select, textarea, form)
- **Resultado esperado:** Design system "Acolher" (Sage Teal) aplicado com os tokens de `docs/talitha-design-system.md` §2.1. shadcn/ui inicializado com todos os átomos necessários. Sonner configurado para toasts. Dark mode via classe.
- **Critérios de aceite:**
  - [ ] CSS variables do design-system.md §2.1 estão em `globals.css` (light e dark mode)
  - [ ] `tailwind.config.ts` estende tokens do design system (radius: 10px, fontes, cores)
  - [ ] Root layout carrega Inter via `next/font/google` com `variable: '--font-sans'`
  - [ ] Pelo menos 15 componentes shadcn/ui instalados (átomos listados acima)
  - [ ] Ver design-system.md §2, §3

### Task 1.3 — Estrutura de pastas e clientes Supabase
- **Tipo:** chore
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.1
- **Stories cobertas:** nenhuma (infraestrutura)
- **Arquivos esperados:**
  - Criar: toda a árvore de diretórios conforme architecture.md §2 — `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/lib/supabase/admin.ts`, `src/lib/actions/`, `src/lib/crypto/`, `src/lib/email/`, `src/hooks/`, `src/schemas/`, `src/types/`, `src/contexts/`, `src/components/` (subpastas: ui, layouts, auth, consent, schedule, financial, patients, clinical, video, shared), `public/robots.txt`
- **Resultado esperado:** 4 clientes Supabase configurados conforme architecture.md §6. `admin.ts` é o ÚNICO módulo que instancia `service_role` client. `robots.txt` bloqueia todas as áreas autenticadas conforme architecture.md §2.
- **Critérios de aceite:**
  - [ ] `client.ts` usa `createBrowserClient` com anon key
  - [ ] `server.ts` usa `createServerClient` com cookies (@supabase/ssr)
  - [ ] `middleware.ts` cria middleware client
  - [ ] `admin.ts` instancia service_role — único ponto de acesso
  - [ ] `robots.txt` bloqueia /portal, /dashboard, /pacientes, /financeiro, /agenda, /perfil, /sala, /convite, /confirmar, /termos, /onboarding, /mfa, /api
  - [ ] Ver architecture.md §2, §6

### Task 1.4 — Aplicar migrations e executar verificações do schema
- **Tipo:** chore
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 1.3 (Supabase configurado)
- **Stories cobertas:** US-404 (parcial — infraestrutura de banco)
- **Arquivos esperados:**
  - Existentes: `supabase/migrations/20260909120000_*.sql` a `20260909121100_*.sql` (12 arquivos)
  - Criar (se N1 não estiver corrigido): `supabase/migrations/20260909121200_fix_retention_trigger.sql`
- **Resultado esperado:** As 12 migrations aplicadas no Supabase remoto via Management API. Todas as 13 verificações (V1–V13 do data-architecture.md §Verificações Executáveis) executadas com resultado esperado. DoD-3 verificado (fn_block_delete_during_retention funciona). DoD-4 executado (V7 — column-level GRANT efetivo).
- **Critérios de aceite:**
  - [ ] 12 migrations aplicadas sem erro
  - [ ] V1: `rowsecurity=false` em public → 0 linhas
  - [ ] V2: `relforcerowsecurity=false` para audit_log → 0 linhas
  - [ ] V3: UPDATE/DELETE/TRUNCATE em audit_log → exceção
  - [ ] V4: UPDATE em sessions como authenticated → permission denied
  - [ ] V5: SELECT de coluna cifrada como authenticated → permission denied
  - [ ] V6: `fn_verify_audit_chain()` → is_valid = true
  - [ ] V7 (DoD-4): SELECT content_ciphertext FROM clinical_records como authenticated → permission denied
  - [ ] V8: log_audit com patient_id de outro paciente → erro
  - [ ] V9: UPDATE/DELETE em consents → erro
  - [ ] V10: retention_until auto-calculado quando treatment_ended_at é setado
  - [ ] V11: RPCs não executáveis por anon
  - [ ] V12: Hash chain íntegro
  - [ ] V13: Máquina monotônica de pagamento impede regressão
  - [ ] DoD-3: fn_block_delete_during_retention funciona em clinical_records, anamnesis e remote_viability_assessments (tabelas sem treatment_ended_at)
  - [ ] Ver data-architecture.md §Verificações Executáveis, security-review-schema.md §6.6

### Task 1.5 — Módulo de criptografia (keys, envelope, blind index)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.1
- **Stories cobertas:** US-404 (parcial — implementação do módulo)
- **Arquivos esperados:**
  - Criar: `src/lib/crypto/keys.ts`, `src/lib/crypto/envelope.ts`, `src/lib/crypto/blind-index.ts`, `src/lib/crypto/constants.ts`
- **Resultado esperado:** `keys.ts` carrega KEK e CPF_INDEX_KEY do env, valida 32 bytes base64, remove do `process.env` após carregar, falha ruidosamente no boot se ausente/inválido. `envelope.ts` implementa AES-256-GCM com envelope DEK/KEK e AAD. `blind-index.ts` implementa HMAC-SHA256 com CPF_INDEX_KEY. Proibido `process.env.X!` em código de cripto.
- **Critérios de aceite:**
  - [ ] `keys.ts` falha com throw se KEK ausente, curta ou base64 inválido
  - [ ] `keys.ts` faz `delete process.env[envName]` após carregar
  - [ ] `envelope.ts` cifra e decifra com AES-256-GCM, AAD parametrizável
  - [ ] `blind-index.ts` gera HMAC-SHA256 determinístico para CPF
  - [ ] Nenhum uso de `process.env.RECORD_ENCRYPTION_KEK_V1!` — somente via `keys.ts`
  - [ ] Testes unitários: chave ausente → throw; chave curta → throw; vetor conhecido de HMAC → valor esperado
  - [ ] Ver architecture.md §9, ADR-0001

### Task 1.6 — Logger centralizado e wrappers de autorização
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.3
- **Stories cobertas:** nenhuma (infraestrutura de segurança)
- **Arquivos esperados:**
  - Criar: `src/lib/logger.ts`, `src/lib/actions/_guard.ts`, `src/lib/permissions.ts`, `src/lib/audit.ts`, `src/lib/constants.ts`, `src/lib/utils.ts`
- **Resultado esperado:** `logger.ts` com allowlist de chaves serializáveis (event_type, session_id, patient_id, action, status, error_code, user_id, payment_id). Proibido logar conteúdo clínico, CPF, tokens, payloads. `_guard.ts` implementa `withPsychologist`, `withPatient`, `withPublicAction` — cada wrapper faz `getUser()` + verifica role + verifica aal2 (para psicóloga) antes de executar a função.
- **Critérios de aceite:**
  - [ ] `logger.ts` exporta funções de log com allowlist — rejeita chaves fora da lista
  - [ ] `withPsychologist` verifica getUser() + role = psychologist + aal = aal2
  - [ ] `withPatient` verifica getUser() + role = patient
  - [ ] `withPublicAction` verifica apenas CSRF/origin
  - [ ] Nenhum `console.*` fora de `logger.ts`
  - [ ] `getUser()` sempre, `getSession()` nunca
  - [ ] Ver architecture.md §5.1, §11.4, §16 regra 1–3, §18 requisitos 1–2

### Task 1.7 — Dockerfile base e configuração de build
- **Tipo:** chore
- **Estimativa:** P
- **Prioridade:** média
- **Dependências:** Task 1.1
- **Stories cobertas:** nenhuma (infraestrutura de deploy)
- **Arquivos esperados:**
  - Criar: `Dockerfile` (multi-stage: deps → builder → runner), `src/app/not-found.tsx`, `src/app/error.tsx`
- **Resultado esperado:** Dockerfile conforme architecture.md §14.1 — `npm ci --ignore-scripts`, NEXT_PUBLIC_* como ARG no builder, NENHUM segredo como ARG/ENV. Páginas 404 e error boundary globais criadas.
- **Critérios de aceite:**
  - [ ] Dockerfile tem 3 stages (deps, builder, runner)
  - [ ] `npm ci --ignore-scripts` no stage deps
  - [ ] Apenas `NEXT_PUBLIC_*` como ARG — zero segredos em qualquer stage
  - [ ] `docker history --no-trunc <imagem> | grep -E 'SERVICE_ROLE|KEK|CPF_INDEX|API_KEY|SECRET'` → 0 linhas
  - [ ] `not-found.tsx` renderiza página 404 com design system
  - [ ] `error.tsx` é client component com error boundary
  - [ ] Ver architecture.md §14, §18 requisito 10

---

## Sprint 2 — Autenticação & MFA

**Objetivo da sprint:** Psicóloga consegue fazer login com email/senha, configurar MFA TOTP (obrigatório), completar onboarding profissional e visualizar/editar seu perfil. Middleware protege todas as rotas conforme role e nível de autenticação. Layouts de cada área montados.
**Pré-requisitos:** Sprint 1 concluída
**Definition of Done:**
- Psicóloga faz login → é redirecionada para /mfa/setup (primeiro acesso) ou /mfa/verify
- Após MFA, acessa /onboarding (se não completou) ou /dashboard
- Onboarding salva dados profissionais (CRP, especialidade, valor sessão)
- Perfil editável com CRP visível
- Middleware redireciona corretamente para cada cenário (não-autenticado, aal1, sem onboarding, sem consentimento)
- Todas as Server Actions usam wrapper de autorização (architecture.md §18 requisito 1)
- Política de senha configurada no Supabase Auth: mínimo 10 caracteres + verificação de senha vazada (architecture.md §18 requisito 8)

**Riscos:**
- Supabase Auth MFA TOTP pode exigir configuração adicional no dashboard — verificar documentação antes de implementar
- Timeout de inatividade precisa ser calibrado (recomendação: 30 min)

### Task 2.1 — Página de login e callback de autenticação
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.2, Task 1.3
- **Stories cobertas:** US-001 (parcial — login)
- **Arquivos esperados:**
  - Criar: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/auth/callback/route.ts`, `src/schemas/auth.ts`, `src/components/auth/LoginForm.tsx`
- **Resultado esperado:** Tela de login conforme wireframe A.01 — email + senha, botão "Entrar", link "Esqueci minha senha". AuthLayout limpo. Callback PKCE com validação de redirect contra allowlist interna. Mensagens genéricas em login falho ("Credenciais inválidas" — não revelar existência de conta).
- **Critérios de aceite:**
  - [ ] Login com email/senha funciona via Supabase Auth
  - [ ] Callback PKCE processa corretamente o code exchange
  - [ ] Redirect validado contra allowlist (nunca redirecionar para URL externa)
  - [ ] Mensagem de erro genérica: não revela se email existe
  - [ ] Validação zod no schema de login
  - [ ] Mobile-first (320px+)
  - [ ] Ver wireframe A.01, architecture.md §7, §11.5

### Task 2.2 — MFA TOTP (setup e verificação)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 2.1
- **Stories cobertas:** nenhuma diretamente (requisito E2 — MFA obrigatório)
- **Arquivos esperados:**
  - Criar: `src/app/(auth)/mfa/setup/page.tsx`, `src/app/(auth)/mfa/verify/page.tsx`, `src/components/auth/MfaSetup.tsx`, `src/components/auth/MfaVerify.tsx`
- **Resultado esperado:** Tela de setup exibe QR code + secret manual para configurar app autenticador. Tela de verify aceita código de 6 dígitos. Após verificação bem-sucedida, sessão é promovida para aal2. Gate de MFA verifica NÍVEL DE GARANTIA (`aal2`), não enrollment.
- **Critérios de aceite:**
  - [ ] Setup: QR code gerado via `supabase.auth.mfa.enroll()`
  - [ ] Setup: secret alternativo exibido para digitação manual
  - [ ] Verify: aceita código de 6 dígitos via `supabase.auth.mfa.challengeAndVerify()`
  - [ ] Após verify, `mfa.getAuthenticatorAssuranceLevel()` retorna `aal2`
  - [ ] Sessão aal1 NÃO passa o gate — middleware redireciona para /mfa/verify
  - [ ] Conforme wireframe A.02 (setup) e A.03 (verify)
  - [ ] Ver architecture.md §7.3, emenda E2

### Task 2.3 — Recuperação de senha
- **Tipo:** feat
- **Estimativa:** P
- **Prioridade:** média
- **Dependências:** Task 2.1
- **Stories cobertas:** nenhuma diretamente (fluxo essencial de auth)
- **Arquivos esperados:**
  - Criar: `src/app/(auth)/recuperar-senha/page.tsx`, `src/components/auth/PasswordRecovery.tsx`
- **Resultado esperado:** Formulário com email. Mensagem sempre genérica: "Se este email estiver cadastrado, você receberá as instruções." Link do Supabase cria sessão aal1 — middleware exige aal2 antes de acesso a qualquer rota protegida. Troca de senha revoga outras sessões.
- **Critérios de aceite:**
  - [ ] Formulário envia email de reset via Supabase Auth
  - [ ] Mensagem genérica independente de email existir ou não
  - [ ] Sessão pós-reset é aal1 → middleware redireciona para /mfa/verify
  - [ ] Ver architecture.md §7.3, §11.5

### Task 2.4 — Middleware completo
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 1.3, Task 1.6
- **Stories cobertas:** nenhuma diretamente (infraestrutura de segurança)
- **Arquivos esperados:**
  - Criar: `src/middleware.ts`
- **Resultado esperado:** Middleware conforme architecture.md §7.1 — refresh de cookies, fail-closed em qualquer erro de getUser(), verificação de role, gate de MFA (aal2), gate de consentimento, redirect por role, headers de segurança. NÃO é a fronteira de autorização — é UX + defense-in-depth.
- **Critérios de aceite:**
  - [ ] Rota pública → permite
  - [ ] Não autenticado → redirect /login
  - [ ] Psicóloga com aal1 → redirect /mfa/verify
  - [ ] Psicóloga sem TOTP cadastrado → redirect /mfa/setup
  - [ ] Psicóloga acessando /portal/* → redirect /dashboard
  - [ ] Psicóloga sem onboarding → redirect /onboarding
  - [ ] Paciente sem consentimento vigente → redirect /termos/atendimento
  - [ ] Paciente acessando rotas da psicóloga → redirect /portal
  - [ ] Role desconhecido → redirect /login + invalidar sessão
  - [ ] Headers de segurança adicionados (X-Content-Type-Options, X-Frame-Options, etc.)
  - [ ] Matcher exclui /_next/static, /favicon.ico, etc.
  - [ ] x-forwarded-for com regra de confiança do proxy (architecture.md §18 requisito 11)
  - [ ] Ver architecture.md §7.1, §7.4

### Task 2.5 — Layouts de área (5 route groups)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 2.4, Task 1.2
- **Stories cobertas:** US-006 (parcial — estrutura de layout do portal)
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/layout.tsx`, `src/app/(patient)/layout.tsx`, `src/app/(consent)/layout.tsx`, `src/app/(video)/layout.tsx`, `src/components/layouts/PsychologistSidebar.tsx`, `src/components/layouts/PatientBottomNav.tsx`, `src/components/layouts/Header.tsx`, `src/components/layouts/SkipToContent.tsx`
- **Resultado esperado:** PsychologistLayout com sidebar (desktop) e bottom nav (mobile). PatientLayout com bottom nav. ConsentLayout e VideoLayout minimalistas. Cada layout reautoriza getUser() + role antes de qualquer query (defense in depth). Skip-to-content para acessibilidade.
- **Critérios de aceite:**
  - [ ] PsychologistLayout verifica getUser() + role = psychologist + aal2
  - [ ] PatientLayout verifica getUser() + role = patient + consentimento vigente
  - [ ] Sidebar com itens: Dashboard, Agenda, Pacientes, Financeiro, Perfil
  - [ ] Bottom nav do paciente: Início, Sessões, Pagamentos, Documentos, Perfil
  - [ ] Mobile-first: sidebar colapsa em drawer (Vaul) em mobile
  - [ ] Ver wireframes A.05 (sidebar), B.01 (portal), navigation-flow.md §1

### Task 2.6 — Onboarding e perfil da psicóloga
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 2.4, Task 2.5
- **Stories cobertas:** US-001, US-007
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/onboarding/page.tsx`, `src/app/(psychologist)/perfil/page.tsx`, `src/components/patients/OnboardingForm.tsx`, `src/components/patients/ProfileForm.tsx`, `src/schemas/profile.ts`, `src/lib/actions/profile.ts`
- **Resultado esperado:** Onboarding obrigatório no primeiro acesso — nome, CRP (formato CRP XX/XXXXX), CPF (cifrado com envelope), telefone, email, especialidade, valor padrão da sessão, política de cancelamento (horas). Perfil editável com os mesmos campos. CRP visível ao paciente (US-007). Sem campo e-Psi (E5). Server Action com `withPsychologist`.
- **Critérios de aceite:**
  - [ ] Onboarding é obrigatório — redirect se `onboarding_completed = false`
  - [ ] Validação de formato CRP (CRP XX/XXXXX) via zod
  - [ ] Validação de CPF (dígitos verificadores) via zod
  - [ ] CPF da psicóloga cifrado com envelope (architecture.md §9)
  - [ ] Sem campo e-Psi (removido por E5)
  - [ ] Após onboarding, `profiles.onboarding_completed = true`
  - [ ] Perfil permite edição de todos os campos profissionais
  - [ ] Server Action usa `withPsychologist`
  - [ ] Ver wireframe A.04 (onboarding), A.14 (perfil), US-001, US-007

---

## Sprint 3 — Pacientes & Consentimento

**Objetivo da sprint:** Psicóloga cadastra pacientes com CPF cifrado, paciente recebe convite por email, cria senha, aceita termos de consentimento (CFP + LGPD) e acessa o portal com suas próximas sessões e status. Fluxo completo de onboarding do paciente.
**Pré-requisitos:** Sprint 2 concluída
**Definition of Done:**
- Psicóloga cadastra paciente → email de convite enviado via Resend
- Paciente clica no link, cria senha, aceita 2 termos, vê portal
- CPF do paciente cifrado com envelope + blind index HMAC (busca por CPF funciona)
- Idade < 18 bloqueada com mensagem clara (E1)
- Consentimento versionado com hash do texto, append-only
- Termo inclui cláusulas de formato online, política de faltas e queda de conexão (E7)
- RLS impede paciente de ver dados de outro paciente

**Riscos:**
- Resend em modo dev envia apenas para o email da conta — teste real de entrega só com domínio verificado
- Supabase Auth `signUp` como admin pode ter quirks de rate limiting — monitorar

### Task 3.1 — Cadastro de paciente com CPF cifrado
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 1.5 (crypto), Task 2.6 (psicóloga existe)
- **Stories cobertas:** US-002
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/pacientes/page.tsx`, `src/app/(psychologist)/pacientes/novo/page.tsx`, `src/components/patients/PatientList.tsx`, `src/components/patients/PatientForm.tsx`, `src/schemas/patient.ts`, `src/lib/actions/patients.ts`
- **Resultado esperado:** Formulário de cadastro: nome, email, telefone, CPF, data de nascimento. CPF cifrado com envelope (AAD = `patient_id|'cpf'`) + blind index HMAC para busca. CHECK de idade ≥ 18 no banco (constraint) + validação no form. UUID gerado ANTES de cifrar (AAD depende do ID). Lista de pacientes com status de convite. Nenhuma funcionalidade de responsável legal (E1).
- **Critérios de aceite:**
  - [ ] Formulário valida todos os campos via zod
  - [ ] Data de nascimento < 18 anos → mensagem "A prática atende exclusivamente pacientes maiores de 18 anos"
  - [ ] CPF cifrado com envelope e HMAC gerado
  - [ ] CPF duplicado detectado via `cpf_hmac UNIQUE`
  - [ ] Email duplicado detectado
  - [ ] Paciente criado com status "Convite pendente"
  - [ ] Lista de pacientes com badge de status
  - [ ] Server Action usa `withPsychologist`
  - [ ] `select()` com lista explícita de colunas (nunca `select('*')`) — architecture.md §18 requisito 6
  - [ ] Ver wireframe A.08 (lista), A.09 (formulário), US-002

### Task 3.2 — Email de convite via Resend
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 3.1
- **Stories cobertas:** US-002 (parte de envio de convite)
- **Arquivos esperados:**
  - Criar: `src/lib/email/client.ts`, `src/lib/email/templates.ts`, `src/lib/email/send.ts`
- **Resultado esperado:** Integração com Resend usando `RESEND_API_KEY_APP`. Template de convite com link para `/convite/[token]`. Assunto neutro conforme allowlist (architecture.md §8.3) — não revela "terapia" ou "psicologia". Token de convite criado em `email_action_tokens` com hash (nunca em claro), TTL 72h, purpose = 'invite'.
- **Critérios de aceite:**
  - [ ] Email enviado via Resend com RESEND_API_KEY_APP
  - [ ] Token armazenado como hash (nunca plaintext no banco)
  - [ ] Assunto do email neutro (allowlist)
  - [ ] Link no email: `/convite/{token}` (token opaco no path, nunca em query string)
  - [ ] Email não contém dados clínicos
  - [ ] Falha de envio → paciente criado + toast "convite falhou, reenvie pela lista"
  - [ ] Rate limit de reenvio: 3/paciente/hora (architecture.md §18 requisito 7)
  - [ ] Ver architecture.md §8.3, §18 requisito 7

### Task 3.3 — Primeiro acesso do paciente
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 3.2
- **Stories cobertas:** US-003
- **Arquivos esperados:**
  - Criar: `src/app/(auth)/convite/[token]/page.tsx`, `src/components/auth/InviteAcceptForm.tsx`, `src/lib/actions/auth.ts`
- **Resultado esperado:** Paciente clica no link, vê tela de criação de senha. Token consumido via RPC `consume_email_token` (R19) — valida expiração, uso único e purpose match atomicamente. Senha mínima 10 caracteres (architecture.md §18 requisito 8). Após criar senha, redireciona para fluxo de termos.
- **Critérios de aceite:**
  - [ ] Token validado via RPC `consume_email_token` (não na aplicação)
  - [ ] Token expirado (>72h) → mensagem "Convite expirou. Contate sua psicóloga."
  - [ ] Token já usado → mensagem "Conta já ativada. Faça login."
  - [ ] Senha mínima 10 caracteres com ao menos 1 letra e 1 número
  - [ ] Senhas não coincidem → mensagem de erro
  - [ ] Após criar senha → redirect para /termos/atendimento
  - [ ] Headers: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`
  - [ ] Ver wireframe B.02, US-003, architecture.md §8.3 (confirmar link)

### Task 3.4 — Termos de consentimento (CFP + LGPD)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 3.3
- **Stories cobertas:** US-004, US-005
- **Arquivos esperados:**
  - Criar: `src/app/(consent)/layout.tsx`, `src/app/(consent)/termos/atendimento/page.tsx`, `src/app/(consent)/termos/lgpd/page.tsx`, `src/components/consent/ConsentForm.tsx`, `src/lib/actions/consents.ts`, `src/schemas/consent.ts`
- **Resultado esperado:** Dois termos sequenciais: (1) Atendimento online CFP com cláusulas de formato online, política de faltas e queda de conexão (E7). (2) Consentimento LGPD segmentado. Cada aceite registrado em `consents` com: patient_id, purpose, consent_version, consent_text_hash, ip, user_agent, timestamp UTC. Append-only. Revogação possível via perfil do paciente. Novo versionamento obriga re-aceite.
- **Critérios de aceite:**
  - [ ] Termo 1 (CFP) com texto rolável + checkbox "Li e aceito"
  - [ ] Termo 2 (LGPD) após aceite do termo 1
  - [ ] Aceite registrado com hash SHA-256 do texto do termo
  - [ ] Timestamps em UTC com valor probatório
  - [ ] IP e User-Agent capturados do request (nunca do body)
  - [ ] Paciente sem termos aceitos → middleware bloqueia acesso ao portal
  - [ ] Nova versão do termo → paciente deve re-aceitar antes de prosseguir
  - [ ] Termo inclui cláusulas E7 (formato online, faltas, queda de conexão)
  - [ ] Ver wireframes B.03 (CFP), B.04 (LGPD), US-004, US-005, emenda E7

### Task 3.5 — Portal do paciente (home)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 3.4, Task 2.5
- **Stories cobertas:** US-006
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/page.tsx`, `src/components/shared/NextSessionCard.tsx`, `src/components/shared/PaymentStatusBadge.tsx`
- **Resultado esperado:** Home do portal com: próximas sessões agendadas (data, hora, botão "Entrar na Sala" habilitado 15 min antes), status do próximo pagamento (em dia / pendente / atrasado), link para "Meus Recibos". Estado vazio: "Nenhuma sessão agendada. Contate sua psicóloga." Mobile-first. Carrega em <2s.
- **Critérios de aceite:**
  - [ ] Próximas sessões listadas com data/hora
  - [ ] Botão "Entrar na Sala" habilitado 15 min antes do horário
  - [ ] Status de pagamento visível (badge colorido, discreto)
  - [ ] Estado vazio com mensagem orientativa
  - [ ] Skeleton loading enquanto dados carregam
  - [ ] RLS garante que paciente vê apenas seus dados
  - [ ] Mobile-first (320px+)
  - [ ] Ver wireframe B.01, US-006

### Task 3.6 — Perfil do paciente e visualização de credenciais
- **Tipo:** feat
- **Estimativa:** P
- **Prioridade:** média
- **Dependências:** Task 3.5
- **Stories cobertas:** US-007 (visão do paciente)
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/perfil/page.tsx`, `src/components/patients/PatientProfile.tsx`
- **Resultado esperado:** Perfil do paciente com dados pessoais (somente leitura — editáveis pela psicóloga). Seção "Sua Psicóloga" com nome, CRP e especialidade visíveis. Link para revogar consentimento LGPD. Sem campo e-Psi (E5).
- **Critérios de aceite:**
  - [ ] Dados do paciente exibidos (somente leitura)
  - [ ] CRP e especialidade da psicóloga visíveis
  - [ ] Sem campo e-Psi
  - [ ] Link para revogação de consentimento funcional
  - [ ] Ver wireframe B.07, US-007, emenda E5

---

## Sprint 4 — Agenda & Lembretes

**Objetivo da sprint:** Psicóloga cria sessões recorrentes semanais, visualiza agenda (semanal/diária), gerencia cancelamentos e remarcações com política de prazo. Paciente vê suas próximas sessões no portal. Lembretes automáticos de 24h e 1h enviados por email com link de confirmação.
**Pré-requisitos:** Sprint 3 concluída
**Definition of Done:**
- Psicóloga cria sessão recorrente → 12 semanas de sessões geradas
- Conflito de horário bloqueado com mensagem clara
- Cancelamento respeita política de prazo configurada no onboarding
- Remarcação regenera room_name e zera waiting_since/admitted_at (trigger no banco)
- Lembretes 24h e 1h enviados via Edge Function + Resend (cron a cada 15 min)
- Confirmação de presença via email token funciona
- DoD-2: `cancellation_reason` validado (comprimento máximo, sem dados clínicos)
- `/confirmar/[token]`: GET só renderiza, POST executa (architecture.md §18 requisito 5)
- Edge Functions de cron usam CRON_SECRET via Vault com timingSafeEqual

**Riscos:**
- Cron job de lembretes precisa de precisão de ±15 min — tolerável para email, insuficiente para push
- Rolling window de recorrência (gerar mais 12 semanas) precisa de job automatizado ou trigger

### Task 4.1 — Visualização da agenda (semanal/diária)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 2.5 (layout da psicóloga)
- **Stories cobertas:** US-301
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/agenda/page.tsx`, `src/components/schedule/WeekView.tsx`, `src/components/schedule/DayView.tsx`, `src/components/schedule/SessionBlock.tsx`, `src/hooks/useSchedule.ts`
- **Resultado esperado:** Visão semanal (padrão em desktop) e diária (padrão em mobile <768px). Cada bloco de sessão mostra: nome do paciente, horário, status (confirmada/pendente/cancelada) com cor diferenciada, indicador de pagamento. Navegação por seta entre semanas. Click no bloco abre detalhes.
- **Critérios de aceite:**
  - [ ] Visão semanal com 7 dias e sessões distribuídas por horário
  - [ ] Visão diária como padrão em mobile (<768px)
  - [ ] Blocos com cor por status: confirmada (success), pendente (warning), cancelada (muted)
  - [ ] Indicador de pagamento (pago/pendente/vencido) no bloco
  - [ ] Click → modal com detalhes + ações (cancelar, remarcar, prontuário)
  - [ ] Navegação entre semanas (setas ou swipe em mobile)
  - [ ] Estado vazio: "Agenda vazia. Cadastre pacientes e agende sessões."
  - [ ] Ver wireframe A.06 (agenda), US-301

### Task 4.2 — Criação de sessão com recorrência semanal
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 4.1, Task 3.1 (pacientes existem)
- **Stories cobertas:** US-302
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/agenda/nova-sessao/page.tsx`, `src/components/schedule/NewSessionForm.tsx`, `src/schemas/session.ts`, `src/lib/actions/sessions.ts`
- **Resultado esperado:** Formulário: paciente, dia da semana, horário de início, duração (padrão 50 min), checkbox "Recorrência semanal". Se recorrente, gera 12 semanas de sessões. Verificação de conflito antes de criar. Sessão criada via Server Action (não via UPDATE direto — REVOKE em sessions). Room_name gerado automaticamente pelo banco (default).
- **Critérios de aceite:**
  - [ ] Sessão avulsa criada com sucesso
  - [ ] Recorrência gera 12 sessões nas próximas semanas
  - [ ] Conflito de horário verificado (US-303) — sessão conflitante não é criada
  - [ ] Recorrência parcial: se 1 das 12 conflita, cria as 11 + aviso
  - [ ] Room_name gerado pelo banco (default: `'s_' || encode(gen_random_bytes(16),'hex')`)
  - [ ] Server Action usa `withPsychologist`
  - [ ] Ver wireframe A.07 (formulário), US-302

### Task 4.3 — Bloqueio de conflito de horário
- **Tipo:** feat
- **Estimativa:** P
- **Prioridade:** alta
- **Dependências:** Task 4.2
- **Stories cobertas:** US-303
- **Arquivos esperados:**
  - Modificar: `src/lib/actions/sessions.ts` (adicionar verificação de sobreposição)
- **Resultado esperado:** Verificação de sobreposição considerando duração (não apenas horário de início). Mensagem clara com nome do paciente e horário conflitante. Funciona para sessões avulsas e recorrentes. Verificação na remarcação também.
- **Critérios de aceite:**
  - [ ] Sobreposição detectada (início novo < fim existente AND fim novo > início existente)
  - [ ] Mensagem: "Conflito com sessão de [Nome] das HH:MM às HH:MM"
  - [ ] Recorrência com conflito parcial → cria as não-conflitantes + aviso
  - [ ] Ver US-303

### Task 4.4 — Cancelamento com política de prazo e remarcação
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 4.2
- **Stories cobertas:** US-306, US-307
- **Arquivos esperados:**
  - Modificar: `src/lib/actions/sessions.ts` (adicionar cancel_session, reschedule)
  - Criar: `src/components/schedule/CancelDialog.tsx`, `src/components/schedule/RescheduleDialog.tsx`
- **Resultado esperado:** Cancelamento via RPC `cancel_session` — verifica ownership, política de prazo, regras de estado. Cancelamento fora do prazo → aviso ao paciente + flag para cobrança. Remarcação = cancelamento + nova sessão (trigger regenera room_name). Paciente pode cancelar/remarcar pelo portal com mesmas regras. DoD-2: `cancellation_reason` validado (max 500 chars, sem termos clínicos).
- **Critérios de aceite:**
  - [ ] Cancelamento dentro do prazo → sessão cancelada sem cobrança
  - [ ] Cancelamento fora do prazo → aviso + flag "Cancelada fora do prazo"
  - [ ] Sessão em andamento ou passada → não pode cancelar
  - [ ] Remarcação verifica conflito no novo horário
  - [ ] Remarcação regenera room_name e zera waiting_since/admitted_at (trigger)
  - [ ] Cancelamento de recorrência → apenas aquela sessão, não as futuras
  - [ ] Email de notificação ao paciente/psicóloga
  - [ ] DoD-2: cancellation_reason validado (comprimento + allowlist)
  - [ ] Ver US-306, US-307, data-architecture.md §Sessions

### Task 4.5 — Próximas sessões no portal do paciente
- **Tipo:** feat
- **Estimativa:** P
- **Prioridade:** alta
- **Dependências:** Task 4.2, Task 3.5
- **Stories cobertas:** US-308
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/compromissos/page.tsx`, `src/components/schedule/PatientSessionList.tsx`
- **Resultado esperado:** Lista das próximas 10 sessões com data, dia, horário, status e botão "Entrar na Sala" (habilitado 15 min antes). Sessão cancelada aparece riscada. Estado vazio: "Nenhuma sessão agendada."
- **Critérios de aceite:**
  - [ ] Até 10 sessões futuras listadas
  - [ ] Botão "Entrar na Sala" habilitado 15 min antes
  - [ ] Sessão cancelada visível com status "Cancelada" e sem botão
  - [ ] RLS: paciente só vê suas sessões
  - [ ] Ver wireframe B.05, US-308

### Task 4.6 — Lembretes automáticos (Edge Function send-reminders)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 4.2, Task 3.2 (Resend)
- **Stories cobertas:** US-304
- **Arquivos esperados:**
  - Criar: `supabase/functions/send-reminders/index.ts`
  - Modificar: Supabase cron job (pg_cron ou webhook externo a cada 15 min)
- **Resultado esperado:** Edge Function executada a cada 15 min via CRON_SECRET. Identifica sessões com lembretes pendentes (24h e 1h). Envia email via RESEND_API_KEY_CRON. Registra em `session_reminders` com UNIQUE constraint (idempotência). Verifica status da sessão antes de enviar (não envia para canceladas). Respeita `communication_preferences` (opt-out). Tom acolhedor e profissional.
- **Critérios de aceite:**
  - [ ] Lembrete 24h enviado ~24h antes da sessão
  - [ ] Lembrete 1h enviado ~1h antes
  - [ ] CRON_SECRET validado com timingSafeEqual
  - [ ] Idempotência via UNIQUE (session_id, reminder_type)
  - [ ] Sessão cancelada → não envia
  - [ ] Opt-out respeitado (communication_preferences)
  - [ ] Falha de envio → log + retry na próxima execução
  - [ ] Sessão agendada <24h → só lembrete de 1h
  - [ ] Ver architecture.md §8.3, US-304

### Task 4.7 — Confirmação de presença por email
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 4.6
- **Stories cobertas:** US-305
- **Arquivos esperados:**
  - Criar: `src/app/(auth)/confirmar/[token]/page.tsx`, `src/components/auth/ConfirmAction.tsx`
  - Modificar: `supabase/functions/send-reminders/index.ts` (incluir links de confirmação)
- **Resultado esperado:** Lembrete de 24h inclui links "Confirmar Presença" e "Não poderei ir" — tokens separados por ação (um para confirmar, outro para cancelar). `/confirmar/[token]`: GET só renderiza tela de confirmação, POST (Server Action pública) efetiva a ação e marca `used_at`. Cancelamento por token respeita política de prazo.
- **Critérios de aceite:**
  - [ ] GET renderiza informação mínima (data/hora, sem nome do paciente)
  - [ ] POST efetiva a ação e marca used_at na mesma transação
  - [ ] Token consumido via RPC consume_email_token
  - [ ] Tokens separados por ação (confirmar ≠ cancelar)
  - [ ] Cancelamento fora do prazo → tela informa e redireciona ao portal
  - [ ] Token usado → "Esta ação já foi processada"
  - [ ] Headers: Referrer-Policy: no-referrer, Cache-Control: no-store
  - [ ] Ver architecture.md §8.3, §18 requisito 5, US-305

---

## Sprint 5 — Financeiro & Asaas

**Objetivo da sprint:** Psicóloga cria cobranças avulsas e assinaturas recorrentes via Asaas, pagamentos são conciliados automaticamente por webhook, régua de cobrança envia lembretes de pagamento, painel de inadimplentes lista pacientes com pendências, e paciente vê histórico de pagamentos no portal.
**Pré-requisitos:** Sprint 4 concluída (sessões existem para vincular cobranças)
**Definition of Done:**
- Cobrança avulsa criada via Edge Function → paciente recebe link de pagamento
- Webhook Asaas recebido e processado (PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED)
- Idempotência de webhook comprovada (mesmo evento 2x não duplica)
- Assinatura recorrente criada com contador de sessões por ciclo
- Régua de cobrança: D-3, D+3, D+7, D+15 com emails automáticos
- Painel de inadimplentes funcional
- Paciente vê pagamentos no portal com badges de status
- API key do Asaas NUNCA no client — toda comunicação via Edge Function
- Payload de webhook não é autoritativo — re-consulta GET /v3/payments/{id} (CLAUDE.md)

**Riscos:**
- Asaas sandbox pode ter instabilidade — implementar retry com backoff exponencial
- Timeout do webhook Asaas é 2s — Edge Function deve ser enxuta
- Fluxo create-charge → retry-charges precisa de testes de integração com sandbox real

### Task 5.1 — Edge Functions de infraestrutura Asaas
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 1.4 (banco com tabelas financeiras)
- **Stories cobertas:** US-102 (parcial — infra), US-104 (parcial — infra)
- **Arquivos esperados:**
  - Criar: `supabase/functions/create-charge/index.ts`, `supabase/functions/retry-charges/index.ts`
- **Resultado esperado:** `create-charge` (verify_jwt=true): recebe apenas `charge_id` no body, carrega registro do banco, verifica ownership, cria customer no Asaas se necessário, cria cobrança, atualiza status. Resposta genérica em qualquer falha. `retry-charges` (verify_jwt=false, CRON_SECRET): carrega charges `pending_creation` > 5 min < 24h, tenta criar, notifica psicóloga após 3 falhas.
- **Critérios de aceite:**
  - [ ] create-charge: JWT verificado, role = psychologist no banco
  - [ ] create-charge: body aceita APENAS charge_id (zod)
  - [ ] create-charge: valor, paciente, vencimento derivados do registro no banco (nunca do body)
  - [ ] create-charge: customer criado no Asaas automaticamente se necessário
  - [ ] retry-charges: CRON_SECRET via Vault com timingSafeEqual
  - [ ] retry-charges: backoff exponencial entre tentativas
  - [ ] Descrição de cobrança neutra: "Prestação de serviços profissionais — Ref. MM/AAAA"
  - [ ] Audit log: CREATE_CHARGE registrado com ator
  - [ ] Ver architecture.md §8.1, CLAUDE.md (regras de descrição)

### Task 5.2 — Cobrança avulsa (Server Action + UI)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.1
- **Stories cobertas:** US-102
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/financeiro/cobrancas/nova/page.tsx`, `src/app/(psychologist)/financeiro/cobrancas/page.tsx`, `src/components/financial/ChargeForm.tsx`, `src/components/financial/ChargeTable.tsx`, `src/schemas/charge.ts`, `src/lib/actions/charges.ts`
- **Resultado esperado:** Formulário: paciente, método de pagamento (PIX/boleto/cartão), valor, vencimento, descrição. Server Action grava `charges` com `status = pending_creation` e chama Edge Function `create-charge`. Tabela de cobranças com filtros (TanStack Table). Falha do Asaas → charge permanece `pending_creation`, toast genérico.
- **Critérios de aceite:**
  - [ ] Formulário com validação zod (valor > 0, vencimento futuro)
  - [ ] Charge criada no banco com pending_creation antes de chamar Edge Function
  - [ ] Edge Function atualiza status para pending/paid conforme resposta
  - [ ] Falha → toast genérico, sem expor erro do Asaas
  - [ ] Tabela de cobranças com sort/filter (TanStack Table)
  - [ ] Server Action usa withPsychologist
  - [ ] Ver wireframe A.11 (formulário), A.10 (lista), US-102

### Task 5.3 — Webhook de conciliação (asaas-webhook)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.1
- **Stories cobertas:** US-104
- **Arquivos esperados:**
  - Criar: `supabase/functions/asaas-webhook/index.ts`
- **Resultado esperado:** Edge Function (verify_jwt=false) recebe webhooks do Asaas. Valida ASAAS_WEBHOOK_TOKEN. Re-consulta `GET /v3/payments/{id}` antes de conciliar (CLAUDE.md — payload não autoritativo). Processa: PAYMENT_RECEIVED → paid, PAYMENT_OVERDUE → overdue, PAYMENT_REFUNDED → refunded. Idempotência via `asaas_event_id PK` em `payment_webhook_events`. Registra colunas de allowlist apenas (sem CPF, sem nome, sem payload bruto).
- **Critérios de aceite:**
  - [ ] authToken validado com timingSafeEqual antes de processar
  - [ ] Token inválido → HTTP 401, sem processamento
  - [ ] Re-consulta GET antes de atualizar (payload não autoritativo)
  - [ ] PAYMENT_RECEIVED → charge.status = paid
  - [ ] PAYMENT_OVERDUE → charge.status = overdue
  - [ ] PAYMENT_REFUNDED → charge.status = refunded
  - [ ] Idempotência: mesmo evento 2x não duplica (asaas_event_id PK)
  - [ ] webhook_events sem payload bruto (colunas de allowlist)
  - [ ] Processado em <2s (timeout Asaas)
  - [ ] Audit log via log_audit_system com actor_source = 'webhook'
  - [ ] Ver architecture.md §8.1, ADR-0003, US-104

### Task 5.4 — Assinatura recorrente
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.2, Task 5.3
- **Stories cobertas:** US-103
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/financeiro/assinaturas/page.tsx`, `src/components/financial/SubscriptionForm.tsx`, `src/components/financial/SubscriptionList.tsx`, `src/schemas/subscription.ts`
  - Modificar: `src/lib/actions/charges.ts` (adicionar criação de assinatura)
- **Resultado esperado:** Criar assinatura no Asaas (`POST /v3/subscriptions`) via Edge Function. Rastrear sessões usadas no ciclo. Aviso quando pacote esgotado → opção de cobrança avulsa. Lista de assinaturas com status.
- **Critérios de aceite:**
  - [ ] Assinatura criada no Asaas com valor, dia de vencimento, sessões incluídas
  - [ ] Paciente com assinatura ativa → nova assinatura bloqueada
  - [ ] Sessões do pacote rastreadas (usadas/total)
  - [ ] Pacote esgotado → aviso + opção de cobrança avulsa
  - [ ] Cancelamento registrado
  - [ ] Ver US-103

### Task 5.5 — Régua de cobrança automática
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.3
- **Stories cobertas:** US-105
- **Arquivos esperados:**
  - Criar: `supabase/functions/billing-rules/index.ts`
- **Resultado esperado:** Edge Function (cron, CRON_SECRET) executa 1x/dia às 9h. Régua: D-3 (pré-vencimento), D+3 (1º lembrete), D+7 (2º lembrete + notifica psicóloga), D+15 (marca inadimplente). Idempotência via UNIQUE (charge_id, step) em `billing_rule_events`. Respeita opt-out de `communication_preferences`. Tom respeitoso (saúde mental).
- **Critérios de aceite:**
  - [ ] D-3: email ao paciente sobre vencimento próximo
  - [ ] D+3: email ao paciente sobre pagamento vencido
  - [ ] D+7: email ao paciente + notificação à psicóloga
  - [ ] D+15: marca como "Inadimplente"
  - [ ] Pagamento confirmado entre steps → para a régua
  - [ ] Idempotência: UNIQUE (charge_id, step)
  - [ ] CRON_SECRET via Vault
  - [ ] Opt-out respeitado
  - [ ] Ver US-105, architecture.md §8.3

### Task 5.6 — Painel de inadimplentes
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 5.3
- **Stories cobertas:** US-106
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/financeiro/inadimplentes/page.tsx`, `src/components/financial/DefaultersList.tsx`
- **Resultado esperado:** Lista de pacientes com cobranças vencidas: nome, valor total em aberto, cobrança mais antiga, qtd de cobranças vencidas. Click → detalhes. Paginação acima de 20. Estado vazio: "Nenhum paciente inadimplente."
- **Critérios de aceite:**
  - [ ] Lista com nome, valor total, dias de atraso, qtd cobranças
  - [ ] Click → detalhes das cobranças vencidas
  - [ ] Paginação acima de 20 itens
  - [ ] Estado vazio positivo
  - [ ] Ver wireframe A.13, US-106

### Task 5.7 — Histórico de pagamentos do paciente
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 5.3, Task 3.5
- **Stories cobertas:** US-107
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/pagamentos/page.tsx`, `src/components/financial/PatientPaymentHistory.tsx`
- **Resultado esperado:** Lista de cobranças do paciente ordenadas por data (recente primeiro). Badges: "Pendente" + botão "Pagar" (link Asaas), "Pago" + botão "Ver Recibo", "Vencida" + botão "Regularizar". Cobranças de assinatura marcadas como "Pacote Mensal". RLS obrigatório.
- **Critérios de aceite:**
  - [ ] Paciente vê apenas suas cobranças (RLS)
  - [ ] Badges por status com cores adequadas
  - [ ] Botão "Pagar" abre link do Asaas
  - [ ] Botão "Ver Recibo" disponível para pagas (Sprint 8)
  - [ ] Estado vazio: "Nenhum pagamento registrado"
  - [ ] Ver wireframe B.06, US-107

---

## Sprint 6 — Sala de Vídeo & LiveKit

**Objetivo da sprint:** Paciente testa dispositivos, entra na sala de espera, é admitido pela psicóloga, sessão de vídeo 1:1 funciona com áudio e vídeo bidirecionais, psicóloga faz anotações cifradas no painel lateral, reconexão automática em <5s. Isolamento comprovado: paciente A nunca acessa sala do paciente B (Gate 5.5).
**Pré-requisitos:** Sprint 5 concluída (sessões no banco, cobranças existem)
**Definition of Done:**
- Teste de câmera/mic funciona em Chrome, Firefox, Safari, Edge
- Paciente entra na sala de espera sem consumir minutos do LiveKit
- Psicóloga admite → token LiveKit emitido → vídeo inicia em <5s
- Anotações cifradas com envelope (AAD = patient_id|session_id), auto-save a cada 5s
- Reconexão automática em <5s para quedas momentâneas, timeout 30s
- Gate 5.5: teste (a)–(g) — paciente A não acessa sala de B (SecurityReview §13.3)
- Token LiveKit apenas em memória (estado React) — nunca localStorage/sessionStorage
- Nenhum dado de vídeo armazenado (sem gravação)

**Riscos:**
- Free tier do LiveKit (5.000 min/mês) — monitorar uso; ~83h = ~4 sessões/dia de 1h (suficiente para MVP)
- Compatibilidade de WebRTC em Safari mobile pode ter quirks — testar early
- Latência de polling da sala de espera (paciente poll, psicóloga Realtime) precisa ser calibrada

### Task 6.1 — Teste de câmera e microfone (preflight)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 2.5 (VideoLayout)
- **Stories cobertas:** US-201
- **Arquivos esperados:**
  - Criar: `src/app/(video)/sala/[sessionId]/preflight/page.tsx`, `src/components/video/DeviceTest.tsx`, `src/hooks/useMediaDevices.ts`
- **Resultado esperado:** Preview da câmera em tempo real, indicador de nível do microfone (barra animada), seletor de dispositivos (câmera, mic, alto-falante). Sem permissão → instrução visual. Sem câmera → permite prosseguir (só áudio). Sem mic → bloqueia avanço. Mobile: câmera frontal como padrão.
- **Critérios de aceite:**
  - [ ] Preview de câmera em tempo real
  - [ ] Indicador de nível de áudio do microfone
  - [ ] Seletor de dispositivo funcional
  - [ ] Sem permissão → mensagem com instrução
  - [ ] Sem mic → bloqueia com mensagem clara
  - [ ] Botão "Tudo certo, entrar na sala" avança para espera
  - [ ] Funciona em Chrome, Firefox, Safari, Edge
  - [ ] Ver wireframe C.01, US-201

### Task 6.2 — Sala de espera (RPC + polling)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 6.1
- **Stories cobertas:** US-202
- **Arquivos esperados:**
  - Criar: `src/app/(video)/sala/[sessionId]/espera/page.tsx`, `src/components/video/WaitingRoom.tsx`, `src/hooks/useWaitingRoom.ts`
- **Resultado esperado:** Paciente chama RPC `enter_waiting_room(session_id)` que escreve SO `waiting_since`. Paciente faz polling do próprio registro sob RLS. Psicóloga recebe notificação Realtime. Vídeo/áudio desligados na espera (não consome minutos LiveKit). Cada sessão é um room separado — isolamento total. >10 min sem admissão → mensagem; >20 min → opção de sair.
- **Critérios de aceite:**
  - [ ] Presença marcada via RPC enter_waiting_room (não UPDATE direto)
  - [ ] Paciente faz polling (TanStack Query com refetchInterval)
  - [ ] Psicóloga vê notificação Realtime quando paciente chega
  - [ ] Vídeo/áudio não ativados na espera
  - [ ] Nenhum token LiveKit emitido antes da admissão
  - [ ] Manipulação de URL → "Você não tem acesso a esta sala"
  - [ ] 10 min → mensagem; 20 min → opção de sair
  - [ ] Ver wireframe C.02, US-202, ADR-0002

### Task 6.3 — Admissão e emissão de token LiveKit
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 6.2
- **Stories cobertas:** US-203
- **Arquivos esperados:**
  - Criar: `src/components/video/AdmissionPanel.tsx`
  - Modificar: `supabase/functions/issue-livekit-token/index.ts` (já existe estrutura)
- **Resultado esperado:** Psicóloga vê lista de pacientes aguardando com nome, horário, tempo de espera. Botão "Admitir" chama RPC `admit_patient(session_id)` → escreve SO `admitted_at`. Após admissão, Edge Function `issue-livekit-token` emite token JWT para ambos (psicóloga e paciente) com room_name da sessão. Se sessão em andamento → aviso "Finalize antes de admitir".
- **Critérios de aceite:**
  - [ ] Admissão via RPC admit_patient (não UPDATE direto)
  - [ ] RPC verifica role = psychologist no banco
  - [ ] Token LiveKit emitido via Edge Function com verify_jwt=true
  - [ ] Token contém room_name correto, identity do usuário
  - [ ] Paciente que saiu da espera → "Paciente não está mais na sala"
  - [ ] Nenhum paciente → "Nenhum paciente aguardando"
  - [ ] Ver wireframe C.03, US-203, architecture.md §8.2

### Task 6.4 — Sessão de vídeo 1:1
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 6.3
- **Stories cobertas:** US-204
- **Arquivos esperados:**
  - Criar: `src/app/(video)/sala/[sessionId]/page.tsx`, `src/components/video/VideoRoom.tsx`, `src/components/video/VideoControls.tsx`, `src/hooks/useLiveKitRoom.ts`
- **Resultado esperado:** Vídeo 1:1 via LiveKit SDK React. Controles: ligar/desligar câmera, ligar/desligar mic, "Encerrar Sessão". Psicóloga encerra → ambos desconectados, paciente vê "Sessão encerrada. Até a próxima!", psicóloga vai para registro de evolução. Paciente sai → sessão não encerra (psicóloga decide). Indicador de qualidade de conexão. >2h → aviso à psicóloga. Token LiveKit APENAS em memória (estado React).
- **Critérios de aceite:**
  - [ ] Vídeo bidirecional funcional
  - [ ] Controles de câmera, mic e encerramento
  - [ ] Psicóloga encerra → redirect para evolução (Sprint 7)
  - [ ] Paciente sai → confirmação, sessão continua
  - [ ] Câmera desligada → avatar/inicial do nome
  - [ ] Indicador de qualidade (latência > 500ms → amarelo/vermelho)
  - [ ] Token LiveKit em memória apenas (proibido localStorage)
  - [ ] Vídeo inicia em <5s após admissão
  - [ ] Mobile: vídeo ocupa área máxima
  - [ ] Ver wireframe C.04, US-204

### Task 6.5 — Anotações laterais (cifradas)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 6.4
- **Stories cobertas:** US-205
- **Arquivos esperados:**
  - Criar: `src/components/video/SessionNotes.tsx`, `src/hooks/useSessionNotes.ts`
  - Modificar: `src/lib/actions/sessions.ts` (adicionar save/load de drafts cifrados)
- **Resultado esperado:** Painel lateral (~30% desktop, fullscreen mobile). Texto puro, auto-save a cada 5s via Server Action com `runtime='nodejs'`. Conteúdo cifrado com envelope (AAD = `patient_id|session_id`). Salvamento em `session_note_drafts`. Paciente NÃO vê (nunca transmitido via LiveKit). Ao encerrar sessão, rascunho pré-carregado na evolução. Proibido localStorage/sessionStorage para rascunho.
- **Critérios de aceite:**
  - [ ] Painel abre sem cobrir vídeo em desktop
  - [ ] Mobile: modal fullscreen com vídeo minimizado
  - [ ] Auto-save a cada 5s (cifrado no servidor)
  - [ ] Conteúdo NÃO transmitido via LiveKit data channel
  - [ ] Proibido localStorage/sessionStorage (architecture.md §16 regra 16)
  - [ ] Rascunho disponível na evolução (Sprint 7)
  - [ ] Conexão cai → rascunho preservado no servidor
  - [ ] Ver wireframe C.05, US-205, architecture.md §9.2

### Task 6.6 — Reconexão automática
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 6.4
- **Stories cobertas:** US-206
- **Arquivos esperados:**
  - Modificar: `src/hooks/useLiveKitRoom.ts` (adicionar handlers de reconexão)
  - Modificar: `src/components/video/VideoRoom.tsx` (UI de reconexão)
- **Resultado esperado:** LiveKit SDK reconnect nativo ativado. Queda → "Conexão perdida. Reconectando..." com indicador. Outro participante vê "[Nome] perdeu a conexão." Reconexão em <5s para quedas momentâneas. Timeout 30s → botões "Tentar Novamente" e "Sair". Ambos reconectam → sessão continua normalmente.
- **Critérios de aceite:**
  - [ ] Reconexão automática iniciada pelo SDK
  - [ ] Mensagem de status para ambos os participantes
  - [ ] Reconexão em <5s para quedas curtas
  - [ ] Timeout 30s → opções manuais
  - [ ] Anotações preservadas após reconexão
  - [ ] Ver US-206

### Task 6.7 — Gate 5.5: Teste de isolamento de sala
- **Tipo:** test
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 6.4
- **Stories cobertas:** US-202, US-204 (critério de aceite de segurança)
- **Arquivos esperados:**
  - Criar: script de teste E2E (Playwright ou manual documentado)
- **Resultado esperado:** Teste de aceitação (a)–(g) do Security Review §13.3 que prova isolamento total entre pacientes. Inclui: (a) paciente A não vê paciente B na espera, (b) paciente A não entra no room de B, (c) manipulação de URL não funciona, (d) token de A não conecta ao room de B, (e) RLS impede SELECT de sessão alheia, (f) RPC valida ownership, (g) encerramento não afeta outra sessão.
- **Critérios de aceite:**
  - [ ] (a) Paciente A na espera não vê paciente B
  - [ ] (b) Paciente A não consegue entrar no room de B
  - [ ] (c) Manipulação de URL de sessão → "Sem acesso"
  - [ ] (d) Token LiveKit de A não conecta ao room de B (room_name diferente)
  - [ ] (e) SELECT de sessão alheia retorna vazio (RLS)
  - [ ] (f) enter_waiting_room com session_id de outro paciente → erro
  - [ ] (g) Encerramento de sessão A não afeta sessão B
  - [ ] Ver architecture.md §13.3, security-review-architecture.md Gate 5.5

---

## Sprint 7 — Prontuário & Registros Clínicos

**Objetivo da sprint:** Psicóloga registra evolução pós-sessão com conteúdo cifrado, anamnese preenchida pelo paciente com dados sensíveis cifrados, histórico clínico com decrypt-then-filter, avaliação de viabilidade técnica (E6), e audit log consultável. Toda leitura de conteúdo clínico decifrado é transacional com o audit log (DoD-1).
**Pré-requisitos:** Sprint 6 concluída (sessões de vídeo encerradas geram evolução)
**Definition of Done:**
- Evolução salva com criptografia envelope AES-256-GCM (AAD = patient_id|record_id)
- Rascunho da sessão pré-carregado na evolução
- Anamnese cifrada, paciente edita sua própria (RLS)
- Histórico com busca decrypt-then-filter
- DoD-1: SELECT + log_audit na mesma transação — se log falhar, dados não retornam
- `runtime='nodejs'` em rotas que usam node:crypto
- `force-dynamic` + `no-store` em rotas que decifram (architecture.md §18 requisito 4)
- Avaliação de viabilidade (E6): append-only, versionada, cifrada
- Audit log visível para psicóloga com paginação
- `select()` com lista explícita de colunas em tabelas cifradas (architecture.md §18 requisito 6)

**Riscos:**
- Decrypt-then-filter pode ser lento com muitas evoluções (>50) — paginação obrigatória, lazy loading
- Busca textual em conteúdo cifrado é decrypt-then-filter por definição — sem índice em plaintext

### Task 7.1 — Registro de evolução (cifrado)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 1.5 (crypto), Task 6.5 (rascunho)
- **Stories cobertas:** US-401, US-404
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/pacientes/[id]/evolucao/page.tsx`, `src/components/clinical/EvolutionForm.tsx`, `src/lib/actions/clinical-records.ts`, `src/schemas/clinical-record.ts`
- **Resultado esperado:** Formulário: data da sessão (pré-preenchida), duração (calculada), evolução/observações (texto livre, pré-carregado com rascunho se houver), humor/estado geral (seleção). Conteúdo cifrado com envelope AES-256-GCM antes de persistir. Rascunho da sessão deletado na mesma transação. `runtime='nodejs'` e `force-dynamic` na rota. Versionamento em `clinical_record_versions` ao editar.
- **Critérios de aceite:**
  - [ ] Conteúdo cifrado com envelope (AAD = patient_id|record_id)
  - [ ] Rascunho pré-carregado se existir (decifrado server-side)
  - [ ] Rascunho deletado na transação de salvamento
  - [ ] Auto-save do rascunho a cada 30s (cifrado no servidor)
  - [ ] Edição gera nova entrada em clinical_record_versions
  - [ ] `export const runtime = 'nodejs'`
  - [ ] `export const dynamic = 'force-dynamic'`
  - [ ] Server Action usa withPsychologist
  - [ ] Paciente NÃO vê evolução (sem policy de SELECT)
  - [ ] Ver wireframe A.16, US-401, architecture.md §9

### Task 7.2 — Anamnese do paciente (cifrada)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 1.5 (crypto), Task 3.5 (portal)
- **Stories cobertas:** US-402
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/anamnese/page.tsx`, `src/components/clinical/AnamnesisForm.tsx`, `src/schemas/anamnesis.ts`, `src/lib/actions/anamnesis.ts`
- **Resultado esperado:** Formulário no portal do paciente: motivo da busca por terapia, histórico de tratamento anterior, uso de medicação, condições de saúde, contato de emergência, observações. Campos sensíveis (medicação, condições, emergência) cifrados com envelope. Paciente pode editar; versão anterior mantida. Psicóloga vê na ficha do paciente.
- **Critérios de aceite:**
  - [ ] Campos clínicos cifrados com envelope (AAD = patient_id|anamnesis_id)
  - [ ] Paciente vê/edita sua anamnese (RLS)
  - [ ] Psicóloga vê anamnese com aal2 (decifrada server-side)
  - [ ] Campos obrigatórios: motivo e contato de emergência
  - [ ] Aviso no portal se não preenchida: "Preencha sua ficha inicial"
  - [ ] `runtime='nodejs'` na rota
  - [ ] Ver wireframe B.08, US-402

### Task 7.3 — Histórico clínico (decrypt-then-filter)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 7.1, Task 7.2
- **Stories cobertas:** US-403, US-405
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/pacientes/[id]/page.tsx` (ficha com tabs), `src/components/clinical/ClinicalHistory.tsx`, `src/components/clinical/AuditLogViewer.tsx`
- **Resultado esperado:** Ficha do paciente com tabs: Info, Anamnese, Histórico, Financeiro, Log. Histórico: lista cronológica de evoluções (mais recente primeiro), preview de 2 linhas, click expande. Busca por decrypt-then-filter. Paginação: 20 por página. DoD-1: cada visualização executa SELECT + log_audit na mesma transação. `force-dynamic` + `no-store`. `runtime='nodejs'`. Cada acesso gera registro VIEW_RECORD no audit log.
- **Critérios de aceite:**
  - [ ] Tabs funcionais: Info, Anamnese, Histórico, Financeiro, Log
  - [ ] Evoluções listadas cronologicamente (recente primeiro)
  - [ ] Click expande texto completo (decifrado server-side)
  - [ ] Busca: decrypt-then-filter em server-side
  - [ ] DoD-1: SELECT + log_audit na mesma transação (BEGIN...COMMIT ou RPC wrapper)
  - [ ] Paginação "Carregar mais" a cada 20
  - [ ] `Cache-Control: private, no-store, max-age=0, must-revalidate`
  - [ ] `export const dynamic = 'force-dynamic'`, `export const fetchCache = 'force-no-store'`
  - [ ] Ver wireframe A.15 (ficha), US-403, US-405, DoD-1

### Task 7.4 — Avaliação de viabilidade técnica (E6)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 7.1
- **Stories cobertas:** nenhuma diretamente (requisito E6 — Resolução CFP 09/2024)
- **Arquivos esperados:**
  - Criar: `src/components/clinical/RemoteViabilityForm.tsx`
  - Modificar: `src/app/(psychologist)/pacientes/[id]/page.tsx` (tab na ficha)
  - Modificar: `src/lib/actions/clinical-records.ts` (adicionar ação de viabilidade)
- **Resultado esperado:** Registro estruturado por paciente: veredicto de adequação ao formato remoto (sim/não), justificativa (texto cifrado), data. Versionado (append-only, version_number). Cifrado com envelope (AAD = patient_id|assessment_id). Nenhum CHECK automático de elegibilidade (E8) — a decisão é clínica. Visível na ficha do paciente, tab "Viabilidade".
- **Critérios de aceite:**
  - [ ] Formulário com veredicto (sim/não), justificativa (texto), data
  - [ ] Conteúdo cifrado com envelope
  - [ ] Append-only (triggers bloqueiam UPDATE/DELETE)
  - [ ] Versionamento: nova avaliação incrementa version_number
  - [ ] Nenhuma validação automática de caso (E8)
  - [ ] aal2 obrigatório
  - [ ] Ver emendas E6, E8, data-architecture.md §remote_viability_assessments

### Task 7.5 — Visualizador de audit log
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 7.3
- **Stories cobertas:** US-405
- **Arquivos esperados:**
  - Criar: `src/components/clinical/AuditLogTable.tsx`
  - Modificar: `src/app/(psychologist)/pacientes/[id]/page.tsx` (tab Log)
- **Resultado esperado:** Tab "Log de Acesso" na ficha do paciente. Lista cronológica de acessos ao prontuário: ator, ação, timestamp, IP. Paginação a cada 50 entradas. Log imutável — apenas leitura. Sem conteúdo clínico no log (apenas metadados).
- **Critérios de aceite:**
  - [ ] Lista cronológica de eventos do audit log filtrada por patient_id
  - [ ] Colunas: data/hora, ação, ator, IP
  - [ ] Paginação a cada 50
  - [ ] Sem conteúdo clínico nos registros
  - [ ] Somente psicóloga vê (RLS)
  - [ ] Ver US-405

### Task 7.6 — Ficha do paciente (consolidação)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 7.1, Task 7.2, Task 7.3
- **Stories cobertas:** US-002 (visualização), US-402 (visualização), US-403
- **Arquivos esperados:**
  - Modificar: `src/app/(psychologist)/pacientes/[id]/page.tsx` (consolidar todas as tabs)
- **Resultado esperado:** Ficha completa do paciente com dados cadastrais, anamnese (decifrada), histórico clínico, financeiro (cobranças vinculadas), avaliação de viabilidade e audit log. Ações: registrar evolução, encerrar atendimento, reenviar convite. Status: Ativo, Convite pendente, Encerrado.
- **Critérios de aceite:**
  - [ ] Todas as tabs integradas e funcionais
  - [ ] Dados sensíveis decifrados server-side
  - [ ] Ação "Encerrar atendimento" → treatment_ended_at + retention_until (5 anos)
  - [ ] Ação "Registrar evolução" → redirect para formulário
  - [ ] Cache-Control: private, no-store
  - [ ] Ver wireframe A.15

---

## Sprint 8 — Dashboard, Recibos & Finalização

**Objetivo da sprint:** Dashboard financeiro com KPIs em tempo real, recibos IRPF numerados com PDF gerado por lib JS pura, soft delete com retenção enforced, direito do titular LGPD, security headers completos, rate limiting, anchor do audit log e preparação final para deploy.
**Pré-requisitos:** Sprint 7 concluída
**Definition of Done:**
- Dashboard exibe: total recebido, a receber, inadimplente, projeção do mês (recharts)
- Recibo IRPF em PDF com numeração sequencial, CRP da psicóloga, CPF do paciente
- PDF gerado por pdfkit ou pdf-lib (proibido puppeteer/chromium) — architecture.md §18 requisito 10
- Download autenticado com `Content-Disposition: attachment`, `Cache-Control: no-store`
- Soft delete funcional: DELETE durante retenção bloqueado, reativação possível
- Solicitação LGPD registrada com prazo de 15 dias úteis
- Export LGPD: dados cadastrais, financeiros, sessões (sem conteúdo clínico)
- Security headers completos (CSP com nonce, HSTS, X-Frame-Options, etc.)
- Rate limiting em: login, reenvio de convite, issue-livekit-token, /confirmar/*, solicitação LGPD
- Anchor do audit log: cron semanal exporta último hash + contagem
- DoD-2 aplicado: cancellation_reason e metadata validados
- `npm audit --audit-level=high` sem vulnerabilidades
- Toda a aplicação funcional em mobile (320px+)

**Riscos:**
- Numeração de recibos sob concorrência — receipt_counters com SELECT FOR UPDATE (ADR-0005)
- CSP com nonce pode quebrar scripts inline do LiveKit — testar exaustivamente
- Rate limiting em Edge Functions (Deno) pode exigir abordagem diferente de Node.js

### Task 8.1 — Dashboard financeiro com KPIs
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.3 (pagamentos conciliados)
- **Stories cobertas:** US-101
- **Arquivos esperados:**
  - Criar: `src/app/(psychologist)/dashboard/page.tsx`, `src/components/financial/KpiCards.tsx`, `src/components/financial/RevenueChart.tsx`, `src/components/financial/RecentCharges.tsx`, `src/hooks/useDashboard.ts`
- **Resultado esperado:** 4 KPI cards: total recebido (R$), total a receber, total inadimplente, projeção do mês. Variação percentual vs. mês anterior. Filtro por mês/ano. Click em "Inadimplentes" → painel de inadimplentes. Gráfico de receita (recharts). Lista de cobranças recentes. Renderiza em <2s com até 500 cobranças. Mobile: KPIs empilham verticalmente.
- **Critérios de aceite:**
  - [ ] 4 KPIs com valores em R$ formatados (R$ X.XXX,XX)
  - [ ] Variação percentual vs. mês anterior
  - [ ] Filtro por período funcional
  - [ ] Gráfico de receita (recharts, BarChart ou LineChart)
  - [ ] Click "Inadimplentes" → redirect /financeiro/inadimplentes
  - [ ] Estado vazio: "Nenhuma cobrança registrada"
  - [ ] Renderiza em <2s
  - [ ] Mobile: cards empilham verticalmente
  - [ ] Ver wireframe A.05, US-101

### Task 8.2 — Recibo IRPF (PDF numerado + download)
- **Tipo:** feat
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Task 5.3 (pagamentos confirmados)
- **Stories cobertas:** US-406
- **Arquivos esperados:**
  - Criar: `src/app/api/receipts/[id]/download/route.ts`, `src/app/(psychologist)/financeiro/recibos/page.tsx`, `src/app/(patient)/portal/documentos/page.tsx`, `src/components/financial/ReceiptList.tsx`, `src/lib/actions/receipts.ts`
- **Resultado esperado:** Recibo gerado automaticamente quando webhook confirma pagamento. Conteúdo: número sequencial (XXX/AAAA), nome e CPF da psicóloga, CRP, nome e CPF do paciente, descrição "Sessão de atendimento psicológico online", data, valor, forma de pagamento. PDF via pdfkit ou pdf-lib (proibido puppeteer). Numeração transacional com `receipt_counters` + SELECT FOR UPDATE. Download autenticado com `Content-Disposition: attachment`, `Cache-Control: private, no-store`. Estorno → recibo marcado "Cancelado".
- **Critérios de aceite:**
  - [ ] Recibo gerado automaticamente na conciliação de pagamento
  - [ ] Número sequencial sem lacunas (receipt_counters + FOR UPDATE)
  - [ ] PDF contém: número, CPFs, CRP, descrição, data, valor
  - [ ] PDF gerado por lib JS pura (proibido puppeteer)
  - [ ] Download: runtime='nodejs', Content-Disposition: attachment, Cache-Control: no-store
  - [ ] Psicóloga vê lista de recibos com filtro (TanStack Table)
  - [ ] Paciente vê "Meus Documentos" com recibos para download
  - [ ] Estorno → recibo "Cancelado" (não deletado)
  - [ ] RLS: paciente só vê seus recibos
  - [ ] Ver wireframe A.12, B.09, US-406, ADR-0005

### Task 8.3 — Soft delete, retenção e encerramento de atendimento
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Task 7.6 (ficha do paciente)
- **Stories cobertas:** US-407
- **Arquivos esperados:**
  - Modificar: `src/lib/actions/patients.ts` (adicionar encerramento)
  - Modificar: `src/app/(psychologist)/pacientes/[id]/page.tsx` (ação de encerrar)
- **Resultado esperado:** Psicóloga marca "Encerrar atendimento" → `treatment_ended_at = now()`, `retention_until = treatment_ended_at + 5 anos` (trigger auto-calcula). DELETE físico bloqueado por trigger durante retenção. Paciente encerrado não aparece na listagem ativa (WHERE deleted_at IS NULL). Reativação possível (limpar treatment_ended_at). Após retention_until, psicóloga recebe opção de eliminar.
- **Critérios de aceite:**
  - [ ] Encerramento seta treatment_ended_at + retention_until calculado
  - [ ] DELETE durante retenção → bloqueado por trigger
  - [ ] Paciente encerrado não aparece na lista ativa
  - [ ] Prontuário ainda acessível com indicação "Encerrado em [data]"
  - [ ] Reativação limpa treatment_ended_at e recalcula retenção
  - [ ] Ver US-407, data-architecture.md §patients

### Task 8.4 — Direito do titular LGPD (solicitação + export)
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 7.6, Task 3.6
- **Stories cobertas:** US-408
- **Arquivos esperados:**
  - Criar: `src/app/(patient)/portal/dados/solicitar/page.tsx`, `src/components/patients/DataRequestForm.tsx`
  - Modificar: `src/lib/actions/patients.ts` (adicionar data export)
- **Resultado esperado:** Paciente solicita cópia dos dados → registrado em `data_subject_requests` com prazo de 15 dias úteis. Psicóloga recebe notificação. Botão "Gerar Export" → JSON/PDF com: dados cadastrais, sessões (datas/durações), pagamentos, recibos, termos aceitos. SEM conteúdo clínico (evolução é sigilosa). Export gerado on-demand, download autenticado, signed URL de vida curta se persistido, artefato expirável, registrado em audit log (architecture.md §18 requisito 12).
- **Critérios de aceite:**
  - [ ] Solicitação registrada com prazo de 15 dias úteis
  - [ ] Solicitação pendente → nova bloqueada
  - [ ] Psicóloga notificada
  - [ ] Export NÃO inclui conteúdo clínico (CLAUDE.md)
  - [ ] Prazo expirado → lembrete à psicóloga
  - [ ] Download autenticado, artefato expirável
  - [ ] Rate limiting na solicitação (architecture.md §18 requisito 7)
  - [ ] Ver US-408, architecture.md §18 requisito 12

### Task 8.5 — Security headers, CSP e rate limiting
- **Tipo:** chore
- **Estimativa:** G
- **Prioridade:** alta
- **Dependências:** Sprint 7 concluída
- **Stories cobertas:** nenhuma diretamente (requisitos não-funcionais de segurança)
- **Arquivos esperados:**
  - Modificar: `src/middleware.ts` (adicionar headers), `next.config.ts` (headers config)
- **Resultado esperado:** Headers completos conforme architecture.md §7.4: CSP com nonce por request, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy (camera/mic = self, geolocation = ()), HSTS, COOP: same-origin, X-Robots-Tag: noindex em áreas autenticadas. Rate limiting: login (5/min), reenvio de convite (3/paciente/hora), issue-livekit-token (10/usuário/min), /confirmar/* (3/token), solicitação LGPD (1/dia).
- **Critérios de aceite:**
  - [ ] CSP com nonce funcional (não quebra LiveKit, shadcn/ui, recharts)
  - [ ] X-Frame-Options: DENY
  - [ ] HSTS: max-age=31536000; includeSubDomains
  - [ ] Permissions-Policy: camera=(self), microphone=(self), geolocation=()
  - [ ] Rate limiting implementado nos 5 endpoints
  - [ ] `npm audit --audit-level=high` sem vulnerabilidades
  - [ ] Ver architecture.md §7.4, §18 requisitos 7–8

### Task 8.6 — Anchor do audit log e polimento
- **Tipo:** feat
- **Estimativa:** M
- **Prioridade:** média
- **Dependências:** Task 7.5
- **Stories cobertas:** US-405 (parcial — integridade externa)
- **Arquivos esperados:**
  - Criar: `supabase/functions/anchor-audit-log/index.ts`
  - Modificar: `src/lib/email/templates.ts` (polir todos os templates)
- **Resultado esperado:** Edge Function cron semanal (CRON_SECRET): exporta último `row_hash` + contagem + timestamp para bucket privado versionado e/ou email à psicóloga. Função de verificação recalcula cadeia entre duas âncoras. Polimento de todos os templates de email (convite, lembretes, cobrança, notificações).
- **Critérios de aceite:**
  - [ ] Cron semanal exporta âncora
  - [ ] Âncora em bucket privado versionado
  - [ ] fn_verify_audit_chain verifica entre âncoras
  - [ ] Todos os templates de email polidos (tom acolhedor, profissional)
  - [ ] Assuntos dentro da allowlist
  - [ ] Ver architecture.md §10.1

### Task 8.7 — Validação final e checklist de deploy
- **Tipo:** test
- **Estimativa:** M
- **Prioridade:** alta
- **Dependências:** Tasks 8.1 a 8.6
- **Stories cobertas:** nenhuma diretamente (qualidade final)
- **Arquivos esperados:**
  - Modificar: `Dockerfile` (ajustes finais se necessário)
  - Criar: `docs/deploy-checklist.md` (preenchido)
- **Resultado esperado:** Validação contra checklist completo de deploy (architecture.md §14.3): output standalone, package-lock versionado, npm ci --ignore-scripts, sem segredos no Dockerfile, todas env vars documentadas, robots.txt, CORS restrito, npm audit limpo, allowedOrigins correto. Alteração de email com double opt-in no novo endereço (architecture.md §18 requisito 9). Toda a aplicação funcional em mobile (320px+).
- **Critérios de aceite:**
  - [ ] Checklist de deploy (architecture.md §14.3) — todos os itens verificados
  - [ ] `docker history --no-trunc` sem segredos em nenhum layer
  - [ ] Toda a aplicação testada em 320px (mobile)
  - [ ] Alteração de email: double opt-in no novo + notificação ao antigo
  - [ ] Login/reset: mensagens genéricas (não revelam existência de conta)
  - [ ] `npm audit --audit-level=high` → 0 vulnerabilidades
  - [ ] Ver architecture.md §14.3, §18 requisitos 8–9

---

## Tabela de Rastreabilidade — Stories × Sprints

| Story | Épico | Sprint | Task(s) |
|-------|-------|--------|---------|
| US-001 | 0 — Auth | Sprint 2 | 2.6 |
| US-002 | 0 — Auth | Sprint 3 | 3.1, 3.2 |
| US-003 | 0 — Auth | Sprint 3 | 3.3 |
| US-004 | 0 — Auth | Sprint 3 | 3.4 |
| US-005 | 0 — Auth | Sprint 3 | 3.4 |
| US-006 | 0 — Auth | Sprint 3 | 3.5 |
| US-007 | 0 — Auth | Sprint 2 + Sprint 3 | 2.6 (edição), 3.6 (visão paciente) |
| US-101 | 1 — Financeiro | Sprint 8 | 8.1 |
| US-102 | 1 — Financeiro | Sprint 5 | 5.1, 5.2 |
| US-103 | 1 — Financeiro | Sprint 5 | 5.4 |
| US-104 | 1 — Financeiro | Sprint 5 | 5.1, 5.3 |
| US-105 | 1 — Financeiro | Sprint 5 | 5.5 |
| US-106 | 1 — Financeiro | Sprint 5 | 5.6 |
| US-107 | 1 — Financeiro | Sprint 5 | 5.7 |
| US-201 | 2 — Vídeo | Sprint 6 | 6.1 |
| US-202 | 2 — Vídeo | Sprint 6 | 6.2, 6.7 |
| US-203 | 2 — Vídeo | Sprint 6 | 6.3 |
| US-204 | 2 — Vídeo | Sprint 6 | 6.4, 6.7 |
| US-205 | 2 — Vídeo | Sprint 6 | 6.5 |
| US-206 | 2 — Vídeo | Sprint 6 | 6.6 |
| US-301 | 3 — Agenda | Sprint 4 | 4.1 |
| US-302 | 3 — Agenda | Sprint 4 | 4.2 |
| US-303 | 3 — Agenda | Sprint 4 | 4.3 |
| US-304 | 3 — Agenda | Sprint 4 | 4.6 |
| US-305 | 3 — Agenda | Sprint 4 | 4.7 |
| US-306 | 3 — Agenda | Sprint 4 | 4.4 |
| US-307 | 3 — Agenda | Sprint 4 | 4.4 |
| US-308 | 3 — Agenda | Sprint 4 | 4.5 |
| US-401 | 4 — Prontuário | Sprint 7 | 7.1 |
| US-402 | 4 — Prontuário | Sprint 7 | 7.2 |
| US-403 | 4 — Prontuário | Sprint 7 | 7.3, 7.6 |
| US-404 | 4 — Prontuário | Sprint 1 + Sprint 7 | 1.5 (infra), 7.1 (uso) |
| US-405 | 4 — Prontuário | Sprint 7 + Sprint 8 | 7.3, 7.5 (viewer), 8.6 (anchor) |
| US-406 | 4 — Prontuário | Sprint 8 | 8.2 |
| US-407 | 4 — Prontuário | Sprint 8 | 8.3 |
| US-408 | 4 — Prontuário | Sprint 8 | 8.4 |

**Stories fora do MVP:** Nenhuma. Todas as 36 stories estão cobertas. As funcionalidades fora do MVP (landing page, gravação, WhatsApp, app nativo, multi-profissional) não possuem stories e foram excluídas deliberadamente no PRD.

---

## Distribuição dos Requisitos do Security Review e da Arquitetura

### 12 Requisitos da Seção 18 (Architecture.md)

| # | Requisito | Sprint | Task |
|---|-----------|--------|------|
| 1 | Wrapper de autorização em toda Server Action | Sprint 1 (criação) + DoD de toda sprint | 1.6 |
| 2 | logger.ts único com allowlist | Sprint 1 | 1.6 |
| 3 | Validação de chaves no boot | Sprint 1 | 1.5 |
| 4 | no-store + force-dynamic em rotas que decifram | Sprint 7 | 7.1, 7.3 |
| 5 | /confirmar/[token]: GET renderiza, POST executa | Sprint 4 | 4.7 |
| 6 | Browser client com lista explícita de colunas | DoD de toda sprint | — |
| 7 | Rate limiting | Sprint 8 | 8.5 |
| 8 | Política de senha (mín. 10 + leaked check) | Sprint 2 | 2.1 |
| 9 | Alteração de email com double opt-in | Sprint 8 | 8.7 |
| 10 | PDF por lib JS pura | Sprint 8 | 8.2 |
| 11 | x-forwarded-for com regra de confiança | Sprint 2 | 2.4 |
| 12 | Export LGPD on-demand | Sprint 8 | 8.4 |

### 4 DoDs do Security Review do Schema (Seção 6.6)

| DoD | Descrição | Sprint | Task |
|-----|-----------|--------|------|
| DoD-1 | VIEW_RECORD transacional | Sprint 7 | 7.3 |
| DoD-2 | Sanitização de campos operacionais | Sprint 4 + Sprint 7 | 4.4, 7.5 |
| DoD-3 | Fix fn_block_delete_during_retention | Sprint 1 (verificação) | 1.4 |
| DoD-4 | Verificação column-level GRANT | Sprint 1 | 1.4 |

---

## Análise de Riscos Consolidada

| # | Risco | Probabilidade | Impacto | Sprint afetada | Mitigação |
|---|-------|--------------|---------|----------------|-----------|
| R1 | Free tier LiveKit insuficiente (5.000 min/mês) | Baixa (~83h/mês) | Médio | Sprint 6 | Monitorar uso. ~4 sessões/dia de 1h está dentro. Escalar para plano pago se necessário |
| R2 | Asaas sandbox instável | Média | Alto | Sprint 5 | retry-charges com backoff exponencial. Charges ficam pending_creation até sucesso |
| R3 | Decrypt-then-filter lento (>50 evoluções) | Média | Médio | Sprint 7 | Paginação obrigatória (20/página). Busca em batches. Sem índice em plaintext (trade-off aceito no ADR-0001) |
| R4 | Column-level GRANT ineficaz no Supabase | Média | Alto | Sprint 1 | DoD-4 detecta. Solução: table-level REVOKE + column-level GRANT (já no SQL). Verificar default privileges |
| R5 | CSP com nonce quebra LiveKit/recharts | Média | Médio | Sprint 8 | Testar CSP exaustivamente antes de produção. Fallback: unsafe-inline temporário com TODO |
| R6 | Safari mobile WebRTC quirks | Média | Alto | Sprint 6 | Testar em Safari iOS early na Sprint 6. Documentar workarounds conhecidos |
| R7 | Receipt counter deadlock sob concorrência | Baixa (prática solo) | Baixo | Sprint 8 | SELECT FOR UPDATE é suficiente. Volume ~20 recibos/mês |
| R8 | Supabase MFA TOTP exige config manual | Baixa | Médio | Sprint 2 | Verificar dashboard Supabase Auth antes de implementar. Habilitar TOTP factor |

**Sprint mais arriscada:** Sprint 6 (Sala de Vídeo) — combina WebRTC (compatibilidade cross-browser), LiveKit SDK (SDK client + server), RPCs de estado sensível (waiting room, admission), e o Gate 5.5 (teste de isolamento obrigatório). Falha em qualquer um desses componentes bloqueia a sprint.

---

## Decisões Tomadas pelo Backlog Agent

1. **Financeiro antes de Vídeo (Sprint 5 antes de Sprint 6):** A dor #1 da psicóloga é descontrole financeiro. Cobranças funcionando cedo entrega mais valor. O vídeo pode esperar porque a psicóloga continua usando Meet/WhatsApp em paralelo.

2. **Dashboard na Sprint 8 (não na Sprint 5):** O dashboard depende de dados financeiros acumulados. Colocá-lo na última sprint garante que ele mostra dados reais e permite validar os KPIs com dados de teste de sprints anteriores.

3. **Recibos na Sprint 8 (não na Sprint 5):** Recibos dependem de pagamentos confirmados E da infraestrutura de criptografia (CPF do paciente). Concentrar na última sprint evita dependências circulares.

4. **US-304 e US-305 combinados na Sprint 4:** Lembretes e confirmação são funcionalidades acopladas — o link de confirmação está no email do lembrete. Separá-los em sprints diferentes não faz sentido funcional.

5. **US-404 dividida entre Sprint 1 (infra) e Sprint 7 (uso):** A criptografia é cross-cutting. A fundação (keys.ts, envelope.ts) é Sprint 1; o uso em clinical_records é Sprint 7.

6. **Gate 5.5 como task explícita (não item de QA genérico):** O Security Review exige teste (a)–(g) como condição de aprovação da sprint de vídeo. Sem essa task explícita, o risco é que o QA não cubra todos os 7 cenários.

---

## Histórico de Versões

| Versão | Data | Mudança |
|--------|------|---------|
| 1.0 | 2026-09-09 | Versão inicial — 8 sprints, 54 tasks, 36 stories cobertas |

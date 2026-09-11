# Status: talitha-psicologia

> ## RETOMADA — sessão de 2026-09-10 encerrada aqui
>
> **Onde paramos:** Sprint 5 (Financeiro e Asaas) implementada e corrigida. Os 5 blockers do Code Review foram resolvidos e as Edge Functions redeployadas. **O re-review da rodada 2 estava em execução quando a sessão encerrou** — o veredicto não chegou.
>
> ### PRIMEIRA AÇÃO ao retomar
> 1. Rodar o **Code Review rodada 2 da Sprint 5** (o anterior não concluiu). Foco: se o Asaas realmente reenvia webhook nos códigos 422 e 500 que o Stack Agent escolheu — se ele só reenviar em 5xx, a correção do B2 é ilusória.
> 2. Rodar o **QA da Sprint 5** — nunca rodou. O teste que importa: criar cobrança no sandbox, confirmar o pagamento pelo botão do Asaas, e verificar se o webhook chega e concilia. Todo o resto do módulo financeiro depende disso funcionar.
> 3. Só então **mergear na `main`** e abrir a Sprint 6.
>
> ### NÃO mergear a Sprint 5 na main antes do veredicto
> A branch `feature/sprint-5-financial` tem 7 commits e está no GitHub. A `main` tem 49 commits com as Sprints 1 a 4 aprovadas. Mergear sem o re-review quebraria o fluxo que encontrou 14 bugs de segurança nesta sessão — inclusive os 5 blockers desta própria sprint.
>
> ### Estado da infraestrutura (tudo funcionando e validado por execução)
> | Item | Estado |
> |---|---|
> | Migrations | **21 aplicadas** no Supabase real |
> | Edge Functions | **8 deployadas**: send-reminders, asaas-webhook, create-charge, create-subscription, cancel-subscription, manage-asaas-customer, retry-charges, billing-rules |
> | Cron (pg_cron) | **3 jobs ativos** — lembretes 15min, régua 9h BRT, cleanup diário. Timeout de 30s (cold start estourava os 5s default) |
> | Webhook Asaas | **Registrado no sandbox**, 6 eventos, authToken configurado |
> | Política de senha | mín. 10 + letra + dígito aplicados. HIBP fora (exige plano Pro) |
> | Testes | **422 passando** |
>
> ### Pendências de schema reportadas e NÃO resolvidas
> - `charges.invoice_url TEXT` — para guardar a URL de pagamento que o Asaas retorna, em vez de derivar
> - `subscriptions.payment_method TEXT` — o W7 ficou parcial; a EF usa PIX fixo até a coluna existir
>
> ### Pendências do dev (não bloqueiam as sprints)
> - Recolocar no `credentials.md`: login das contas LiveKit e Resend, e o SIP URI (perdidos na sobrescrita do script na Sprint 2)
> - Trocar a senha de login da conta Resend (apareceu no transcript)
> - **Access token do Supabase vence 31/12** — depois disso, deploy de Edge Function e `secrets set` param de funcionar
>
> ### Próximas sprints
> **6 — Vídeo (LiveKit).** A que o cliente mais quis. Tem o gate mais rigoroso do projeto: o teste (a)–(g) que prova que o paciente A não entra na sala do paciente B. Esse gate **bloqueia** a sprint. Os secrets do LiveKit já estão configurados no Supabase.
> **7 — Prontuário.** Primeiro uso clínico real do envelope encryption. O `envelopeToBytea` já existe e tem teste de round-trip.
> **8 — Dashboard, recibos e deploy.** Inclui as pendências diferidas: `pending` órfão no retry de lembrete, claim atômico, batch limit da Edge Function.

---

## Fase atual: Execucao -- Sprint 5 CODE REVIEW REPROVADO (5B 10W 5S)
## Ultimo agente: Code Reviewer (Sprint 5)
## Branch: feature/sprint-5-financial

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.9 (docs/talitha-data-architecture.md + supabase/migrations/)
- Security Review (schema): APROVADO
- Backlog: CONCLUIDO (docs/talitha-backlog.md)

### Sprint 1: Fundacao -- ENCERRADA
- Task 1.1-1.7: CONCLUIDAS
- Code Review: APROVADO
- QA: APROVADO (91 testes, 90 passando)
- 4 patches aplicados

### Sprint 2: Autenticacao & MFA -- APROVADA COM RESSALVA
- Task 2.1: Login e callback de autenticacao -- CONCLUIDA
- Task 2.2: MFA TOTP (setup e verificacao) -- CONCLUIDA
- Task 2.3: Recuperacao de senha -- CONCLUIDA (B1 corrigido: Server Action com aal2)
- Task 2.4: Middleware completo -- CONCLUIDA
- Task 2.5: Layouts de area (5 route groups) -- CONCLUIDA
- Task 2.6: Onboarding e perfil da psicologa -- CONCLUIDA
- Code Review 1: REPROVADO (1B + 1W) -- corrigidos
- Code Review 2: APROVADO
- QA 1: REPROVADO (F5 profiles recursion + F6 password policy)
- QA 2: APROVADO COM RESSALVA -- docs/talitha-qa-sprint-2.md

### Sprint 3: Pacientes & Consentimento -- APROVADA
- Task 3.1-3.6: CONCLUIDAS
- Code Review 1: REPROVADO (0B 2W 5S)
- Code Review 2: APROVADO
- QA: APROVADA COM RESSALVA -- docs/talitha-qa-sprint-3.md

### Sprint 4: Agenda & Lembretes -- APROVADA
- Task 4.1-4.7: CONCLUIDAS
- QA: APROVADO -- docs/talitha-qa-sprint-4.md (408 testes passando)
- Code Review 1: REPROVADO (0B 5W 6S)
- Stack Agent: W1-W5 corrigidos, S5-S6 aplicadas, S1-S2 recusadas, S3-S4 pendencias
- Code Review 2 (rodada 2): APROVADO -- docs/talitha-review-sprint-4.md

### Sprint 5: Financeiro & Asaas -- REPROVADA (Code Review)
- Task 5.1: Edge Functions infra Asaas -- Parcial (manage-asaas-customer nao grava patients.asaas_customer_id)
- Task 5.2: Cobranca avulsa -- OK
- Task 5.3: Webhook de conciliacao -- FALHA (B1 idempotencia, B2 200 silencioso, B3 subscription_charge_create_failed)
- Task 5.4: Assinatura recorrente -- FALHA (W1 status lifecycle, B4 cancel nao propaga Asaas)
- Task 5.5: Regua de cobranca -- OK
- Task 5.6: Painel de inadimplentes -- Parcial (falta paginacao)
- Task 5.7: Historico pagamentos paciente -- Parcial (URL sandbox hardcoded)
- **Code Review 1: REPROVADO** -- docs/talitha-review-sprint-5.md
  - B1: Idempotencia webhook quebrada (Date.now no event ID)
  - B2: 200 para handled events sem payment.id
  - B3: subscription_charge_create_failed retorna 200 para erros nao-duplicate
  - B4: cancelSubscription nao cancela no Asaas
  - B5: patients.asaas_customer_id nunca escrito (data-architecture v1.8/v1.9)

### Pendencias tecnicas acumuladas
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada
- S1 (Sprint 2): middleware.ts deprecation
- S4 (Sprint 2): ProfileForm exige CPF em toda edicao
- S6 (Sprint 2): Sidebar mobile sem Vaul
- S7 (Sprint 2): x-forwarded-for trust rule ausente
- S10 (Sprint 2): Considerar wrapper withAuthenticatedUser
- S11 (Sprint 2): eslint error em MfaSetup.tsx
- .env.example: pode necessitar CRON_SECRET, RESEND_API_KEY_CRON, SITE_URL
- W1 (QA Sprint 3): unused imports na Sprint 3
- S3 (CR Sprint 3): documentar consumo de convite na allowlist do Architect
- W5 (CR Sprint 4): Architect deve atualizar allowlist em architecture.md secao 6.2
- S1 (CR Sprint 4): Divergencia status pre-check app vs RPC (documentada como intencional)
- S3 (CR Sprint 4): Edge Function sem batch limit
- S4 (CR Sprint 4): timingSafeEqual manual vs nativo do Deno
- Edge Function retry: riscos residuais de pending orfao e duplicacao sob concorrencia (hardening Sprint 8)
- Deploy da Edge Function send-reminders PENDENTE
- S1 (CR Sprint 5): timingSafeEqual early return leaks length
- S2 (CR Sprint 5): manage-asaas-customer sem consent check independente
- S3 (CR Sprint 5): CPF em query parameter no Asaas search
- S4 (CR Sprint 5): timingSafeEqual duplicado em 3 EFs
- S5 (CR Sprint 5): select nativo em vez de shadcn Select

### Proximo passo
Stack agent corrige os 5 blockers + 10 warnings do Code Review Sprint 5. Code Review roda novamente.

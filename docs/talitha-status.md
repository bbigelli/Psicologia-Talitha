# Status: talitha-psicologia
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

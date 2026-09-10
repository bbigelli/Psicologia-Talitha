# Status: talitha-psicologia
## Fase atual: Execucao -- Sprint 4 implementada, aguardando Code Review
## Ultimo agente: Next.js Agent (Sprint 4)
## Branch: feature/sprint-4-schedule

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.6 (docs/talitha-data-architecture.md + supabase/migrations/)
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
- F5 corrigido: migration 121500 (fn_is_psychologist SD)
- F5b corrigido: GRANT UPDATE cipher columns
- QA 2: APROVADO COM RESSALVA -- docs/talitha-qa-sprint-2.md
- Build: PASSA
- TypeScript: PASSA
- Testes: 217 total (216 passando, 1 pulado) -- SEM REGRESSAO
- 5 patches aplicados (121200-121500)

### ALERTA: docs/credentials.md foi sobrescrito pelo seed
- O seed rodou ANTES da correcao S3 e sobrescreveu docs/credentials.md
- O arquivo agora contem apenas credenciais do seed, nao as chaves originais
- O desenvolvedor precisa restaurar o conteudo original de docs/credentials.md
  a partir do .env.local ou de outra fonte

### Pendencias (nao bloqueiam Sprint 3)
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada. Servidor aceita senhas fracas. Acao do desenvolvedor: configurar no dashboard
- S1: middleware.ts deprecation -- avaliar migracao para proxy.ts na Sprint 8
- S2: Seed nao cria registro em patients (NOT NULL cpf) -- Sprint 3
- S4: ProfileForm exige CPF em toda edicao -- schema com CPF opcional para futuro
- S6: Sidebar mobile sem Vaul (usa overlay customizado) -- consistencia futura
- S7: x-forwarded-for trust rule ausente -- Sprint 4+
- S10: Considerar wrapper withAuthenticatedUser para Server Actions role-agnostic
- S11: eslint error em MfaSetup.tsx (setState em useEffect)
- (Sprint 1) S1: ASAAS_BASE_URL ausente no .env.example

### Sprint 3: Pacientes & Consentimento -- APROVADA
- Task 3.1-3.6: CONCLUIDAS
- Code Review 1: REPROVADO (0B 2W 5S) -- W1 (version check), W2 (zod parse)
- Stack Agent: W1 e W2 corrigidos, S1/S2/S5 aplicadas, S4 recusada com motivo
- Code Review 2 (rodada 2): APROVADO -- W1 e W2 fechados, W3 (constante duplicada) registrado como pendencia obrigatoria
- QA: APROVADA COM RESSALVA -- docs/talitha-qa-sprint-3.md (BLOCKER-1 do QA ja corrigido)
- Build: PASSA
- TypeScript: PASSA
- Testes: 324 total (323 passando, 1 pulado) -- SEM REGRESSAO

### Code Review Sprint 3 -- resultado final (docs/talitha-review-sprint-3.md)
- W1 (version check): FECHADO. 3 locais verificam consent_version. Re-aceite sem loop. 7 testes
- W2 (zod parse): FECHADO. 3 actions parseiam. revokeConsentSchema criado
- **W3 (NOVO): CURRENT_CONSENT_VERSION duplicada em 3 locais sem mecanismo de sincronizacao.** Correcao: extrair para src/lib/consent-version.ts (modulo sem dependencias). OBRIGATORIO no inicio da Sprint 4
- S1 (scroll a11y): FECHADO
- S2 (audit label): FECHADO
- S3 (allowlist doc): pendencia para Architect
- S4 (date helpers): recusa aceitavel
- S5 (envelopeToBytea tipo): FECHADO -- assertion justificada
- Proposito opcional (communication): decisao aceitavel para Sprint 3. Nota: Sprint 4 deve verificar hash do texto ao enviar lembretes
- Regressao: zero (324 testes, 323 passando)

### Pendencias tecnicas acumuladas
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada
- **W3 (OBRIGATORIO Sprint 4):** Extrair CURRENT_CONSENT_VERSION para modulo proprio sem dependencias
- S1 (Sprint 2): middleware.ts deprecation
- S4 (Sprint 2): ProfileForm exige CPF em toda edicao
- S6 (Sprint 2): Sidebar mobile sem Vaul
- S7 (Sprint 2): x-forwarded-for trust rule ausente
- S10 (Sprint 2): Considerar wrapper withAuthenticatedUser
- S11 (Sprint 2): eslint error em MfaSetup.tsx
- EMAIL_FROM e RESEND_API_KEY_APP nao adicionados ao .env.example
- W1 (QA Sprint 3): unused imports na Sprint 3
- S3 (CR Sprint 3): documentar consumo de convite na allowlist do Architect
- Nota Sprint 4: verificar hash do texto de comunicacao ao enviar lembretes

### Sprint 4: Agenda & Lembretes -- IMPLEMENTADA (aguardando CR + QA)
- **W3 fix**: CONCLUIDO -- src/lib/consent-version.ts criado, 3 consumidores atualizados, 5 testes de sincronizacao
- Task 4.1: Visualizacao da agenda (semanal/diaria) -- CONCLUIDA
- Task 4.2: Criacao de sessao com recorrencia semanal -- CONCLUIDA
- Task 4.3: Bloqueio de conflito de horario -- CONCLUIDA (integrado em Task 4.2)
- Task 4.4: Cancelamento com politica de prazo e remarcacao -- CONCLUIDA
- Task 4.5: Proximas sessoes no portal do paciente -- CONCLUIDA
- Task 4.6: Lembretes automaticos (Edge Function send-reminders) -- CONCLUIDA (codigo criado, deploy PENDENTE)
- Task 4.7: Confirmacao de presenca por email -- CONCLUIDA
- Build: PASSA
- TypeScript: PASSA
- Testes: 375 passando, 1 pulado (376 total) -- SEM REGRESSAO (324 anteriores intactos + 52 novos)
- Segredos: varredura limpa, nenhum segredo hardcoded

### RPCs (migration 17, aplicada)
- `create_session` -- chamado via client autenticado (RPC deriva psychologist_id de auth.uid())
- `reschedule_session` -- chamado via client autenticado (RPC valida ownership, status, conflito)
- Admin client REMOVIDO de sessions.ts -- zero imports de createAdminClient

### Admin client restante nesta sprint (justificado)
- `src/lib/actions/confirm-action.ts` -- usuario nao autenticado (clicando link de email); email_action_tokens nao tem RLS; cancel/confirm exigem service_role
- `src/app/(auth)/confirmar/[token]/page.tsx` -- pagina publica lendo token sem auth

### Deploy pendente (Edge Function)
- `supabase/functions/send-reminders/index.ts` -- deploy via `supabase functions deploy send-reminders`
- Secrets necessarios: CRON_SECRET, RESEND_API_KEY_CRON, SITE_URL, EMAIL_FROM
- Cron job: invocar a cada 15 minutos com `Authorization: Bearer <CRON_SECRET>`
- Access token do Supabase nao configurado nesta maquina -- deploy requer acao do dev

### Decisoes tomadas pelo agente (sem consulta)
1. RPCs create_session e reschedule_session adotadas via client autenticado -- admin client removido de sessions.ts
2. Cancel via RPC existente cancel_session -- ja existia, usa diretamente. Late-cancellation prefix enviado na propria chamada da RPC (sem UPDATE separado)
3. Confirmation tokens no 24h reminder apenas (nao no 1h) -- 1h e muito tarde para confirmar/cancelar
4. Cancellation via email token usa admin client (sem auth.uid()) porque e acao anonima de link -- justificado
5. Timezone: America/Sao_Paulo explicito em todas as formatacoes -- offset -03:00 para timestamptz
6. tsconfig.json exclui supabase/functions/ (Deno, nao Node.js)
7. App-side conflict check mantido para UX (mostra qual paciente conflita) mas RPC e a garantia; erros da RPC mapeados para pt-BR via mapRpcError()

### Pendencias tecnicas acumuladas
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada
- S1 (Sprint 2): middleware.ts deprecation
- S4 (Sprint 2): ProfileForm exige CPF em toda edicao
- S6 (Sprint 2): Sidebar mobile sem Vaul
- S7 (Sprint 2): x-forwarded-for trust rule ausente
- S10 (Sprint 2): Considerar wrapper withAuthenticatedUser
- S11 (Sprint 2): eslint error em MfaSetup.tsx
- .env.example: nao pude verificar conteudo (permissao bloqueada) -- pode necessitar CRON_SECRET, RESEND_API_KEY_CRON, SITE_URL se nao presente
- W1 (QA Sprint 3): unused imports na Sprint 3
- S3 (CR Sprint 3): documentar consumo de convite na allowlist do Architect
- Deploy da Edge Function send-reminders PENDENTE

### Proximo passo
Ativar Code Review para Sprint 4. Apos CR + QA aprovados, avancar para Sprint 5 -- Financeiro & Asaas.

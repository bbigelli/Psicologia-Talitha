# Status: talitha-psicologia
## Fase atual: Execucao -- Sprint 2 QA REPROVADO (aguardando correcoes F5 + F6)
## Ultimo agente: QA (Sprint 2)
## Branch: feature/sprint-2-auth

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.5 (docs/talitha-data-architecture.md + supabase/migrations/)
- Security Review (schema): APROVADO
- Backlog: CONCLUIDO (docs/talitha-backlog.md)

### Sprint 1: Fundacao -- ENCERRADA
- Task 1.1-1.7: CONCLUIDAS
- Code Review: APROVADO
- QA: APROVADO (91 testes, 90 passando)
- 4 patches aplicados

### Sprint 2: Autenticacao & MFA -- CODE REVIEW APROVADO
- Task 2.1: Login e callback de autenticacao -- CONCLUIDA
- Task 2.2: MFA TOTP (setup e verificacao) -- CONCLUIDA (W1 corrigido: UI honesta)
- Task 2.3: Recuperacao de senha -- CONCLUIDA (B1 corrigido: Server Action com aal2)
- Task 2.4: Middleware completo -- CONCLUIDA
- Task 2.5: Layouts de area (5 route groups) -- CONCLUIDA
- Task 2.6: Onboarding e perfil da psicologa -- CONCLUIDA
- Code Review 1: REPROVADO (1B + 1W) -- docs/talitha-review-sprint-2.md
- Correcoes aplicadas: B1, W1, S3, S5, S8
- Code Review 2: APROVADO (0B, 0W) -- secao "Re-verificacao (rodada 2)" no mesmo arquivo
- Build: PASSA
- TypeScript: PASSA
- Testes: 195 total (194 passando, 1 pulado) -- SEM REGRESSAO (48 novos)
- QA: REPROVADO (1 Blocker F5 + 1 Warning F6) -- docs/talitha-qa-sprint-2.md

### ALERTA: docs/credentials.md foi sobrescrito pelo seed
- O seed rodou ANTES da correcao S3 e sobrescreveu docs/credentials.md
- O arquivo agora contem apenas credenciais do seed, nao as chaves originais
- O desenvolvedor precisa restaurar o conteudo original de docs/credentials.md
  a partir do .env.local ou de outra fonte

### Blockers (devem ser corrigidos antes de re-QA)
- **F5 (BLOCKER):** profiles RLS infinite recursion (42P17) -- `profiles_select_psychologist` faz subquery contra si propria. Impede TODA operacao autenticada em profiles e cascata para patients, sessions. Correcao: usar `auth.jwt()->'app_metadata'->>'role'` em vez de subquery
- **F5b:** Onboarding Server Action tenta UPDATE em colunas cpf_* que nao estao no GRANT UPDATE de profiles para authenticated. Adicionar ao grant ou usar RPC SECURITY DEFINER
- **F6 (WARNING):** Politica de senha no Supabase Auth dashboard NAO configurada. Servidor aceita senhas com 7 chars e senhas vazadas. Configurar no dashboard: min 10 chars + pwned check

### Pendencias tecnicas (nao bloqueantes)
- S1: middleware.ts deprecation -- avaliar migracao para proxy.ts na Sprint 8
- S2: Seed nao cria registro em patients (NOT NULL cpf) -- Sprint 3
- S4: ProfileForm exige CPF em toda edicao -- schema com CPF opcional para futuro
- S6: Sidebar mobile sem Vaul (usa overlay customizado) -- consistencia futura
- S7: x-forwarded-for trust rule ausente -- Sprint 4+ (quando audit log usar IP)
- S8: MfaSetup.tsx com 247 linhas (acima de 200, parcialmente resolvido)
- S10: Considerar wrapper withAuthenticatedUser para Server Actions role-agnostic
- S11: eslint error em MfaSetup.tsx (setState em useEffect)
- (Sprint 1) S1: ASAAS_BASE_URL ausente no .env.example

### Proximo passo
Data Architect / Stack Agent corrige F5 (RLS recursion) + F5b (column grant) + F6 (password policy dashboard).
Apos correcoes, re-QA da Sprint 2 com os mesmos 195 testes (5 testes de F5 devem mudar de "recursao esperada" para "operacao bem-sucedida").

# Status: talitha-psicologia
## Fase atual: Execucao -- Sprint 2 CODE REVIEW REPROVADO (1 Blocker, 1 Warning)
## Ultimo agente: Code Reviewer (Sprint 2)
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

### Sprint 2: Autenticacao & MFA -- CODE REVIEW REPROVADO
- Task 2.1: Login e callback de autenticacao -- CONCLUIDA
- Task 2.2: MFA TOTP (setup e verificacao) -- CONCLUIDA (Warning: recovery codes mislabeled/non-functional)
- Task 2.3: Recuperacao de senha -- BLOCKER: troca de senha sem MFA server-side
- Task 2.4: Middleware completo -- CONCLUIDA
- Task 2.5: Layouts de area (5 route groups) -- CONCLUIDA
- Task 2.6: Onboarding e perfil da psicologa -- CONCLUIDA
- Code Review: REPROVADO (docs/talitha-review-sprint-2.md)
  - B1: updateUser callable at aal1 -- mover para Server Action com withPsychologist
  - W1: Recovery codes mislabeled + non-functional -- remover feature ficticia ou implementar de verdade
- QA: PENDENTE (aguarda correcao dos blockers/warnings)

### Pendencias tecnicas (nao bloqueantes)
- S1: middleware.ts deprecation warning Next.js 16 -- avaliar na Sprint 8
- S2: Seed patients insert falha por NOT NULL constraint em cpf_ciphertext -- atualizar na Sprint 3
- S3: Seed sobrescreve credentials.md -- considerar merge ou arquivo separado
- S4: ProfileForm exige CPF em toda edicao -- criar profileUpdateSchema com CPF opcional
- S5: MfaCodeInput touch target 40px no mobile -- alterar w-10 para w-11
- S6: Sidebar mobile nao usa Vaul -- integrar em sprint futura
- S7: x-forwarded-for trust rule ausente no middleware -- implementar com audit logging
- S8: MfaSetup.tsx com 311 linhas -- extrair util e subcomponentes
- S9: Politica de senha no Supabase Auth -- QA deve verificar config do dashboard
- (Sprint 1) S1: ASAAS_BASE_URL ausente no .env.example
- (Sprint 1) S3: safeErrorCode() sem uso em producao

### Proximo passo
Stack agent corrige B1 e W1 conforme report. Code Review roda novamente.

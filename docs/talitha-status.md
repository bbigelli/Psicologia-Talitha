# Status: talitha-psicologia
## Fase atual: Planejamento CONCLUÍDO — próximo passo: execução da Sprint 1
## Último agente: Backlog Agent
## Branch: feature/planning-docs

### Planejamento
- Decisões de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA — 8/8 correções fechadas
- Data Architect: OK v1.2 (docs/talitha-data-architecture.md + supabase/migrations/)
- Security Review (schema): APROVADO — 9/9 patches, 32/32 requisitos, 4 DoDs para o Backlog
- Backlog: **CONCLUÍDO** (docs/talitha-backlog.md) ✅

### Backlog — Resumo
- **8 sprints**, **54 tasks**, **36 stories cobertas** (nenhuma órfã)
- Sprint 1: Fundação (setup, migrations, crypto, logger, wrappers)
- Sprint 2: Autenticação & MFA (login, TOTP, middleware, onboarding)
- Sprint 3: Pacientes & Consentimento (cadastro, convite, termos, portal)
- Sprint 4: Agenda & Lembretes (recorrência, conflito, email reminders)
- Sprint 5: Financeiro & Asaas (cobranças, webhook, régua, inadimplentes)
- Sprint 6: Sala de Vídeo & LiveKit (espera, admissão, vídeo, Gate 5.5)
- Sprint 7: Prontuário & Registros Clínicos (evolução, anamnese, E6, audit log)
- Sprint 8: Dashboard, Recibos & Finalização (KPIs, PDF, LGPD, hardening)

### DoDs do Security Review incorporados
- DoD-1 (VIEW_RECORD transacional): Sprint 7, Task 7.3
- DoD-2 (Sanitização campos operacionais): Sprint 4, Task 4.4
- DoD-3 (N1 fix: fn_block_delete_clinical_retention): Sprint 1, Task 1.4 (verificação)
- DoD-4 (Column-level GRANT): Sprint 1, Task 1.4

### Blockers (herdados — não resolvidos pelo Backlog)
- Migrations pendentes de aplicação (Sprint 1, Task 1.4)
- GitHub CLI não instalado
- DNS (SPF/DKIM/DMARC) pendente — pré-requisito de deploy, não de sprint
- 2FA na conta EasyPanel — pré-requisito de deploy
- Região do LiveKit Cloud a confirmar
- Ambiente de teste dedicado

### Próximo passo
**OBRIGATÓRIO: `/gp import-backlog docs/talitha-backlog.md --feature "Talitha Psicologia" --apply`** — importar as 8 sprints para a plataforma Gestão Financeira antes de qualquer execução técnica. Após import, iniciar Sprint 1 via `/gp next`.

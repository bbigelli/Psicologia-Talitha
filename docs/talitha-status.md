# Status: talitha-psicologia
## Fase atual: Planejamento -- Security Review (schema) APROVADO, proximo passo Backlog
## Ultimo agente: Security Agent (re-verificacao rodada 2)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.1 (docs/talitha-data-architecture.md + supabase/migrations/)
  - v1.0: 19 tabelas, 32 requisitos (28 impl, 4 parciais)
  - v1.1: patches A1-A4, M1, B1-B2, R19 aplicados; emendas E5-E8; 20 tabelas; 4 parciais fechados
- Security Review (schema): **APROVADO** -- rodada 2 concluida <- CONCLUIDO
  - v1.0: Aprovado com ressalvas (4 Altos, 2 Medios, 5 Baixos)
  - v1.1: 9/9 patches Fechados, 32/32 requisitos completos, E5/E6/E8 corretas, 1 regressao funcional (N1 Medio, falha segura), 4 recusas aceitaveis, 4 DoDs para o Backlog
- Backlog: -- pendente <- PROXIMO PASSO

### Resultado da Re-verificacao Security (rodada 2)

- **Patches:** 9/9 Fechados (A1, A2, A3, A4, M1, B1, B2, R19, consume_email_token)
- **Requisitos parciais:** 4/4 agora Completos (R11, R12, R14, R19)
- **Emendas:** E5 (e-Psi removido), E6 (remote_viability_assessments com rigor clinico), E8 (sem vedacoes)
- **Regressoes de seguranca:** 0
- **Regressoes funcionais:** 1 (N1 -- fn_block_delete_during_retention referencia OLD.treatment_ended_at em tabelas sem essa coluna; falha segura)
- **Recusas aceitas:** M2 (VIEW_RECORD transacional), B3 (texto livre), B4 (single-tenant), B5 (contagem RPCs)
- **DoDs para o Backlog:** DoD-1 (VIEW_RECORD transacional), DoD-2 (sanitizacao campos operacionais), DoD-3 (fix fn_block_delete_during_retention), DoD-4 (verificacao column-level GRANT em provisionamento)

### Blockers
- Migrations pendentes de aplicacao (orquestrador aplica)
- GitHub CLI nao instalado
- Credenciais Asaas Sandbox nao fornecidas
- Credenciais LiveKit Cloud nao fornecidas
- Custodia da KEK nao definida
- DNS (SPF/DKIM/DMARC) pendente
- 2FA na conta EasyPanel
- Regiao do LiveKit Cloud a confirmar
- Duas chaves Resend a criar
- Ambiente de teste dedicado
- Versao minima do Next.js a fixar

### Proximo passo
Ativar **Backlog**. Todas as fases de planejamento concluidas: PRD, Design, Arquitetura, Data Architecture, 3 Security Reviews (todos aprovados). O Backlog recebe como entrada todos os docs/ gerados e deve incorporar os 4 DoDs do Security Review (docs/talitha-security-review-schema.md secao 6.6).

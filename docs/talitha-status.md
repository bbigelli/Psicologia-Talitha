# Status: talitha-psicologia
## Fase atual: Planejamento -- Data Architect patches CONCLUIDOS + Emendas E5-E8 incorporadas, proximo passo Backlog
## Ultimo agente: Data Architect (patches v1.1)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA -- 8/8 correcoes fechadas
- Data Architect: OK v1.1 (docs/talitha-data-architecture.md + supabase/migrations/) <- CONCLUIDO
  - v1.0: 19 tabelas, 32 requisitos (28 impl, 4 parciais)
  - v1.1: patches A1-A4, M1, B1-B2, R19 aplicados; emendas E5-E8; 20 tabelas; 4 parciais fechados
- Security Review (schema): APROVADO COM RESSALVAS -- patches solicitados e aplicados
- Backlog: -- pendente <- PROXIMO PASSO

### Resultado do Data Architect v1.1

20 tabelas (+1 remote_viability_assessments por E6), 8 RPCs SECURITY DEFINER (+1 consume_email_token, +1 fn_profiles_sync_role_metadata), 12 migrations.

**Patches aplicados do Security Review:**
- A1: log_audit com validacao de role + ownership (120800)
- A2: fn_patients_set_retention + fn_block_delete_during_retention mais segura (120100)
- A3: consents com 3 triggers append-only + FORCE RLS + REVOKE service_role (120500, 121000)
- A4: REVOKE ALL table-level + GRANT SELECT column-level em 8 tabelas (121000)
- M1: clinical_record_versions com triggers append-only (120300)
- B1: REVOKE EXECUTE de anon em 6 RPCs (121000)
- B2: trigger impedindo paciente de alterar colunas da psicologa (120900)
- R19: RPC consume_email_token para validacao atomica (120800)

**4 Requisitos Parciais fechados:** R11 (consents append-only via A3), R12 (versions append-only via M1), R14 (retention_until auto-calc via A2), R19 (token RPC via consume_email_token)

**Emendas E5-E8:**
- E5: epsi_status removido de profiles (120100)
- E6: remote_viability_assessments como tabela propria com envelope encryption (120300, 120900, 121000)
- E7: sem alteracao de schema (versionamento por hash ja acomoda)
- E8: nenhuma vedacao automatica de elegibilidade clinica no schema

**Migrations NAO aplicadas.** Projeto provisionado (sa-east-1) mas credenciais nao acessiveis por este agente.

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
Ativar **Backlog**. Todas as fases de planejamento concluidas: PRD, Design, Arquitetura, Data Architecture, 3 Security Reviews (todos aprovados). O Backlog recebe como entrada todos os docs/ gerados.

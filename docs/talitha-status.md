# Status: talitha-psicologia
## Fase atual: Planejamento -- Security Review do schema CONCLUIDO (aprovado com ressalvas), proximo passo Data Architect (patches) + Backlog
## Ultimo agente: Security (schema review)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA (docs/talitha-security-review-architecture.md secao 6) -- 8/8 correcoes fechadas
- Data Architect: OK v1.0 (docs/talitha-data-architecture.md + supabase/migrations/) -- CONCLUIDO
- Security Review (schema): APROVADO COM RESSALVAS (docs/talitha-security-review-schema.md) -- 4 patches DDL obrigatorios <- CONCLUIDO
- Data Architect (patches): -- pendente <- PROXIMO PASSO (4 correcoes Alto)
- Security Review (re-verificacao patches): -- pendente
- Backlog: -- pendente (apos patches aprovados)

### Resultado do Security Review do schema

**Requisitos (32 da secao 17):** 28 Implementados, 4 Parciais, 0 Nao implementados.

**Issues encontrados:** 0 Criticos, 4 Altos, 2 Medios, 5 Baixos.

**4 Altos (patches obrigatorios):**
- A1: `log_audit` sem validacao de ownership nos parametros -- paciente pode injetar entradas fabricadas no log de compliance
- A2: `retention_until` sem auto-calculo por trigger -- NULL permite DELETE antes do prazo legal
- A3: `consents` sem triggers de append-only -- service_role pode adulterar registros de consentimento (LGPD art. 37)
- A4: Column-level REVOKE possivelmente ineficaz contra default privileges do Supabase -- ciphertext pode chegar ao browser

**2 Medios (Backlog/Stack Agent):**
- M1: `clinical_record_versions` sem trigger de append-only
- M2: VIEW_RECORD sincrono requer transacao unica (read + audit)

**Decisao autonoma (VIEW_RECORD sincrono):** aprovada com condicao M2.

### Resultado do Data Architect

19 tabelas, 6 RPCs SECURITY DEFINER, 33 RLS policies, 4 camadas de audit log, envelope encryption em 4 tabelas.

**Tabelas:** profiles, patients, sessions, clinical_records, clinical_record_versions, anamnesis, session_note_drafts, charges, subscriptions, payment_webhook_events, receipt_counters, receipts, consents, communication_preferences, email_action_tokens, data_subject_requests, session_reminders, billing_rule_events, audit_log.

**RPCs SECURITY DEFINER:** log_audit, log_audit_system, enter_waiting_room, admit_patient, cancel_session, fn_verify_audit_chain.

**12 migrations** em supabase/migrations/ ordenadas por dependencia.

**Migrations NAO aplicadas:** projeto Supabase nao provisionado. Arquivos prontos para `supabase db push`.

### Resultado da re-verificacao (Security Review rodada 2 -- arquitetura)

8 correcoes verificadas: **8 Fechadas / 0 Parciais / 0 Nao fechadas**

- AC1 (Critico): create-charge com 9 pre-condicoes, IDOR fechado por ownership check
- AC2 (Critico): REVOKE UPDATE ON sessions, RPCs de assinatura estreita, auto-admissao fechada
- AA1/AA2: wrappers obrigatorios, middleware nao e fronteira, fail-closed
- AA3: aal2 (nao enrollment), recuperacao de senha coberta
- AA4: keys.ts com validacao no boot, AAD com UUID real
- AA5/AA6/AA7: force-dynamic, Dockerfile sem segredos, npm ci --ignore-scripts
- AA11: session_note_drafts como conteudo clinico cifrado
- AA12: ADR-0001 com risco residual, checklist completo (20 itens)

### Blockers
- Projeto Supabase nao provisionado (migrations pendentes de aplicacao)
- **4 patches DDL pendentes (Security Review do schema)** -- Data Architect deve aplicar antes do Backlog
- GitHub CLI nao instalado
- Credenciais Asaas Sandbox nao fornecidas
- Credenciais LiveKit Cloud nao fornecidas
- Cadastro e-Psi a confirmar
- Custodia da KEK nao definida
- DNS (SPF/DKIM/DMARC) pendente
- 2FA na conta EasyPanel
- Regiao do LiveKit Cloud a confirmar
- Duas chaves Resend a criar
- Ambiente de teste dedicado
- Versao minima do Next.js a fixar

### Proximo passo
Ativar **Data Architect** para aplicar os 4 patches DDL listados em `docs/talitha-security-review-schema.md` secao 2 (A1-A4). Apos patches, Security re-verifica (pontual). Depois, Backlog.

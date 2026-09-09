# Status: talitha-psicologia
## Fase atual: Planejamento -- Data Architect CONCLUIDO, proximo passo Security Review do schema
## Ultimo agente: Data Architect
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): APROVADA (docs/talitha-security-review-architecture.md secao 6) -- 8/8 correcoes fechadas
- Data Architect: OK v1.0 (docs/talitha-data-architecture.md + supabase/migrations/) <- CONCLUIDO
- Security Review (schema): -- pendente <- PROXIMO PASSO
- Backlog: -- pendente

### Resultado do Data Architect

19 tabelas, 7 RPCs SECURITY DEFINER, 33 RLS policies, 4 camadas de audit log, envelope encryption em 4 tabelas.

**Tabelas:** profiles, patients, sessions, clinical_records, clinical_record_versions, anamnesis, session_note_drafts, charges, subscriptions, payment_webhook_events, receipt_counters, receipts, consents, communication_preferences, email_action_tokens, data_subject_requests, session_reminders, billing_rule_events, audit_log.

**RPCs SECURITY DEFINER:** log_audit, log_audit_system, enter_waiting_room, admit_patient, cancel_session, fn_verify_audit_chain.

**12 migrations** em supabase/migrations/ ordenadas por dependencia.

**32 requisitos da secao 17:** todos absorvidos (ver detalhes no resumo final do agente).

**Migrations NAO aplicadas:** projeto Supabase nao provisionado. Arquivos prontos para `supabase db push`.

### Resultado da re-verificacao (Security Review rodada 2)

8 correcoes verificadas: **8 Fechadas / 0 Parciais / 0 Nao fechadas**

- AC1 (Critico): create-charge com 9 pre-condicoes, IDOR fechado por ownership check
- AC2 (Critico): REVOKE UPDATE ON sessions, RPCs de assinatura estreita, auto-admissao fechada
- AA1/AA2: wrappers obrigatorios, middleware nao e fronteira, fail-closed
- AA3: aal2 (nao enrollment), recuperacao de senha coberta
- AA4: keys.ts com validacao no boot, AAD com UUID real
- AA5/AA6/AA7: force-dynamic, Dockerfile sem segredos, npm ci --ignore-scripts
- AA11: session_note_drafts como conteudo clinico cifrado
- AA12: ADR-0001 com risco residual, checklist completo (20 itens)

Secao 17 (32 requisitos) cobre 100% da secao 4 do Security Review.
Nenhuma regressao. Nenhum issue novo.

### Blockers
- Projeto Supabase nao provisionado (migrations pendentes de aplicacao)
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
Ativar **Security Review do schema** (3o momento obrigatorio). Entradas: `docs/talitha-data-architecture.md`, `supabase/migrations/`, requisitos da secao 17 e secao 4 dos reviews anteriores.

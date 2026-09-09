# Security Review -- Schema: Talitha Psicologia

**Versao:** 1.0
**Data:** 2026-09-09
**Momento:** 3o dos 3 obrigatorios (apos Data Architect)
**Entradas:** `supabase/migrations/*.sql` (12 arquivos), `docs/talitha-data-architecture.md` v1.0, `docs/talitha-architecture.md` v1.1 secao 17 (32 requisitos), `docs/talitha-security-review-architecture.md` secoes 4 e 6, `docs/talitha-security-review-prd.md`, `docs/talitha-prd.md` (emendas E1-E4), `CLAUDE.md`, `docs/adr/ADR-0001..0006`
**Classe de dado:** pessoal sensivel de saude mental (LGPD art. 5 II, art. 11) -- severidade calibrada nesse patamar

## Status: APROVADO COM RESSALVAS -- 0 Criticos, 4 Altos, 2 Medios, 5 Baixos

---

## Resumo executivo

O schema e trabalho serio. 19 tabelas, 6 RPCs SECURITY DEFINER com validacao tripla (auth, role, ownership), 4 camadas de audit log com hash chain serializado, envelope encryption em 4 tabelas clinicas, maquina de estados monotonica em pagamentos, room_name de 128 bits, blind index HMAC para CPF, CHECK de idade no banco, e REVOKE explicitico em sessions. A maioria dos 32 requisitos esta corretamente implementada no SQL -- nao apenas documentada, mas forcada por constraints, triggers e RPCs.

Precedente registrado: na fase de arquitetura, a afirmacao de completude (42/42 absorvidos) se revelou 26 absorvidos, 11 parciais e 5 nao absorvidos. Nesta fase, a afirmacao de 32/32 e substancialmente mais precisa: **28 implementados, 4 parciais, 0 nao implementados**. O Data Architect fez o trabalho que prometeu.

Os 4 Altos encontrados nao sao falhas de concepcao -- sao lacunas de enforcement que o SQL deveria fechar e nao fecha. A mais grave e a ineficacia dos `REVOKE SELECT (coluna)` quando os default privileges do Supabase ja concedem SELECT em nivel de tabela: a defesa de "ciphertext nao chega ao browser" pode nao existir. As outras tres sao: `log_audit` sem validacao de ownership nos parametros, `retention_until` sem auto-calculo por trigger, e `consents` sem enforcement de append-only alem do RLS. Todas tem DDL corrigido sugerido abaixo.

A decisao autonoma do Data Architect (VIEW_RECORD sincrono) e correta para o volume deste produto, com uma ressalva: a leitura do prontuario e o log de auditoria devem estar na mesma transacao, ou existe caminho em que a leitura acontece sem registro.

---

## Secao 1: Matriz dos 32 requisitos

| # | Requisito | Veredicto | Evidencia no SQL |
|---|-----------|-----------|-----------------|
| 1 | Criptografia envelope (clinical_records, anamnesis, session_note_drafts) | **Implementado** | 120300: 7 colunas de envelope em cada tabela (`content_ciphertext`, `content_iv`, `content_tag`, `dek_wrapped`, `dek_iv`, `dek_tag`, `kek_version`). AAD documentado. |
| 2 | CPF cifrado + blind index | **Implementado** | 120100: `cpf_ciphertext..cpf_kek_version` (7 colunas) + `cpf_hmac TEXT NOT NULL UNIQUE` em `patients`. 121000: REVOKE SELECT das colunas de `authenticated`. |
| 3 | Audit log 4 camadas | **Implementado** | 120700: (1) `ENABLE RLS` + `FORCE ROW LEVEL SECURITY`, (2) triggers `trg_audit_log_no_update` (FOR EACH ROW), `trg_audit_log_no_delete` (FOR EACH ROW), `trg_audit_log_no_truncate` (FOR EACH STATEMENT), (3) 121000: `REVOKE UPDATE, DELETE, TRUNCATE FROM authenticated, anon, service_role`, (4) `fn_audit_log_hash_chain` com `pg_advisory_xact_lock`. |
| 4 | Duas funcoes de audit log | **Implementado** | 120800: `log_audit` (actor_id := auth.uid(), RAISE se NULL) e `log_audit_system` (recebe p_actor_id, valida enum actor_source). 121000: `REVOKE EXECUTE ON FUNCTION log_audit_system FROM authenticated, anon`. 120700: `actor_source CHECK`, `chk_audit_actor` (actor_id nullable so quando anonymous). |
| 5 | sessions.room_name | **Implementado** | 120200: `room_name TEXT UNIQUE NOT NULL DEFAULT ('s_' \|\| encode(gen_random_bytes(16), 'hex'))`. Trigger `trg_sessions_on_reschedule` regenera room_name e zera waiting_since/admitted_at quando scheduled_at muda. |
| 6 | sessions waiting/admitted RPCs | **Implementado** | 120800: `enter_waiting_room` (valida auth.uid(), ownership via JOIN patients, status, janela temporal; escreve SO waiting_since). `admit_patient` (valida auth.uid(), role=psychologist no banco, ownership psychologist_id; escreve SO admitted_at). `cancel_session` (valida auth.uid(), role, ownership; transicao controlada). 121000: `REVOKE UPDATE, INSERT, DELETE ON sessions FROM authenticated, anon`. |
| 7 | payment_webhook_events | **Implementado** | 120400: `asaas_event_id TEXT PRIMARY KEY`. Colunas de allowlist apenas: `event_type`, `payment_id`, `status`, `value`, `due_date`, `received_at`, `processed_at`, `result`. Nenhuma coluna de CPF ou nome. |
| 8 | receipt_counters | **Implementado** | 120400: `receipt_counters(year INT PK, last_number INT NOT NULL DEFAULT 0)`. SELECT FOR UPDATE e responsabilidade da aplicacao; estrutura suporta. |
| 9 | receipts UNIQUE(charge_id) | **Implementado** | 120400: `CONSTRAINT uq_receipt_charge UNIQUE (charge_id)` + `CONSTRAINT uq_receipt_number_year UNIQUE (receipt_number, receipt_year)`. |
| 10 | Maquina de estados monotonica | **Implementado** | 120400: `fn_charges_monotonic_status` com trigger `BEFORE UPDATE OF status`. Transicoes explicitas: pending_creation->pending/cancelled, pending->paid/overdue/cancelled, overdue->paid/cancelled, paid->refunded/chargeback. No-op permitido. Sem regressao. |
| 11 | consents append-only | **Parcial** | 120500: Tabela sem `updated_at` (correto). Purpose enum por finalidade (4 valores). `consent_text_hash`, `ip INET`, `user_agent TEXT`, timestamps `TIMESTAMPTZ`. Sem `subject_type = 'guardian'`. RLS sem UPDATE/DELETE para authenticated. **Lacuna:** nenhum trigger bloqueia UPDATE/DELETE por service_role (contraste: audit_log tem 3 triggers + REVOKE). Ver issue A3. |
| 12 | clinical_record_versions append-only | **Parcial** | 120300: Tabela com UNIQUE(record_id, version_number), apenas created_at. RLS so INSERT para psicologa. **Lacuna:** nenhum trigger bloqueia UPDATE/DELETE por service_role. Ver issue M1. |
| 13 | profiles | **Implementado** | 120100: `profiles.id PK FK auth.users`. `role TEXT NOT NULL CHECK`. `onboarding_completed BOOLEAN`. `full_name`, `crp`, dados profissionais. 120900: trigger `trg_profiles_protect_role` impede UPDATE de role. Trigger `trg_profiles_sync_role_metadata` SECURITY DEFINER com `SET search_path = public` espelha role em app_metadata. Policies clinicas com clausula `aal2`. |
| 14 | retention_until | **Parcial** | 120100: coluna `retention_until TIMESTAMPTZ` em patients, clinical_records, anamnesis. Trigger `fn_block_delete_during_retention` bloqueia DELETE quando `retention_until IS NOT NULL AND retention_until > now()`. **Lacuna:** nenhum trigger auto-calcula `retention_until` quando `treatment_ended_at` e setado. Se a aplicacao nao setar, retention_until fica NULL e o DELETE e permitido. Ver issue A2. |
| 15 | PKs UUID | **Implementado** | Todas as tabelas com `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. `receipt_counters` usa INT PK (ano) mas nao e exposta em URL. Nenhum bigserial/identity. |
| 16 | RLS obrigatoria | **Implementado** | Todas as 19 tabelas tem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. |
| 17 | Supabase region sa-east-1 | **Implementado (documental)** | Configuracao de infraestrutura, nao verificavel no SQL. Documentado na data architecture. |
| 18 | CHECK de idade >= 18 | **Implementado** | 120100: `CONSTRAINT chk_patient_adult CHECK (date_of_birth <= current_date - interval '18 years')`. Avaliado em INSERT e UPDATE. `current_date` avalia no momento da operacao. |
| 19 | email_action_tokens | **Parcial** | 120500: Tabela com todas as colunas corretas: `token_hash TEXT UNIQUE NOT NULL`, `purpose CHECK enum`, `expires_at TIMESTAMPTZ NOT NULL`, `used_at TIMESTAMPTZ`, `created_ip INET`. RLS habilitado, zero policies (correto). **Lacuna:** nenhuma RPC SECURITY DEFINER para consumo do token (requisito 19 pede "acesso so por RPC SD"). Acesso via service_role em Server Actions e funcionalmente equivalente, mas nao ha validacao de banco para: token expirado, token ja usado, purpose mismatch. Ver issue M2. |
| 20 | Eliminacao seletiva por categoria | **Implementado** | 120100/120500: soft delete (`deleted_at`) em patients, clinical_records, anamnesis. `communication_preferences` com ON DELETE CASCADE. `email_action_tokens` com ON DELETE CASCADE. Categorias eliminaveis vs. congelaveis documentadas. |
| 21 | data_subject_requests | **Implementado** | 120500: Tabela com todas as colunas: `request_type CHECK enum`, `status CHECK enum`, `due_at TIMESTAMPTZ`, `decision TEXT`, `legal_basis TEXT`, `eliminated_categories JSONB`, `retained_categories JSONB`, `artifact_path`, `artifact_expires_at`. |
| 22 | Preferencia de comunicacao | **Implementado** | 120500: `communication_preferences` com `opted_out BOOLEAN`, `channel CHECK enum`, `purpose CHECK enum`, `UNIQUE (patient_id, channel, purpose)`. |
| 23 | session_note_drafts | **Implementado** | 120300: Envelope completo (7 colunas). AAD documentado (`patient_id\|session_id`). RLS so psicologa com aal2 (SELECT, INSERT, UPDATE, DELETE). Nenhuma policy para patient. UNIQUE(session_id). |
| 24 | log_audit_system REVOKE | **Implementado** | 121000: `REVOKE EXECUTE ON FUNCTION log_audit_system FROM authenticated, anon`. |
| 25 | Serializacao hash chain | **Implementado** | 120700: `PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain'))` no trigger BEFORE INSERT, ANTES de ler o ultimo hash. Lock transacional impede fork sob concorrencia. Em rollback, lock e liberado e cadeia permanece intacta. |
| 26 | Caminho sincrono audit log | **Implementado** | Decisao documentada: VIEW_RECORD sincrono, sem outbox. Volume ~dezenas/dia. Ver avaliacao na Secao 3. |
| 27 | REVOKE SELECT colunas cifradas | **Implementado (com ressalva)** | 121000: REVOKE SELECT das colunas de ciphertext em 7 tabelas (patients, profiles, clinical_records, clinical_record_versions, anamnesis, session_note_drafts, receipts). **Ressalva critica:** column-level REVOKE e ineficaz se default privileges do Supabase concedem table-level SELECT. Ver issue A4. |
| 28 | RLS clinica | **Implementado** | 120900: clinical_records sem policy de SELECT para patient. anamnesis: paciente tem INSERT/UPDATE/SELECT propria (ciphertext REVOKEd). session_note_drafts: sem policy para patient. Todas as policies clinicas com clausula `(auth.jwt()->>'aal') = 'aal2'`. |
| 29 | Idempotencia lembretes/regua | **Implementado** | 120600: `UNIQUE (session_id, reminder_type)` em session_reminders. `UNIQUE (charge_id, step)` em billing_rule_events. Constraints de banco, nao verificacao na aplicacao. |
| 30 | CRON_SECRET no Vault | **Implementado (documental)** | Configuracao de runtime, nao verificavel no SQL. Documentado na data architecture. |
| 31 | charges com pending_creation | **Implementado** | 120400: status CHECK inclui `'pending_creation'`. `psychologist_id UUID NOT NULL REFERENCES profiles(id)`. |
| 32 | Verificacoes executaveis | **Implementado** | 6 queries de verificacao documentadas na data architecture (V1-V6). `fn_verify_audit_chain` implementada como RPC com recomputacao da cadeia. |

### Placar

| Veredicto | Quantidade | Requisitos |
|-----------|-----------|------------|
| **Implementado** | 28 | 1-10, 13, 15-18, 20-26, 28-32 |
| **Parcial** | 4 | 11, 12, 14, 19 |
| **Nao implementado** | 0 | -- |

A afirmacao do Data Architect de 32/32 absorvidos e substancialmente correta: 28 estao implementados com enforcement no SQL, e os 4 parciais tem a estrutura certa com lacunas de enforcement especificas. Nenhum requisito foi ignorado ou esquecido.

---

## Secao 2: Issues

### Alto

#### A1: `log_audit` sem validacao de ownership nos parametros

**Arquivo:** `120800_rpc_functions.sql` linhas 15-49
**Trecho:**
```sql
CREATE OR REPLACE FUNCTION log_audit(
  p_patient_id UUID, p_action TEXT, ...
) ... AS $$
DECLARE v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION ...; END IF;
  INSERT INTO audit_log (...) VALUES (v_actor_id, 'user', p_patient_id, p_action, ...);
END; $$;
```

**Cenario de exploracao:** qualquer usuario autenticado (inclusive paciente) chama `supabase.rpc('log_audit', { p_patient_id: '<outro-paciente>', p_action: 'PURGE_RECORD' })`. O `actor_id` e verdadeiro (derivado de auth.uid()), mas `p_patient_id` e `p_action` sao controlados pelo chamador. O paciente injeta entradas fabricadas no log de compliance (LGPD art. 37 / CFP), poluindo-o com acoes que nunca ocorreram. Em processo etico, a defesa pode argumentar que o log contem entradas falsas e nao e confiavel.

A funcao nao recebeu REVOKE (diferente de `log_audit_system`) -- e executavel por qualquer authenticated.

**DDL corrigido sugerido:**
```sql
CREATE OR REPLACE FUNCTION log_audit(
  p_patient_id UUID, p_action TEXT,
  p_target_id UUID DEFAULT NULL, p_target_table TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id UUID;
  v_role TEXT;
  v_log_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'log_audit: auth.uid() is NULL';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_actor_id;

  -- Ownership validation: caller can only log about their own scope
  IF v_role = 'patient' AND p_patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND user_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'log_audit: patient can only log actions on own record';
    END IF;
  ELSIF v_role = 'psychologist' AND p_patient_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND psychologist_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'log_audit: psychologist can only log actions on own patients';
    END IF;
  END IF;

  INSERT INTO audit_log (
    actor_id, actor_source, patient_id, action,
    target_id, target_table, ip, user_agent, metadata
  ) VALUES (
    v_actor_id, 'user', p_patient_id, p_action,
    p_target_id, p_target_table, p_ip, p_user_agent, p_metadata
  ) RETURNING id INTO v_log_id;
  RETURN v_log_id;
END; $$;
```

---

#### A2: `retention_until` nao auto-calculado por trigger -- NULL permite DELETE

**Arquivo:** `120100_core_tables.sql` linhas 94-106
**Trecho:**
```sql
CREATE OR REPLACE FUNCTION fn_block_delete_during_retention() ...
BEGIN
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > now() THEN
    RAISE EXCEPTION 'Cannot delete record during retention period ...';
  END IF;
  RETURN OLD;  -- permite DELETE se retention_until IS NULL
END;
```

**Cenario de exploracao:** a aplicacao encerra o tratamento (`treatment_ended_at = now()`) mas esquece de setar `retention_until`. O registro fica com `retention_until IS NULL`. Um DELETE por service_role (bug, correcao manual errada, ou insider) apaga o registro sem que o trigger bloqueie. Prontuario eliminado antes do prazo legal de 5 anos -- violacao CFP e LGPD.

O Data Architect documentou `retention_until` como "Calculado automaticamente" (secao "patients"), mas nenhum trigger realiza o calculo. A protecao depende integralmente da aplicacao nao errar.

**DDL corrigido sugerido:**
```sql
-- Trigger que auto-calcula retention_until quando treatment_ended_at e setado
CREATE OR REPLACE FUNCTION fn_patients_set_retention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.treatment_ended_at IS NOT NULL AND OLD.treatment_ended_at IS NULL THEN
    NEW.retention_until := NEW.treatment_ended_at + interval '5 years';
  END IF;
  -- Impedir reducao manual de retention_until
  IF OLD.retention_until IS NOT NULL
     AND NEW.retention_until IS DISTINCT FROM OLD.retention_until
     AND NEW.retention_until < OLD.retention_until THEN
    RAISE EXCEPTION 'Cannot reduce retention_until (was %, attempted %)',
      OLD.retention_until, NEW.retention_until;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_set_retention
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION fn_patients_set_retention();

-- Mesmo padrao para clinical_records e anamnesis:
-- retention_until := (SELECT retention_until FROM patients WHERE id = NEW.patient_id)
```

Nota: `fn_block_delete_during_retention` tambem deve ser ajustada para bloquear DELETE incondicional quando `retention_until IS NULL AND treatment_ended_at IS NOT NULL` (tratamento encerrado mas retencao nao calculada -- falha, nao permissao):

```sql
CREATE OR REPLACE FUNCTION fn_block_delete_during_retention()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tratamento encerrado e retention_until nao calculado, bloquear por seguranca
  IF OLD.retention_until IS NULL AND OLD.treatment_ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'retention_until not set after treatment end -- cannot delete safely';
  END IF;
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > now() THEN
    RAISE EXCEPTION 'Cannot delete record during retention period (until %)', OLD.retention_until;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

---

#### A3: `consents` sem enforcement de append-only alem do RLS

**Arquivo:** `120500_compliance_tables.sql` linhas 1-30
**Trecho:** Tabela `consents` tem RLS sem UPDATE/DELETE policies para authenticated, mas nenhum trigger bloqueia mutacao por service_role.

**Cenario de exploracao:** um bug em Server Action ou um insider com service_role executa `UPDATE consents SET action = 'accept' WHERE ...` ou `DELETE FROM consents WHERE ...`. O registro de consentimento e adulterado ou eliminado. Em inspecao da ANPD, a psicologa nao consegue provar que o consentimento foi obtido (LGPD art. 37).

Contraste: o `audit_log` tem 3 triggers (UPDATE, DELETE, TRUNCATE) + REVOKE + FORCE RLS -- 4 camadas de protecao. O `consents`, que tem valor probatorio identico (prova de consentimento), tem apenas 1 camada (RLS).

**DDL corrigido sugerido:**
```sql
-- Reutiliza a funcao fn_audit_log_block_mutation ou cria generica
CREATE OR REPLACE FUNCTION fn_block_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (compliance record): % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consents_no_update
  BEFORE UPDATE ON consents
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_consents_no_delete
  BEFORE DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_consents_no_truncate
  BEFORE TRUNCATE ON consents
  FOR EACH STATEMENT EXECUTE FUNCTION fn_block_append_only_mutation();

-- Opcional: FORCE ROW LEVEL SECURITY (impede bypass pelo dono da tabela)
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

-- REVOKE para service_role (defense in depth)
REVOKE UPDATE, DELETE, TRUNCATE ON consents FROM service_role;
```

---

#### A4: Column-level REVOKE possivelmente ineficaz contra default privileges do Supabase

**Arquivo:** `121000_grants_revokes_indexes.sql` linhas 30-63
**Trecho:**
```sql
REVOKE SELECT (cpf_ciphertext, cpf_iv, ...) ON patients FROM authenticated;
REVOKE SELECT (content_ciphertext, ...) ON clinical_records FROM authenticated;
-- ... (7 tabelas)
```

**Cenario de exploracao:** o Supabase configura default privileges no provisionamento:
```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
```
Se esse default estiver ativo, `authenticated` tem **table-level SELECT** em todas as tabelas. Em PostgreSQL, table-level GRANT supersede column-level REVOKE. O column-level REVOKE e ignorado silenciosamente -- nenhum erro, nenhum aviso. O browser client faz `supabase.from('clinical_records').select('*')` e recebe `content_ciphertext` (bytes cifrados). O dado e cifrado (nao ha plaintext), mas:
- Viola o principio de minimizacao (LGPD art. 6 III) -- dados cifrados enviados a um cliente que nao precisa deles
- Ciphertext armazenado localmente pode ser atacado se a KEK for comprometida no futuro
- A existencia de bytes cifrados confirma a existencia do registro (D3 -- vinculo terapeutico)

**Severidade calibrada:** Alto (nao Critico) porque o dado esta cifrado e a KEK permanece server-side. A defesa primaria (criptografia) esta intacta. A defesa secundaria (REVOKE) e a que falha.

**DDL corrigido sugerido:**
```sql
-- Para cada tabela com colunas cifradas, substituir o column-level REVOKE por:
-- 1. REVOKE table-level SELECT
-- 2. GRANT column-level SELECT nas colunas permitidas

-- Exemplo para clinical_records:
REVOKE ALL ON clinical_records FROM authenticated;
GRANT SELECT (
  id, patient_id, session_id, psychologist_id,
  session_date, duration_minutes, mood,
  kek_version, deleted_at, retention_until,
  created_at, updated_at
) ON clinical_records TO authenticated;
-- Colunas OMITIDAS: content_ciphertext, content_iv, content_tag, dek_wrapped, dek_iv, dek_tag

-- Repetir para: patients, profiles, clinical_record_versions, anamnesis, session_note_drafts, receipts
```

**Nota:** esta correcao pode exigir revisao de todas as policies RLS das tabelas afetadas, pois a revogacao de table-level SELECT pode afetar policies que usam subqueries. Testar apos aplicar.

**Verificacao obrigatoria no provisionamento:**
```sql
-- Como authenticated (paciente com RLS passando):
SET ROLE authenticated;
SET request.jwt.claim.sub = '<uid>';
SELECT content_ciphertext FROM clinical_records LIMIT 1;
-- ESPERADO: ERROR: permission denied for column content_ciphertext
-- SE RETORNAR DADOS: o REVOKE e ineficaz, aplicar a correcao acima
RESET ROLE;
```

---

### Medio

#### M1: `clinical_record_versions` sem trigger de append-only

**Arquivo:** `120300_clinical_tables.sql` linhas 58-77
**Cenario:** service_role pode UPDATE/DELETE versoes de evolucao. Menor severidade que consents (A3) porque o registro primario esta em `clinical_records`; versoes sao historico auxiliar.

**DDL sugerido:** aplicar os mesmos triggers de A3:
```sql
CREATE TRIGGER trg_clinical_record_versions_no_update
  BEFORE UPDATE ON clinical_record_versions
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();

CREATE TRIGGER trg_clinical_record_versions_no_delete
  BEFORE DELETE ON clinical_record_versions
  FOR EACH ROW EXECUTE FUNCTION fn_block_append_only_mutation();
```

---

#### M2: VIEW_RECORD -- acoplamento transacional obrigatorio

**Contexto:** decisao autonoma do Data Architect (Requisito 26): VIEW_RECORD sincrono. Avaliacao detalhada na Secao 3.

O risco: se o Server Action faz duas chamadas separadas ao Supabase (1. SELECT clinical_records, 2. RPC log_audit), e a segunda falha, a leitura do prontuario acontece sem registro de auditoria. Este e exatamente o cenario que o audit log existe para cobrir.

**Responsabilidade:** Stack Agent. O schema nao precisa de alteracao -- a transacao e responsabilidade da aplicacao.

**Requisito para o Backlog:** toda leitura de conteudo clinico (clinical_records, anamnesis) DEVE usar uma RPC ou transacao explicita que (1) le o ciphertext, (2) chama log_audit, em um unico `BEGIN...COMMIT`. Se qualquer passo falhar, nenhum dos dois persiste.

**Alternativa (mais robusta):** criar RPC `read_clinical_record(p_record_id UUID)` que faz SELECT + log_audit internamente. A decifracaco permanece server-side (fora do banco).

---

### Baixo

#### B1: RPCs sem REVOKE de `anon`

**Arquivo:** `121000_grants_revokes_indexes.sql`
**Funcoes afetadas:** `log_audit`, `enter_waiting_room`, `admit_patient`, `cancel_session`, `fn_verify_audit_chain`

Em Supabase, funcoes sao executaveis por PUBLIC por padrao. O role `anon` (requisicoes nao autenticadas) pode chamar essas funcoes. Todas validam `auth.uid()` internamente e falham se NULL, mas o round-trip ao banco acontece. REVOKE de `anon` e defense in depth:
```sql
REVOKE EXECUTE ON FUNCTION log_audit FROM anon;
REVOKE EXECUTE ON FUNCTION enter_waiting_room FROM anon;
REVOKE EXECUTE ON FUNCTION admit_patient FROM anon;
REVOKE EXECUTE ON FUNCTION cancel_session FROM anon;
REVOKE EXECUTE ON FUNCTION fn_verify_audit_chain FROM anon;
```

#### B2: `profiles_update_own` sem restricao de colunas

**Arquivo:** `120900_rls_policies.sql` linhas 27-31
**Policy:** `profiles_update_own` permite que qualquer authenticated atualize o proprio profile, incluindo colunas especificas da psicologa (`crp`, `specialty`, `default_session_value`, `cancellation_policy_hours`). Um paciente poderia setar `crp = 'fake'` no proprio profile. Sem impacto de seguranca direto (role e protegido por trigger), mas viola o principio de minimo privilegio.

**Sugestao:** trigger que impede pacientes de alterar colunas de psicologa, ou policies separadas por role.

#### B3: `sessions.cancellation_reason` e `audit_log.metadata` aceitam texto livre

**Arquivos:** `120200_sessions.sql`, `120700_audit_log.sql`
**Risco:** conteudo clinico pode ser inserido acidentalmente nesses campos (ex: "paciente relatou crise"). O schema nao impede. Mitigacao: validacao na aplicacao (logger.ts para metadata, validacao no Server Action para cancellation_reason).

#### B4: Policies single-tenant

**Arquivo:** `120900_rls_policies.sql`
**Exemplo:** `patients_select_psychologist` usa `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')` -- qualquer psicologa ve TODOS os pacientes. Para o cenario atual (1 psicologa), correto. Se o sistema crescer para multi-tenant, todas as policies de psicologa precisarao de refactoring para incluir `psychologist_id = auth.uid()`. Nao e risco atual.

#### B5: Status file indica 7 RPCs mas existem 6

**Arquivo:** `docs/talitha-status.md` linha 23
**Correto:** 6 RPCs SECURITY DEFINER (log_audit, log_audit_system, enter_waiting_room, admit_patient, cancel_session, fn_verify_audit_chain). A 7a contada e `fn_profiles_sync_role_metadata`, que e trigger SECURITY DEFINER, nao RPC. Inconsistencia documental, sem impacto de seguranca.

---

## Secao 3: Veredicto

### APROVADO COM RESSALVAS

O schema implementa 28 dos 32 requisitos com enforcement real no SQL. Os 4 parciais tem a estrutura correta com lacunas de enforcement especificas. Os 4 issues Altos sao lacunas de enforcement, nao falhas de concepcao. Todos tem DDL corrigido definido e testavel.

### Ressalvas obrigatorias (o que o Data Architect corrige antes do Backlog)

| # | Issue | Correcao | Complexidade |
|---|-------|----------|-------------|
| A1 | `log_audit` sem ownership | Adicionar validacao de role + ownership dentro da funcao | Baixa (10 linhas) |
| A2 | `retention_until` sem auto-calculo | Trigger `fn_patients_set_retention` + ajuste em `fn_block_delete_during_retention` | Baixa (20 linhas) |
| A3 | `consents` sem append-only triggers | 3 triggers + REVOKE opcional | Baixa (10 linhas) |
| A4 | REVOKE column-level vs table-level | REVOKE table-level + GRANT column-level em 7 tabelas | Media (revisao de RLS necessaria) |

**Fluxo:** Data Architect aplica as 4 correcoes -> Security Review re-verifica (pontual, nao review completo) -> Backlog.

### Requisitos para o Stack Agent (incorporar no Backlog)

| # | Issue | O que o Stack Agent faz |
|---|-------|------------------------|
| M2 | VIEW_RECORD transacional | Toda leitura clinica em RPC ou transacao unica (read + log_audit) |
| B1 | REVOKE anon em RPCs | Pode ser incorporado na migration patch pelo Data Architect |
| B2 | profiles_update_own colunas | Trigger ou policy separada por role |
| B3 | Texto livre em campos operacionais | Validacao na aplicacao (Server Actions) |

### Avaliacao da decisao autonoma: VIEW_RECORD sincrono

O Data Architect trocou o caminho assincrono (outbox `audit_log_pending` drenado por cron) por sincrono, argumentando volume irrelevante (~dezenas de leituras/dia). **A decisao e correta para este produto.** O volume nao justifica a complexidade de outbox + cron + drenagem. O custo de ~5ms por log sincrono e imperceptivel.

**A ressalva e M2:** o sincrono so e seguro se a leitura e o log estiverem na mesma transacao. Se forem chamadas separadas:
- Read succeeds, log fails -> leitura sem trilha de auditoria (o cenario que o audit log existe para cobrir)
- Read fails, log succeeds -> entrada orfao no log (ruido, nao risco)

O primeiro cenario e o grave. A mitigacao e simples (transacao unica ou RPC wrapper) e fica com o Stack Agent.

**Conclusao:** decisao autonoma aprovada com a condicao de que o Backlog inclua M2 como criterio de Definition of Done para toda task que le conteudo clinico.

---

## Secao 4: Verificacoes executaveis

As 6 verificacoes do Data Architect (V1-V6) estao corretas. Complemento com as que faltam:

### V7. Column-level REVOKE efetivo (A4)

```sql
-- Executar como authenticated (apos provisionar usuarios de teste)
-- DEVE falhar com "permission denied for column"
SET ROLE authenticated;
SET request.jwt.claim.sub = '<psychologist_uid>';
SET request.jwt.claims = '{"role": "authenticated", "aal": "aal2"}';

-- Testar em cada tabela:
SELECT content_ciphertext FROM clinical_records LIMIT 1;
-- ESPERADO: ERROR: permission denied for column content_ciphertext

SELECT cpf_ciphertext FROM patients LIMIT 1;
-- ESPERADO: ERROR: permission denied for column cpf_ciphertext

SELECT content_ciphertext FROM anamnesis LIMIT 1;
-- ESPERADO: ERROR: permission denied

RESET ROLE;
```

### V8. log_audit ownership (A1, apos correcao)

```sql
-- Como paciente autenticado, tentar logar acao sobre outro paciente
SET ROLE authenticated;
SET request.jwt.claim.sub = '<patient_uid>';
SET request.jwt.claims = '{"role": "authenticated"}';

SELECT log_audit(
  '<OUTRO_patient_id>'::UUID,
  'PURGE_RECORD'
);
-- ESPERADO: ERROR: patient can only log actions on own record

RESET ROLE;
```

### V9. consents append-only (A3, apos correcao)

```sql
-- Como service_role, tentar UPDATE e DELETE em consents
SET ROLE service_role;

UPDATE consents SET action = 'revoke' WHERE id = (SELECT id FROM consents LIMIT 1);
-- ESPERADO: ERROR: consents is append-only

DELETE FROM consents WHERE id = (SELECT id FROM consents LIMIT 1);
-- ESPERADO: ERROR: consents is append-only

TRUNCATE consents;
-- ESPERADO: ERROR: consents is append-only

RESET ROLE;
```

### V10. retention_until auto-calculo (A2, apos correcao)

```sql
-- Setar treatment_ended_at e verificar que retention_until foi calculado
UPDATE patients SET treatment_ended_at = now() WHERE id = '<patient_id>';
SELECT retention_until FROM patients WHERE id = '<patient_id>';
-- ESPERADO: retention_until = treatment_ended_at + 5 years (aprox)

-- Tentar reduzir retention_until
UPDATE patients SET retention_until = now() WHERE id = '<patient_id>';
-- ESPERADO: ERROR: Cannot reduce retention_until
```

### V11. RPCs nao executaveis por anon (B1, apos correcao)

```sql
SET ROLE anon;
SELECT enter_waiting_room('<session_id>'::UUID);
-- ESPERADO: ERROR: permission denied for function enter_waiting_room
RESET ROLE;
```

### V12. Hash chain integridade sob concorrencia

```sql
-- Inserir 10 entradas simultaneas (simular concorrencia)
-- Usar pgbench ou DO block com dblink
-- Apos insercao, verificar cadeia:
SELECT * FROM fn_verify_audit_chain();
-- ESPERADO: is_valid = true, total_entries = valid_entries
```

### V13. Monotonic state machine -- regressao bloqueada

```sql
-- Tentar voltar de paid para pending
UPDATE charges SET status = 'pending' WHERE id = '<charge_id_paid>';
-- ESPERADO: ERROR: Invalid charge status transition: paid -> pending
```

---

## Secao 5: Pendencias humanas

Pendencias que dependem de acao do desenvolvedor ou da cliente, nao de agentes:

| # | Pendencia | Responsavel | Impacto se nao resolvida |
|---|-----------|-------------|-------------------------|
| H1 | Verificar se Supabase provisioned tem `ALTER DEFAULT PRIVILEGES` com table-level grants para authenticated | Dev (no provisionamento) | Se sim, A4 e critico e exige a correcao de REVOKE table-level + GRANT column-level |
| H2 | Custodia da KEK: 2 copias offline + teste de restauracao | Dev + cliente | Sem custodia testada, prontuarios sao irrecuperaveis se o host falhar |
| H3 | Regiao do LiveKit Cloud: confirmar SFU em regiao sul-americana | Dev | Midia roteada por SFU nos EUA = transferencia internacional de dado sensivel |
| H4 | DNS: SPF/DKIM/DMARC `p=reject` configurado | Dev | Spoofing de email com identidade da psicologa |
| H5 | 2FA na conta EasyPanel | Dev + cliente | Comprometimento do EasyPanel = acesso a KEK |
| H6 | Politica de senha Supabase Auth: minimo 10 + pwned password check | Dev (Dashboard Auth) | Senhas fracas na conta da psicologa |
| H7 | Site URL e Redirect URLs no Dashboard Auth | Dev | Open redirect em fluxo OAuth/email |
| H8 | Signup publico desabilitado no Supabase Auth | Dev (Dashboard Auth) | Usuarios nao convidados criam conta |
| H9 | Ambiente de teste dedicado (nao usar producao para QA) | Dev | Dados de teste em producao |
| H10 | Versao minima do Next.js >= fix para CVE-2025-29927 | Dev (package.json) | Bypass de middleware |

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Review inicial: 28 implementados, 4 parciais, 0 nao implementados. 4 Altos, 2 Medios, 5 Baixos. Aprovado com ressalvas |

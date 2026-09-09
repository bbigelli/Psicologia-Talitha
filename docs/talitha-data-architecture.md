# Data Architecture: Talitha Psicologia

**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** `docs/talitha-architecture.md` (v1.1, secao 17), `docs/talitha-security-review-architecture.md` (secao 4), `docs/talitha-security-review-prd.md`, `docs/talitha-prd.md` (emendas E1-E4), `docs/talitha-user-stories.md`, `docs/adr/ADR-0001..0006`, `CLAUDE.md`, `docs/decisions.md`

---

## Diagrama de Entidades (Mermaid)

```mermaid
erDiagram
    profiles ||--o{ patients : "psychologist manages"
    profiles ||--o{ sessions : "psychologist conducts"
    profiles ||--o{ charges : "psychologist bills"
    profiles ||--o{ clinical_records : "psychologist writes"
    profiles ||--o{ session_note_drafts : "psychologist drafts"
    profiles ||--o{ receipts : "psychologist issues"

    patients ||--o{ sessions : "attends"
    patients ||--o{ charges : "is billed"
    patients ||--o{ clinical_records : "is subject of"
    patients ||--o{ anamnesis : "fills"
    patients ||--o{ consents : "gives"
    patients ||--o{ communication_preferences : "sets"
    patients ||--o{ email_action_tokens : "receives"
    patients ||--o{ data_subject_requests : "submits"
    patients ||--o{ receipts : "receives"
    patients ||--o{ subscriptions : "subscribes"

    sessions ||--o{ session_note_drafts : "has draft"
    sessions ||--o{ session_reminders : "has reminders"
    sessions ||--o{ email_action_tokens : "linked to"
    sessions ||--|{ clinical_records : "generates"

    charges ||--|{ receipts : "produces (1:1)"
    charges ||--o{ billing_rule_events : "triggers"
    charges }o--|| payment_webhook_events : "conciliated by"
    charges }o--o| subscriptions : "belongs to"

    receipt_counters ||--o{ receipts : "numbers"

    clinical_records ||--o{ clinical_record_versions : "versioned"

    profiles {
        uuid id PK
        text role
        text full_name
        boolean onboarding_completed
        timestamptz created_at
    }
    patients {
        uuid id PK
        uuid user_id FK
        uuid psychologist_id FK
        text cpf_hmac UK
        date date_of_birth
        text status
        timestamptz retention_until
    }
    sessions {
        uuid id PK
        uuid patient_id FK
        uuid psychologist_id FK
        timestamptz scheduled_at
        text room_name UK
        timestamptz waiting_since
        timestamptz admitted_at
        text status
        text payment_status
    }
    clinical_records {
        uuid id PK
        uuid patient_id FK
        uuid session_id FK
        bytea content_ciphertext
        smallint kek_version
        timestamptz retention_until
    }
    anamnesis {
        uuid id PK
        uuid patient_id FK_UK
        bytea content_ciphertext
        smallint kek_version
    }
    session_note_drafts {
        uuid id PK
        uuid session_id FK_UK
        uuid patient_id FK
        bytea content_ciphertext
        smallint kek_version
    }
    charges {
        uuid id PK
        uuid patient_id FK
        uuid psychologist_id FK
        text asaas_payment_id UK
        numeric amount
        text status
    }
    subscriptions {
        uuid id PK
        uuid patient_id FK_UK
        text asaas_subscription_id UK
        numeric monthly_value
        text status
    }
    payment_webhook_events {
        text asaas_event_id PK
        text event_type
        text payment_id
        timestamptz received_at
    }
    receipt_counters {
        int year PK
        int last_number
    }
    receipts {
        uuid id PK
        uuid charge_id FK_UK
        int receipt_number
        int receipt_year
        text status
    }
    consents {
        uuid id PK
        uuid patient_id FK
        text purpose
        text action
        text consent_text_hash
        timestamptz occurred_at
    }
    communication_preferences {
        uuid id PK
        uuid patient_id FK
        text channel
        text purpose
        boolean opted_out
    }
    email_action_tokens {
        uuid id PK
        text token_hash UK
        text purpose
        uuid patient_id FK
        uuid session_id FK
        timestamptz expires_at
        timestamptz used_at
    }
    data_subject_requests {
        uuid id PK
        uuid patient_id FK
        text request_type
        text status
        timestamptz due_at
        text decision
        text legal_basis
    }
    audit_log {
        uuid id PK
        uuid actor_id FK
        text actor_source
        text action
        uuid patient_id
        bytea prev_hash
        bytea row_hash
        timestamptz occurred_at
    }
    clinical_record_versions {
        uuid id PK
        uuid record_id FK
        int version_number
        bytea content_ciphertext
    }
```

---

## Tabelas

### 1. profiles

**Proposito:** Perfil do usuario vinculado a `auth.users`. `role` e a fonte canonica de autorizacao, espelhada em `app_metadata` por trigger. Contem dados profissionais da psicologa.

**Classificacao LGPD:** D6 (Interno), D15/D16 (Publico/Confidencial para psicologa)
**Retencao:** Vida da conta

**Colunas:**

| Coluna | Tipo | Constraints | Descricao |
|--------|------|-------------|-----------|
| id | UUID | PK, FK auth.users ON DELETE CASCADE | = auth.users.id |
| role | TEXT | NOT NULL, CHECK ('psychologist','patient') | Fonte canonica |
| full_name | TEXT | NOT NULL | Nome completo |
| email | TEXT | NOT NULL | Email |
| phone | TEXT | | Telefone |
| crp | TEXT | | CRP (psicologa) |
| crp_region | TEXT | | Regiao do CRP |
| epsi_status | TEXT | CHECK ('active','pending') | Status e-Psi |
| specialty | TEXT | | Especialidade |
| default_session_value | NUMERIC(10,2) | | Valor padrao da sessao |
| cancellation_policy_hours | INT | DEFAULT 24 | Prazo de cancelamento |
| cpf_ciphertext..cpf_kek_version | BYTEA/SMALLINT | | CPF criptografado (D16) |
| onboarding_completed | BOOLEAN | NOT NULL DEFAULT false | Onboarding |
| created_at | TIMESTAMPTZ | DEFAULT now() NOT NULL | |
| updated_at | TIMESTAMPTZ | DEFAULT now() NOT NULL | |

**Decisoes:**
- `profiles.id = auth.users.id` (padrao Supabase) em vez de UUID auto-gerado, para que `auth.uid()` resolva diretamente.
- CPF da psicologa criptografado com envelope (mesma infra do paciente) por precaucao, embora a arquitetura nao o exija explicitamente. E Confidencial (D16) e usado apenas server-side para recibos.
- Trigger `trg_profiles_protect_role` impede UPDATE na coluna role por qualquer usuario.
- Trigger `trg_profiles_sync_role_metadata` espelha role em `raw_app_meta_data` via SECURITY DEFINER.

### 2. patients

**Proposito:** Dados do paciente. CPF cifrado com envelope + blind index HMAC-SHA256 para unicidade. Vinculado a auth.users quando o paciente aceita o convite.

**Classificacao LGPD:** D5 (Confidencial - CPF), D6 (Interno)
**Retencao:** 5 anos apos `treatment_ended_at` (Emenda E1 - fixa, sem regra de 20 anos)

**Colunas relevantes:**

| Coluna | Tipo | Constraints | Descricao |
|--------|------|-------------|-----------|
| id | UUID | PK DEFAULT gen_random_uuid() | |
| user_id | UUID | UNIQUE FK auth.users ON DELETE SET NULL | Nullable ate aceite do convite |
| psychologist_id | UUID | NOT NULL FK profiles | |
| full_name | TEXT | NOT NULL | |
| email | TEXT | NOT NULL | |
| phone | TEXT | | Eliminavel por LGPD |
| date_of_birth | DATE | NOT NULL | |
| cpf_ciphertext..cpf_kek_version | BYTEA/SMALLINT | NOT NULL | Envelope encryption |
| cpf_hmac | TEXT | NOT NULL UNIQUE | HMAC-SHA256 blind index |
| status | TEXT | NOT NULL DEFAULT 'invited' | invited/active/inactive/treatment_ended |
| treatment_started_at | TIMESTAMPTZ | | |
| treatment_ended_at | TIMESTAMPTZ | | |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| retention_until | TIMESTAMPTZ | | Calculado automaticamente |

**Constraints criticas:**
- `CHECK (date_of_birth <= current_date - interval '18 years')` -- Requisito 18: unico enforcement de E1 que sobrevive a RPC, seed e correcao manual.
- `cpf_hmac UNIQUE` -- blind index com HMAC-SHA256 chaveado (nunca SHA-256 puro)
- Trigger `trg_patients_block_delete` impede DELETE durante retencao

### 3. sessions

**Proposito:** Sessoes de terapia. `room_name` e 128 bits aleatorios, unico, nunca reutilizado. Estado da sala de espera (`waiting_since`, `admitted_at`) nunca alterado por UPDATE direto.

**Classificacao LGPD:** D3 (Sensivel-LGPD - existencia do vinculo), D12 (room metadata)
**Retencao:** Vinculada ao paciente (5 anos)

**Colunas relevantes:**

| Coluna | Tipo | Constraints | Descricao |
|--------|------|-------------|-----------|
| id | UUID | PK | |
| patient_id | UUID | NOT NULL FK patients ON DELETE RESTRICT | |
| psychologist_id | UUID | NOT NULL FK profiles | |
| scheduled_at | TIMESTAMPTZ | NOT NULL | Data/hora agendada |
| duration_minutes | INT | NOT NULL DEFAULT 50 | |
| status | TEXT | NOT NULL DEFAULT 'scheduled' | scheduled/confirmed/in_progress/completed/cancelled/no_show |
| room_name | TEXT | UNIQUE NOT NULL DEFAULT gen 128 bits | LiveKit room identifier |
| waiting_since | TIMESTAMPTZ | | Paciente na sala de espera |
| admitted_at | TIMESTAMPTZ | | Paciente admitido |
| payment_status | TEXT | NOT NULL DEFAULT 'pending' | pending/paid/overdue/refunded/waived |
| recurrence_group_id | UUID | | Agrupamento de recorrencia |
| cancelled_at | TIMESTAMPTZ | | |
| cancelled_by | TEXT | | psychologist/patient/system |
| cancellation_reason | TEXT | | |

**Protecoes (Requisito 6 - AC2):**
- `REVOKE UPDATE ON sessions FROM authenticated, anon` -- nenhum UPDATE direto
- `REVOKE INSERT ON sessions FROM authenticated, anon` -- criacao via service_role
- `REVOKE DELETE ON sessions FROM authenticated, anon`
- Transicoes de estado APENAS por RPCs SECURITY DEFINER:
  - `enter_waiting_room(session_id)` -- escreve SO `waiting_since`
  - `admit_patient(session_id)` -- escreve SO `admitted_at`
  - `cancel_session(session_id, reason)` -- transicao controlada
- Trigger `trg_sessions_on_reschedule` regenera `room_name` e zera `waiting_since`/`admitted_at` quando `scheduled_at` muda

### 4. clinical_records

**Proposito:** Registros de evolucao clinica. Conteudo cifrado com envelope encryption (7 colunas). AAD = `patient_id|record_id`.

**Classificacao LGPD:** D1 (Sensivel-LGPD)
**Retencao:** 5 anos apos encerramento (CFP)

**Envelope encryption (Requisito 1):**
```
content_ciphertext  BYTEA NOT NULL    -- conteudo cifrado com DEK
content_iv          BYTEA NOT NULL    -- 12 bytes (GCM nonce)
content_tag         BYTEA NOT NULL    -- 16 bytes (GCM auth tag)
dek_wrapped         BYTEA NOT NULL    -- DEK cifrada com KEK
dek_iv              BYTEA NOT NULL
dek_tag             BYTEA NOT NULL
kek_version         SMALLINT NOT NULL DEFAULT 1
```

**RLS (Requisito 28):**
- Nenhuma policy concede SELECT a `patient`
- Clausula `(auth.jwt()->>'aal') = 'aal2'` em todas as policies
- REVOKE SELECT das colunas de ciphertext de `authenticated`

### 5. clinical_record_versions

**Proposito:** Versionamento append-only de evolucoes (Requisito 12). Toda edicao de `clinical_records` armazena a versao anterior aqui.

**Classificacao LGPD:** D1 (Sensivel-LGPD)
**Retencao:** Igual a clinical_records

### 6. anamnesis

**Proposito:** Ficha inicial do paciente. Campos de saude cifrados (medicacao, condicoes, contato de emergencia). Campos nao-sensiveis em claro para listagem.

**Classificacao LGPD:** D2 (Sensivel-LGPD), D4 (Confidencial - contato emergencia)
**Retencao:** 5 anos

**RLS (Requisito 28):**
- Paciente: INSERT/UPDATE/SELECT da propria linha (sem acesso a colunas de ciphertext via REVOKE)
- Psicologa: SELECT com `aal2`
- Ninguem tem DELETE durante retencao

### 7. session_note_drafts

**Proposito:** Rascunhos de anotacoes durante sessao (Requisito 23). Conteudo clinico - envelope completo. AAD = `patient_id|session_id`.

**Classificacao LGPD:** D1 (Sensivel-LGPD)
**Retencao:** Curta - deletado ao gravar evolucao; job de limpeza para orfaos > 7 dias

**RLS:** SO psicologa, nenhuma policy de SELECT para patient, aal2 obrigatorio.

### 8. charges

**Proposito:** Cobrancas vinculadas ao Asaas. Maquina de estados monotonica (Requisito 10, 31).

**Classificacao LGPD:** D11 (Interno/Confidencial)
**Retencao:** 5 anos (fiscal)

**Maquina de estados (Requisito 10):**
```
pending_creation -> pending -> overdue -> paid -> refunded/chargeback
                 -> cancelled
pending -> paid (pagamento antes do vencimento)
pending -> cancelled
overdue -> paid
overdue -> cancelled
paid -> refunded | chargeback (unicas transicoes permitidas a partir de paid)
```
Trigger `trg_charges_monotonic_status` impede regressoes.

### 9. subscriptions

**Proposito:** Assinaturas recorrentes via Asaas. UNIQUE por paciente (apenas uma ativa por vez).

**Classificacao LGPD:** D11 (Interno)
**Retencao:** 5 anos (fiscal)

### 10. payment_webhook_events

**Proposito:** Idempotencia de webhooks (Requisito 7). PK = `asaas_event_id`. Sem payload bruto - colunas de allowlist apenas. CPF e nome completo PROIBIDOS.

**Classificacao LGPD:** D11 (Interno)
**Retencao:** 5 anos

**Colunas permitidas (allowlist):** `event_type`, `payment_id`, `status`, `value`, `due_date`, `received_at`, `processed_at`, `result`.

### 11. receipt_counters

**Proposito:** Contador transacional por ano (Requisito 8, ADR-0005). `SELECT FOR UPDATE` serializa acesso. SEQUENCE nao serve (lacunas em rollback).

### 12. receipts

**Proposito:** Recibos IRPF numerados (Requisito 9). `UNIQUE(charge_id)` garante um recibo por cobranca.

**Classificacao LGPD:** D11 (Confidencial - agrega D3+D5)
**Retencao:** 5 anos (fiscal)

**Snapshots:** Nome, CRP e CPFs sao congelados no momento da geracao (Bill Inmon). CPFs armazenados cifrados com envelope.

### 13. consents

**Proposito:** Registros de consentimento append-only (Requisito 11). Sem `subject_type = 'guardian'` (Emenda E1). Todos os timestamps em `timestamptz` UTC.

**Classificacao LGPD:** D9 (Confidencial - prova de conformidade)
**Retencao:** Igual ao registro do paciente

**Finalidades (purpose):**
- `online_therapy` -- Termo CFP (obrigatorio)
- `lgpd_clinical` -- Consentimento LGPD principal (obrigatorio)
- `lgpd_asaas` -- Compartilhamento com Asaas (obrigatorio, destacado)
- `communication` -- Lembretes por email (opcional)

### 14. communication_preferences

**Proposito:** Opt-out por canal/finalidade (Requisito 22). Consultado pela regua e lembretes antes de cada envio.

**Classificacao LGPD:** D6 (Interno) - eliminavel por LGPD
**Retencao:** Vida da conta (eliminavel a pedido)

### 15. email_action_tokens

**Proposito:** Tokens hasheados para links de email (Requisito 19). Token NUNCA em claro no banco. RLS sem nenhuma policy para authenticated/anon.

**Classificacao LGPD:** D8 (Confidencial)
**Retencao:** Curta (auto-expiracao)

**Protecoes:**
- `token_hash` e SHA-256 do token real -- token nunca em claro
- `used_at` marcado na mesma transacao da acao
- Um token por acao (nunca token generico que aceite acao como parametro)
- TTL: 72h para convite, horario da sessao para confirmacao
- **Zero policies RLS** -- acesso so via RPC SECURITY DEFINER

### 16. data_subject_requests

**Proposito:** Solicitacoes LGPD (Requisito 21). Resposta fundamentada e requisito de conformidade.

**Classificacao LGPD:** D9/D10 (Confidencial - prova de compliance)
**Retencao:** Igual ao registro do paciente

**Campos de resposta:** `decision`, `legal_basis`, `eliminated_categories`, `retained_categories` -- sem esses campos, nao ha prova de atendimento.

### 17. session_reminders

**Proposito:** Idempotencia de lembretes (Requisito 29). `UNIQUE (session_id, reminder_type)` como constraint de banco.

### 18. billing_rule_events

**Proposito:** Idempotencia da regua de cobranca (Requisito 29). `UNIQUE (charge_id, step)` como constraint de banco.

### 19. audit_log

**Proposito:** Log de auditoria imutavel com 4 camadas (Requisito 3, ADR-0004).

**Classificacao LGPD:** D10 (Confidencial - prova em processo etico)
**Retencao:** Igual ao registro do paciente (5 anos min)

**4 Camadas:**

| Camada | Mecanismo | Protege contra |
|--------|-----------|---------------|
| 1 | RLS + FORCE ROW LEVEL SECURITY | Cliente autenticado |
| 2 | Triggers BEFORE UPDATE/DELETE (row) e TRUNCATE (statement) | service_role e bugs da app |
| 3 | REVOKE UPDATE/DELETE/TRUNCATE de authenticated, anon, service_role | Defense in depth |
| 4 | Hash chain (prev_hash/row_hash) + pg_advisory_xact_lock | Superuser/insider (detectavel) |

**Duas funcoes de escrita (Requisito 4):**
- `log_audit(...)` -- contexto usuario, `actor_id := auth.uid()`, RAISE se NULL
- `log_audit_system(...)` -- contexto service_role, recebe `p_actor_id`, executavel APENAS por service_role

**Coluna `actor_source`:** enum `('user', 'edge_function', 'webhook', 'cron', 'anonymous')`. `actor_id` nullable apenas quando `actor_source = 'anonymous'`.

**Serializacao (Requisito 25):** `pg_advisory_xact_lock(hashtext('audit_log_chain'))` no trigger BEFORE INSERT impede fork da cadeia sob concorrencia.

**Decisao sobre async vs sync (Requisito 26):** Todos os eventos sao sincronos, incluindo `VIEW_RECORD`. O volume deste produto (~20-30 pacientes, uma psicologa) torna o custo de ~5ms por log irrelevante. Isso elimina a necessidade de tabela outbox `audit_log_pending` e simplifica significativamente a arquitetura. Se o volume crescer, migrar VIEW_RECORD para outbox.

---

## RLS Policies

### Matriz completa

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| **profiles** | Psicologa: todas; Paciente: propria + psicologa | Nenhuma (service_role) | Proprio usuario (exceto role) | Nenhuma |
| **patients** | Psicologa: todas; Paciente: propria | Nenhuma (service_role) | Nenhuma (service_role/RPC) | Nenhuma (trigger de retencao) |
| **sessions** | Psicologa: suas; Paciente: suas | Nenhuma (REVOKE) | Nenhuma (REVOKE, RPCs) | Nenhuma (REVOKE) |
| **clinical_records** | Psicologa: suas, aal2 | Psicologa: aal2 | Psicologa: aal2 | Nenhuma (soft delete) |
| **clinical_record_versions** | Psicologa: editadas por ela, aal2 | Psicologa: aal2 | Nenhuma (append-only) | Nenhuma |
| **anamnesis** | Psicologa: de seus pacientes, aal2; Paciente: propria | Paciente: propria | Paciente: propria | Nenhuma (retencao) |
| **session_note_drafts** | Psicologa: seus, aal2 | Psicologa: aal2 | Psicologa: aal2 | Psicologa: aal2 |
| **charges** | Psicologa: suas; Paciente: proprias | Nenhuma (service_role) | Nenhuma (service_role) | Nenhuma |
| **subscriptions** | Psicologa: suas; Paciente: proprias | Nenhuma (service_role) | Nenhuma (service_role) | Nenhuma |
| **payment_webhook_events** | Nenhuma | Nenhuma (service_role) | Nenhuma | Nenhuma |
| **receipt_counters** | Nenhuma | Nenhuma (service_role) | Nenhuma (service_role) | Nenhuma |
| **receipts** | Psicologa: seus; Paciente: proprios | Nenhuma (service_role) | Nenhuma | Nenhuma |
| **consents** | Psicologa: todos; Paciente: proprios | Paciente: proprios | Nenhuma (append-only) | Nenhuma |
| **communication_preferences** | Psicologa + paciente proprio | Nenhuma (app cria) | Paciente: proprio | Nenhuma |
| **email_action_tokens** | Nenhuma | Nenhuma | Nenhuma | Nenhuma |
| **data_subject_requests** | Psicologa: todos; Paciente: proprios | Paciente: proprios | Nenhuma (service_role) | Nenhuma |
| **session_reminders** | Psicologa: de suas sessoes | Nenhuma (cron) | Nenhuma (cron) | Nenhuma |
| **billing_rule_events** | Psicologa: de suas charges | Nenhuma (cron) | Nenhuma (cron) | Nenhuma |
| **audit_log** | Psicologa: todos | Nenhuma (via funcao SD) | Nenhuma (trigger + REVOKE) | Nenhuma (trigger + REVOKE) |

**Convencao de "Nenhuma":** ausencia de policy = operacao negada pelo Postgres. E decisao explicita, nao omissao.

---

## Triggers e Functions

| Trigger / Function | Tabela | Evento | O que faz |
|---|---|---|---|
| `fn_update_timestamp` | -- | -- | Funcao generica: `NEW.updated_at = now()` |
| `trg_*_updated_at` | Todas com updated_at | BEFORE UPDATE | Atualiza `updated_at` |
| `fn_profiles_protect_role` | profiles | BEFORE UPDATE | Impede alteracao de `role` |
| `fn_profiles_sync_role_metadata` | profiles | AFTER INSERT/UPDATE OF role | Espelha role em `app_metadata` (SECURITY DEFINER) |
| `fn_sessions_on_reschedule` | sessions | BEFORE UPDATE | Regenera room_name e zera waiting/admitted quando scheduled_at muda |
| `fn_charges_monotonic_status` | charges | BEFORE UPDATE OF status | Impede regressao na maquina de estados de pagamento |
| `fn_block_delete_during_retention` | patients, clinical_records, anamnesis | BEFORE DELETE | Bloqueia DELETE durante periodo de retencao |
| `fn_audit_log_block_mutation` | audit_log | BEFORE UPDATE/DELETE (row), BEFORE TRUNCATE (statement) | Impede qualquer mutacao no audit log |
| `fn_audit_log_hash_chain` | audit_log | BEFORE INSERT | Calcula prev_hash e row_hash com serializacao via pg_advisory_xact_lock |

### RPCs SECURITY DEFINER

Cada RPC segue o padrao: search_path fixo, validacao de auth.uid(), validacao de papel, validacao de ownership, escrita de UMA unica coluna.

| RPC | Parametros | O que faz | Motivo SECURITY DEFINER |
|---|---|---|---|
| `log_audit` | patient_id, action, target_id, ... | Insere no audit_log com actor_id = auth.uid() | INSERT no audit_log so via SD (camada 3) |
| `log_audit_system` | actor_id, actor_source, ... | Insere no audit_log para contexto Edge/cron | Executavel APENAS por service_role |
| `enter_waiting_room` | session_id | Escreve SO waiting_since; valida ownership e janela temporal | RLS nao e column-level (AC2) |
| `admit_patient` | session_id | Escreve SO admitted_at; exige role=psychologist | Idem |
| `cancel_session` | session_id, reason | Transicao controlada de estado | Idem |
| `fn_verify_audit_chain` | from_id, to_id | Recalcula e verifica integridade da cadeia de hash | So psicologa pode verificar |

---

## RBAC

**Abordagem:** A (roles fixos em `profiles`) -- conforme PRD.

**Roles:**
- `psychologist` -- acesso total a gestao (1 usuario)
- `patient` -- acesso ao proprio portal (N usuarios)

**Fonte canonica:** `profiles.role` (Requisito 13). Espelhado em `app_metadata` por trigger para caminho rapido do middleware. RLS nunca confia apenas no claim do JWT. Policies clinicas exigem `(auth.jwt()->>'aal') = 'aal2'` (Requisito 29).

**Bootstrap:**
- Psicologa provisionada por seed/migration
- Paciente criado exclusivamente via convite
- Signup publico desabilitado

---

## Eliminacao Seletiva por Categoria (Requisito 20)

| Categoria de Dado | Base legal apos revogacao | Na revogacao | No pedido de eliminacao |
|---|---|---|---|
| Evolucao clinica, anamnese (D1, D2) | Obrigacao regulatoria CFP | Congelar: read-only, deleted_at | Negar ate retention_until |
| Identificacao minima (nome, CPF, nascimento) | idem | Congelar | Negar ate retention_until |
| Cobrancas, recibos (D11) | Obrigacao fiscal (5 anos) | Congelar | Negar ate 5 anos |
| Consentimentos, audit log (D9, D10) | Prova de conformidade | Congelar | Negar durante retencao |
| Telefone, preferencias de comunicacao, contato emergencia | Consentimento | **Eliminar/anonimizar** | **Atender** |
| Rascunho de anotacoes incorporado | Nenhuma | Eliminar ao salvar evolucao | Atender |
| Conta de autenticacao (auth.users) | Nenhuma apos encerramento | Revogar sessoes e desativar | Atender (deletar auth user) |

---

## Indices

Todos os indices sao justificados por queries reais das telas.

```sql
-- profiles: RLS filter by role
CREATE INDEX idx_profiles_role ON profiles(role);

-- patients: RLS + listing
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_psychologist_id ON patients(psychologist_id);
CREATE INDEX idx_patients_status ON patients(status);

-- sessions: agenda views
CREATE INDEX idx_sessions_patient_id ON sessions(patient_id);
CREATE INDEX idx_sessions_psychologist_id ON sessions(psychologist_id);
CREATE INDEX idx_sessions_scheduled_at ON sessions(scheduled_at);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_psychologist_scheduled ON sessions(psychologist_id, scheduled_at);
-- Agenda semanal: WHERE psychologist_id = $1 AND scheduled_at BETWEEN $2 AND $3

-- clinical_records: history views (sem indice em plaintext!)
CREATE INDEX idx_clinical_records_patient_id ON clinical_records(patient_id);
CREATE INDEX idx_clinical_records_patient_date ON clinical_records(patient_id, session_date DESC);
-- Historico: WHERE patient_id = $1 ORDER BY session_date DESC LIMIT 20

-- charges: dashboard financeiro
CREATE INDEX idx_charges_patient_id ON charges(patient_id);
CREATE INDEX idx_charges_psychologist_id ON charges(psychologist_id);
CREATE INDEX idx_charges_status ON charges(status);
CREATE INDEX idx_charges_due_date ON charges(due_date);
CREATE INDEX idx_charges_status_due ON charges(status, due_date)
  WHERE status IN ('pending', 'overdue');
-- Dashboard KPI: SELECT SUM(amount) WHERE status = 'paid' AND paid_at BETWEEN ...
-- Inadimplentes: WHERE status = 'overdue' ORDER BY due_date ASC

-- audit_log: browsing and patient history
CREATE INDEX idx_audit_log_patient_id ON audit_log(patient_id);
CREATE INDEX idx_audit_log_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_patient_action ON audit_log(patient_id, action, occurred_at DESC);
-- Log do paciente: WHERE patient_id = $1 ORDER BY occurred_at DESC LIMIT 50
```

**Nota:** Nenhum indice em plaintext de conteudo clinico. Busca no historico e decrypt-then-filter server-side (volume: ~1500 registros max).

---

## Seed Data

### Dados estruturais (obrigatorios antes do sistema funcionar)

```sql
-- Inicializacao do contador de recibos
INSERT INTO receipt_counters (year, last_number) VALUES (2026, 0)
ON CONFLICT (year) DO NOTHING;
```

### Dados de desenvolvimento (ficticios, >= 18 anos)

Os dados de desenvolvimento requerem:
1. Criacao de auth.users via Supabase Dashboard ou CLI
2. Geracao de campos criptografados pelo modulo `src/lib/crypto/` da aplicacao

**Procedimento:**
1. Criar auth users (psicologa + 3 pacientes ficticios) via Dashboard
2. Executar seed script da aplicacao que chama as funcoes de criptografia
3. Inserir sessoes em varios estados (scheduled, completed, cancelled)
4. Inserir cobrancas em varios estados (pending, paid, overdue, refunded)
5. Inserir consentimentos aceitos
6. Inserir registros de audit log

**Pacientes ficticios (exemplo):**
- Ana Silva, nascida 1990-03-15 (36 anos), status active
- Bruno Santos, nascido 1985-07-22 (41 anos), status active
- Carla Oliveira, nascida 1998-11-08 (27 anos), status invited

**Ressalva:** Seed NUNCA contem dado real de paciente. CPFs ficticios gerados por algoritmo de validacao (ex: 123.456.789-09).

---

## Verificacoes Executaveis (Requisito 32)

### V1. Nenhuma tabela sem RLS

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- Resultado esperado: 0 linhas
```

### V2. audit_log com FORCE ROW LEVEL SECURITY

```sql
SELECT relname
FROM pg_class
WHERE relname = 'audit_log'
  AND relforcerowsecurity = false;
-- Resultado esperado: 0 linhas
```

### V3. UPDATE/DELETE/TRUNCATE em audit_log falha

```sql
-- Como service_role:
UPDATE audit_log SET action = 'TAMPERED' WHERE id = (SELECT id FROM audit_log LIMIT 1);
-- Esperado: EXCEPTION 'audit_log is append-only'

DELETE FROM audit_log WHERE id = (SELECT id FROM audit_log LIMIT 1);
-- Esperado: EXCEPTION 'audit_log is append-only'

TRUNCATE audit_log;
-- Esperado: EXCEPTION 'audit_log is append-only'
```

### V4. UPDATE em sessions como paciente (authenticated) falha

```sql
-- Como authenticated (paciente):
UPDATE sessions SET admitted_at = now() WHERE id = '<session_id>';
-- Esperado: ERROR permission denied (REVOKE)
```

### V5. SELECT de coluna de ciphertext como authenticated falha

```sql
-- Como authenticated:
SELECT cpf_ciphertext FROM patients WHERE id = '<patient_id>';
-- Esperado: ERROR permission denied for column cpf_ciphertext
```

### V6. Verificacao da cadeia de hash

```sql
-- Como psychologist authenticated:
SELECT * FROM fn_verify_audit_chain();
-- Esperado: is_valid = true, total_entries = valid_entries
```

---

## Decisoes

| Decisao | Alternativa descartada | Motivo |
|---------|----------------------|--------|
| TEXT + CHECK para todos os enums | PostgreSQL native ENUM | Impossivel remover/renomear valores sem migration destrutiva |
| profiles.id = auth.users.id | UUID auto-gerado separado | auth.uid() resolve diretamente sem JOIN; padrao Supabase |
| VIEW_RECORD sincrono (sem outbox) | audit_log_pending drenada por cron | Volume irrelevante (~dezenas/dia); elimina complexidade da tabela outbox e do cron de drenagem |
| CPF da psicologa criptografado | Plaintext em profiles | Classificado como Confidencial (D16); mesmo padrao do paciente por consistencia |
| Retencao fixa 5 anos | Retencao variavel 5/20 anos | Emenda E1: pratica nao atende menores. Regra de 20 anos nao modelada |
| Nao modelar is_minor_at_start | Coluna com calculo de retencao variavel | Emenda E1 torna a coluna desnecessaria |
| Receipts com CPFs criptografados (snapshot) | CPFs em claro no recibo | Recibo agrega D3+D5; snapshot necessario para desacoplamento do paciente |
| Recurrence como group_id em sessions | Tabela separada de recurrence rules | Cada ocorrencia e uma linha independente; grupo serve apenas para cancelamento em lote |
| UNIQUE(patient_id) em subscriptions | Permitir multiplas assinaturas ativas | PRD: "se ja tem assinatura ativa, nao pode criar outra" |
| current_date em CHECK de idade | Trigger BEFORE INSERT | PostgreSQL aceita current_date em CHECK; re-avaliado em cada INSERT/UPDATE, correto para o caso de uso |

---

## Migrations

Arquivos em `supabase/migrations/`, ordenados por dependencia:

| Arquivo | Conteudo |
|---------|----------|
| `20260909120000_extensions_and_utilities.sql` | pgcrypto, pg_net, fn_update_timestamp |
| `20260909120100_core_tables.sql` | profiles, patients (com CHECK idade, blind index, trigger retencao) |
| `20260909120200_sessions.sql` | sessions (room_name, trigger de remarcacao) |
| `20260909120300_clinical_tables.sql` | clinical_records, clinical_record_versions, anamnesis, session_note_drafts |
| `20260909120400_financial_tables.sql` | charges (maquina monotonica), subscriptions, payment_webhook_events, receipt_counters, receipts |
| `20260909120500_compliance_tables.sql` | consents, communication_preferences, email_action_tokens, data_subject_requests |
| `20260909120600_operational_tables.sql` | session_reminders, billing_rule_events |
| `20260909120700_audit_log.sql` | audit_log com 4 camadas (RLS+FORCE, triggers, hash chain com serializacao) |
| `20260909120800_rpc_functions.sql` | log_audit, log_audit_system, enter_waiting_room, admit_patient, cancel_session, fn_verify_audit_chain |
| `20260909120900_rls_policies.sql` | Todas as policies (uma por operacao por perfil) + triggers de protecao de role |
| `20260909121000_grants_revokes_indexes.sql` | REVOKE/GRANT + todos os indices |
| `20260909121100_seed_development.sql` | receipt_counters init + guia de seed |

**Aplicacao pendente:** Nao existe projeto Supabase provisionado. Migrations escritas e prontas para `supabase db push` apos provisionamento.

---

## Historico de versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Versao inicial: 19 tabelas, 7 RPCs SECURITY DEFINER, 4 camadas de audit log, envelope encryption em 4 tabelas, 32 requisitos da secao 17 absorvidos |

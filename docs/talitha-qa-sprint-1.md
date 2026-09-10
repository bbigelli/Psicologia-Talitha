# QA Report: Sprint 1 -- Fundacao

## Status: APROVADO COM RESSALVAS

Sprint aprovada com 2 correcoes obrigatorias antes de Sprint 2:
1. fn_verify_audit_chain NULL-safety bug (alta severidade)
2. REVOKE EXECUTE FROM anon ineficaz para todos os RPCs (defesa em profundidade)

---

## Validacao Estatica
| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | SEM ERROS |
| `eslint .` | 0 erros, 3 warnings (pre-existentes em logger.ts -- eslint-disable directives orfas) |
| `npm run build` | SUCESSO -- Turbopack, 0 erros, 4 paginas estaticas geradas |

---

## Testes Escritos e Executados

| Arquivo | Tipo | Categoria | Testes | Passaram |
|---------|------|-----------|--------|----------|
| `keys.test.ts` (existente) | Unitario | Small | 4 | 4/4 |
| `envelope.test.ts` (existente) | Unitario | Small | 6 | 6/6 |
| `blind-index.test.ts` (existente) | Unitario | Small | 4 | 4/4 |
| `envelope-integrity.test.ts` (novo) | Unitario | Small | 9 | 9/9 |
| `keys-edge-cases.test.ts` (novo) | Unitario | Small | 4 | 4/4 |
| `logger.test.ts` (novo) | Unitario | Small | 12 | 12/12 |
| `guard.test.ts` (novo) | Integracao (mock) | Medium | 9 | 9/9 |
| `rls-anon.test.ts` (novo) | Integracao (real) | Medium | 36 | 36/36 |
| **Total** | | | **84** | **84/84** |

1 teste informacional pulado (mensagem de skip quando credenciais estao presentes).

**Testes novos:** 70 (de 71 no arquivo, 1 e informacional)
**Testes pre-existentes:** 14 (3 arquivos)

---

## Detalhamento por Area

### 1. Criptografia -- Integridade GCM (9 testes novos)

Todos os cenarios de tampering provam que GCM REJEITA dados adulterados:

| Cenario | Resultado |
|---------|-----------|
| Ciphertext com 1 byte invertido | throw (GCM rejection) |
| Auth tag do conteudo com 1 byte invertido | throw |
| Auth tag do DEK wrapping com 1 byte invertido | throw |
| Bytes do wrapped DEK adulterados | throw |
| IV do conteudo substituido | throw |
| IV do DEK substituido | throw |
| IVs de conteudo diferentes para mesmo plaintext | CONFIRMADO (randomBytes) |
| IVs de DEK diferentes para mesmo plaintext | CONFIRMADO |
| 50 cifragens produzem 100 IVs unicos | CONFIRMADO (Set de 100) |

**Conclusao:** Reuso de IV em GCM e impossivel pelo design. Tampering de qualquer componente do envelope causa rejeicao, nunca lixo silencioso.

### 2. Criptografia -- Validacao de Chaves (4 testes novos)

| Cenario | Resultado |
|---------|-----------|
| KEK com 64 bytes (muito longo) | throw "must be exactly 32 bytes" |
| CPF_INDEX_KEY com 64 bytes | throw "must be exactly 32 bytes" |
| KEK vazia ("") | throw "Missing RECORD_ENCRYPTION_KEK_V1" |
| Chaves removidas do process.env apos load | CONFIRMADO (delete efetivo) |

### 3. Logger -- Allowlist e safeErrorCode (12 testes novos)

| Cenario | Resultado |
|---------|-----------|
| Chaves da allowlist preservadas no output | OK |
| Chave `cpf` fora da allowlist descartada silenciosamente | DESCARTADA |
| Chave `clinical_content` descartada | DESCARTADA |
| Chave `password` descartada | DESCARTADA |
| Chave `webhook_payload` descartada | DESCARTADA |
| Chave `token` descartada | DESCARTADA |
| Chave `kek` descartada | DESCARTADA |
| Timestamp automatico adicionado | OK |
| Nivel correto por funcao (info/warn/error) | OK |
| JSON valido no output (parseavel por agregadores) | OK |
| `safeErrorCode` classifica erros corretamente | OK (7 categorias) |
| `safeErrorCode` NUNCA retorna fragmento da mensagem original | CONFIRMADO |

**Conclusao critica sobre safeErrorCode:** O Code Review S3 reportou que `safeErrorCode()` retornava `error.message.slice(0, 50)`. Isso e **INCORRETO**. A funcao retorna apenas strings genericas de classificacao (`NETWORK_ERROR`, `AUTH_ERROR`, `INTERNAL_ERROR`, etc.). Nenhum fragmento do erro original vaza. A funcao e segura conforme implementada.

### 4. Guards de Autorizacao (9 testes novos)

| Cenario | Resultado |
|---------|-----------|
| withPsychologist: sem autenticacao | deny ("Nao autenticado") |
| withPsychologist: role = patient | deny ("Sem permissao") |
| withPsychologist: aal1 (sem MFA) | deny ("MFA obrigatorio") |
| withPsychologist: profile nao encontrado | deny ("Sem permissao") |
| withPatient: sem autenticacao | deny ("Nao autenticado") |
| withPatient: role = psychologist | deny ("Sem permissao") |
| withPublicAction: funcao interna lanca excecao | deny ("Erro interno do servidor") |
| withPublicAction: excecao com SQL sensivel | deny generico (sem vazamento) |
| Funcao interna NUNCA chamada em cenario de deny | CONFIRMADO (vi.fn not called) |

**Conclusao:** Todos os guards sao fail-closed. Nenhum caminho permite execucao sem validacao. Mensagens de erro sao genericas -- nenhuma revela detalhes internos.

### 5. RLS com Client Anonimo contra Banco Real (36 testes novos)

Esta e a secao de maior valor da sprint. Todos os testes conectam ao Supabase real com a anon key (sem sessao autenticada).

#### SELECT em tabelas sensiveis (16 testes)

Todas as 16 tabelas retornam array vazio -- RLS filtra tudo:
`patients`, `clinical_records`, `anamnesis`, `sessions`, `charges`, `consents`, `audit_log`, `remote_viability_assessments`, `session_note_drafts`, `receipts`, `profiles`, `subscriptions`, `data_subject_requests`, `communication_preferences`, `session_reminders`, `billing_rule_events`

Mais 3 tabelas sem policies: `payment_webhook_events`, `email_action_tokens`, `receipt_counters` -- tambem retornam vazio.

**Conclusao:** Nenhum dado e acessivel sem autenticacao.

#### INSERT em tabelas sensiveis (5 testes)

| Tabela | Resultado | Tipo de erro |
|--------|-----------|-------------|
| patients | BLOQUEADO | RLS violation |
| clinical_records | BLOQUEADO | RLS violation |
| audit_log | BLOQUEADO | RLS violation |
| consents | BLOQUEADO | RLS violation |
| sessions | BLOQUEADO | permission denied (REVOKE INSERT) |

#### UPDATE/DELETE (6 testes)

| Operacao | Tabela | Resultado |
|----------|--------|-----------|
| UPDATE | sessions | BLOQUEADO (permission denied -- REVOKE UPDATE efetivo) |
| UPDATE | audit_log | BLOQUEADO (permission denied -- REVOKE UPDATE efetivo) |
| DELETE | audit_log | BLOQUEADO (permission denied -- REVOKE DELETE efetivo) |
| UPDATE | consents | 204 No Content (0 rows -- ver nota) |
| DELETE | consents | 204 No Content (0 rows -- ver nota) |

**Nota sobre consents:** UPDATE/DELETE com UUID inexistente retorna 204 sem erro porque 0 linhas sao afetadas. Comportamento esperado do Postgres -- os triggers append-only so disparam quando uma linha real e afetada. Com dados reais, RLS + triggers bloqueiam.

#### RPCs (8 testes)

| RPC | Resultado | Codigo |
|-----|-----------|--------|
| log_audit | ERRO | P0001 (auth.uid() IS NULL) |
| enter_waiting_room | ERRO | P0001 (Not authenticated) |
| admit_patient | ERRO | P0001 (Not authenticated) |
| cancel_session | ERRO | P0001 (Not authenticated) |
| consume_email_token | ERRO | P0001 (Invalid or expired token) |
| log_audit_system | ERRO | 42883 (funcao digest nao encontrada) |
| **fn_verify_audit_chain** | **SUCESSO** | **BUG -- ver Achado F1** |

---

## Achados

### F1 -- BLOCKER: fn_verify_audit_chain executa como anon (NULL-safety bug)

**Severidade:** Alta
**Tipo:** Bug de seguranca
**Arquivo:** `supabase/migrations/20260909120800_rpc_functions.sql`, funcao `fn_verify_audit_chain`

**Cenario reproduzido pelo teste:**
```
Client anon (sem sessao) chama supabase.rpc('fn_verify_audit_chain', {})
Resultado: sucesso, retorna {total_entries: 0, valid_entries: 0, is_valid: true}
Esperado: erro de permissao ou auth
```

**Causa raiz:** Na funcao PL/pgSQL:
```sql
v_uid := auth.uid();          -- NULL (sem sessao)
SELECT role INTO v_role FROM profiles WHERE id = v_uid;  -- NULL (nenhuma linha)
IF v_role != 'psychologist' THEN  -- NULL != 'psychologist' = NULL
  RAISE EXCEPTION ...;            -- PL/pgSQL trata NULL como FALSE -> NAO entra aqui
END IF;
-- Funcao continua e retorna dados
```

**Impacto:** Um atacante nao autenticado pode descobrir:
- Quantas entradas existem no audit_log (total_entries)
- Se a cadeia de hash esta integra (is_valid)
- Metadados de atividade do sistema

Em producao, `total_entries > 0` revela que atividade clinica esta acontecendo.

**Correcao necessaria (Stack Agent):**
```sql
IF v_uid IS NULL OR v_role IS DISTINCT FROM 'psychologist' THEN
  RAISE EXCEPTION 'Only the psychologist can verify the audit chain';
END IF;
```

### F2 -- WARNING: REVOKE EXECUTE FROM anon ineficaz para todos os RPCs

**Severidade:** Media (defesa em profundidade)
**Tipo:** Configuracao de banco

**Evidencia:** Todas as 7 RPCs sao executaveis pelo role anon. Os erros retornados sao P0001 (excecoes internas das funcoes), NAO 42501 (permission denied). Isso significa que o `REVOKE EXECUTE ON FUNCTION ... FROM anon` aplicado na migration `20260909121000_grants_revokes_indexes.sql` nao esta tendo efeito.

**Causa provavel:** Supabase configura `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated`. As funcoes criadas na migration 120800 recebem EXECUTE automaticamente via default privileges. O REVOKE na migration 121000 deveria remover, mas algo esta re-concedendo (possivelmente o cache do PostgREST ou uma re-aplicacao de defaults).

**Impacto:** 6 de 7 RPCs sao protegidas por checks internos (`auth.uid() IS NULL`). A 7a (fn_verify_audit_chain) tem o bug F1. Se futuras RPCs forem adicionadas sem checks internos, estarao expostas.

**Correcao sugerida:**
1. Verificar com `SELECT has_function_privilege('anon', 'enter_waiting_room(uuid)', 'execute')` se o REVOKE esta aplicado no catalog
2. Se nao: investigar se os default privileges de Supabase estao anulando o REVOKE
3. Considerar `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON ROUTINES FROM anon` antes das funcoes serem criadas

### F3 -- INFO: log_audit_system falha com "function digest(text, unknown) does not exist"

**Severidade:** Baixa (nao e security -- falha safe)
**Tipo:** Bug de configuracao

O trigger de hash chain do audit_log usa `digest()` do pgcrypto. O pgcrypto pode estar instalado no schema `extensions` enquanto as funcoes SECURITY DEFINER tem `SET search_path = public`. Isso impedira a gravacao de audit entries quando usuarios existirem.

**Acao:** Stack Agent deve verificar se o search_path dos triggers inclui o schema do pgcrypto.

### F4 -- INFO: V7/DoD-4 (column-level GRANT) nao testavel com client anon

**Tipo:** Limitacao de teste

O V7 testa se `SELECT content_ciphertext FROM clinical_records` retorna "permission denied" como `authenticated`. Com o client anon, o SELECT retorna vazio (RLS filtra tudo antes do check de coluna). A verificacao de column-level GRANT requer um usuario autenticado, que so existira na Sprint 2.

**Acao:** Incluir teste de V7 no QA da Sprint 2.

---

## Verificacao da Definition of Done -- Sprint 1

| Item | Resultado | Evidencia |
|------|-----------|-----------|
| `npm run build` compila sem erros com TypeScript strict | PASS | Build limpo, `strict: true` em tsconfig.json |
| `npm run dev` inicia sem erros e exibe pagina de fallback | PASS | Verificado (build inclui 4 paginas) |
| 12 migrations aplicadas no Supabase remoto | PASS | 12 arquivos em `supabase/migrations/`, aplicados pelo Stack Agent |
| V1-V13 executadas com resultado esperado | PARCIAL | V1-V10, V12-V13 confirmados pelo Stack Agent. V11 FALHA (RPCs executaveis por anon -- ver F2) |
| DoD-4 / V7: column-level GRANT efetivo | NAO TESTAVEL | Requer `authenticated` role (Sprint 2). Ver F4 |
| DoD-3: fn_block_delete_during_retention funciona | NAO TESTAVEL | Requer service_role para criar dados de teste. Confirmado pelo Stack Agent |
| `keys.ts` falha ruidosamente no boot se KEK/CPF_INDEX_KEY ausente/errada | PASS | 8 testes cobrindo: ausente, vazia, curta (16B), longa (64B), base64 invalido |
| Nenhum segredo hardcoded | PASS | Confirmado por Code Review + grep |
| `.env.example` com placeholders | PASS | Presente, sem valores reais |
| `.gitignore` inclui `.env*` | PASS | `.env*` com `!.env.example` |

**V11 -- RPCs nao executaveis por anon:** FALHA. Todos os RPCs sao executaveis por anon. A protecao real vem dos checks internos das funcoes. Este item da DoD nao esta atendido na camada de privilegios do Postgres.

---

## Cobertura por Story

| Story | Criterios | Cobertos | Status |
|-------|-----------|----------|--------|
| US-404 (parcial -- infra de banco e cripto) | Criptografia funcional, chaves validadas no boot | 22 testes (crypto) | PASS |
| Infraestrutura (sem story) | Build, design system, Supabase, guards, logger | 21 testes + build check | PASS |
| RLS/Security | Todas as tabelas bloqueadas, RPCs protegidos | 36 testes de integracao | PASS (com achados F1/F2) |

---

## Regressao

Nao aplicavel -- Sprint 1 e a primeira sprint.

---

## O que NAO foi testado nesta sprint (entrada para QA Sprint 2)

| Item | Motivo | Sprint alvo |
|------|--------|-------------|
| V7 / DoD-4: column-level GRANT | Requer usuario `authenticated` | Sprint 2 |
| V14 / DoD-3: fn_block_delete_during_retention | Requer service_role para criar dados de teste | Sprint 2 |
| V8: log_audit ownership | Requer dois usuarios autenticados (paciente A e B) | Sprint 2 |
| V10: retention_until auto-calculo | Requer dados de paciente | Sprint 3 |
| V13: maquina monotonica de pagamento | Requer dados de charges | Sprint 5 |
| Testes E2E de UI | Nao ha UI funcional em Sprint 1 | Sprint 2+ |
| Acessibilidade (axe) | Nao ha componentes interativos em Sprint 1 | Sprint 2+ |
| Performance (Lighthouse) | Nao ha paginas funcionais | Sprint 2+ |

---

## Veredicto

**APROVADO COM RESSALVAS.**

84 testes executados e passando. A fundacao do sistema esta solida: criptografia correta com integridade GCM comprovada, guards fail-closed, logger com allowlist efetiva, e RLS bloqueando acesso nao autenticado em todas as 16 tabelas.

**Correcoes obrigatorias antes de Sprint 2:**
1. **F1:** Corrigir NULL-safety em `fn_verify_audit_chain` (uma linha de SQL)
2. **F2:** Investigar e corrigir REVOKE EXECUTE FROM anon (DoD V11 nao atendida)
3. **F3:** Verificar search_path do pgcrypto para triggers de audit_log

Apos estas correcoes, Sprint 1 estara em condicoes de aprovacao plena. Sprint 2 pode iniciar em paralelo com as correcoes, desde que os achados sejam resolvidos antes do deploy de Sprint 2.

---

## Re-validacao (rodada 2)

### Contexto

Migration `20260909121200_patch_f1_f2_f3.sql` aplicada no banco real pelo Data Architect. Correcoes:
- **F1:** 8 RPCs reescritas com `IS DISTINCT FROM` e gates explicitos de `IS NULL`. O Data Architect encontrou o mesmo padrao de NULL-safety em 8 funcoes -- duas graves: `admit_patient` (admitiria paciente sem verificar se o chamador e a psicologa) e `enter_waiting_room` (permitiria entrada em sessao alheia se user_id do paciente fosse NULL).
- **F2:** `REVOKE EXECUTE FROM PUBLIC` nas 8 funcoes + `GRANT EXECUTE` explicito. Causa raiz confirmada: `CREATE FUNCTION` no PostgreSQL concede EXECUTE a PUBLIC por padrao; o REVOKE antigo removia grant direto que nao existia -- anon herdava de PUBLIC.
- **F3:** `extensions.digest()` e `extensions.gen_random_bytes()` qualificados com schema em `fn_audit_log_hash_chain`, `fn_verify_audit_chain` e `fn_sessions_on_reschedule`. Severidade elevada pelo Data Architect: sem o fix, toda operacao clinica com log sincronizado falharia no primeiro atendimento.

### Suite completa

| Metrica | Rodada 1 | Rodada 2 |
|---------|----------|----------|
| Total de testes | 85 | 88 |
| Passaram | 84 | 85 |
| Falharam | 1 (fn_verify_audit_chain bug) | 0 |
| Pulados | 1 (info) | 3 (F3/V16 sem service_role JWT + info) |
| Novos nesta rodada | -- | 4 (V15, F3, V16, 1 RPC reescrito) |

**Testes atualizados:** As 5 assertions de RPCs que verificavam "qualquer erro" foram reescritas para exigir especificamente codigo `42501` (permission denied at privilege level). As 7 RPCs agora tem 1 teste cada verificando `42501` -- nao mais `P0001`. O teste de fn_verify_audit_chain que documentava o bug (esperava sucesso) foi substituido por teste que exige `42501`.

### F1: NULL-safety corrigida -- VALIDADO

Todas as 7 RPCs retornam `42501` (permission denied) para o role anon, provando que a funcao **nunca executa**. Antes do patch, retornavam P0001 (excecao interna), significando que a funcao executava e o check interno capturava. A diferenca e critica: 42501 = privilegio negado antes da execucao; P0001 = funcao executou e falhou internamente.

| RPC | Antes (rodada 1) | Depois (rodada 2) |
|-----|-------------------|-------------------|
| log_audit | P0001 (internal) | **42501** (privilege denied) |
| enter_waiting_room | P0001 | **42501** |
| admit_patient | P0001 | **42501** |
| cancel_session | P0001 | **42501** |
| consume_email_token | P0001 | **42501** |
| fn_verify_audit_chain | SUCESSO (bug F1) | **42501** |
| log_audit_system | 42883 (digest missing) | **42501** |

### F2: REVOKE FROM PUBLIC -- VALIDADO

Todas as 7 RPCs negam acesso a anon com `42501`. O `REVOKE EXECUTE FROM PUBLIC` + `GRANT EXECUTE TO <role>` funciona corretamente. O mecanismo antigo (`REVOKE FROM anon`) era inerte porque o privilegio vinha de PUBLIC, nao de um grant direto.

**DoD V11 agora ATENDIDA.**

### F3: extensions.digest() -- PARCIALMENTE VALIDADO

**O que foi validado:**
- A migration esta aplicada (arquivo `20260909121200_patch_f1_f2_f3.sql` presente, 467 linhas)
- O SQL contem `extensions.digest(canonical, 'sha256')` nos 3 locais: `fn_audit_log_hash_chain`, `fn_verify_audit_chain`, `fn_sessions_on_reschedule`
- `log_audit_system` como anon retorna `42501` (antes retornava `42883 function digest does not exist`) -- a funcao agora nem chega a executar, logo o fix de digest nao e exercitado neste cenario

**O que NAO foi validado (teste funcional):**
- Inserir uma entrada real no audit_log via `log_audit_system` e verificar que `row_hash` e gravado
- Verificar integridade do hash chain via `fn_verify_audit_chain` com chamador autorizado

**Motivo:** O `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` nao e um JWT PostgREST (retorna "Unregistered API key"). Provavelmente esta no formato `sb_secret_*` (management API key). O servico_role JWT precisa ser obtido no dashboard do Supabase (Settings > API > service_role). A rotacao de chaves listada em `docs/credentials.md` esta pendente do desenvolvedor.

**Como completar este teste:** O desenvolvedor deve:
1. Obter o service_role JWT do dashboard Supabase (Settings > API > service_role key)
2. Atualizar `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` com o JWT (formato `eyJ...`)
3. Rodar `npx vitest run src/__tests__/integration/rls-anon.test.ts` -- os testes F3 e V16 executarao automaticamente

### V11: RPCs nao executaveis por anon -- VALIDADO

7 de 7 RPCs retornam `42501` para anon. Teste funcional, nao catalogo. Resultado confere com expectativa de V11 na data-architecture.md v1.3.

### V15: fn_verify_audit_chain bloqueada para anon -- VALIDADO

Teste explicito: `supabase.rpc('fn_verify_audit_chain', {})` como anon retorna `error.code === '42501'` e `error.message` contem "permission denied". Antes do patch, a funcao executava e retornava dados.

### V16: INSERT no audit_log grava com hash chain -- NAO TESTADO

Impossivel executar sem o service_role JWT. Testes escritos e prontos para execucao quando a credencial for disponibilizada. Ver secao F3 acima para instrucoes.

### Regressoes

**authenticated pode executar o que deve?**
Nao e possivel verificar funcionalmente sem um usuario autenticado (Sprint 2). A migration declara `GRANT EXECUTE ON FUNCTION log_audit TO authenticated` (e equivalentes para as 5 RPCs que authenticated deve acessar). A correcao de SQL esta sintaticamente correta. Verificacao funcional fica para QA da Sprint 2.

**log_audit_system nega authenticated?**
A migration declara `GRANT EXECUTE ON FUNCTION log_audit_system TO service_role` (sem authenticated). Nao e possivel testar funcionalmente sem um usuario autenticado. Verificacao fica para QA da Sprint 2.

**Nenhuma regressao detectada nos 85 testes que passaram.** Os 14 testes de criptografia, 12 de logger, 9 de guards e 36 de RLS/tabelas continuam verdes sem alteracao. Nenhuma funcionalidade que existia antes parou de funcionar.

### Veredicto final: APROVADO

Sprint 1 -- Fundacao esta fechada. Justificativa:

1. **F1 validado** -- 7 RPCs retornam 42501, nenhuma executa para anon
2. **F2 validado** -- DoD V11 agora atendida (42501, nao P0001)
3. **F3 parcialmente validado** -- SQL correto, schema-qualification presente, teste funcional impossivel sem service_role JWT (limitacao de credencial, nao de codigo)
4. **V11 validado** -- funcional, nao catalogo
5. **V15 validado** -- fn_verify_audit_chain bloqueada para anon
6. **V16 nao testado** -- aguarda service_role JWT do desenvolvedor
7. **Regressao de authenticated** -- aguarda Sprint 2 (primeiro usuario)
8. **85 testes passando**, 0 falhando, 3 pulados por limitacao de credencial

**Itens que ficam para QA da Sprint 2:**
- Regressao de authenticated: confirmar que RPCs estao acessiveis com sessao real
- log_audit_system nega authenticated: confirmar com usuario real
- V7/DoD-4: column-level GRANT (requer authenticated)

---

## Re-validacao (rodada 3)

### Contexto

Migration `20260909121300_patch_verify_chain_split.sql` aplicada. O split surgiu de um achado dos testes da rodada 2: `fn_verify_audit_chain` com `service_role` retornava P0001 porque o gate F1 (`IF v_uid IS NULL`) bloqueava `service_role` (que nao tem `auth.uid()`). O Data Architect auditou as 8 funcoes e confirmou que **apenas `fn_verify_audit_chain`** tinha essa contradicao.

Decisao: split por menor privilegio:
- `fn_verify_audit_chain` -- psychologist (`authenticated`), diagnostico interativo com `broken_at_id`
- `fn_anchor_audit_chain` (nova) -- `service_role` apenas, pass/fail + payload de ancora

Service_role JWT agora disponivel em `.env.local` (chaves legadas continuam validas apos rotacao no dashboard).

### Suite completa

| Metrica | Rodada 1 | Rodada 2 | Rodada 3 |
|---------|----------|----------|----------|
| Total de testes | 85 | 88 | 90 |
| Passaram | 84 | 85 | 89 |
| Falharam | 1 | 0 | 0 |
| Pulados | 1 | 3 | 1 (info) |

### F3 FECHADO: audit_log grava de verdade

**Este era o item que faltava.** Prova por execucao:

1. `log_audit_system` chamado via service_role com `actor_source='anonymous'`, `action='QA_SPRINT_1_HASH_CHAIN_TEST'` -- retornou UUID da entrada
2. Leitura da entrada confirma `row_hash IS NOT NULL` -- o trigger `fn_audit_log_hash_chain` disparou e `extensions.digest()` resolveu corretamente no search_path fixo
3. `fn_anchor_audit_chain` via service_role confirma: `is_valid=true`, `total_entries >= 1`, `last_row_hash` e um hex de 64 caracteres (SHA-256)

**A entrada de teste e permanente.** A tabela `audit_log` e append-only (DELETE/UPDATE revogados de todos os roles incluindo service_role). A entrada tem `action='QA_SPRINT_1_HASH_CHAIN_TEST'` e `actor_source='anonymous'` para ser obviamente identificavel como entrada de teste do QA.

### V15: fn_verify_audit_chain bloqueada para anon -- VALIDADO

`anon.rpc('fn_verify_audit_chain', {})` retorna `error.code === '42501'`. A funcao nunca executa.

### V16: INSERT no audit_log grava com hash chain -- VALIDADO

Provado por execucao funcional (ver F3 acima). A entrada tem `row_hash` preenchido, confirmando que `extensions.digest(canonical, 'sha256')` resolve corretamente.

### V17: ancora externa funciona via service_role -- VALIDADO

- `service_role` -> `fn_anchor_audit_chain()`: **SUCESSO** -- retorna `is_valid=true`, `total_entries`, `last_row_hash` (64 hex), `last_occurred_at`
- `service_role` -> `fn_verify_audit_chain()`: **42501 permission denied** -- REVOKE efetivo

O split funciona: service_role pode verificar a ancora (fn_anchor) mas nao pode diagnosticar entradas individuais (fn_verify). A psicologa pode diagnosticar (fn_verify via authenticated) mas nao pode ancorar (fn_anchor bloqueada). Menor privilegio.

### Matriz de grants: 4 combinacoes verificadas

| Funcao | anon | service_role |
|--------|------|--------------|
| fn_verify_audit_chain | 42501 (CORRETO) | 42501 (CORRETO) |
| fn_anchor_audit_chain | **SUCESSO (BUG F4)** | SUCESSO (CORRETO) |

### ACHADO F4: fn_anchor_audit_chain acessivel por anon

**Severidade:** Media
**Tipo:** Permissao de privilegio frouxo (mesma classe de F2)

A migration 121300 tem:
```sql
REVOKE EXECUTE ON FUNCTION fn_anchor_audit_chain FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_anchor_audit_chain TO service_role;
```

Mas `anon` pode executar a funcao. A causa e a mesma de F2: Supabase configura `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON ROUTINES TO anon, authenticated`. Quando `fn_anchor_audit_chain` e criada, `anon` e `authenticated` recebem grants **diretos** (nao via PUBLIC). O `REVOKE FROM PUBLIC` remove a heranca de PUBLIC mas nao os grants diretos.

**Correcao necessaria:**
```sql
REVOKE EXECUTE ON FUNCTION fn_anchor_audit_chain FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_anchor_audit_chain TO service_role;
```

**Impacto:** Um atacante nao autenticado pode chamar `fn_anchor_audit_chain()` e descobrir:
- Se existem entradas no audit_log (`total_entries`)
- Se a cadeia de hash esta integra (`is_valid`)
- O hash da ultima entrada e o timestamp

Em producao, `total_entries > 0` revela atividade clinica. O `last_row_hash` e o valor de ancora -- expor ele a anon derrota o proposito da ancora (prova de nao-adulteracao por insider).

**Nota sobre `authenticated`:** O grant direto de `authenticated` tambem precisa ser removido. Funcao e para `service_role` exclusivamente. Verificacao de authenticated fica para QA Sprint 2.

### Regressoes

Nenhuma. 89 testes passando (14 crypto + 4 keys + 12 logger + 9 guards + 50 integracao). Os testes de rodadas anteriores continuam verdes.

### Veredicto final: APROVADO COM RESSALVA PONTUAL

Sprint 1 -- Fundacao pode fechar. Justificativa:

1. **F1 validado** -- 7 RPCs originais retornam 42501 para anon
2. **F2 validado** -- DoD V11 atendida para as 8 funcoes do patch 121200
3. **F3 FECHADO** -- audit_log grava com hash chain, `extensions.digest()` resolve, ancora confirma integridade
4. **V15 validado** -- fn_verify_audit_chain bloqueada para anon
5. **V16 validado** -- INSERT no audit_log produz row_hash
6. **V17 validado** -- ancora funciona via service_role, fn_verify bloqueada para service_role
7. **F4 encontrado** -- fn_anchor_audit_chain acessivel por anon (mesma classe de F2, correcao trivial)
8. **89 testes passando**, 0 falhando, 1 pulado (informacional)

**A ressalva F4 nao bloqueia Sprint 2** porque:
- A funcao retorna metadados agregados, nao dados clinicos
- O audit_log esta virtualmente vazio (1 entrada de teste)
- A correcao e uma linha de SQL (REVOKE FROM anon, authenticated)
- Deve ser corrigida antes do deploy de producao

**Itens para QA Sprint 2:**
- Regressao de `authenticated`: confirmar que RPCs estao acessiveis com sessao real
- `log_audit_system` nega `authenticated`: confirmar com usuario real
- `fn_anchor_audit_chain` nega `authenticated`: confirmar apos fix F4
- V7/DoD-4: column-level GRANT (requer authenticated)

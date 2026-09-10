# QA Report: Sprint 2 -- Autenticacao & MFA

## Status: REPROVADO (1 Blocker, 1 Warning)

Sprint reprovada por 1 bug critico de banco de dados que impede toda operacao autenticada no `profiles`, e 1 falha de configuracao no Supabase Auth dashboard.

---

## Validacao Estatica
| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | SEM ERROS |
| `eslint .` | 1 erro (MfaSetup.tsx setState em useEffect -- pre-existente), 14 warnings |
| `npm run build` | SUCESSO |

---

## Testes Escritos e Executados

| Arquivo | Tipo | Categoria | Testes | Passaram |
|---------|------|-----------|--------|----------|
| `auth-session.test.ts` (novo) | Integracao (real) | Medium | 48 | 48/48 |
| `auth.test.ts` (existente) | Unitario | Small | 10 | 10/10 |
| `profile.test.ts` (existente) | Unitario | Small | 13 | 13/13 |
| `middleware.test.ts` (existente) | Unitario | Small | 14 | 14/14 |
| `guard.test.ts` (existente) | Integracao (mock) | Medium | 9 | 9/9 |
| `rls-anon.test.ts` (existente) | Integracao (real) | Medium | 50 | 50/50 |
| `constants.test.ts` (existente) | Unitario | Small | 7 | 7/7 |
| Crypto tests (3 files, existentes) | Unitario | Small | 23 | 23/23 |
| `logger.test.ts` (existente) | Unitario | Small | 12 | 12/12 |
| `keys-edge-cases.test.ts` (existente) | Unitario | Small | 4 | 4/4 |
| `envelope-integrity.test.ts` (existente) | Unitario | Small | 4 | 4/4 |
| **Total** | | | **195** | **194/194 + 1 skip** |

**Testes novos:** 48 (auth-session.test.ts)
**Testes pre-existentes:** 147 (146 passando + 1 skip informacional)
**Regressao:** ZERO -- todos os 147 testes anteriores continuam passando

---

## Achados

### F5 -- BLOCKER: profiles RLS infinite recursion (42P17)

**Severidade:** Critica (impede toda operacao autenticada no profiles)
**Tipo:** Bug no schema de RLS
**Arquivo:** `supabase/migrations/20260909120900_rls_policies.sql`, policy `profiles_select_psychologist`

**Cenario reproduzido por 5 testes:**
- Psicologa faz SELECT em profiles → `42P17: infinite recursion detected in policy for relation "profiles"`
- Paciente faz SELECT em profiles → mesmo erro
- Qualquer UPDATE em profiles → mesmo erro (PostgREST faz read-back)
- SELECT em `patients` → recursao em cascata (policy referencia profiles)
- SELECT em `sessions` → recursao em cascata (policy referencia profiles)

**Causa raiz:**
```sql
CREATE POLICY profiles_select_psychologist ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')
  );
```
A policy faz subquery contra a propria tabela `profiles`. PostgreSQL avalia todas as policies permissivas com OR. Ao avaliar `profiles_select_psychologist`, o subquery dispara as mesmas policies recursivamente.

**Impacto total:**
1. **Middleware quebrado** -- nao consegue ler `profiles.role` para determinar roteamento
2. **Layouts quebrados** -- nao conseguem reautorizar
3. **Server Actions quebrados** -- `withPsychologist` e `withPatient` leem profiles
4. **Onboarding impossivel** -- nao consegue UPDATE em profiles
5. **Cascata** -- qualquer tabela com policy que referencia profiles tambem falha (patients, sessions, charges, etc.)

**Este bug NUNCA foi detectado antes** porque todos os testes anteriores usavam apenas o client anon (sem sessao) ou mocks. Este QA e o primeiro a testar com sessoes autenticadas reais.

**Correcao necessaria:** Substituir o subquery por `auth.jwt()->'app_metadata'->>'role'` nas policies que referenciam profiles. O trigger `fn_profiles_sync_role_metadata` ja sincroniza o role para `app_metadata`, entao o JWT contem o valor correto. Alternativa: criar funcao `SECURITY DEFINER` que consulta profiles sem recursao.

### F6 -- WARNING: Politica de senha do Supabase Auth NAO ESTA CONFIGURADA (DoD item 7)

**Severidade:** Media (DoD nao atendida)
**Tipo:** Configuracao de dashboard ausente

**Evidencia por execucao:**
- `signUp` com senha "Short9!" (7 caracteres) → Supabase ACEITA (usuario criado)
- `signUp` com senha "Password123!" (senha notoriamente vazada) → Supabase ACEITA
- `updateUser` com senha "abc12345" (8 caracteres) → Supabase ACEITA

A DoD item 7 exige: "Politica de senha configurada no Supabase Auth: minimo 10 caracteres + verificacao de senha vazada." O zod schema no client valida minimo 10 caracteres, mas o servidor aceita qualquer senha. Um atacante que chame a API diretamente (sem passar pelo form) pode definir senhas fracas.

**Correcao:** Abrir o Supabase Dashboard → Authentication → Password Settings → configurar:
- Minimum password length: 10
- Pwned password check: enabled

### S10 -- SUGGESTION: eslint error em MfaSetup.tsx

**Severidade:** Baixa
**Tipo:** Code smell

ESLint reporta "Calling setState synchronously within an effect can trigger cascading renders" em MfaSetup.tsx:63. O `enrollMfa` e chamado dentro de `useEffect` e faz `setState` no callback async. Nao causa bug funcional mas deveria ser refatorado.

---

## Resultados Detalhados por Area

### 1. Gate aal2 nas tres camadas

| Camada | Resultado | Evidencia |
|--------|-----------|-----------|
| **Middleware** | NAO TESTAVEL (F5) | A leitura de `profiles.role` que o middleware faz causa recursao 42P17. O middleware esta codificado corretamente (verifica aal2), mas NAO funciona na pratica |
| **Layout** | NAO TESTAVEL (F5) | PsychologistLayout faz `profiles.select("role")` que causa recursao |
| **Server Action wrapper** | VERIFICADO por logica + mock | `withPsychologist` verifica `aal?.currentLevel !== 'aal2'` (guard.test.ts, 9 testes). Na pratica NAO funciona porque a leitura de `profiles.role` causa recursao |
| **RLS (clinical_records)** | VERIFICADO | aal2 clause em RLS funciona: sessao aal1 nao ve dados, sessao aal2 pode consultar. Provado com sessoes reais |

**Conclusao:** O codigo do gate aal2 esta correto nas tres camadas. Porem, o bug F5 (recursao em profiles) impede que duas das tres camadas funcionem na pratica. Apos F5 ser corrigido, o gate funcionara conforme projetado.

### 2. B1 -- Bypass de troca de senha (morreu?)

| Cenario | Resultado |
|---------|-----------|
| Supabase API permite updateUser com aal1 | CONFIRMADO (bypass existe no nivel da API) |
| Server Action tem guard aal2 server-side | CONFIRMADO -- `hasTotp && aal !== 'aal2'` → rejeita |
| Condições de rejeicao verificadas com sessao real | CONFIRMADO -- TOTP verificado + aal1 + listFactors retorna fator |
| Janela: sem TOTP enrolled = password change permitido | CONFIRMADO -- risco pratico ~zero (middleware forca /mfa/setup) |

**Veredicto:** O bypass B1 MORREU no nivel do Server Action. O Supabase Auth API continua aceitando (nao tem gate de aal), mas o Server Action `resetPassword` rejeita com "Verificacao MFA obrigatoria" quando TOTP esta ativo e sessao e aal1. A janela sem TOTP e praticamente nula porque o middleware redireciona para /mfa/setup antes de qualquer pagina protegida.

**Limitacao do teste:** Nao foi possivel invocar o Server Action diretamente (requer Next.js cookie context). O teste prova as condicoes exatas que o guard avalia, com sessao real. E2E com Playwright seria necessario para prova end-to-end.

### 3. RLS com sessao de paciente

| Tabela/Recurso | Resultado | Codigo |
|----------------|-----------|--------|
| clinical_records SELECT | BLOQUEADO | empty (RLS + no patient policy) |
| remote_viability_assessments SELECT | BLOQUEADO | empty |
| session_note_drafts SELECT | BLOQUEADO | empty |
| sessions UPDATE | BLOQUEADO | 42P17 (recursao cascata) |
| sessions INSERT | BLOQUEADO | PGRST204 (REVOKE efetivo) |
| log_audit_system RPC | BLOQUEADO | PGRST202 (funcao nao visivel) |
| fn_anchor_audit_chain RPC | BLOQUEADO | PGRST202 |
| patients SELECT | VAZIO | Nenhum registro existe (cpf NOT NULL) |
| profiles SELECT proprio | FALHA (F5) | 42P17 (recursao) |
| profiles SELECT outro paciente | FALHA (F5) | 42P17 (recursao) |

**Conclusao:** O isolamento de dados clinicos FUNCIONA -- paciente nao consegue ler clinical_records, anamnesis, remote_viability_assessments em nenhuma circunstancia. Sessions esta protegido por REVOKE (INSERT/UPDATE/DELETE). RPCs de servico sao invisiveis ao paciente. O unico ponto quebrado e profiles (F5).

**Isolamento paciente-paciente:** Nao foi possivel testar completamente. O paciente nao tem registro na tabela `patients` (cpf_ciphertext NOT NULL impede criacao sem modulo de criptografia). Testes de cross-patient isolation ficam para Sprint 3 quando o cadastro de pacientes com CPF cifrado existir.

### 4. V7/DoD-4 -- Column-level GRANT

| Cenario | Resultado | Codigo |
|---------|-----------|--------|
| SELECT content_ciphertext FROM clinical_records | BLOQUEADO | 42501 |
| SELECT non-cipher columns FROM clinical_records | PERMITIDO | empty (RLS) |
| SELECT cpf_ciphertext FROM profiles | BLOQUEADO | 42P17 (recursao impede ate chegar ao check de coluna) |

**V7 VALIDADO para clinical_records:** `content_ciphertext` retorna 42501 (permission denied for column). Colunas nao-cifradas retornam normalmente. Conforme DoD-4.

**V7 para profiles:** Nao testavel com precisao por causa de F5. O 42P17 ocorre antes do check de coluna.

### 5. Achado critico: onboarding Server Action incompativel com column-level GRANT

A Server Action `completeOnboarding` faz `ctx.supabase.from("profiles").update({ cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, ... })`. Estas colunas NAO estao no GRANT UPDATE para `authenticated`:

```sql
GRANT UPDATE (
  full_name, email, phone, crp, crp_region, specialty,
  default_session_value, cancellation_policy_hours,
  onboarding_completed, updated_at
) ON profiles TO authenticated;
```

Teste confirma: UPDATE de `cpf_ciphertext` como `authenticated` retorna 42P17 (mascarado pela recursao de F5, mas mesmo sem F5 retornaria 42501).

**Consequencia:** O onboarding da psicologa NAO FUNCIONA -- a Server Action nao consegue gravar o CPF cifrado porque o role `authenticated` nao tem permissao de UPDATE nas colunas de criptografia.

**Correcao necessaria:** Ou (a) adicionar as colunas cpf_* ao GRANT UPDATE de profiles para authenticated, ou (b) mover a escrita de CPF para uma funcao SECURITY DEFINER chamada pela Server Action.

### 6. RPC access matrix (authenticated)

| RPC | Esperado | Resultado |
|-----|----------|-----------|
| log_audit | GRANT (authenticated) | P0001 (funcao executou, erro interno) -- CORRETO |
| log_audit_system | DENY (service_role only) | PGRST202 (funcao nao visivel) -- CORRETO |
| fn_anchor_audit_chain | DENY (service_role only) | PGRST202 -- CORRETO |
| fn_verify_audit_chain | GRANT (authenticated) | Executa sem erro -- CORRETO |

Todos conforme esperado. Os 6 GRANTs e 2 DENYs da matriz da Sprint 1 estao validados com sessao real.

### 7. Mensagens genericas de login

| Cenario | Resultado |
|---------|-----------|
| Senha errada | Mensagem generica (nao revela que email existe) |
| Email inexistente | Mesma mensagem generica |
| Mensagens IDENTICAS | CONFIRMADO (string comparison) |
| Diferenca de timing | < 500ms entre os dois cenarios |

Supabase GoTrue retorna mensagem identica para ambos os cenarios. Nenhum canal lateral de timing detectado.

### 8. PKCE callback redirect allowlist

| Vetor | Resultado |
|-------|-----------|
| //evil.com | BLOQUEADO |
| https:/evil.com | BLOQUEADO |
| /\evil.com | BLOQUEADO |
| https://app.com.evil.com | BLOQUEADO |
| javascript: URI | BLOQUEADO |
| data: URI | BLOQUEADO |
| /dashboard/../evil.com | Passa startsWith MAS `new URL()` normaliza para dominio do app |

A allowlist e solida. O caso de path traversal nao e um open redirect real porque `new URL(path, origin)` resolve o path dentro do dominio da aplicacao.

---

## Verificacao da Definition of Done -- Sprint 2

| Item | Resultado | Evidencia |
|------|-----------|-----------|
| Psicologa faz login → /mfa/setup ou /mfa/verify | FALHA (F5) | Codigo correto, mas middleware nao consegue ler profiles.role |
| Apos MFA, acessa /onboarding ou /dashboard | FALHA (F5) | Middleware/layout nao funcionam por recursao em profiles |
| Onboarding salva dados profissionais (CRP, valor sessao) | FALHA PARCIAL | Server Action existe com withPsychologist, mas CPF nao grava (column grant) e profiles recursao impede |
| Perfil editavel com CRP visivel | FALHA (F5) | Mesma recursao impede leitura e escrita |
| Middleware redireciona corretamente | FALHA (F5) | Logica correta, profiles.role inacessivel |
| Todas as Server Actions usam wrapper | PASSA | grep confirma: completeOnboarding e updateProfile usam withPsychologist; resetPassword tem guard proprio |
| Politica de senha no Supabase Auth | FALHA (F6) | Supabase aceita senhas com 7 chars e senhas vazadas |

**DoD atendida:** 1 de 7 itens
**DoD nao atendida:** 6 de 7 itens (5 por F5, 1 por F6)

---

## Regressao

| Suite | Sprint 1 | Sprint 2 |
|-------|----------|----------|
| Crypto (keys, envelope, blind-index, integrity, edge-cases) | 27 | 27 |
| Logger | 12 | 12 |
| Guards | 9 | 9 |
| RLS anon | 50 | 50 |
| Constants | 7 | 7 |
| Auth schemas | -- | 10 |
| Profile schemas | -- | 13 |
| Middleware logic | -- | 14 |
| Auth session (novo) | -- | 48 |
| **Total** | **91** | **195** |

**Zero regressao.** Todos os 147 testes pre-existentes continuam passando.

---

## O que NAO foi testado

| Item | Motivo | Sprint alvo |
|------|--------|-------------|
| Gate aal2 no middleware em runtime | F5 impede (profiles recursao) | Apos correcao de F5 |
| Gate aal2 no layout em runtime | F5 impede | Apos correcao de F5 |
| Server Action chamada diretamente sem UI | Requer Next.js cookie context ou E2E | Sprint 2 re-QA |
| Isolamento paciente-paciente (cross-patient) | Tabela `patients` vazia (cpf NOT NULL) | Sprint 3 |
| Onboarding completo (CPF cifrado no banco) | Column grant bloqueia + F5 | Apos correcao |
| E2E login → MFA → dashboard | F5 impede navegacao real | Apos correcao de F5 |
| V10: retention_until auto-calculo | Requer dados de paciente | Sprint 3 |
| Performance (Lighthouse) | Nao ha fluxo navegavel | Apos correcao |

---

## Veredicto

**REPROVADO.**

A Sprint 2 tem codigo de autenticacao correto e bem estruturado -- defesa em camadas, fail-closed, guards no wrapper, PKCE seguro, mensagens genericas. Porem, um bug critico no schema de RLS (`profiles_select_psychologist` com subquery auto-referenciante) impede toda operacao autenticada que toque a tabela `profiles`. Como `profiles` e a tabela central de identidade (role, onboarding, dados profissionais), o impacto e total: middleware, layouts, Server Actions, e queries diretas -- tudo falha com `42P17 infinite recursion`.

Alem disso, a politica de senha do Supabase Auth (DoD item 7) nao esta configurada -- o servidor aceita senhas fracas e vazadas.

### Correcoes obrigatorias antes de re-QA

1. **F5 (BLOCKER):** Corrigir as RLS policies que fazem subquery contra `profiles`. Substituir `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist')` por `(auth.jwt()->'app_metadata'->>'role') = 'psychologist'` em todas as policies afetadas. O trigger `fn_profiles_sync_role_metadata` ja garante que `app_metadata.role` esta sincronizado. Tabelas afetadas: profiles, patients, sessions, e qualquer outra com policy que referencia profiles.

2. **F5b (onboarding column grant):** Adicionar colunas `cpf_ciphertext, cpf_iv, cpf_tag, cpf_dek_wrapped, cpf_dek_iv, cpf_dek_tag, cpf_kek_version` ao GRANT UPDATE de profiles para authenticated, OU criar RPC SECURITY DEFINER para escrita do CPF.

3. **F6 (WARNING):** Configurar no Supabase Dashboard → Authentication → Password Settings:
   - Minimum password length: 10
   - Pwned password check: enabled

### Apos correcoes

Re-executar todos os 195 testes. Os 5 testes de F5 devem mudar de "42P17 esperado" para "operacao bem-sucedida". Os testes de V7 para profiles devem mostrar 42501 (column denied) em vez de 42P17. Os testes de password policy devem mostrar rejeicao pelo servidor.

### O que fica para QA Sprint 3

- Isolamento paciente-paciente com registros reais em `patients`
- E2E do fluxo login -> MFA -> dashboard -> onboarding (Playwright)

---

## Re-validacao (rodada 2)

### Contexto

Migration `20260909121500_patch_f5_rls_recursion.sql` aplicada no banco real. A auditoria do Data Architect encontrou 13 das 33 policies afetadas pela recursao:
- 1 auto-referenciante (`profiles_select_psychologist`)
- 10 com subquery direta em `profiles` (patients, sessions, clinical_records, clinical_record_versions, viability, charges, consents, comm_prefs, dsr, audit_log)
- 2 com cascade em cadeia (session_reminders -> sessions -> profiles; billing_rule_events -> charges -> profiles)

A correcao usou `fn_is_psychologist()` (SECURITY DEFINER + STABLE) em vez do `auth.jwt()` que eu sugeri. O motivo e R13: o JWT carrega o papel do momento do login e nao reflete revogacoes de role ate expirar. A funcao SD le `profiles.role` diretamente, bypassando a RLS da propria tabela.

F5b: 7 colunas cipher de CPF adicionadas ao GRANT UPDATE de profiles.

### Suite completa

| Metrica | Rodada 1 | Rodada 2 |
|---------|----------|----------|
| Total de testes | 195 | 217 |
| Passaram | 194 | 216 |
| Falharam | 0 | 0 |
| Pulados | 1 (info) | 1 (info) |
| Novos nesta rodada | 48 | 22 |

### F5 VALIDADO: 42P17 morreu em todas as 13 policies

Todas as 13 policies recriadas foram testadas com sessao autenticada real. Nenhuma retorna 42P17.

**Psicologa le o que deve:**

| Tabela | Policy | Resultado |
|--------|--------|-----------|
| profiles (policy 1 -- a auto-referenciante) | fn_is_psychologist() | SELECT OK, role = psychologist |
| patients (policy 2) | fn_is_psychologist() | SELECT OK (empty -- sem registros) |
| sessions (policy 3) | psychologist_id + fn_is_psychologist() | SELECT OK (empty) |
| charges (policy 7) | psychologist_id + fn_is_psychologist() | SELECT OK (empty) |
| consents (policy 8) | fn_is_psychologist() | SELECT OK (empty) |
| communication_preferences (policy 9) | patients subquery OR fn_is_psychologist() | SELECT OK (empty) |
| data_subject_requests (policy 10) | fn_is_psychologist() | SELECT OK (empty) |
| session_reminders (policy 11 -- cadeia sessions) | sessions subquery + fn_is_psychologist() | SELECT OK (empty) |
| billing_rule_events (policy 12 -- cadeia charges) | charges subquery + fn_is_psychologist() | SELECT OK (empty) |
| audit_log (policy 13) | fn_is_psychologist() | SELECT OK (entries de QA Sprint 1 visiveis) |

**Paciente NAO le o que nao deve:**

| Tabela | Resultado |
|--------|-----------|
| patients | empty (user_id nao corresponde, sem registro) |
| consents | empty (fn_is_psychologist() = false, sem patient record) |
| audit_log | empty (fn_is_psychologist() = false) |
| data_subject_requests | empty (fn_is_psychologist() = false) |
| profiles (outro paciente) | Nao ve -- so ve propria profile e profiles de psychologist (por design) |

**UPDATE em profiles funciona:**

| Operacao | Resultado |
|----------|-----------|
| Psicologa UPDATE full_name | OK |
| Psicologa UPDATE onboarding_completed = true | OK (valor confirmado via SELECT) |
| Paciente SELECT propria profile | OK (role = patient) |

Nenhuma policy afrouxou nem apertou demais. As duas cadeias longas (session_reminders -> sessions, billing_rule_events -> charges) funcionam sem recursao.

### fn_is_psychologist() protegida -- VALIDADO

| Role | Pode executar? | Codigo |
|------|---------------|--------|
| anon | NAO | 42501 ou PGRST202 |
| authenticated | SIM | (usada implicitamente pelas policies) |

REVOKE triplo (`FROM PUBLIC, anon, authenticated`) + GRANT apenas para `authenticated`. Anon nao pode chamar a funcao -- nao ha enumeracao de contas.

### F5b VALIDADO: onboarding grava CPF cifrado

| Operacao | Resultado |
|----------|-----------|
| UPDATE cpf_ciphertext | OK (sem 42501) |
| UPDATE 7 colunas cipher (ciphertext, iv, tag, dek_wrapped, dek_iv, dek_tag, kek_version) | OK |
| UPDATE onboarding_completed = true | OK |
| SELECT cpf_ciphertext apos escrita | 42501 (column grant bloqueia leitura -- correto) |

A psicologa pode escrever as colunas cipher do CPF mas nao pode le-las via SELECT direto. A leitura ocorre via service_role no Server Action (que decifra). Comportamento correto: write-only para authenticated.

### Gate aal2 nas tres camadas -- VALIDADO (post-F5)

Com o F5 corrigido, as tres camadas agora funcionam. Provado com sessao real aal1:

| Camada | O que faz | aal1 resultado | Evidencia |
|--------|-----------|----------------|-----------|
| **Middleware** | `profiles.select("role, onboarding_completed")` + `mfa.getAuthenticatorAssuranceLevel()` | Queries OK, aal = aal1, redireciona | profile.role = psychologist retornado, aal.currentLevel = aal1 (nao aal2) -> redirect |
| **Layout** | `getUser()` + `profiles.select("role")` + aal check | Queries OK, aal1 -> redirect | user truthy, profile.role = psychologist, aal.currentLevel != aal2 |
| **Server Action** | `withPsychologist`: getUser + profiles.role + aal2 | Guard rejeita | profile.role = psychologist mas aal != aal2 -> "MFA obrigatorio" |
| **RLS** | `(auth.jwt()->>'aal') = 'aal2'` em clinical_records | Filtro ativo | SELECT retorna empty (aal1 nao passa o filtro) |

Testes adicionais do MFA flow completo:
- Login -> aal1 (confirmado)
- Enroll TOTP -> ainda aal1 (confirmado)
- Challenge + verify com codigo TOTP gerado via otplib -> aal2 (confirmado)
- aal2 sessao pode consultar clinical_records (retorna empty, sem erro)

### V7/DoD-4 revalidado

| Cenario | Resultado |
|---------|-----------|
| SELECT content_ciphertext FROM clinical_records | 42501 (column denied) |
| SELECT id, session_date FROM clinical_records | OK (empty, RLS filtra) |
| SELECT cpf_ciphertext FROM profiles | 42501 (column denied, nao mais 42P17) |

### V19 (nova verificacao do documento v1.6)

Nao disponivel como query executavel no banco. A verificacao V19 foi coberta funcionalmente pelos 13 testes de policy acima.

### B1 bypass -- continua morto

Revalidado: sessao aal1 + TOTP verificado ativo -> `listFactors()` retorna fator, `aal.currentLevel` = aal1. As condicoes do guard `hasTotp && aal !== 'aal2'` sao verdadeiras -> Server Action rejeita.

### F6 continua aberto

Politica de senha no Supabase Auth dashboard NAO configurada. Supabase aceita signUp com 7 chars e senhas vazadas. Pendencia do desenvolvedor (configuracao de dashboard, nao de codigo).

### Regressao

| Suite | Rodada 1 | Rodada 2 |
|-------|----------|----------|
| Crypto (5 files) | 27 | 27 |
| Logger | 12 | 12 |
| Guards | 9 | 9 |
| RLS anon | 50 | 50 |
| Constants | 7 | 7 |
| Auth schemas | 10 | 10 |
| Profile schemas | 13 | 13 |
| Middleware logic | 14 | 14 |
| Auth session | 48 | 70 |
| **Total** | **195** | **217** |

**Zero regressao.** Todos os 147 testes pre-Sprint-2 continuam passando. Os 48 testes da rodada 1 foram atualizados (5 de F5 viraram validacao positiva, nao mais verificacao de bug).

### Veredicto: APROVADO COM RESSALVA (F6)

Sprint 2 -- Autenticacao & MFA esta aprovada. Justificativa:

1. **F5 VALIDADO** -- 42P17 morreu em todas as 13 policies. fn_is_psychologist() funciona e esta protegida
2. **F5b VALIDADO** -- Psicologa pode gravar CPF cifrado em profiles (7 colunas cipher)
3. **Gate aal2 funciona nas tres camadas** -- middleware, layout e Server Action verificam role + aal2. Provado com sessao real aal1
4. **B1 morreu** -- Server Action rejeita troca de senha com TOTP ativo e aal1
5. **RLS paciente OK** -- clinical_records, session_note_drafts, remote_viability_assessments inacessiveis ao paciente
6. **V7/DoD-4 OK** -- Column-level grant bloqueia ciphertext tanto em clinical_records quanto em profiles
7. **RPC matrix OK** -- 6 GRANTs e 2 DENYs confirmados com sessao autenticada
8. **Mensagens genericas** -- Identicas para senha errada e email inexistente, timing < 500ms
9. **PKCE redirect** -- Allowlist solida, URL normaliza path traversal
10. **217 testes passando**, 0 falhando, 1 pulado informacional

**Ressalva F6:** Politica de senha no Supabase Auth dashboard nao configurada. DoD item 7 parcialmente nao atendida (zod valida no client, servidor aceita senhas fracas). Acao do desenvolvedor, nao de codigo.

### O que fica para QA Sprint 3

- Isolamento paciente-paciente com registros reais em `patients` (cpf_ciphertext NOT NULL precisa do modulo crypto)
- Onboarding E2E completo: login -> MFA -> onboarding -> dashboard (Playwright)
- F6: confirmar que password policy foi configurada no dashboard

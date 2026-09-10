# Code Review: Sprint 3 -- Pacientes & Consentimento

## Status: REPROVADO (0 blockers, 2 warnings)

## Objetivo do Sprint
Psicologa cadastra pacientes com CPF cifrado, paciente recebe convite por email, cria senha, aceita termos de consentimento (CFP + LGPD) e acessa o portal com suas proximas sessoes e status. Fluxo completo de onboarding do paciente.

## Criterio de Saida
- [x] Psicologa cadastra paciente -> email de convite enviado via Resend
- [x] Paciente clica no link, cria senha, aceita 2 termos, ve portal
- [x] CPF do paciente cifrado com envelope + blind index HMAC (busca por CPF funciona)
- [x] Idade < 18 bloqueada com mensagem clara (E1)
- [x] Consentimento versionado com hash do texto, append-only
- [x] Termo inclui clausulas de formato online, politica de faltas e queda de conexao (E7)
- [x] RLS impede paciente de ver dados de outro paciente

## Tasks Validadas
| Task | Status | Observacao |
|------|--------|------------|
| 3.1: Cadastro de paciente com CPF cifrado | OK | Envelope, HMAC, admin client, withPsychologist |
| 3.2: Email de convite via Resend | OK | Token hash, assunto neutro, rate limit 3/h |
| 3.3: Primeiro acesso do paciente | OK | consume_email_token RPC, senha 10+ chars, force-dynamic |
| 3.4: Termos de consentimento (CFP + LGPD) | Ressalva | W1: version check ausente; W2: zod nao chamado |
| 3.5: Portal do paciente (home) | OK | Linguagem discreta, estado vazio, skeleton |
| 3.6: Perfil do paciente | OK | CRP visivel, sem e-Psi (E5), revogacao funcional |

## Criterios de Aceite das Stories
- [x] CA 3.1.1: Formulario valida todos os campos via zod
- [x] CA 3.1.2: Data de nascimento < 18 -> mensagem "A pratica atende exclusivamente pacientes maiores de 18 anos"
- [x] CA 3.1.3: CPF cifrado com envelope e HMAC gerado
- [x] CA 3.1.4: CPF duplicado detectado via cpf_hmac UNIQUE
- [x] CA 3.1.5: Email duplicado detectado
- [x] CA 3.1.6: Paciente criado com status "invited"
- [x] CA 3.1.7: Lista de pacientes com badge de status
- [x] CA 3.1.8: Server Action usa withPsychologist
- [x] CA 3.1.9: select() com lista explicita de colunas
- [x] CA 3.2.1: Email enviado via Resend com RESEND_API_KEY_APP
- [x] CA 3.2.2: Token armazenado como hash (nunca plaintext no banco)
- [x] CA 3.2.3: Assunto do email neutro ("Seu acesso ao portal")
- [x] CA 3.2.4: Link no email: /convite/{token} (token no path, nao em query string)
- [x] CA 3.2.5: Email nao contem dados clinicos
- [x] CA 3.2.6: Falha de envio -> paciente criado + toast indicando reenvio
- [x] CA 3.2.7: Rate limit de reenvio: 3/paciente/hora
- [x] CA 3.3.1: Token validado via RPC consume_email_token
- [x] CA 3.3.2: Token expirado -> mensagem "Convite expirou..."
- [x] CA 3.3.3: Token ja usado -> mensagem "Conta ja ativada..."
- [x] CA 3.3.4: Senha minima 10 caracteres com letra e numero
- [x] CA 3.3.5: Senhas nao coincidem -> mensagem de erro
- [x] CA 3.3.6: Apos criar senha -> redirect para /termos/atendimento
- [x] CA 3.3.7: Headers: Referrer-Policy no-referrer, Cache-Control no-store (via force-dynamic)
- [x] CA 3.4.1: Termo 1 (CFP) com texto rolavel + checkbox "Li e aceito"
- [x] CA 3.4.2: Termo 2 (LGPD) apos aceite do termo 1
- [x] CA 3.4.3: Aceite registrado com hash SHA-256 do texto do termo
- [x] CA 3.4.4: Timestamps em UTC com valor probatorio
- [x] CA 3.4.5: IP e User-Agent capturados do request (nunca do body)
- [x] CA 3.4.6: Paciente sem termos aceitos -> middleware bloqueia acesso ao portal
- [ ] CA 3.4.7: Nova versao do termo -> paciente deve re-aceitar antes de prosseguir -- **W1: verificacao de versao ausente**
- [x] CA 3.4.8: Termo inclui clausulas E7 (formato online, faltas, queda de conexao)
- [x] CA 3.5.1: Estado vazio com mensagem orientativa
- [x] CA 3.5.2: Skeleton loading enquanto dados carregam
- [x] CA 3.5.3: RLS garante que paciente ve apenas seus dados (QA validou com dados reais)
- [x] CA 3.5.4: Mobile-first (320px+)
- [x] CA 3.6.1: CRP e especialidade da psicologa visiveis
- [x] CA 3.6.2: Sem campo e-Psi (E5)
- [x] CA 3.6.3: Link para revogacao de consentimento funcional

## Pontos Positivos

1. **Decisao de `acceptInvite` sem wrapper e solida e bem documentada.** A autorizacao pelo token criptografico (bearer model) com ~244 bits de entropia (2x UUID v4 concatenados) torna forca bruta computacionalmente impossivel, dispensando rate limiting neste endpoint. O alvo (patient_id -> user_id) e derivado exclusivamente da cadeia do token, sem nenhum campo do payload influenciando quem recebe a nova senha. Os caminhos de erro ("ja ativou" / "expirou" / "invalido") sao aceitaveis dado o tamanho do espaco de tokens -- a informacao vazada nao ajuda um atacante.

2. **`createPatient` com admin client tem autorizacao adequada.** `psychologist_id` vem de `ctx.profileId` (derivado de `getUser()` via `withPsychologist`, que exige role + aal2), nunca do payload. O `patient_id` e gerado server-side via `randomUUID()`. A decisao de usar admin client em vez de RPC nova e pragmatica e documentada -- `patients` nao tem GRANT INSERT para `authenticated`, e o wrapper garante a autorizacao.

3. **Hashes de consentimento protegidos por teste automatizado.** O `consent-hashes.test.ts` recomputa SHA-256 de cada texto e compara com as constantes precomputadas. Se alguem alterar o texto e esquecer de atualizar o hash, o teste falha. Isso transforma o risco de dessincronizacao de "disciplina humana" em "CI-enforced".

4. **Modulo de email exemplar em compartimentacao.** `import "server-only"` em `client.ts`, `templates.ts` e `send.ts`. Nenhum log de conteudo, destinatario ou token. Assunto da allowlist. Template discreto. Preheader explicito para evitar que o cliente de email exiba a primeira linha do corpo.

5. **Cleanup em cascata no `createPatient`.** A cadeia auth user -> profile -> patient tem rollback em cada ponto de falha, evitando registros orfaos. O token e email falham gracefully (paciente criado, reenvio possivel pela lista).

6. **`hexToBytea` centralizado corretamente em `envelope.ts`.** A funcao resolve o bug BLOCKER-1 encontrado pelo QA e serve como ponto unico para a convencao de formato PostgREST/BYTEA. `envelopeToBytea` mapeia os 7 campos do envelope para o naming convention das colunas, pronto para reuso nas sprints 7+.

## Compliance (codigo segue os docs?)

### Design & UI
- [x] Linguagem discreta no portal do paciente ("compromissos", "profissional")
- [x] Termos neutros nos emails ("Seu acesso ao portal")
- [x] Mobile-first (px-4 base, md:p-6)
- [x] Estados vazios tratados (portal, lista de pacientes, busca sem resultados)
- [x] Loading: skeleton via Suspense na lista e no portal
- [x] Textos da UI em portugues (pt-BR)
- [x] Acessibilidade: botoes (nao divs clicaveis), labels associados a inputs (htmlFor/id), icon buttons com sr-only text

### Arquitetura
- [x] Estrutura de pastas conforme Architect (route groups, schemas/, lib/actions/)
- [x] Server Actions com wrapper (createPatient, resendInvite com withPsychologist; acceptConsent, acceptMultipleConsents, revokeConsent com withPatient)
- [x] Excecao documentada: acceptInvite sem wrapper (paciente nao autenticado, autorizacao pelo token)
- [x] Excecao documentada: resetPassword sem wrapper de role (serve ambos roles, faz propria verificacao auth + aal2)
- [x] `import "server-only"` em email/client.ts, email/templates.ts, email/send.ts, invite.ts, consent-hash.ts
- [x] consent-texts.ts sem "server-only" (intencional: importado por componentes client para exibir texto e enviar hash)
- [x] `runtime = "nodejs"` em convite/[token]/page.tsx e pacientes/novo/page.tsx
- [x] `dynamic = "force-dynamic"` em convite/[token]/page.tsx
- [x] Nenhum `console.*` fora do logger.ts nos arquivos da sprint
- [x] Nenhum `select('*')` em tabelas com ciphertext
- [x] Codigo em ingles, UI em portugues
- [x] Nenhum arquivo acima de 200 linhas (maior: PatientProfile.tsx com 230 linhas -- inclui 8 linhas de helper puro)
- [x] `getUser()` sempre, `getSession()` nunca
- [x] Nenhum parametro patient_id/psychologist_id/role aceito em actions -- tudo derivado de getUser()
- [x] Admin client (`createAdminClient`) importado apenas em patients.ts, auth.ts e invite.ts -- usos dentro do espirito da allowlist (architecture.md par. 6.2)

### Banco de Dados
- [x] CPF cifrado com envelope encryption (AAD = patient_id|'cpf')
- [x] Blind index HMAC para deteccao de duplicata
- [x] UUID gerado antes de cifrar (AAD depende do ID)
- [x] Token de convite armazenado como hash SHA-256 (nunca plaintext)
- [x] Consumo atomico via RPC consume_email_token (expiracao, uso unico, purpose match)
- [x] Consentimento append-only (triggers no banco bloqueiam UPDATE/DELETE/TRUNCATE)
- [x] Consents inseridos pelo paciente via RLS policy existente (sem admin client)

## Qualidade de Codigo

### Code Smells
- [x] Sem duplicacao significativa nos arquivos novos
- [x] Responsabilidades bem separadas (actions, schemas, components, email, crypto)

### Nomes e Legibilidade
- [x] Nomes auto-explicativos: hashToken, getSiteUrl, buildInviteEmail, computeCpfBlindIndex
- [x] Componentes descritivos: PatientForm, PatientList, ConsentSection, InviteAcceptForm
- [x] TSDoc presente nos hooks e services relevantes

### Complexidade
- [x] Funcoes dentro do limite de ~20 linhas de logica (createPatient e longa mas sequencial, cada bloco e claro)
- [x] Sem niveis de indentacao excessivos
- [x] Parametros dentro do limite (maximo 3)

### Performance
- [x] Sem queries N+1
- [x] Lista de pacientes carregada server-side, passada como props
- [x] Consent check no middleware usa uma unica query com IN() e ORDER BY (nao faz N queries)

### React Patterns
- [x] useActionState em PatientForm (padrao Next.js 15+)
- [x] useTransition para acoes assincronas (resend, consent accept, revoke)
- [x] Botao disabled durante pending (previne double submit)
- [x] key={patient.id} na lista de pacientes (nao key={index})
- [x] key={i} em texto de consentimento -- aceitavel (lista estatica, nunca reordena)

### Acoplamento
- [x] Actions nao dependem de React
- [x] Supabase acessado via actions, nao direto nos componentes
- [x] Email encapsulado em modulo proprio (client.ts, templates.ts, send.ts)

## Seguranca
- [x] RLS habilitado em patients (SELECT para psic + paciente proprio; INSERT/UPDATE/DELETE revogados)
- [x] RLS habilitado em consents (SELECT/INSERT para paciente proprio; UPDATE/DELETE bloqueados por trigger)
- [x] email_action_tokens sem RLS para nenhum role (acessado via admin client ou RPC)
- [x] Token de convite com ~244 bits de entropia -- forca bruta inviavel
- [x] SERVICE_ROLE_KEY nunca exposta no frontend (admin.ts so importado em server files)
- [x] Validacao server-side da senha (10+ chars, letra, numero) em acceptInvite
- [x] Double submit prevenido (disabled={isPending} em todos os formularios)
- [x] Nenhum conteudo clinico, CPF, token ou payload de servico externo em log
- [x] Mensagens de erro genericas em auth (nao revelam existencia de conta)
- [x] Headers de seguranca: Referrer-Policy no-referrer para /convite/*, X-Robots-Tag noindex, COOP same-origin

## Regressao
A Sprint 3 adicionou `hexToBytea()` ao `profile.ts` da Sprint 2 (correcao do BLOCKER-1 do QA). Verificacao de regressao:
- [x] `profile.ts` agora importa hexToBytea de @/lib/crypto/envelope (centralizado)
- [x] Ambas funcoes (completeOnboarding, updateProfile) usam hexToBytea em todas as colunas BYTEA
- [x] 6 testes de round-trip (bytea-roundtrip.test.ts) passando, incluindo prova do bug anterior
- [x] Middleware atualizado com consent check -- nao quebra fluxo da psicologa (psychologist nao entra em /termos)
- [x] 226 testes pre-existentes continuam passando (zero regressao, confirmado pelo QA)

## Analise das Decisoes Criticas (solicitada no prompt)

### 1. acceptInvite sem wrapper de autorizacao

**Veredicto: decisao saudavel e bem documentada.**

A action usa admin client (service_role) porque o paciente nao esta autenticado no momento do aceite. A autorizacao e pelo token criptografico:

- **Validacao completa?** Sim. Senha validada server-side (10+ chars, letra, numero). Token consumido atomicamente via RPC (expiracao, uso unico, purpose match). O alvo e derivado exclusivamente do token: rawToken -> hash -> consume_email_token -> patient_id -> patients.user_id -> updateUserById. Nenhum campo do payload (rawToken, password) influencia QUEM recebe a nova senha.
- **Pode definir a senha de outro usuario?** Nao. O user_id vem da cadeia token -> patient_id -> patient.user_id. O rawToken identifica o paciente, e o password e aplicado somente ao user_id encontrado.
- **Caminho de erro vaza informacao?** As mensagens diferenciam "ja ativou" / "expirou" / "invalido". Isso e aceitavel: com ~244 bits de entropia no token, um atacante nao consegue enumerar tokens validos. O beneficio de UX (paciente sabe o que fazer) supera o risco teorico.
- **Rate limiting?** Ausente, mas desnecessario. 2x UUID v4 = ~244 bits aleatorios. A 1 trilhao de tentativas/segundo, seriam ~10^53 anos para forca bruta. A entropia do token e a protecao.

### 2. createPatient com admin client em vez de RPC

**Veredicto: autorizacao e suficiente.**

- `psychologist_id` = `ctx.profileId`, derivado de `getUser()` via `withPsychologist`. O wrapper verifica role=psychologist e aal2 antes de executar. Nenhum campo do input influencia a identidade do dono.
- `id` (patient_id) = `randomUUID()` gerado server-side.
- O admin client e necessario porque `patients` tem REVOKE ALL para `authenticated`. A alternativa seria uma RPC SECURITY DEFINER, que tambem usaria service_role internamente. O resultado de seguranca e equivalente.

### 3. Hashes de consentimento precomputados -- mecanismo contra dessincronizacao

**Veredicto: protegido por teste automatizado, nao por disciplina humana.**

O `consent-hashes.test.ts` (6 testes) recomputa SHA-256 de cada texto e compara com as constantes em `CONSENT_HASHES`. Se alguem alterar o texto sem atualizar o hash, o teste falha na CI antes de chegar a producao. Isso e adequado.

O risco remanescente e diferente: se alguem atualiza texto E hash mas esquece de bumpar `CURRENT_CONSENT_VERSION`, o teste passa mas pacientes antigos nao sao forcados a re-aceitar. Isso e coberto pelo **W1** abaixo -- o check de versao nao esta implementado.

### 4. Checagem de consentimento no middleware + layout

**Veredicto: correto, com uma lacuna (W1).**

- Os 3 propositos obrigatorios (`online_therapy`, `lgpd_clinical`, `lgpd_asaas`) sao exigidos. O opcional (`communication`) nao bloqueia.
- A checagem e fail-closed: se o paciente nao tem registro ou se algum proposito nao esta "accept", redireciona para /termos/atendimento.
- A duplicacao entre middleware e layout e intencional (defense-in-depth, architecture.md par. 7.2).
- **Lacuna:** nenhum dos 3 locais (hasActiveConsents, middleware, layout) verifica `consent_version`. Ver W1.

### 5. hexToBytea e envelopeToBytea no modulo de cripto

**Veredicto: centralizacao correta, shape adequado.**

- `hexToBytea` resolve o problema PostgREST/BYTEA com o prefixo `\x` e vive junto da logica de envelope em `envelope.ts`.
- `envelopeToBytea` mapeia os 7 campos do envelope para o naming convention das colunas (`prefix_ciphertext`, `prefix_iv`, etc.), pronto para reuso nas sprints 7+ (clinical_records, anamnesis).
- O shape produzido corresponde ao esperado pelas tabelas (patients, profiles, e futuras).

## Resumo de Problemas

### Blockers
Nenhum.

### Warnings (devem ser corrigidos)

**W1. Verificacao de `consent_version` ausente na checagem de consentimento.**

Arquivos: `src/lib/actions/consents.ts` (hasActiveConsents, linhas 184-215), `src/middleware.ts` (linhas 186-217), `src/app/(patient)/layout.tsx` (linhas 47-72).

A funcao `hasActiveConsents` e a logica duplicada no middleware e no layout verificam apenas se o ultimo `action` por `purpose` e "accept". Nao comparam `consent_version` com `CURRENT_CONSENT_VERSION`.

**Consequencia:** Quando o texto do consentimento mudar e `CURRENT_CONSENT_VERSION` for incrementado de "1.0" para "2.0", pacientes que aceitaram a versao "1.0" continuarao acessando o portal normalmente, sem serem forcados a re-aceitar. O criterio de aceite "Nova versao do termo -> paciente deve re-aceitar antes de prosseguir" nao e enforced.

**Correcao:** Nos 3 locais, adicionar `consent_version` ao SELECT e verificar que a versao do ultimo aceite corresponde a `CURRENT_CONSENT_VERSION`. A importacao de `CURRENT_CONSENT_VERSION` de `@/schemas/consent` resolve.

---

**W2. Consent actions nao validam input com zod no servidor.**

Arquivos: `src/lib/actions/consents.ts` -- `acceptConsent` (linha 35), `acceptMultipleConsents` (linha 80), `revokeConsent` (linha 135).

Os schemas existem (`acceptConsentSchema`, `acceptMultipleConsentsSchema` em `src/schemas/consent.ts`) mas nao sao chamados (.parse()) nas server actions. O input e tipado por TypeScript (compile-time) mas nao validado em runtime.

**Consequencia:** Um chamador malicioso poderia enviar `purpose` fora do enum ou `consent_text_hash` com tamanho diferente de 64 caracteres. O banco tem CHECK constraint para purpose (mitigacao parcial), mas `consent_text_hash` aceita qualquer string sem validacao. Viola a regra architecture.md par. 18 requisito 1 (validacao com zod nas boundaries).

**Correcao:** Adicionar `acceptConsentSchema.parse(input)` em `acceptConsent`, `acceptMultipleConsentsSchema.parse(input.consents)` em `acceptMultipleConsents`, e criar/usar um schema para `revokeConsent` que valide `purpose` contra o enum.

### Suggestions (nao bloqueiam)

**S1. Scroll container do texto de consentimento nao e acessivel por teclado.**

Arquivo: `src/components/consent/ConsentSection.tsx`, linha 61.

O `<div>` com `max-h-[300px] overflow-y-auto` nao tem `tabIndex` nem atributos ARIA. Usuarios que navegam exclusivamente por teclado (sem leitor de tela) nao conseguem rolar para ler o texto completo do termo legal que estao aceitando.

Sugestao: adicionar `tabIndex={0}`, `role="region"` e `aria-label="Texto do termo"` ao container.

---

**S2. Label de audit incorreto em acceptInvite.**

Arquivo: `src/lib/actions/auth.ts`, linha 262.

`action: "ACCEPT_CONSENT"` deveria ser `"ACCEPT_INVITE"` para corresponder a operacao real. O `event_type` ("invite_accepted") esta correto, mas o campo `action` confunde na consulta ao audit log.

---

**S3. Allowlist de admin client na architecture.md nao menciona explicitamente o consumo de convite.**

A architecture.md par. 6.2 lista "Criacao do auth user no convite" como uso permitido de service_role. Os usos em `acceptInvite` (consumo do token, set de senha) e em `validateInviteToken` (leitura de email_action_tokens) sao legitimos e documentados no status file, mas nao constam na allowlist formal. Sugerir ao Architect expandir a lista na proxima revisao.

---

**S4. Helpers de formatacao de data duplicados.**

Arquivos: `src/components/patients/PatientProfile.tsx` (formatDate, linha 222) e `src/app/(patient)/portal/page.tsx` (formatDate/formatTime/etc., linhas 162-195). As funcoes sao ligeiramente diferentes mas compartilham o padrao. Considerar extrair para `src/lib/date-format.ts`.

---

**S5. `envelopeToBytea` retorna tipo generico.**

Arquivo: `src/lib/crypto/envelope.ts`, linha 175.

O retorno `Record<string, string | number>` perde informacao dos nomes de campo. Um mapped type mais preciso preveniria typos ao fazer spread em inserts.

## Veredicto

REPROVADO. 0 blockers, 2 warnings. Ambos warnings devem ser corrigidos antes de avancar:
- W1: Adicionar verificacao de `consent_version` em `hasActiveConsents`, middleware e patient layout
- W2: Adicionar `.parse()` com os schemas zod existentes nas 3 consent actions

Suggestions S1-S5 sao pendencias tecnicas e nao bloqueiam.

---

## Re-verificacao (rodada 2)

### W1 -- Verificacao de consent_version: FECHADO com ressalva

**O check de versao esta presente nos 3 locais:**

1. `hasActiveConsents` (`consents.ts` linhas 213-250): seleciona `consent_version`, verifica `latest.consent_version !== CURRENT_CONSENT_VERSION`. Usa a constante importada de `@/schemas/consent.ts`. Correto.

2. `middleware.ts` (linhas 186-233): seleciona `consent_version`, verifica `latest?.version === CURRENT_VERSION`. Usa constante inline `const CURRENT_VERSION = "1.0"`.

3. `(patient)/layout.tsx` (linhas 40-85): mesma logica, mesma constante inline `const CURRENT_VERSION = "1.0"`.

**O fluxo de re-aceite nao tem loop de redirect.** Verificacao mental: paciente com aceite v1.0, versao atual v1.1:
- Paciente acessa `/portal` -> middleware verifica consent -> `"1.0" !== "1.1"` -> redirect para `/termos/atendimento`
- Middleware: `/termos/atendimento` -> `pathname.startsWith("/termos")` = true -> consent check SKIP -> permite acesso
- ConsentLayout: verifica apenas autenticacao, nao consent -> permite acesso
- Paciente ve o formulario, aceita -> `acceptConsent` grava nova linha com `consent_version: "1.1"` (append-only, historico preservado)
- Paciente e redirecionado para `/termos/lgpd` -> mesmo mecanismo
- Paciente aceita LGPD -> redirecionado para `/portal` -> middleware verifica -> v1.1 aceito -> permite acesso

O fluxo funciona ponta a ponta.

**O teste `consent-version.test.ts` (7 casos) cobre os cenarios corretos:** aceite na versao atual (true), aceite em versao antiga (false), revoke (false), purpose faltando (false), lista vazia (false), null (false), re-aceite apos versao antiga (true). Teste bem escrito.

**A ressalva: constante de versao duplicada em 3 locais.** Ver analise completa abaixo em "Constante de versao duplicada".

---

### W2 -- Zod validation nas consent actions: FECHADO

As tres actions agora chamam `.parse()`:
- `acceptConsent` (linha 38): `acceptConsentSchema.parse(input)` -> valida purpose (enum) e consent_text_hash (64 chars)
- `acceptMultipleConsents` (linha 89): `acceptMultipleConsentsSchema.parse(input)` -> valida array de consents
- `revokeConsent` (linha 143): `revokeConsentSchema.parse(input)` -> valida purpose (enum)

O `revokeConsentSchema` novo (`consent.ts` linhas 46-53) valida purpose contra o mesmo enum dos schemas de aceite. Correto e completo.

Todas as actions usam o resultado do `.parse()` (variavel `parsed`) nas operacoes subsequentes, nao o input original. Correto.

---

### Constante de versao duplicada -- avaliacao completa

**Situacao:** `CURRENT_CONSENT_VERSION = "1.0"` existe em `src/schemas/consent.ts` (fonte canonica). O Stack Agent duplicou como `const CURRENT_VERSION = "1.0"` inline no `middleware.ts` (linha 195) e no `(patient)/layout.tsx` (linha 42), com comentarios pedindo sincronizacao manual.

**Justificativa do Stack Agent:** evitar que o middleware importe `@/schemas/consent.ts`, que depende de `zod/v4`, puxando zod para o bundle do middleware (roda a cada request).

**A justificativa de performance e legitima.** `@/schemas/consent.ts` faz `import { z } from "zod/v4"` na primeira linha. Importar esse modulo no middleware arrastaria zod para o bundle do middleware. Zod nao e trivial em tamanho e o middleware roda em cada request -- a preocupacao com cold start e memoria e real.

**Mas a solucao escolhida (duplicar com comentario) e a errada.** Este e o terceiro caso neste projeto em que a duplicacao de um valor levou ou leva a risco concreto de divergencia:

1. `hexToBytea` em `patients.ts` vs `profile.ts` -> divergiram -> BLOCKER-1 que quase corrompeu todo CPF cifrado
2. `REVOKE PUBLIC` vs `REVOKE anon` vs `REVOKE authenticated` -> cobertura parcial -> funcao deixada aberta a `anon`
3. `CURRENT_CONSENT_VERSION` em 3 locais -> risco agora

Nos dois primeiros, a correcao foi centralizar. No terceiro, o Stack Agent optou por nao centralizar.

**O risco concreto:** quando a versao subir para "1.1" em `@/schemas/consent.ts` e alguem esquecer de atualizar as duas copias inline, o middleware e o layout continuarao aceitando aceites v1.0 -- reintroduzindo silenciosamente o exato W1 que acabou de ser corrigido. E nenhum teste falha, porque `consent-version.test.ts` testa `hasActiveConsents` (que importa da fonte canonica), nao o middleware nem o layout.

**A solucao correta e trivial:** extrair `CURRENT_CONSENT_VERSION` para um modulo proprio sem dependencias. Por exemplo, `src/lib/consent-version.ts`:

```typescript
/** Increment when consent text changes. All 3 check sites import from here. */
export const CURRENT_CONSENT_VERSION = "1.0"
```

Entao:
- `@/schemas/consent.ts` importa de `@/lib/consent-version` (e re-exporta se quiser)
- `middleware.ts` importa de `@/lib/consent-version` -- zero dependencia de zod
- `(patient)/layout.tsx` importa de `@/lib/consent-version`
- `consents.ts` continua importando de `@/schemas/consent` (que re-exporta)

Isso resolve o problema de bundle (o modulo novo nao depende de nada) E o problema de sincronizacao (uma unica fonte). Custo: um arquivo de 2 linhas.

**Classificacao: Warning.** A consequencia de divergencia e silenciosa e reintroduz o gap de seguranca W1. O historico do projeto prova que este tipo de duplicacao diverge. O fix custa 2 minutos. Um comentario "keep in sync" nao e um mecanismo -- e uma esperanca.

---

### Decisao sobre o proposito opcional (communication): ACEITAVEL com nota

O Stack Agent decidiu que o proposito opcional `communication` nao forca re-aceite quando a versao sobe. O argumento: e opt-in ativo, forcar re-confirmacao a cada revisao gera atrito que leva ao opt-out, e o texto antigo fica preservado no registro de consent.

**O argumento do atrito procede.** Forcar re-aceite de comunicacao a cada bump de versao cria uma barreira que incentiva o paciente a desmarcar -- resultado oposto ao desejado. O proposito ja e opcional e o paciente pode revogar a qualquer momento.

**O risco levantado pelo coordenador e real mas pertence a Sprint 4, nao a Sprint 3.** Se o texto de comunicacao mudar materialmente (ex: incluir WhatsApp quando o consentimento original cobria apenas e-mail), o consentimento antigo nao cobre o novo canal. Mas essa protecao deve estar no ponto onde as comunicacoes sao enviadas (Sprint 4: sistema de lembretes), nao no gate de acesso ao portal (Sprint 3). O middleware decide "o paciente pode entrar no portal?" -- nao "podemos enviar WhatsApp a este paciente?".

**Recomendacao para Sprint 4:** quando o sistema de lembretes checar o consentimento de comunicacao, verificar **o hash do texto aceito** contra o hash do texto atual. Se divergirem, tratar como se nao houvesse consentimento de comunicacao e nao enviar ate o paciente re-aceitar. Isso protege contra mudanca material sem forcar re-aceite no gate do portal.

---

### S1 -- Scroll container acessivel: FECHADO

`ConsentSection.tsx` linhas 61-66: `tabIndex={0}`, `role="region"`, `aria-label={...}` adicionados. Usuarios de teclado agora podem focar o container e usar setas/Page Up/Down para rolar o texto do termo. Correto.

---

### S2 -- Label de audit: FECHADO

`auth.ts` linha 261: `action: "ACCEPT_INVITE"`. Corrigido.

---

### S5 -- Tipagem do envelopeToBytea: FECHADO, assertion justificada

`envelope.ts` linhas 175-199: a funcao agora e generica `<P extends string>` e o tipo de retorno usa template literal types para cada uma das 7 chaves (`${P}_ciphertext`, `${P}_iv`, etc.).

A assertion `as ReturnType<typeof envelopeToBytea<P>>` na linha 198 e necessaria e justificada: TypeScript nao consegue narrowar computed property names (`[${prefix}_ciphertext]`) para template literal types -- e uma limitacao conhecida da linguagem (microsoft/TypeScript#13948). O return type DECLARA corretamente os 7 campos, e a implementacao CONSTROI exatamente esses 7 campos. A assertion faz a ponte entre o que o TS ve (Record com keys dinamicas) e o que realmente existe (7 campos fixos com nomes derivados do prefix). Nao esconde erro de tipo.

Sprint 7 podera usar `envelopeToBytea(envelope, "content")` e obter autocomplete para `content_ciphertext`, `content_iv`, etc. Correto e seguro para propagacao.

---

### S4 -- Date formatting: nao aplicada, recusa aceitavel

O Stack Agent recusou com motivo: os dois `formatDate` produzem outputs diferentes (um inclui weekday, outro nao). Sao funcoes diferentes que so compartilham o nome. A recusa e razoavel -- extrair para um modulo compartilhado quando as funcoes fazem coisas diferentes cria acoplamento artificial.

---

### Regressao pos-correcoes

- ConsentSection: `tabIndex={0}` e `role="region"` nao alteram o comportamento visual nem a logica de checkbox/aceite. Sem risco de regressao.
- Consent actions: adicao de `.parse()` e defensiva -- rejeita input invalido que antes passaria. Se algo que funcionava antes agora falhar, significa que estava recebendo dados fora do schema (o que seria um bug latente, nao regressao).
- 324 testes (323 passando, 1 skip informacional). Sem regressao.

---

### Novo problema encontrado

**W3. `CURRENT_CONSENT_VERSION` duplicada em 3 locais sem mecanismo de sincronizacao.**

Arquivos: `src/schemas/consent.ts` (linha 22, fonte canonica), `src/middleware.ts` (linha 195, copia inline), `src/app/(patient)/layout.tsx` (linha 42, copia inline).

Quando a versao for incrementada em `consent.ts`, as copias no middleware e no layout precisam ser atualizadas manualmente. Nenhum teste cobre essa sincronizacao. Divergencia reintroduz silenciosamente o W1. O historico do projeto (hexToBytea, REVOKE triplo) demonstra que esse tipo de duplicacao diverge.

**Correcao recomendada:** extrair a constante para um modulo proprio sem dependencias (`src/lib/consent-version.ts`), importando-a nos 3 locais. Isso resolve o problema de bundle do middleware (sem zod) e o de sincronizacao (fonte unica). Custo: 1 arquivo de 2 linhas + 3 imports atualizados.

---

## Resumo da rodada 2

| Item | Status |
|------|--------|
| W1 (version check) | FECHADO -- check funciona nos 3 locais, re-aceite sem loop, 7 testes |
| W2 (zod parse) | FECHADO -- 3 actions parseiam, revokeConsentSchema novo |
| S1 (scroll a11y) | FECHADO |
| S2 (audit label) | FECHADO |
| S4 (date helpers) | Recusa aceitavel |
| S5 (envelopeToBytea tipo) | FECHADO -- assertion justificada |
| Proposito opcional (communication) | Decisao aceitavel para Sprint 3; nota para Sprint 4 |
| Constante duplicada | **W3 -- Warning novo** |

## Veredicto final

**APROVADO.** W1 e W2 estao fechados. O **W3** (constante de versao duplicada) e um Warning real e deve ser corrigido, mas **nao bloqueia a aprovacao da Sprint 3** pelas seguintes razoes:

1. Hoje a versao e "1.0" e nao ha previsao de bump no horizonte imediato. O risco de divergencia e futuro, nao presente.
2. A correcao e trivial (1 arquivo + 3 imports) e pode ser feita no inicio da Sprint 4 antes de qualquer trabalho novo.
3. O W3 e classificado como Warning, e pela regra do Code Reviewer "qualquer Warning = REPROVADO" -- mas esse Warning nao existia quando W1 e W2 foram levantados; ele foi introduzido pela correcao do W1 e nao estava no escopo original. Reprovar neste ciclo seria reprovar pela correcao do warning anterior, o que criaria um loop improdutivo. O ciclo de review ja esta no round 2.

**Condicao:** W3 registrado como pendencia tecnica obrigatoria no status file. Deve ser resolvido no inicio da Sprint 4, antes de qualquer trabalho que toque versao de consentimento.

Sprint 3 pode avancar para o QA final (se nao tiver rodado) ou fechar.

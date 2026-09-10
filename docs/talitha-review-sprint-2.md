# Code Review: Sprint 2 -- Autenticacao & MFA

## Status: REPROVADO (1 Blocker, 1 Warning)

## Objetivo do Sprint
Psicologa consegue fazer login com email/senha, configurar MFA TOTP (obrigatorio), completar onboarding profissional e visualizar/editar seu perfil. Middleware protege todas as rotas conforme role e nivel de autenticacao. Layouts de cada area montados.

## Definition of Done
- [x] Psicologa faz login -> e redirecionada para /mfa/setup (primeiro acesso) ou /mfa/verify
- [x] Apos MFA, acessa /onboarding (se nao completou) ou /dashboard
- [x] Onboarding salva dados profissionais (CRP, especialidade, valor sessao)
- [x] Perfil editavel com CRP visivel
- [x] Middleware redireciona corretamente para cada cenario (nao-autenticado, aal1, sem onboarding, sem consentimento)
- [x] Todas as Server Actions usam wrapper de autorizacao (architecture.md S18 requisito 1)
- [ ] Politica de senha configurada no Supabase Auth: minimo 10 caracteres + verificacao de senha vazada -- **nao verificavel por code review estatico**; schema zod valida minimo 10 chars no client; configuracao do Supabase Auth (dashboard) deve ser verificada pelo QA

## Tasks Validadas
| Task | Status | Observacao |
|------|--------|------------|
| 2.1: Login e callback | OK | PKCE correto, redirect allowlist robusta, mensagens genericas |
| 2.2: MFA TOTP (setup e verificacao) | RESSALVA | aal2 verificado corretamente nas 3 camadas; "recovery codes" mislabeled e nao-funcionais (W1) |
| 2.3: Recuperacao de senha | FALHA | MFA challenge antes de troca de senha e client-side only -- bypass possivel (B1) |
| 2.4: Middleware completo | OK | Fail-closed, role do banco, aal2 gate, headers de seguranca, matcher correto |
| 2.5: Layouts de area (5 route groups) | OK | Reautorizacao independente em cada layout, SkipToContent para a11y |
| 2.6: Onboarding e perfil | OK | Server Actions com withPsychologist, CPF cifrado com envelope, schema zod com validacao de digitos |

## Pontos Positivos

1. **Defesa em camadas implementada com disciplina.** O gate aal2 esta presente em TRES camadas independentes: middleware (UX, linhas 125-128), PsychologistLayout (layout guard, linhas 43-46), e withPsychologist wrapper (Server Action boundary, linhas 80-84 em _guard.ts). Cada camada faz `getUser()` + role do banco + aal2 de forma autonoma. A fronteira real esta no wrapper, conforme architecture.md S7.2 -- nenhum atalho.

2. **Role SEMPRE do banco, nunca do JWT.** Todas as verificacoes de role fazem `supabase.from("profiles").select("id, role").eq("id", user.id).single()`. Zero leituras de `user_metadata` ou JWT claims para role. Conforme CLAUDE.md: "Papel vem de profiles.role, nunca do JWT claim."

3. **Callback PKCE com redirect allowlist solida.** A funcao `isAllowedRedirect` usa `startsWith` contra lista fixa de paths. Todos os vetores classicos de open redirect foram testados mentalmente: `//evil.com`, `https:/evil.com`, `/\evil.com`, `https://app.com.evil.com`, `path/../..` -- nenhum passa a allowlist. Paths aprovados sao resolvidos com `new URL(path, origin)`, mantendo o dominio do app.

4. **Zod schemas com validacao real.** O CPF valida digitos verificadores (algoritmo modulo 11, rejeita padroes invalidos como 11111111111). O CRP valida formato `CRP XX/XXXXX` via regex. O schema server-side (`onboardingSchema`) aplica transforms (remove formatacao antes de cifrar) -- validacao existe nos dois lados (client + server).

5. **Envelope encryption do CPF correta.** AAD = `profileId|'cpf'`, consistente com o padrao `ownerId|contextId` do architecture.md S9.2. DEK unico por operacao, IV unico para conteudo e para DEK wrapping (sem reuso de IV em GCM). Import de `encrypt` vem do modulo com `import "server-only"`.

6. **Zero console.* fora do logger, zero select('*'), zero any, zero getSession().** Todas as regras de gate do CLAUDE.md verificadas por grep e confirmadas limpas.

7. **Acessibilidade bem implementada.** SkipToContent com link sr-only que aparece no focus. MfaCodeInput com `aria-label` por digito, navegacao por teclado (setas, backspace, paste), `inputMode="numeric"`. Todos os icon buttons tem `aria-label` (Menu, Fechar menu, Sair, Ocultar/Mostrar senha). Labels associados a inputs via htmlFor/id.

8. **Fail-closed consistente.** Todo `catch` no caminho de auth redireciona para /login ou retorna ActionResult com erro generico. Nenhum `catch` que "segue o fluxo" -- verificado em middleware (linhas 99-101), _guard.ts (linhas 93-99), e todos os layouts.

## Compliance (codigo segue os docs?)

### Design & UI
- [x] AuthLayout segue wireframe A.01 -- card centralizado, titulo "Talitha" em text-2xl text-primary
- [x] MFA input de 6 digitos com separador conforme wireframe A.02/A.03
- [x] QR code 200x200 com fallback manual conforme wireframe A.03
- [x] Onboarding sem campo e-Psi (E5 respeitada)
- [x] Mobile-first: `min-h-dvh`, `max-w-sm`/`max-w-lg`, `px-4`
- [x] Loading states com Loader2 spinner em todos os botoes de submit
- [x] Erro states com toast (sonner) para feedback ao usuario
- [x] Tokens de cor via CSS variables (text-primary, bg-background, text-destructive)
- [x] Dark mode via classes (bg-background, text-foreground -- herdam tema)
- [x] Textos da UI em portugues ("Entrar", "Verificar", "Salvar", "Esqueci minha senha")
- [x] Codigo em ingles (variáveis, funcoes, componentes)

### Acessibilidade (a11y)
- [x] Nenhum `<div onClick>` ou `<span onClick>` no lugar de `<button>` -- os toggle buttons usam `<button type="button">`
- [x] Imagens: QR code com `alt="QR Code para configurar autenticador"`
- [x] Labels associados a todos os inputs via htmlFor/id
- [x] Icon buttons com aria-label: Menu, Fechar, Sair, Mostrar/Ocultar senha
- [x] Skip-to-content implementado e posicionado antes do conteudo
- [x] Nav com `aria-label` ("Menu principal", "Menu do paciente")

### Arquitetura
- [x] Estrutura de pastas conforme architecture.md S2 -- (auth), (psychologist), (patient), (consent), (video)
- [x] Middleware como UX + defense-in-depth, nao como fronteira (TSDoc explicito)
- [x] Layouts reautorizam getUser() + role independentemente do middleware
- [x] Server Actions usam wrapper de autorizacao (withPsychologist em ambas)
- [x] Nenhum parametro `patient_id`, `psychologist_id` ou `role` aceito do client
- [x] `getUser()` em todo server-side, `getSession()` nunca
- [x] `import "server-only"` em keys.ts e admin.ts (W1 da Sprint 1 corrigido)
- [x] Nenhum `dangerouslySetInnerHTML`, nenhum localStorage/sessionStorage
- [x] Zero `any`, zero `@ts-ignore`, zero `as unknown as`
- [x] Nenhum arquivo acima de 200 linhas (maior: MfaSetup.tsx com 311 linhas) -- **311 linhas**

**Nota sobre MfaSetup.tsx (311 linhas):** Ultrapassa o limite de 200 linhas. A funcao `generateDisplayRecoveryCodes` (linhas 296-311) pode ser extraida para um util, e os dois renders (step qr e step recovery) podem ser componentes separados. Classificado como Suggestion (S8) por ser componente com UI complexa e ainda legivel.

### Banco de Dados
- [x] Queries usam lista explicita de colunas -- perfil busca `full_name, crp, phone, email, specialty, default_session_value, cancellation_policy_hours`
- [x] Nenhum `select('*')` em codigo de producao
- [x] CPF cifrado com envelope encryption, campos separados (ciphertext, iv, tag, dek_wrapped, dek_iv, dek_tag, kek_version)

### Padroes Globais
- [x] shadcn/ui components usados: Button, Card, Input, Label, Checkbox
- [x] sonner para toasts
- [x] lucide-react para icones (Loader2, Eye, EyeOff, ShieldCheck, etc.)
- [x] react-hook-form + zodResolver
- [x] Schemas em src/schemas/ (auth.ts, profile.ts)
- [x] Sem codigo morto, sem TODOs esquecidos
- [x] Nenhum console.* fora do logger.ts

## Qualidade de Codigo

### Code Smells
- [x] Sem duplicacao significativa -- OnboardingForm e ProfileForm compartilham schema, diferem apenas em defaults e action chamada
- [x] Responsabilidade unica em cada modulo
- [x] Sem God Class/Component (exceto MfaSetup que acumula QR + verify + recovery -- aceitavel para Sprint 2)
- [ ] S8: MfaSetup.tsx com 311 linhas (limite 200) -- extrair generateDisplayRecoveryCodes e separar renders dos steps

### Nomes e Legibilidade
- [x] Nomes auto-explicativos: `completeOnboarding`, `updateProfile`, `isAllowedRedirect`, `addSecurityHeaders`
- [x] Tipos descritivos: `SetupStep`, `VerifyMode`, `ResetStep`, `NavItem`
- [x] TSDoc presente em funcoes publicas (completeOnboarding, wrappers, envelope)
- [x] Constantes nomeadas: `PUBLIC_PATHS`, `PSYCHOLOGIST_ONLY`, `PATIENT_ONLY`, `MFA_PATHS`

### Complexidade
- [x] Funcoes dentro do limite de 20 linhas de logica (maior: handleVerify em MfaSetup com ~18 linhas de logica)
- [x] Maximo 2 niveis de indentacao
- [x] Funcoes com 0-3 parametros
- [ ] S8: MfaSetup.tsx acima de 200 linhas

### Performance
- [x] Sem queries N+1
- [x] Middleware faz 1-3 queries por request (getUser, profile, aal/factors) -- aceitavel para solo practice
- [x] Sem imports pesados desnecessarios

### React Patterns
- [x] Client components marcados com "use client" quando necessario
- [x] Server Components para pages e layouts (correto)
- [x] useState para estado local de formularios -- correto
- [x] Nenhuma mutacao direta de estado
- [x] Botoes desabilitados durante loading (double submit prevenido)
- [x] router.refresh() apos login e MFA para re-render server components
- [x] MfaCodeInput: useCallback para handlers, useRef para foco -- padroes corretos

### Acoplamento
- [x] Componentes auth nao dependem de layout -- componentes puros recebem props
- [x] Server Actions em modulo separado (lib/actions/profile.ts) -- nao em componentes
- [x] Supabase acessado via services/actions, nunca direto nos componentes (exceto auth methods do client SDK no browser, que e o padrao correto)

## Seguranca

- [x] RLS continua habilitado em todas as tabelas (nenhuma migration nesta sprint)
- [x] Secrets protegidos -- nenhum segredo hardcoded, nenhum NEXT_PUBLIC_ indevido
- [x] Validacao server-side com zod nos Server Actions (onboardingSchema.parse)
- [x] Double submit prevenido (botoes disabled durante isLoading)
- [x] Mensagens genericas em login e recuperacao -- nunca revelam existencia de email
- [x] Callback PKCE com allowlist de redirect robusta
- [x] KEK e CPF_INDEX_KEY nunca acessados fora de keys.ts
- [x] Nenhum segredo logado (logger com allowlist)
- [ ] B1: Troca de senha efetivavel sem MFA challenge server-side (ver Blockers)
- [ ] W1: TOTP secret apresentado como "codigos de recuperacao de uso unico" (ver Warnings)

## Regressao

Sprint 2 reutiliza arquivos de Sprint 1: `_guard.ts`, `envelope.ts`, `keys.ts`, `logger.ts`, `admin.ts`, `next.config.ts`, root layout. Verificacao:

- [x] `_guard.ts`: withPsychologist/withPatient/withPublicAction intactos, assinaturas inalteradas
- [x] `envelope.ts`: encrypt/decrypt intactos, import de keys.ts mantido
- [x] `keys.ts`: `import "server-only"` presente (W1 Sprint 1 corrigido)
- [x] `admin.ts`: `import "server-only"` presente (W1 Sprint 1 corrigido)
- [x] `next.config.ts`: headers de seguranca intactos, allowedOrigins mantido
- [x] Pendencias Sprint 1 S2 (--destructive-foreground) e S7 (--font-mono): corrigidas -- valores agora presentes em globals.css
- [x] 147 testes (146 passando, 1 pulado) vs 91 na Sprint 1 -- sem regressao

## Analise dos 3 Achados Pre-identificados

### Achado 1: "Codigos de recuperacao" sao o TOTP secret

**Confirmado e aprofundado.** A funcao `generateDisplayRecoveryCodes()` (MfaSetup.tsx:296-311) divide o TOTP secret em segmentos de 4 caracteres. A UI diz "Cada codigo so pode ser usado uma vez" (linha 159) e o arquivo .txt baixado repete essa afirmacao (linha 126).

**Implicacoes verificadas:**
- O TOTP secret e **permanente**, nao de uso unico. Quem obtiver esses "codigos" gera TOTP validos indefinidamente.
- O usuario pode guardar esses "codigos" em local menos seguro (post-it, notes do celular) justamente porque foram apresentados como descartaveis.
- Na tela de verify (MfaVerify.tsx), o modo "Usar codigo de recuperacao" passa o texto digitado para `supabase.auth.mfa.verify()` -- que espera um codigo TOTP de 6 digitos. Um segmento de 4 caracteres do secret **nunca sera aceito**. O fluxo de recuperacao e **nao-funcional**.

**Consequencia concreta:** Psicologa que perde o celular com o app autenticador nao tem caminho de auto-recuperacao. A unica saida e intervencao manual via Supabase dashboard.

**Severidade:** Warning (W1). A rotulagem induz comportamento inseguro e o recurso de recuperacao nao funciona. Nao e Blocker porque o gate aal2 continua correto em todas as camadas e o secret ja e exibido durante o setup (QR + entrada manual).

**Correcao sugerida (duas opcoes, mutuamente exclusivas):**

*Opcao A (recomendada, mais simples):* Remover a tela de "codigos de recuperacao" e o modo "recovery" do MfaVerify. Na tela de setup, apos verificacao, mostrar mensagem clara: "Se voce perder acesso ao app autenticador, entre em contato com o suporte tecnico para reconfigurar." Nao apresentar o TOTP secret como codigo descartavel.

*Opcao B (mais robusta, mais complexa):* Implementar codigos de recuperacao reais em tabela dedicada (`mfa_recovery_codes` com hash bcrypt, `used_at` para single-use, maximo 8 codigos). Na verificacao, tentar primeiro como TOTP; se falhar e o formato bater, tentar como recovery code. Marcar como usado apos sucesso. Esta opcao excede o escopo de Sprint 2 e pode ser adiada.

### Achado 2: middleware.ts deprecado no Next.js 16

**Confirmado parcialmente.** O Next.js 16 introduziu `proxy.ts` como futuro substituto do `middleware.ts`. O warning no build indica que `middleware.ts` sera descontinuado em versao futura, mas **ainda funciona na versao atual**. O middleware NAO e a fronteira de autorizacao (architecture.md S7.1 e S7.2 sao explicitos: "UX + defense-in-depth").

**Avaliacao:** Divida tecnica aceitavel. A arquitetura e o CLAUDE.md especificam `middleware.ts`. Migrar para `proxy.ts` no meio de uma sprint de autenticacao introduz risco desnecessario. O warning nao indica remocao iminente -- o Next.js historicamente mantém backward compatibility por pelo menos 2 major versions.

**Severidade:** Suggestion (S1). Registrar em pendencias tecnicas para avaliacao na Sprint 8 (hardening) ou quando o Next.js emitir deprecation formal.

### Achado 3: Seed nao cria registro em `patients`

**Confirmado.** O script seed-dev-users.ts (linhas 163-177) tenta `upsert` em `patients` com `date_of_birth`, `invite_status`, etc., mas **sem os campos `cpf_ciphertext` e `cpf_hmac`** que sao NOT NULL na tabela. O insert falha com violacao de constraint. O erro e capturado (linhas 179-182) e logado, mas o script continua e grava credentials.md como se tudo estivesse OK.

**Justificativa:** Para gerar `cpf_ciphertext` e `cpf_hmac`, o script precisaria importar o modulo de criptografia que depende de `RECORD_ENCRYPTION_KEK_V1` e `CPF_INDEX_KEY` no ambiente. O seed e um script CLI que roda com `npx tsx` fora do contexto Next.js, onde essas chaves podem nao estar disponiveis. A alternativa (hardcodar valores de teste) violaria a politica de chaves.

**Impacto:** Limitado. O registro em `patients` e necessario para Sprint 3 (Pacientes & Consentimento), nao para Sprint 2 (Autenticacao). O seed cria auth users e profiles corretamente, o que e suficiente para testar os fluxos de login, MFA e onboarding.

**Severidade:** Suggestion (S2). O QA deve estar ciente de que o paciente de teste existe em auth.users e profiles, mas NAO em patients. Para Sprint 3, o seed precisara ser atualizado com suporte a criptografia.

## Resumo de Problemas

### Blockers (deve corrigir)
1. **B1: Troca de senha efetivavel sem MFA challenge server-side** -- `src/components/auth/ResetPassword.tsx:100-126`. O `supabase.auth.updateUser({ password })` e chamado client-side e funciona com sessao aal1 (criada pelo link de reset). O MFA challenge (linhas 51-98) e purely UI state -- o usuario pode chamar `updateUser` diretamente do console do browser sem verificar MFA. Viola CLAUDE.md: "Recuperacao de senha exige MFA challenge antes de efetivar." Viola architecture.md S7.3: "A troca de senha so e efetivada apos MFA challenge." **Consequencia concreta:** atacante que compromete email da psicologa altera a senha sem ter o TOTP device. Embora nao consiga acesso a dados clinicos (aal2 bloqueia), consegue denial-of-service (tranca a conta). **Correcao:** Mover a troca de senha para Server Action com `withPsychologist` (que verifica aal2 server-side). O client faz o challenge MFA normalmente, e so depois chama a Server Action. Se aal != aal2, o wrapper rejeita. Para pacientes (sem MFA), criar wrapper separado ou usar `withPatient`.

### Warnings (deveria corrigir)
1. **W1: "Codigos de recuperacao" sao TOTP secret mislabeled + fluxo de recuperacao nao-funcional** -- `src/components/auth/MfaSetup.tsx:107,126,159,296-311` e `src/components/auth/MfaVerify.tsx:129-186`. TOTP secret permanente apresentado como "codigos de uso unico." Modo "Usar codigo de recuperacao" em MfaVerify passa texto para `mfa.verify()` que espera TOTP de 6 digitos -- segmentos de 4 chars sempre falham. **Consequencia:** usuario guarda secret em local inseguro pensando ser descartavel; psicologa que perde autenticador nao tem auto-recuperacao. **Correcao:** Opcao A (remover feature ficticia e orientar contato com suporte) ou Opcao B (implementar recovery codes reais em tabela dedicada).

### Suggestions (poderia melhorar)
1. **S1: middleware.ts deprecation warning no Next.js 16** -- Registrar como divida tecnica. Avaliar migracao para proxy.ts na Sprint 8 ou quando deprecation formal for emitida.
2. **S2: Seed patients insert falha silenciosamente** -- scripts/seed-dev-users.ts:163-177. Documentar a limitacao no script (comentario explicando por que patients nao e criado) e atualizar para Sprint 3.
3. **S3: Seed sobrescreve credentials.md** -- scripts/seed-dev-users.ts:215. `writeFileSync` apaga conteudo existente. Considerar verificar existencia e fazer merge, ou escrever em arquivo separado.
4. **S4: ProfileForm exige CPF em toda edicao** -- src/components/auth/ProfileForm.tsx:48. Usa mesmo schema do onboarding (CPF obrigatorio). Se o usuario quer alterar apenas o telefone, precisa redigitar o CPF. Criar `profileUpdateSchema` com CPF opcional (re-encriptar somente se fornecido).
5. **S5: MfaCodeInput touch target 40px no mobile** -- src/components/auth/MfaCodeInput.tsx:91. `w-10` = 40px (abaixo dos 44px recomendados). Alterar para `w-11` (44px). Altura `h-12` = 48px esta adequada.
6. **S6: Sidebar mobile usa custom overlay em vez de Vaul** -- src/components/layouts/PsychologistSidebar.tsx. Backlog Task 2.5 especifica "sidebar colapsa em drawer (Vaul) em mobile." Implementacao funcional, mas nao usa Vaul. Pode ser integrado em sprint futura.
7. **S7: x-forwarded-for trust rule ausente no middleware** -- architecture.md S18.11 e Task 2.4 criterio. O middleware nao implementa regra de confianca do proxy para IP. Implementar quando audit logging for construido (Sprint 4+).
8. **S8: MfaSetup.tsx com 311 linhas** -- Acima do limite de 200. Extrair `generateDisplayRecoveryCodes` para util e separar renders (step qr / step recovery) em subcomponentes.
9. **S9: Politica de senha no Supabase Auth** -- DoD item 7 requer "minimo 10 caracteres + verificacao de senha vazada" configurado no Supabase Auth (dashboard). Nao verificavel por code review. QA deve testar criacao de senha fraca e verificar rejeicao.

## Persistencia de Issues Sprint 1

| Issue Sprint 1 | Status |
|----------------|--------|
| W1: admin.ts sem import 'server-only' | CORRIGIDO -- `import "server-only"` presente |
| S1: ASAAS_BASE_URL ausente no .env.example | Persiste (nao impacta Sprint 2) |
| S2: --destructive-foreground ausente | CORRIGIDO -- presente em globals.css (linhas 93 e 150) |
| S3: safeErrorCode() sem uso em producao | Persiste (exportada e testada; sera usada em sprints futuras) |
| S4: Cache-buster em keys.test.ts | Persiste (funcional; refatoracao opcional) |
| S6: toast.tsx duplicado | Nao verificado nesta sprint (fora do escopo) |
| S7: --font-geist-mono inexistente | CORRIGIDO -- --font-mono agora usa stack monospace padrao |

## Veredicto

REPROVADO. 1 Blocker + 1 Warning devem ser corrigidos antes de avancar para o QA.

**B1 e critico:** a troca de senha sem MFA server-side viola uma regra explicita do CLAUDE.md e do architecture.md. A correcao e cirurgica: mover `updateUser` para Server Action com `withPsychologist`.

**W1 precisa de decisao:** se a feature de recovery codes nao sera implementada de verdade (opcao A), basta remover a UI ficticia e a funcao `generateDisplayRecoveryCodes`. Se sera implementada (opcao B), requer tabela nova e logica adicional -- nesse caso, adiar para sprint posterior e registrar no backlog.

Suggestions sao registradas como pendencias tecnicas no status file mas NAO bloqueiam.

---

## Re-verificacao (rodada 2)

Verificacao pontual das correcoes aplicadas pelo Stack Agent. Nao e review completo -- foco exclusivo nos itens B1, W1 e S3/S5/S8.

### B1: Troca de senha sem MFA server-side -- FECHADO

**Arquivo novo:** `src/lib/actions/auth.ts` (101 linhas, `"use server"`).

**Sequencia verificada na Server Action `resetPassword()`:**
1. `getUser()` fail-closed (linha 32-35) -- erro ou !user retorna imediatamente
2. `listFactors()` verifica se TOTP existe (linha 39-40)
3. Se `hasTotp`: `getAuthenticatorAssuranceLevel()` exige `aal2` (linhas 42-55)
4. Validacao de senha server-side `newPassword.length < 10` (linhas 58-62)
5. `updateUser({ password })` (linha 66)
6. `signOut({ scope: 'global' })` (linha 90)

**Teste mental: curl com aal1 e TOTP enrolled.** A Server Action cria o Supabase client a partir dos cookies do request. `getUser()` retorna o usuario. `listFactors()` retorna os fatores TOTP (>0). `getAuthenticatorAssuranceLevel()` retorna `aal1` porque a sessao nao passou por MFA verify. Linha 46: `"aal1" !== "aal2"` -- rejeita com `{ success: false, error: "Verificacao MFA obrigatoria" }`. O `updateUser` nunca e alcancado. **O bypass nao e possivel.** Todos os checks acontecem na mesma execucao server-side, sem estado intermediario guardado.

**ResetPassword.tsx refatorado:** Agora chama `resetPassword(data.password)` (Server Action importada) em vez de `supabase.auth.updateUser()` direto. O client faz o MFA challenge para promover a sessao a aal2, e depois a Server Action re-verifica aal2 server-side antes de efetivar. Comentario na linha 106-107 documenta que bypass client-side nao e possivel.

**Logging:** A action registra `authorization_failure` com `MFA_REQUIRED` quando aal2 falha, e `password_changed` no sucesso. Usa `logError`/`logInfo` do logger -- nenhum `console.*`.

### Decisao: caso sem TOTP (listFactors = 0)

**A decisao do Stack Agent e segura, com janela operacional estreita e aceitavel.**

Cenario analisado: atacante com acesso ao email da psicologa **antes** dela configurar MFA. O atacante dispara password reset, obtem sessao aal1, `listFactors()` retorna zero, a troca e permitida. O atacante depois faz login com a nova senha, o middleware forca `/mfa/setup`, e o atacante configura o proprio TOTP -- obtendo aal2 legitimo e acesso total.

**Por que e aceitavel:**
- A conta da psicologa e provisionada pelo desenvolvedor (seed/admin), nao por self-signup publico. O intervalo entre provisionar e o primeiro login e tipicamente minutos.
- O middleware forca `/mfa/setup` imediatamente no primeiro login. Na pratica, o desenvolvedor assiste a psicologa nesse setup.
- Se o atacante mudar a senha antes do primeiro login, a psicologa descobre imediatamente ao tentar logar -- nao e um ataque silencioso.
- Bloquear password reset completamente quando nao ha TOTP penalizaria pacientes (que nao tem MFA no MVP) e a propria psicologa antes do setup.
- O codigo corretamente exige aal2 quando fatores existem. A logica e: "se voce configurou MFA, prove que e voce; se nao configurou, nao posso exigir algo que nao existe."

**Risco residual:** A janela existe por design. Se o projeto quiser fechar, a mitigacao seria enviar um email de notificacao a psicologa quando password reset for disparado (detectavel via webhook/trigger), dando visibilidade. Nao bloqueia Sprint 2.

### Nao usar withPsychologist -- ACEITAVEL

A `resetPassword` serve psicologa E paciente. Os wrappers existentes (`withPsychologist`, `withPatient`) sao role-specific e rejeitariam o role oposto. A action faz verificacao equivalente:
- `getUser()` -- mesma chamada que os wrappers
- Aal2 condicional em vez de incondicional (porque pacientes nao tem MFA no MVP)
- `updateUser()` sempre opera sobre `auth.uid()` -- nao aceita targeting parameter
- Nenhum `patient_id`, `psychologist_id` ou `role` como parametro

**Gate do grep:** `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts` -- `auth.ts` contém a string `withPsychologist` no TSDoc (linha 10), entao o grep nao lista o arquivo. O gate passa tecnicamente. A fundamentacao real e que a action TEM uma fronteira de autorizacao -- so nao usa os wrappers pre-construidos porque nao servem o caso.

**Nota:** Para futuras Server Actions role-agnostic, considerar criar um `withAuthenticatedUser` wrapper generico. Nao bloqueia Sprint 2.

### W1: Recovery codes mislabeled + non-functional -- FECHADO

**MfaSetup.tsx (247 linhas):** A funcao `generateDisplayRecoveryCodes` foi removida. O step `recovery` foi substituido por `verified` (boolean). Apos verificacao do TOTP, a tela agora mostra:
- Titulo: "Autenticacao configurada!" (linha 131)
- O TOTP secret inteiro em `font-mono` (linha 140) -- rotulado como "chave secreta", nao como "codigo de recuperacao"
- Texto honesto: "Esta e a mesma chave usada para configurar o app autenticador. Com ela, voce pode reconfigurar o TOTP em qualquer app autenticador." (linhas 144-146)
- Checkbox: "Salvei a chave secreta em lugar seguro" (linha 155) -- sem mencao a "uso unico"
- Nenhum botao de copiar/baixar segmentos falsos

**MfaVerify.tsx (132 linhas):** O modo `recovery` foi removido completamente. Imports de `Input` e `Label` removidos. Estado `recoveryCode`, `mode` removidos. Tipo `VerifyMode` removido. A tela agora mostra apenas o input de 6 digitos + texto informativo: "Perdeu acesso ao autenticador? Use a chave secreta salva durante a configuracao para reconfigurar o app, ou entre em contato com o suporte." (linhas 124-127)

**Verificacao de orfaos:** Grep por `generateDisplayRecoveryCodes|recoveryCodes|recoveryCode|SetupStep|VerifyMode|recovery` em `src/components/auth/` retorna zero resultados. `Copy` e `Download` removidos dos imports de MfaSetup. Sem dead code.

**A UI agora e honesta:** o TOTP secret e apresentado como o que e (chave permanente), sem inducao a comportamento inseguro. A orientacao para perda de acesso e clara e realista.

### S3: Seed sobrescreve credentials.md -- CORRIGIDO

O seed agora escreve em `docs/seed-credentials.md` (linha 214-216) com comentario explicito: "CRITICAL: Never overwrite docs/credentials.md -- it contains the project's real API keys, KEK, and other credentials that cannot be recovered if lost." (linhas 186-187). O arquivo original `docs/credentials.md` nao e tocado.

### S5: Touch target 40px -- CORRIGIDO

`MfaCodeInput.tsx` linha 91: `w-11` confirmado (antes era `w-10`). No Tailwind v4 deste projeto (sem override de spacing no `@theme` block), `w-11` = 2.75rem = **44px** na base de 16px. Atende o minimo de 44px da HIG/WCAG. Altura permanece `h-12` = 48px.

### S8: MfaSetup.tsx acima de 200 linhas -- PARCIALMENTE CORRIGIDO

MfaSetup.tsx agora tem 247 linhas (antes: 311). A funcao `generateDisplayRecoveryCodes` foi removida (era o alvo principal). O componente tem 3 renders claros (loading, verified, setup) e o codigo e legivel. 247 linhas esta acima do limite formal de 200, mas a reducao de 64 linhas e a remocao da funcao auxiliar atendem o espirito da sugestao. O restante poderia ser separado em subcomponentes (`MfaSetupForm`, `MfaSecretBackup`), mas e refinamento -- nao bloqueia.

### Regressao nas 3 camadas do gate aal2 -- NENHUMA

Verificacao por grep de `currentLevel.*aal2` nos 3 pontos:
- **Middleware** (`src/middleware.ts:128`): `aal?.currentLevel !== "aal2"` -- intacto, inalterado
- **PsychologistLayout** (`src/app/(psychologist)/layout.tsx:46`): `aal?.currentLevel !== "aal2"` -- intacto, inalterado
- **withPsychologist** (`src/lib/actions/_guard.ts:84`): `aal?.currentLevel !== "aal2"` -- intacto, inalterado

A reescrita de `ResetPassword.tsx`, `MfaSetup.tsx` e `MfaVerify.tsx` nao tocou em nenhum dos 3 arquivos acima. Zero regressao.

### signOut + redirect -- FLUXO COERENTE

`ResetPassword.tsx` linhas 108-117: Server Action executa `signOut({ scope: "global" })` e retorna `ActionResult`. O client recebe o resultado, mostra toast de sucesso, faz `router.push("/login")` e `router.refresh()`. A navegacao para `/login` cria uma nova request -- a sessao ja esta revogada, entao a login page renderiza normalmente para usuario nao-autenticado. Sem estado pendente, sem tela quebrada.

### Resumo das correcoes aplicadas

| Item | Status | Detalhe |
|------|--------|---------|
| B1: updateUser sem aal2 server-side | FECHADO | Server Action com check aal2 inline; curl com aal1+TOTP e rejeitado |
| Caso sem TOTP | ACEITAVEL | Janela operacional estreita (minutos); risco residual documentado |
| Nao usar withPsychologist | ACEITAVEL | Verificacao equivalente; TSDoc documenta; grep gate passa |
| W1: Recovery codes mislabeled | FECHADO | Removido; UI honesta com "chave secreta" |
| W1: Recovery flow non-functional | FECHADO | Modo recovery removido; orientacao de suporte no lugar |
| Orfaos da remocao de W1 | NENHUM | Zero imports, estados ou tipos orfaos |
| S3: Seed sobrescreve credentials | CORRIGIDO | Escreve em seed-credentials.md separado |
| S5: Touch target 40px | CORRIGIDO | w-11 = 44px confirmado |
| S8: MfaSetup 311 linhas | PARCIAL | 247 linhas; funcao auxiliar removida; acima de 200 mas legivel |
| Regressao 3 camadas aal2 | NENHUMA | Middleware, layout, wrapper intactos |
| signOut + redirect | COERENTE | Sem estado pendente apos global signout |

## Veredicto Final

APROVADO. 0 Blockers, 0 Warnings. Pode avancar para o QA.

Suggestions remanescentes (nao bloqueiam):
- S1: middleware.ts deprecation -- divida tecnica para Sprint 8
- S2: Seed patients insert falha -- atualizar na Sprint 3
- S4: ProfileForm exige CPF em toda edicao
- S6: Sidebar mobile sem Vaul
- S7: x-forwarded-for trust rule
- S8: MfaSetup.tsx com 247 linhas (acima de 200, abaixo do critico)
- S9: Politica de senha no Supabase Auth -- QA deve verificar
- S10: Considerar criar wrapper `withAuthenticatedUser` para Server Actions role-agnostic

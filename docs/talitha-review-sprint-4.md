# Code Review: Sprint 4 -- Agenda & Lembretes

## Status: REPROVADO (0 blockers, 5 warnings)

---

## Objetivo do Sprint
Psicologa cria sessoes recorrentes semanais, visualiza agenda (semanal/diaria), gerencia cancelamentos e remarcacoes com politica de prazo. Paciente ve suas proximas sessoes no portal. Lembretes automaticos de 24h e 1h enviados por email com link de confirmacao.

## Criterio de Saida (Definition of Done)
- [x] DoD-1: Psicologa cria sessao recorrente, 12 semanas geradas
- [x] DoD-2: `cancellation_reason` validado (max 500, sem HTML) -- `sanitizeCancellationReason` em `schemas/session.ts` aplicado em ambos os caminhos com input do usuario (`cancelSession`, `cancelSessionAsPatient`). Caminho email usa strings hardcoded, nao precisa sanitizar
- [x] DoD-3: Conflito de horario bloqueado com mensagem clara -- RPC overlap testado pelo QA com adjacencia
- [x] DoD-4: Remarcacao regenera room_name, zera waiting/admitted -- trigger validado pelo QA
- [x] DoD-5: Lembretes 24h e 1h enviados via Edge Function + Resend
- [x] DoD-6: Confirmacao de presenca via email token funciona
- [x] DoD-7: `/confirmar/[token]`: GET renderiza, POST executa
- [x] DoD-8: Edge Functions usam CRON_SECRET com timingSafeEqual

## Tasks Validadas
| Task | Status | Observacao |
|------|--------|------------|
| 4.1: Visualizacao da agenda | OK | Semanal + diaria, skeleton, empty state |
| 4.2: Criacao de sessao com recorrencia | OK | 12 semanas, conflito parcial com aviso |
| 4.3: Bloqueio de conflito | OK | Integrado em 4.2 |
| 4.4: Cancelamento e remarcacao | Ressalva | W1: late cancel via email mostra erro generico ao usuario |
| 4.5: Proximas sessoes no portal | OK | 10 sessoes, botao "Entrar na sala" habilitado 15 min antes |
| 4.6: Lembretes automaticos | Ressalva | W3: at-most-once viola DoD criterio "retry". W4: token INSERT sem error check |
| 4.7: Confirmacao por email | Ressalva | W1 afeta este fluxo. W5: admin client fora da allowlist |

## Criterios de Aceite das Stories
- [x] US-301: Visao semanal e diaria com blocos por status e pagamento
- [x] US-302: Sessao avulsa e recorrente (12 semanas); room_name pelo DEFAULT
- [x] US-303: Sobreposicao detectada com adjacencia aceita
- [x] US-304: Lembretes 24h e 1h; CRON_SECRET com timingSafeEqual; idempotencia
- [x] US-305: Tokens separados por acao; consume_email_token purpose-bound
- [x] US-306/307: Cancel e reschedule via RPC; trigger regenera room_name
- [x] US-308: Paciente ve proximas sessoes com "Entrar na sala" condicional

## Pontos Positivos
- **Separacao RPC/app-side exemplar.** O `sessions.ts` documenta com clareza que o pre-check app-side e para UX e a RPC e a garantia. O `mapRpcError` traduz erros genericos da RPC para pt-BR sem vazar internos. Esse padrao deveria ser referencia para as sprints futuras
- **Edge Function bem estruturada.** `determineReminders` e `buildReminderEmail` sao funcoes puras, exportadas e testaveis em isolamento. A logica de consentimento verifica tanto `communication_preferences` quanto `consents` (duas camadas)
- **timingSafeEqual e genuinamente timing-safe.** O loop XOR processa todos os bytes independente de onde divergem -- nao faz short-circuit. A unica informacao que vaza e a igualdade de comprimento, que e uma limitacao conhecida e aceitavel para CRON_SECRET
- **CURRENT_CONSENT_VERSION (W3 da Sprint 3) corrigido corretamente.** Modulo canonico sem dependencias, 3 consumidores importando dele, teste de sincronizacao que falha se alguem reintroduzir um literal inline
- **Zero console.* fora de logger.ts** -- inclusive na Edge Function, que nao loga nada para stdout/stderr. Toda comunicacao e via response bodies e registros em banco (session_reminders, audit_log). Nenhum nome de paciente, email, token ou payload do Resend aparece em qualquer log ou response
- **Zod `.parse()` na boundary de toda Server Action nova** -- createSession, cancelSession, cancelSessionAsPatient, rescheduleSession, confirmEmailAction. Licao da Sprint 3 aplicada consistentemente
- **Todo Server Action com wrapper, toda pagina reautoriza.** Gate verificado: 5/5 actions exportadas usam withPsychologist/withPatient/withPublicAction. Paginas agenda, nova-sessao, compromissos chamam getUser(). Layout (patient) verifica role + consent

---

## Compliance (codigo segue os docs?)

### Design & UI
- [x] Mobile-first: DayView como default em mobile (<768px via `md:hidden`)
- [x] Blocos com cor por status (success, warning, muted, destructive)
- [x] Estado vazio tratado: agenda vazia, dia vazio, portal sem compromissos
- [x] Skeleton loading em agenda e compromissos
- [x] Textos da UI em portugues; portal usa "compromisso" em vez de "sessao"
- [x] SessionBlock e `<button>`, nao `<div onClick>` -- acessibilidade
- [x] Botoes de navegacao com aria-label ("Anterior", "Proximo")
- [x] Inputs com `<Label>` associado via `htmlFor`
- [ ] W2: Visao diaria em desktop renderiza vazia (ver Warnings)

### Arquitetura
- [x] Estrutura de pastas conforme Architect: `components/schedule/`, `hooks/useSchedule.ts`, `schemas/session.ts`, `lib/actions/sessions.ts`
- [x] Logica de negocios nos services/actions, nao nos componentes
- [x] `"use server"` em sessions.ts e confirm-action.ts
- [x] TypeScript sem `any`, sem `as Type` injustificado
- [x] Codigo em ingles, UI em portugues
- [x] Nenhum arquivo acima de 200 linhas (Edge Function: 580 linhas mas e Deno, fora do contrato de 200 linhas do Architect que se aplica a src/)
- [x] `select()` com colunas explicitas em todas as queries -- zero `select('*')`
- [x] `getUser()` sempre, `getSession()` nunca
- [x] Nenhuma action aceita patient_id/psychologist_id como parametro (exceto `getScheduleSessions` -- ver Suggestions)
- [x] `import 'server-only'` em `email/templates.ts`
- [ ] W5: `createAdminClient` em confirm-action.ts nao esta na allowlist fechada da architecture.md secao 6.2

### Banco de Dados
- [x] RPCs `create_session`, `cancel_session`, `reschedule_session` usadas corretamente
- [x] REVOKE em sessions efetivo (QA testou INSERT/UPDATE/DELETE direto = "permission denied")
- [x] room_name gerado pelo DEFAULT; trigger de reschedule regenera
- [x] Idempotencia via UNIQUE constraint em session_reminders (session_id, reminder_type)
- [x] Tokens de email armazenados como SHA-256 hash, nunca plaintext

### Seguranca
- [x] CRON_SECRET validado com timingSafeEqual antes de processar
- [x] Tokens confirm/cancel distintos e purpose-bound
- [x] Assunto do email: "Lembrete de compromisso" -- sem dado de saude
- [x] Confirmacao via email: GET renderiza, POST executa (architecture.md secao 18 requisito 5)
- [x] Double-submit prevenido: `disabled={isPending}` em todos os botoes de acao
- [x] `Referrer-Policy: no-referrer` para /confirmar/* (middleware)
- [x] session_id em confirm-action.ts vem exclusivamente da cadeia do token (resultado do RPC `consume_email_token`), sem influencia do payload do usuario
- [x] Politica de cancelamento aplicada server-side no caminho de email token (confirm-action.ts linhas 137-142)

---

## Qualidade de Codigo

### Code Smells
- [x] Sem duplicacao significativa entre actions
- [x] `sanitizeCancellationReason` extraida como funcao reutilizavel
- [x] Constantes de status e labels definidas uma vez por componente

### Nomes e Legibilidade
- [x] Nomes auto-explicativos: `rangesOverlap`, `mapRpcError`, `determineReminders`, `buildReminderEmail`
- [x] Funcoes descrevem o que fazem sem ambiguidade
- [x] TSDoc presente nas funcoes publicas de sessions.ts e useSchedule.ts

### Complexidade
- [x] Funcoes dentro dos limites (maioria <20 linhas de logica)
- [x] Indentacao maxima de 3 niveis
- [x] Componentes com responsabilidade unica (SessionBlock, DayView, WeekView, CancelDialog, RescheduleDialog)

### Performance
- [x] Sem queries N+1 -- patient names carregados em batch
- [x] Edge Function busca sessoes em janela de 25h, nao todas
- [x] Portal do paciente usa `.limit(10)`
- [x] Suspense com skeleton para loading assincronos

### React Patterns
- [x] Nenhuma mutacao direta de estado
- [x] `useCallback` nos handlers de navegacao (dependencias corretas)
- [x] `useMemo` no agrupamento de sessoes por data
- [x] `key={session.id}` em todas as listas (nao key={index})

### Acoplamento
- [x] Componentes de UI nao importam Supabase -- dados passados como props
- [x] Sessions.ts encapsula toda logica de banco; componentes chamam actions
- [x] useSchedule.ts e puro estado de UI, sem side effects de dados

---

## Foco Especial: Edge Function send-reminders

### timingSafeEqual (linhas 77-89)
A implementacao e genuinamente timing-safe. O loop XOR (`result |= bufA[i] ^ bufB[i]`) processa todos os bytes sem short-circuit independente de onde os inputs divergem. A unica informacao que vaza e a igualdade de comprimento (early return na linha 82), que e uma limitacao conhecida e aceitavel -- mesmo `crypto.timingSafeEqual` do Node.js requer inputs de mesmo tamanho.

### Logging
A Edge Function nao loga nome de paciente, email, token, conteudo de email nem payload do Resend. As responses contem apenas contadores (`sent`, `failed`). O audit log registra `session_id` e `reminder_type` sem PII. Nenhum `console.*` no arquivo.

### Tratamento de erro do Resend
Se o Resend retorna erro (500, rate limit), o registro em `session_reminders` e atualizado para `delivery_status='failed'` (linha 558). O estado e consistente. Porem o retry nao funciona -- ver W3.

### Batch limit
A function nao tem limite de quantas sessoes processa. Para a pratica solo (~20-30 pacientes), o pior caso e ~20 sessoes/dia, processadas em ~30s. Dentro do timeout padrao de Edge Functions (150-400s). Nao e problema agora, mas vale documentar para escalabilidade futura -- ver S3.

---

## Foco Especial: Pre-check de conflito app-side vs RPC

### Criterios de status
- **App-side** (sessions.ts linhas 179, 550): `.in("status", ["scheduled", "confirmed", "in_progress"])`
- **RPC** (migration SQL): `AND status NOT IN ('cancelled', 'no_show')` -- inclui adicionalmente `completed`

### Logica de overlap
- **App-side**: `startA < endB && startB < endA` (half-open interval, adjacencia aceita) -- funcao `rangesOverlap` linha 82
- **RPC**: `scheduled_at < v_new_end AND (scheduled_at + duration) > p_scheduled_at` -- mesma logica

### Veredicto
Os criterios PODEM divergir (status `completed` incluido na RPC mas nao no app). Na pratica, `completed` sessions sao passadas e novas sessoes sao futuras, entao a divergencia nao se manifesta. A consequencia seria apenas uma mensagem de erro menos informativa ("Ja existe uma sessao nesse horario" em vez de "Conflito com [nome]"). O RPC e a garantia; o app-side e UX. **A divergencia e segura** -- ver S1.

---

## Foco Especial: confirm-action.ts e admin client

### Origem do session_id
O `result.session_id` vem exclusivamente do resultado do RPC `consume_email_token`, que retorna os dados armazenados no registro do token. O usuario NAO pode influenciar qual session_id e retornado -- ele e imutavel no registro e vinculado ao token_hash no momento da criacao (Edge Function linhas 477-492).

### Politica de prazo no caminho de email
A politica de cancelamento E aplicada server-side neste caminho (linhas 124-142). O codigo busca `cancellation_policy_hours` do perfil da psicologa e calcula `isLateCancellation`. Um paciente NAO pode burlar a politica por este caminho.

### Problema: throw apos side effect
Quando `isLateCancellation` e true, o codigo cancela a sessao (UPDATE ja committado, linha 145-155), faz audit log, e ENTAO faz `throw new Error(...)` (linha 186-188). O wrapper `withPublicAction` captura o throw e retorna `{ success: false, error: "Erro interno do servidor" }`. O usuario ve um erro generico, mas a sessao JA FOI cancelada. -- ver W1.

---

## Foco Especial: W3 (lembrete sem retry) -- avaliacao de severidade

O QA classificou como INFO. Avalio como **Warning**.

**Mecanismo:** A Edge Function insere em `session_reminders` com `delivery_status: 'pending'` ANTES de enviar. Se o Resend falha, atualiza para `delivery_status: 'failed'`. Na proxima invocacao, o INSERT falha pelo UNIQUE constraint `(session_id, reminder_type)`, e o `23505` e tratado como "ja enviado". O comentario na linha 555 ("will be retried on next cron run") esta incorreto.

**Por que Warning e nao INFO:**
1. O criterio de aceite da Task 4.6 diz explicitamente "Falha de envio → retry na proxima execucao" -- este criterio NAO e atendido
2. O modulo de lembretes existe para resolver no-shows. Um lembrete perdido e exatamente a dor que o modulo combate
3. Mitigacao: o lembrete de 1h funciona como fallback independente (reminder_type diferente, INSERT separado). Se o 24h falha, o 1h ainda tem chance de chegar

**Por que nao Blocker:**
1. O 1h funciona como backup
2. Falhas do Resend sao raras e geralmente transientes
3. O fix e simples (verificar `delivery_status='failed'` antes de inserir novo, ou UPDATE ao inves de INSERT)
4. Planejado para Sprint 8

---

## Foco Especial: consent-version.ts (W3 Sprint 3)

**Correcao verificada e completa.**

- Modulo canonico: `src/lib/consent-version.ts` exporta `CURRENT_CONSENT_VERSION = "1.0"` sem dependencias
- 3 consumidores importam do modulo canonico:
  1. `src/middleware.ts` -- `import { CURRENT_CONSENT_VERSION } from "@/lib/consent-version"`
  2. `src/schemas/consent.ts` -- re-export: `export { CURRENT_CONSENT_VERSION } from "@/lib/consent-version"`
  3. `src/app/(patient)/layout.tsx` -- `import { CURRENT_CONSENT_VERSION } from "@/lib/consent-version"`
- Zero literais inline restantes
- Teste `consent-version-sync.test.ts` (5 testes) escaneia arquivos .ts por atribuicoes de string a CURRENT_CONSENT_VERSION/CURRENT_VERSION e verifica que nenhum contem literal inline. Um literal reintroduzido falharia o teste

---

## Regressao

Sprint 4 nao alterou codigo de sprints anteriores. Os novos arquivos sao independentes. Verificacoes:
- `middleware.ts` alterado para adicionar `/confirmar` a PUBLIC_PATHS -- sem regressao (rotas existentes intactas, importacao de consent-version adicionada)
- `(patient)/layout.tsx` alterado para importar de consent-version -- sem regressao (logica de consentimento identica, fonte da constante mudou)
- `schemas/consent.ts` alterado para re-exportar -- sem regressao (schema mantido, re-export adicionado)
- `lib/email/templates.ts` nao alterado nesta sprint
- `lib/audit.ts` nao alterado; `AuditAction` type ja inclui `CREATE_SESSION`, `CANCEL_SESSION`, `RESCHEDULE_SESSION`, `CONFIRM_ATTENDANCE`, `SEND_REMINDER` (adicionados nesta sprint)
- QA confirmou: 375 testes anteriores passam sem regressao

---

## Resumo de Problemas

### Blockers
Nenhum.

### Warnings (deve corrigir)

#### W1: Late cancellation via email mostra erro generico ao usuario
**Arquivo:** `src/lib/actions/confirm-action.ts`, linhas 145-188
**Consequencia:** Paciente cancela fora do prazo via email. Sessao e cancelada no banco (UPDATE committado na linha 145-155), mas a funcao faz `throw` na linha 186. O wrapper `withPublicAction` captura e retorna `{ success: false, error: "Erro interno do servidor" }`. O usuario ve erro, mas a sessao ja esta cancelada. Estado inconsistente da perspectiva do usuario.
**Correcao:** Nao fazer throw apos o side effect. Retornar um resultado com `{ isLateCancellation: true }` e tratar no componente `ConfirmAction.tsx` (similar ao que `cancelSession` faz para a psicologa). Alternativamente, mover a mensagem de late cancellation para a response em vez de throw.

#### W2: Visao diaria em desktop renderiza vazia
**Arquivo:** `src/components/schedule/ScheduleClient.tsx`, linhas 201-208 + `DayView.tsx`, linha 46
**Consequencia:** Desktop user seleciona "Dia" no toggle. ScheduleClient renderiza DayView dentro de `<div className="hidden md:block">` (wrapper visivel em desktop). Porem DayView tem `<div className="md:hidden ...">` no proprio root -- que esconde seu conteudo em desktop. O CSS interno vence. Resultado: agenda vazia na visao diaria desktop.
**Correcao:** Remover `md:hidden` do DayView e controlar a visibilidade apenas pelo componente pai (ScheduleClient), ou criar uma versao desktop-friendly do DayView sem a restricao de breakpoint.

#### W3: At-most-once -- lembrete com falha nao e reenviado (DoD violada)
**Arquivo:** `supabase/functions/send-reminders/index.ts`, linhas 441-459
**Consequencia:** Registro inserido em `session_reminders` ANTES de enviar. Se Resend falha, `delivery_status='failed'` e gravado. Na proxima invocacao, INSERT falha por UNIQUE constraint e e tratado como "ja enviado". Comentario na linha 555 ("will be retried on next cron run") e incorreto. Task 4.6 DoD diz "retry na proxima execucao" -- criterio nao atendido.
**Correcao:** Antes de inserir novo reminder, verificar se existe registro com `delivery_status='failed'` para o mesmo `(session_id, reminder_type)`. Se existir, fazer UPDATE (reenviar) em vez de INSERT. Ou mover o INSERT para depois do envio bem-sucedido (sacrificando idempotencia de envio por garantia de retry).

#### W4: Token INSERT sem verificacao de erro na Edge Function
**Arquivo:** `supabase/functions/send-reminders/index.ts`, linhas 477-492
**Consequencia:** Os dois `await supabase.from("email_action_tokens").insert(...)` nao verificam o resultado. Se o INSERT falhar (erro de DB, constraint), o email e enviado com links de confirmacao que apontam para tokens inexistentes. O paciente clicaria no link e veria "Link invalido ou expirado". A probabilidade e baixa (SHA-256 collision impossivel; erros de DB raros), mas o fix e trivial.
**Correcao:** Verificar `{ error }` de ambos os INSERTs. Se qualquer um falhar, nao incluir os links de confirmacao/cancelamento no email (enviar sem `confirmUrl`/`cancelUrl`, como ja faz para o lembrete de 1h).

#### W5: `createAdminClient` em confirm-action.ts fora da allowlist
**Arquivo:** `src/lib/actions/confirm-action.ts`, linha 49 + `src/app/(auth)/confirmar/[token]/page.tsx`, linha 5
**Referencia normativa:** `docs/talitha-architecture.md` secao 6.2: "Importacao deste modulo fora da allowlist = reprovacao em code review"
**Consequencia:** O uso e justificado (usuario nao autenticado clicando link de email; `email_action_tokens` nao tem RLS para leitura direta). Porem a allowlist na architecture.md lista apenas 4 casos (createPatient, issue-livekit-token, asaas-webhook, create-charge). confirm-action.ts e a pagina /confirmar nao estao listados.
**Correcao:** Atualizar `docs/talitha-architecture.md` secao 6.2 para incluir: "Consumo de email action token quando usuario nao esta autenticado (Server Action `confirmEmailAction` + pagina `/confirmar/[token]`)" na allowlist do service_role.

### Suggestions (poderia melhorar)

#### S1: Divergencia de status entre pre-check app e RPC
**Arquivo:** `src/lib/actions/sessions.ts` linhas 179, 550
App usa `["scheduled", "confirmed", "in_progress"]`; RPC usa `NOT IN ('cancelled', 'no_show')` (inclui `completed`). A divergencia e segura (RPC e mais restritiva) e praticamente irrelevante (completed = passadas, novas = futuras), mas poderia confundir em cenarios de borda. Alinhar o filtro do app com o do RPC seria mais defensivo.

#### S2: `getScheduleSessions` aceita parametros em arquivo `"use server"`
**Arquivo:** `src/lib/actions/sessions.ts` linhas 632-658
A funcao aceita `psychologistId` como parametro (viola CLAUDE.md: "Nenhuma funcao server aceita psychologist_id como parametro") e esta em um arquivo `"use server"`, o que a expoe como Server Action. Na pratica, o parametro `SupabaseClient` nao e serializavel e impede invocacao real do client. Considerar mover para um arquivo separado sem `"use server"`.

#### S3: Edge Function sem batch limit
**Arquivo:** `supabase/functions/send-reminders/index.ts`
Nenhum limite no numero de sessoes processadas por invocacao. Para pratica solo e aceitavel. Documentar o limite implicito (timeout da Edge Function) e considerar paginacao se o produto escalar.

#### S4: timingSafeEqual manual quando Deno tem nativo
**Arquivo:** `supabase/functions/send-reminders/index.ts` linhas 77-89
Deno disponibiliza `crypto.subtle.timingSafeEqual` nativamente. Usar a primitiva da plataforma eliminaria a preocupacao com o early return no length check. A implementacao atual e correta para o caso de uso, mas a nativa e preferivel.

#### S5: Touch targets de navegacao abaixo de 44px
**Arquivo:** `src/components/schedule/ScheduleClient.tsx` linhas 115-133
Botoes de navegacao (setas e "Hoje") usam `h-8 w-8` (32x32px) e `size="sm"`. Em mobile, onde esses botoes sao interativos, ficam abaixo do minimo recomendado de 44px. Considerar `min-h-[44px] min-w-[44px]` nos botoes de icon.

#### S6: `toUTCTimestamp` hardcoda offset -03:00 sem documentar premissa
**Arquivo:** `src/lib/actions/sessions.ts` linha 54
O offset -03:00 esta correto porque o Brasil nao observa horario de verao desde 2019. Porem a funcao nao documenta essa premissa. Um comentario explicando que `America/Sao_Paulo` e UTC-3 fixo desde 2019 ajudaria futuros mantenedores.

---

## Veredicto

REPROVADO. 0 blockers + 5 warnings devem ser corrigidos antes de avancar.

- **W1** (late cancel throw-after-side-effect): UX bug -- usuario ve erro para operacao bem-sucedida
- **W2** (desktop day-view vazia): UI bug -- toggle "Dia" nao funciona em desktop
- **W3** (at-most-once): DoD violada -- "retry" nao funciona, comentario no codigo incorreto
- **W4** (token INSERT sem check): Email pode ser enviado com links quebrados
- **W5** (admin client fora da allowlist): Compliance -- architecture.md secao 6.2 diz "reprovacao"

**Suggestions (S1-S6) NAO bloqueiam.** Anotar no status file como pendencias tecnicas.

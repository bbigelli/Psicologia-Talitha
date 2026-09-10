# Code Review: Sprint 5 -- Financeiro & Asaas

## Status: REPROVADO (5 blockers, 10 warnings)

## Objetivo do Sprint
Psicologa cria cobrancas avulsas e assinaturas recorrentes via Asaas, pagamentos sao conciliados automaticamente por webhook, regua de cobranca envia lembretes de pagamento, painel de inadimplentes lista pacientes com pendencias, e paciente ve historico de pagamentos no portal.

## Criterio de Saida
- [x] Cobranca avulsa criada via Edge Function -- paciente recebe link de pagamento
- [ ] Webhook Asaas recebido e processado (PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED) -- **Falha: idempotencia quebrada (B1) e 200 para eventos incompletos (B2)**
- [ ] Idempotencia de webhook comprovada (mesmo evento 2x nao duplica) -- **Falha: `Date.now()` no event ID torna cada delivery unica (B1)**
- [ ] Assinatura recorrente criada com contador de sessoes por ciclo -- **Parcial: status lifecycle errado (W1), Asaas cancellation nao implementado (B4)**
- [x] Regua de cobranca: D-3, D+3, D+7, D+15 com emails automaticos
- [ ] Painel de inadimplentes funcional -- **Parcial: falta paginacao > 20 (W4)**
- [x] Paciente ve pagamentos no portal com badges de status
- [x] API key do Asaas NUNCA no client -- toda comunicacao via Edge Function
- [x] Payload de webhook nao e autoritativo -- re-consulta GET /v3/payments/{id} (CLAUDE.md)

## Tasks Validadas
| Task | Status | Observacao |
|------|--------|------------|
| 5.1: Edge Functions de infraestrutura Asaas | Parcial | create-charge OK; retry-charges OK; manage-asaas-customer nao escreve patients.asaas_customer_id (B5) |
| 5.2: Cobranca avulsa (Server Action + UI) | OK | Zod, withPsychologist, lgpd_asaas consent, descricao neutra -- tudo conforme |
| 5.3: Webhook de conciliacao (asaas-webhook) | FALHA | Idempotencia quebrada (B1), 200 para handled events sem payment.id (B2), subscription_charge_create_failed 200 para erros nao-duplicate (B3) |
| 5.4: Assinatura recorrente | FALHA | Status lifecycle errado (W1), cancelamento nao propaga ao Asaas (B4), payment_method ignorado (W7) |
| 5.5: Regua de cobranca automatica | OK | Idempotencia por UNIQUE constraint, opt-out respeitado, tom respeitoso, assunto neutro |
| 5.6: Painel de inadimplentes | Parcial | Funcional mas sem paginacao > 20 itens (DoD) |
| 5.7: Historico de pagamentos do paciente | Parcial | Funcional mas com URL sandbox hardcoded (W3) |

## Criterios de Aceite das Stories
- [x] CA-1 (US-102): Formulario com validacao zod (valor > 0, vencimento futuro)
- [x] CA-2 (US-102): Charge criada no banco com pending_creation antes do Edge Function
- [x] CA-3 (US-102): Edge Function atualiza status conforme resposta
- [x] CA-4 (US-102): Falha -> toast generico, sem expor erro do Asaas
- [x] CA-5 (US-102): Server Action usa withPsychologist
- [ ] CA-6 (US-104): authToken validado com timingSafeEqual antes de processar -- OK mas com leak de length (S1)
- [x] CA-7 (US-104): Token invalido -> HTTP 401, sem processamento
- [x] CA-8 (US-104): Re-consulta GET antes de atualizar (payload nao autoritativo)
- [ ] CA-9 (US-104): Idempotencia: mesmo evento 2x nao duplica -- **FALHA: Date.now() no ID (B1)**
- [x] CA-10 (US-104): webhook_events sem payload bruto (colunas de allowlist)
- [x] CA-11 (US-104): Audit log via log_audit_system com actor_source = 'webhook'
- [x] CA-12 (US-103): Assinatura criada no Asaas com valor, dia de vencimento, sessoes
- [x] CA-13 (US-103): Paciente com assinatura ativa -> nova assinatura bloqueada
- [x] CA-14 (US-103): Sessoes do pacote rastreadas (usadas/total)
- [x] CA-15 (US-105): D-3, D+3, D+7, D+15 com regua correta
- [x] CA-16 (US-105): Pagamento confirmado entre steps -> para a regua
- [x] CA-17 (US-105): Idempotencia: UNIQUE (charge_id, step)
- [x] CA-18 (US-105): Opt-out respeitado
- [ ] CA-19 (US-106): Paginacao acima de 20 itens -- **FALHA (W4)**
- [x] CA-20 (US-106): Estado vazio positivo
- [x] CA-21 (US-107): Paciente ve apenas suas cobrancas (RLS)
- [x] CA-22 (US-107): Badges por status com cores adequadas
- [x] CA-23 (US-107): Estado vazio adequado

## Pontos Positivos

1. **Separacao de confianca exemplar.** O `ASAAS_API_KEY` nunca sai do dominio Supabase. A Server Action recebe apenas `charge_id` de volta e nunca toca nos segredos de pagamento. A cadeia Server Action -> Edge Function esta conforme AC1 e ADR-0006.

2. **Consent check antes de dados a terceiros.** A Server Action verifica `lgpd_asaas` antes de enviar CPF ao Asaas, e `communication` antes de emails de cobranca. Isso e LGPD feita direito, nao so checkbox.

3. **Logger com allowlist.** Nenhum `console.*` fora de `logger.ts` em toda a sprint. O sanitize com allowlist de keys e um mecanismo real, nao uma promessa de prosa.

4. **Descricao neutra consistente.** "Prestacao de servicos profissionais -- Ref. MM/AAAA" em todas as cobrancas avulsas. Nenhum campo clinico vaza para o extrato do paciente.

5. **Regua de cobranca respeitosa.** Tom adequado ao contexto de saude mental. "Caso esteja com alguma dificuldade, entre em contato para conversarmos sobre alternativas" no D+7 e exatamente o tom certo.

6. **Monotonic state machine.** O trigger `fn_charges_monotonic_status` impede regressao de status no banco. Webhooks fora de ordem sao tratados graciosamente (monotonic_skip).

7. **Nenhum `select('*')` em tabelas sensiveis.** Todas as queries usam lista explicita de colunas.

---

## Compliance (codigo segue os docs?)

### Design & UI
- [x] Tokens do design system respeitados (cores, badges, espacamento)
- [x] Mobile-first: padding diferenciado por breakpoint, colunas escondidas em mobile
- [x] Estado vazio tratado em todas as telas (cobrancas, assinaturas, inadimplentes, pagamentos)
- [x] Acessibilidade: labels com htmlFor, nav com aria-label, tabela semantica
- [x] Textos em pt-BR
- [ ] Skeleton/loading via Suspense -- OK em todas as paginas

### Arquitetura
- [x] Estrutura de pastas conforme Architect
- [x] Logica de negocio nos services/actions, nao nos componentes
- [x] Validacao com zod na boundary (Server Actions)
- [x] Codigo em ingles (variaveis, funcoes, componentes)
- [x] Server Actions usam `withPsychologist`
- [x] `"use server"` correto em charges.ts
- [x] `"use client"` apenas onde necessario (formularios, interatividade)
- [x] Metadata exportada no layout do financeiro

### Banco de Dados
- [x] RLS habilitado em charges, subscriptions, payment_webhook_events
- [x] Monotonic state machine por trigger
- [x] Nomenclatura correta (snake_case, ingles)
- [ ] `patients.asaas_customer_id` definido na data-architecture v1.8 mas nao utilizado no codigo (B5)
- [ ] Subscription status lifecycle nao segue a migration 19 (W1)

### Padroes Globais
- [x] shadcn/ui (Badge, Button, Card, Input, Label, Table, Textarea)
- [x] sonner para toasts
- [x] lucide-react para icones
- [x] Nenhum `console.*` fora de logger.ts
- [x] Conventional commits (verificavel pelo dev)
- [x] Nenhum codigo morto ou TODO esquecido

---

## Qualidade de Codigo

### Code Smells
- [x] Sem duplicacao significativa nas Server Actions e componentes
- [ ] W10: `FinanceiroTabs` duplicado em 3 paginas com estados hardcoded (DRY violation)
- [ ] S4: `timingSafeEqual` copy-paste identico em 3 Edge Functions

### Nomes e Legibilidade
- [x] Nomes auto-explicativos (ChargeStatusBadge, DefaultersList, PatientPaymentHistory)
- [x] Tipos TypeScript bem definidos (ChargeListItem, DefaulterItem, PatientCharge)
- [x] TSDoc presente em funcoes publicas dos hooks e actions

### Complexidade
- [x] Funcoes dentro dos limites de linhas
- [x] Niveis de indentacao aceitaveis
- [x] Nenhum arquivo com mais de 200 linhas (exceto billing-rules com 403 -- limiar proximo mas justificado pela regua com 4 steps)

### Performance
- [x] Sem queries N+1
- [ ] W4/W5: Tabela de cobrancas e inadimplentes carregam todos os registros sem limit/paginacao
- [x] Suspense com skeleton em todas as paginas (loading states)

### React Patterns
- [x] `useActionState` para integracao com Server Actions (padrao Next.js 15+)
- [x] `useEffect` com deps corretas
- [x] Keys estáveis (ids de banco, nao indices)
- [x] Nenhuma mutacao direta de estado
- [x] Botao de submit desabilitado durante pending (double submit prevenido)

### Acoplamento
- [x] Services/actions nao dependem de React
- [x] Supabase acessado via actions/EFs, nao direto nos componentes
- [x] Schemas de validacao isolados em `src/schemas/`

---

## Seguranca

- [x] RLS habilitado em todas as tabelas financeiras
- [x] Validacao server-side com zod em todas as Server Actions
- [x] SERVICE_ROLE_KEY nao no frontend -- isolada em `createAdminClient`
- [x] Double submit prevenido (disabled durante pending)
- [x] lgpd_asaas consent verificado antes de enviar CPF ao Asaas
- [x] communication consent verificado antes de emails de cobranca
- [x] Assunto de email ("Lembrete de pagamento") nao revela dado de saude
- [x] Descricao neutra no Asaas -- nao diz "psicoterapia"
- [x] Audit log com ator em create-charge e create-subscription
- [x] RBAC: wrappers verificam role no banco, nunca do JWT
- [x] RBAC: aal2 exigido em withPsychologist

### Webhook security (as 4 regras)
- [x] Regra 1: Token validado antes de parsing (linhas 65-89)
- [x] Regra 2: Re-consulta autoritativa em GET /v3/payments/{id} -- todos os campos usados vem da re-consulta, nao do payload
- [ ] Regra 3: Idempotencia -- **QUEBRADA** (B1)
- [x] Regra 4: Sem payload bruto persistido -- apenas allowlist de colunas

---

## Regressao
Regressao nao aplicavel -- sprint independente. Nenhum arquivo de sprints anteriores foi modificado. Os wrappers `_guard.ts`, `logger.ts` e `audit.ts` sao utilizados conforme construidos nas sprints 1-4.

---

## Resumo de Problemas

### B1 -- Idempotencia do webhook completamente quebrada

**Severidade:** BLOCKER
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:133`
**Codigo:** `const asaasEventId = \`${paymentIdFromPayload}_${eventType}_${Date.now()}\``
**Consequencia:** `Date.now()` torna cada delivery unica. Se o Asaas reenviar o mesmo webhook (timeout, erro de rede, retry programatico), o evento sera processado novamente. Pagamentos podem ser marcados como `paid` multiplas vezes. O trigger monotonic impede regressao, mas a corrida entre dois processamentos concorrentes do mesmo evento pode causar race conditions na criacao de charges de subscription e na atualizacao de `payment_webhook_events`.
**Correcao:** Usar chave deterministica. O Asaas envia `id` no payload de cada webhook event. Usar esse ID diretamente como `asaas_event_id`. Se o Asaas nao enviar ID, usar `${paymentIdFromPayload}_${eventType}` (sem timestamp). A PK no banco com ON CONFLICT DO NOTHING garante a idempotencia.

### B2 -- Webhook retorna 200 para eventos validos com payment.id ausente

**Severidade:** BLOCKER
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:108-115`
**Codigo:**
```typescript
if (!eventType || !paymentIdFromPayload) {
    return new Response(JSON.stringify({ received: true }), { ... })
}
```
**Consequencia:** Se `PAYMENT_RECEIVED` chegar com token valido mas `payment: undefined` (payload malformado, bug do Asaas, mudanca de API), a function retorna 200. O Asaas marca como entregue e nao reenvia. O pagamento nunca concilia e nada sinaliza o problema. E silencioso e irrecuperavel.
**Avaliacao solicitada:** Nao e tratamento correto de evento irrelevante -- e aceitacao silenciosa de payload incompleto. O codigo trata "evento sem tipo" e "evento valido sem payment.id" identicamente. A distincao necessaria:
- Sem `eventType` -> 200 (nao e evento, nao ha o que fazer)
- Com `eventType` fora de `HANDLED_EVENTS` -> 200 (evento que nao interessa)
- Com `eventType` em `HANDLED_EVENTS` mas sem `payment.id` -> 4xx ou 5xx (evento que deveria processar mas chegou malformado -- Asaas reenvia)
**Correcao:** Inverter a ordem dos checks. Primeiro verificar se e handled event, depois exigir `payment.id` apenas para handled events.

### B3 -- subscription_charge_create_failed retorna 200 para erros nao-duplicate

**Severidade:** BLOCKER
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:302-319`
**Consequencia:** Quando o INSERT da charge de subscription falha por erro de DB (conexao, timeout, constraint inesperado), a function retorna `200 {"subscription_charge_create_failed":true}`. O Asaas aceita como processado. O pagamento existe no Asaas, o paciente pagou (ou vai pagar), mas nenhuma charge local e criada. A cobranca desaparece do sistema da psicologa.
**Avaliacao solicitada:** Se o INSERT falhar por UNIQUE no `asaas_payment_id`, retornar 200 e correto (charge ja existe -- idempotencia). Para qualquer outro erro, deveria retornar 5xx para que o Asaas reenvie.
**Correcao:** Distinguir duplicate key (23505) de outros erros. Para 23505: retornar 200. Para outros: retornar 500.

### B4 -- cancelSubscription nao cancela a assinatura no Asaas

**Severidade:** BLOCKER
**Arquivo:** `src/lib/actions/charges.ts:452-495`
**Consequencia:** A Server Action marca `status = 'cancelled'` localmente, mas a assinatura no Asaas continua ativa. O Asaas continua gerando cobrancas recorrentes. Essas cobrancas chegam via webhook e, pelo codigo de resolucao de subscription em asaas-webhook (linhas 275-323), criam novas charges locais vinculadas a uma subscription "cancelada". O paciente continua sendo cobrado apos o cancelamento. Impacto financeiro direto.
**Correcao:** Antes de atualizar o status local, chamar `DELETE /v3/subscriptions/{asaas_subscription_id}` na API do Asaas (via Edge Function ou diretamente, ja que a Server Action nao tem a API key). Criar uma Edge Function `cancel-asaas-subscription` ou estender `create-subscription` com metodo de cancelamento.

### B5 -- patients.asaas_customer_id nunca escrito

**Severidade:** BLOCKER
**Arquivo:** `supabase/functions/manage-asaas-customer/index.ts` (retorna customer_id mas nao grava em patients)
**Referencia:** Data Architecture v1.8: "`asaas_customer_id TEXT UNIQUE` -- Escrito por service_role (Edge Function)." Migration 18 (`20260909121700_add_asaas_customer_id.sql`) criada especificamente para eliminar o fallback por email.
**Consequencia:**
1. A coluna existe no banco mas e NULL para todos os pacientes
2. Customer resolution cai em fallback: busca em charges anteriores (fragil -- falha na primeira cobranca) ou busca por email no Asaas (perigoso -- descrito abaixo)
3. `create-subscription` (linhas 159-183) depende do email fallback quando nao ha charges anteriores
**Avaliacao do fallback por email (solicitada):** Risco concreto. O Asaas pode retornar multiplos customers para o mesmo email. O codigo pega o primeiro (`searchData.data[0]`). Se o email do paciente mudou, ou se dois pacientes compartilham email (familiar, casal), a subscription vai para o customer errado. A cobranca recorrente e enviada para a pessoa errada. Em contexto de saude mental, isso tambem revela que alguem faz terapia. A coluna `patients.asaas_customer_id` existe justamente para eliminar este risco.
**Correcao:** `manage-asaas-customer` deve escrever `asaas_customer_id` em `patients` apos criar/encontrar o customer. Todas as resolucoes de customer devem consultar `patients.asaas_customer_id` como fonte primaria. O fallback por email deve ser eliminado ou reduzido a tentativa de ultimo recurso com log de warning.

### W1 -- Subscription status lifecycle errado

**Severidade:** WARNING
**Arquivo:** `src/lib/actions/charges.ts:389,429` + `supabase/functions/create-subscription/index.ts:127`
**Referencia:** Data Architecture v1.9, migration 19 (`20260909121800_subscriptions_pending_creation.sql`)
**Problema:** A Data Architecture define: default `pending_creation`, transicao `pending_creation -> active | creation_failed`. A migration 19 implementa exatamente isso. Mas o codigo:
- Insere com `status: "active"` (linha 389) -- ignora o default `pending_creation`
- Na falha, marca como `cancelled` (linha 429) -- deveria ser `creation_failed`
- O EF verifica `status !== "active"` (linha 127) -- deveria verificar `pending_creation`
**Avaliacao do rollback para `cancelled` (solicitada):** Semanticamente errado. `cancelled` significa "existia e foi cancelada pela psicologa". `creation_failed` significa "nunca existiu no Asaas". A diferenca importa para:
- Historico do paciente (mostra cancelamento ficticio)
- Metricas de churn (infla abandono)
- UNIQUE parcial (cancelled nao bloqueia nova tentativa, o que e correto -- mas creation_failed tambem nao bloquearia, e comunica o motivo real)
**Correcao:** (1) Inserir com status omitido (usar o default `pending_creation`). (2) EF verificar `status = 'pending_creation'`. (3) EF atualizar para `active` apos sucesso no Asaas. (4) Server Action marcar `creation_failed` na falha.

### W2 -- Subscription schema TypeScript incompleto

**Severidade:** WARNING
**Arquivo:** `src/schemas/charge.ts:28-33`
**Problema:** `SUBSCRIPTION_STATUSES = ["active", "paused", "cancelled"]` -- faltam `pending_creation` e `creation_failed` da data architecture. O tipo `SubscriptionStatus` nao representa todos os estados validos. `SubscriptionList.tsx:26` usa esse tipo, o que impede exibir subscriptions nos novos estados.
**Correcao:** Adicionar `pending_creation` e `creation_failed` ao array e ao type.

### W3 -- URL sandbox hardcoded no PatientPaymentHistory

**Severidade:** WARNING
**Arquivo:** `src/components/financial/PatientPaymentHistory.tsx:101`
**Codigo:** `https://sandbox.asaas.com/i/${charge.asaas_payment_id}`
**Problema:** Em producao, a URL e `https://www.asaas.com/i/`. Com esta URL hardcoded, o link de pagamento do paciente nao funciona em producao.
**Correcao:** Usar variavel de ambiente `NEXT_PUBLIC_ASAAS_INVOICE_URL` ou derivar da `ASAAS_BASE_URL`. Alternativamente, a `invoiceUrl` retornada pelo Asaas na criacao da cobranca pode ser armazenada na tabela `charges`.

### W4 -- Painel de inadimplentes sem paginacao

**Severidade:** WARNING
**Arquivo:** `src/app/(psychologist)/financeiro/inadimplentes/page.tsx`
**Referencia:** Task 5.6 DoD: "Paginacao acima de 20 itens"
**Problema:** Todas as charges overdue sao carregadas e agregadas no servidor sem limit. Com crescimento de inadimplencia, a query e o processamento ficam proporcionais ao total de dividas.
**Correcao:** Implementar paginacao server-side ou, no minimo, aplicar `.limit()` na query e informar quando ha mais.

### W5 -- Tabela de cobrancas sem paginacao

**Severidade:** WARNING
**Arquivo:** `src/app/(psychologist)/financeiro/cobrancas/page.tsx:24-29`
**Problema:** `getCharges()` carrega todas as cobrancas sem limit. Ao longo do tempo (1 sessao/semana * 30 pacientes * 12 meses = ~1500 charges/ano), a query e o componente ChargeTable recebem volume crescente sem paginacao.
**Correcao:** Implementar paginacao server-side com cursor ou offset.

### W6 -- cancelSubscription sem audit log

**Severidade:** WARNING
**Arquivo:** `src/lib/actions/charges.ts:485-489`
**Problema:** Usa `logInfo` (log de aplicacao) em vez de `logAudit` (audit trail no banco). Cancelamento de assinatura e evento financeiro que deve ser rastreavel no audit_log -- especialmente porque o cancelamento tem consequencia de parar cobrancas.
**Correcao:** Adicionar `await logAudit(ctx.supabase, sub.patient_id, "CANCEL_SUBSCRIPTION", { subscription_id: sub.id })` antes do `logInfo`.

### W7 -- createSubscription payment_method coletado mas ignorado

**Severidade:** WARNING
**Arquivo:** `src/schemas/charge.ts:73` (valida), `supabase/functions/create-subscription/index.ts:218` (hardcoda PIX)
**Problema:** O formulario coleta payment_method, o schema valida, mas o Edge Function cria a subscription no Asaas com `billingType: "PIX"` hardcoded. Se a psicologa selecionar boleto ou cartao, a subscription sera PIX mesmo assim.
**Correcao:** Incluir `payment_method` na tabela `subscriptions`, carregar no EF, e usar o valor no `billingType`.

### W8 -- Descricao de charge de subscription usa "Pacote mensal"

**Severidade:** WARNING
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:296`
**Codigo:** `description: "Prestacao de servicos profissionais - Pacote mensal"`
**Referencia:** CLAUDE.md: "Descricao de cobranca no Asaas neutra: `Prestacao de servicos profissionais -- Ref. MM/AAAA`"
**Problema:** "Pacote mensal" descreve a modalidade do servico (pacote vs avulso). Embora nao revele terapia, o CLAUDE.md define um formato canonico. A inconsistencia pode confundir o paciente que ve uma descricao diferente entre cobrancas avulsas e de subscription.
**Correcao:** Usar o formato canonico com `Ref. MM/AAAA` derivado da `due_date` autoritativa.

### W9 -- Chamada redundante ao Asaas no webhook

**Severidade:** WARNING
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:254-273`
**Problema:** Quando a charge nao e encontrada localmente, o webhook faz um SEGUNDO `GET /v3/payments/{id}` (linhas 255-256) para obter o campo `subscription`. A primeira chamada (linhas 173-178) ja retorna o mesmo endpoint com os mesmos dados -- incluindo `subscription`. O campo deveria ser lido da primeira resposta e preservado.
**Correcao:** Armazenar a resposta completa da primeira re-consulta e usar `verifiedPayment.subscription` em vez de fazer segunda chamada.

### W10 -- FinanceiroTabs duplicado em 3 paginas

**Severidade:** WARNING
**Arquivo:** `cobrancas/page.tsx:54-77`, `assinaturas/page.tsx:71-94`, `inadimplentes/page.tsx:79-102`
**Problema:** Componente identico copiado 3 vezes com apenas o tab ativo diferente. Violacao DRY. Mudanca na navegacao (novo tab, renomear) exige alterar 3 arquivos.
**Correcao:** Extrair para `src/components/financial/FinanceiroTabs.tsx` com prop `activeTab`.

### S1 -- timingSafeEqual com early return em length mismatch

**Severidade:** SUGGESTION
**Arquivo:** `supabase/functions/asaas-webhook/index.ts:38`, `retry-charges/index.ts:28`, `billing-rules/index.ts:35`
**Problema:** `if (bufA.length !== bufB.length) return false` -- leak de timing sobre o comprimento do token. Um atacante pode determinar o tamanho do webhook token. Impacto real baixo (saber o tamanho de um token de alta entropia nao ajuda significativamente em brute force).
**Alternativa:** Usar `crypto.subtle` do Deno para HMAC-based comparison, ou pad ambos para o mesmo tamanho.

### S2 -- manage-asaas-customer nao verifica consent independentemente

**Severidade:** SUGGESTION
**Arquivo:** `supabase/functions/manage-asaas-customer/index.ts`
**Problema:** A Server Action verifica `lgpd_asaas` antes de chamar o EF. Mas o EF e invocavel diretamente com JWT valido de psychologist. Defense-in-depth sugere que o EF tambem verifique consent.

### S3 -- CPF em query parameter na busca do Asaas

**Severidade:** SUGGESTION
**Arquivo:** `supabase/functions/manage-asaas-customer/index.ts:112`
**Codigo:** `${asaasBaseUrl}/customers?cpfCnpj=${body.cpf}`
**Problema:** CPF aparece na URL, que pode ser logada por proxies ou pelo runtime do Edge Function. O body do POST (linhas 134-147) e seguro (sob TLS). A busca por CPF na URL e o padrao da API do Asaas, entao nao ha alternativa simples, mas vale documentar a exposicao.

### S4 -- timingSafeEqual duplicado em 3 Edge Functions

**Severidade:** SUGGESTION
**Arquivo:** asaas-webhook, retry-charges, billing-rules
**Correcao:** Extrair para um modulo compartilhado em `supabase/functions/_shared/timing.ts`.

### S5 -- select nativo em vez de shadcn Select

**Severidade:** SUGGESTION
**Arquivo:** `ChargeForm.tsx:85-98`, `SubscriptionForm.tsx:75-88`
**Problema:** Usa `<select>` nativo com classes CSS manuais. shadcn/ui tem componente Select com estilo consistente. Impacto visual baixo -- funciona e e acessivel.

---

## Veredicto

REPROVADO. 5 blockers + 10 warnings devem ser corrigidos antes de avancar.

Os 5 blockers sao todos no dominio financeiro critico:
1. **B1** (idempotencia) e **B2** (200 silencioso) comprometem a confiabilidade do webhook -- a porta de entrada de dinheiro no sistema
2. **B3** (200 para erros nao-duplicate) perde charges de subscription silenciosamente
3. **B4** (cancelamento nao propaga) continua cobrando paciente apos cancelamento
4. **B5** (asaas_customer_id nao escrito) deixa ativa a resolucao por email, que pode cobrar a pessoa errada

A regua de cobranca (Task 5.5) e o melhor codigo da sprint: idempotencia correta por constraint de banco, opt-out respeitado, tom adequado, assuntos neutros.

Os 5 suggestions sao pendencias tecnicas e nao bloqueiam.

# ADR-0003: Webhook do Asaas em Edge Function do Supabase

## Status: Accepted

## Contexto

O Asaas envia webhooks de pagamento (PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.) para um endpoint publico. O endpoint precisa:
- Validar o `asaas-access-token` (comparacao time-safe)
- Re-consultar a API do Asaas (payload nao e autoritativo)
- Escrever no banco (atualizar cobrancas, criar recibos)
- Operar com `verify_jwt = false` (o Asaas nao envia JWT do Supabase)

Duas opcoes: Edge Function do Supabase ou Route Handler do Next.js.

## Decisao

**Edge Function do Supabase (`asaas-webhook`), com `verify_jwt = false`, segredos em `supabase secrets`, e escrita no banco via funcao `SECURITY DEFINER` de assinatura estreita.**

## Alternativas descartadas

- **Route Handler do Next.js (`/api/webhooks/asaas/route.ts`):** funcionaria tecnicamente, mas exigiria colocar `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` no EasyPanel. Esses segredos de integracao de pagamento nao precisam cruzar dominios — mante-los em `supabase secrets` e mais seguro. Alem disso, o Route Handler nao tem `verify_jwt = false` como conceito nativo (qualquer request chega e precisa de validacao manual identica), e compartilha processo com o resto da aplicacao.

## Consequencias

**Positivas:**
- Segredos de pagamento (`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`) ficam no dominio Supabase — nao cruzam para o EasyPanel.
- `verify_jwt = false` e configuracao nativa de Edge Function — documentacao clara de por que JWT nao e verificado.
- Edge Function esta no mesmo datacenter que o Postgres — latencia minima para a escrita transacional (dentro do SLA de 2s do Asaas).
- Isolamento: a Edge Function tem escopo minimo de escrita via `SECURITY DEFINER`, nao compartilha memoria com a aplicacao.
- A Edge Function nao precisa da KEK (nao toca em prontuario) — separacao de dominio mantida.

**Negativas:**
- Logica de negocio (maquina de estados de pagamento, criacao de recibo) roda em Deno/Edge Function em vez de no Next.js. Precisa de testes especificos.
- Debug de Edge Function depende dos logs do Supabase Dashboard (com as restricoes de nao logar payload completo).
- Se o volume crescer significativamente, Edge Functions podem ter limites de concorrencia (improvavel para pratica solo com 20-30 pacientes).

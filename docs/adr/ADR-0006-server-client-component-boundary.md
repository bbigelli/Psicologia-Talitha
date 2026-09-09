# ADR-0006: Fronteira Server Component / Client Component e uso de Server Actions

## Status: Accepted

## Contexto

Next.js App Router oferece Server Components (padrao) e Client Components (`'use client'`). O produto trata dado sensivel de saude mental — a decisao de onde renderizar afeta diretamente o que o browser pode acessar.

Alem disso, o App Router oferece Server Actions (`'use server'`) como alternativa a Route Handlers para mutations, e Edge Functions do Supabase para logica server-side fora do Next.js.

## Decisao

### Server Components vs Client Components

**Server Components por padrao.** Client Components explicitamente, apenas quando necessarios (interatividade, hooks, browser APIs).

| Cenario | Tipo | Razao |
|---------|------|-------|
| Listagem de pacientes | Server Component | Dados renderizados no server; ciphertext de CPF nunca sai |
| Ficha do paciente com historico clinico | Server Component (`runtime='nodejs'`, `force-dynamic`) | Decifra prontuario no server; client recebe HTML; plaintext nunca em cache |
| Dashboard financeiro (KPIs) | Server Component | Agregacao SQL no server |
| Formulario de cadastro/cobranca | Client Component | Precisa de react-hook-form, zod resolver, interatividade |
| Agenda (interativa) | Client Component | Interacao rica, TanStack Query para refresh |
| Sala de video | Client Component | LiveKit SDK, WebRTC, estado de midia |
| Sala de espera (polling) | Client Component | TanStack Query com `refetchInterval` |
| Portal do paciente (home) | Server Component | Busca de dados, renderizacao simples |

### Server Actions — fronteira de autorizacao

**Server Actions sao endpoints HTTP publicos com IDs estaveis, invocaveis por POST direto.** O middleware e os guards de layout **nao protegem Server Actions** — eles podem ser chamados fora do contexto da pagina. Por isso:

- **Toda Server Action exportada usa wrapper obrigatorio** (`withPsychologist` / `withPatient` / `withPublicAction`) que faz `getUser()`, resolve role no banco, verifica `aal2` quando necessario, e so entao chama o corpo.
- Gate de code review: `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts` deve retornar vazio.
- `allowedOrigins` no `next.config.ts` para protecao CSRF atras do proxy do EasyPanel.

### Server Actions vs Route Handlers vs Edge Functions

| Tipo de operacao | Mecanismo | Razao |
|-----------------|-----------|-------|
| Mutation interna (CRUD paciente, sessao, evolucao) | **Server Action** (com wrapper) | Validacao zod, cifra com KEK, audit log, revalidacao de cache |
| Auth callback (PKCE) | **Route Handler** | Precisa de endpoint HTTP GET padrao; validar redirect contra allowlist |
| Download de recibo PDF | **Route Handler** (`runtime='nodejs'`, `no-store`) | Precisa gerar PDF com CPF decifrado |
| Webhook externo (Asaas) | **Edge Function** (`asaas-webhook`, verify_jwt=false) | Endpoint publico, segredos de pagamento no Supabase |
| Criar cobranca no Asaas | **Edge Function** (`create-charge`, verify_jwt=true) | Segredos Asaas no Supabase; body aceita **apenas** `charge_id`, nunca `patient_id` |
| Retentar cobrancas | **Edge Function** (`retry-charges`, CRON_SECRET) | Cron; segredos no Supabase |
| Emissao de token LiveKit | **Edge Function** (`issue-livekit-token`, verify_jwt=true) | Segredos LiveKit no Supabase, 8 pre-condicoes |
| Cron (lembretes, regua, ancora audit) | **Edge Function** (CRON_SECRET) | Disparado por pg_cron |

### Criacao de cobrancas no Asaas

1. **Server Action** (`withPsychologist`) valida input, grava `charges` com `status = 'pending_creation'` e o `charge_id`.
2. Server Action invoca `supabase.functions.invoke('create-charge', { body: { charge_id } })`.
3. **Edge Function** (`verify_jwt=true`) verifica `role = 'psychologist'` no banco, carrega o registro `charges` pelo `charge_id`, verifica ownership (`psychologist_id == uid`), deriva paciente e valor **do banco** (nunca do body), chama o Asaas, atualiza o status.
4. A `ASAAS_API_KEY` permanece no dominio Supabase.

## Alternativas descartadas

- **Client Components para tudo:** ciphertext no browser; KEK no server impossibilita decifrar no client.
- **Route Handlers para toda mutation:** boilerplate excessivo; Server Actions integram com revalidacao de cache.
- **Edge Functions para mutations internas:** exigiria mover KEK para `supabase secrets` (viola ADR-0001).
- **Toda logica no Next.js:** colocaria segredos de integracao no EasyPanel, misturando dominios.
- **Edge Function `create-charge` aceitando `patient_id` e `value` do body:** contraria a regra "nenhuma funcao server aceita patient_id como parametro". Um paciente autenticado poderia chamar a Edge Function diretamente com seu JWT e criar cobrancas arbitrarias, inclusive no nome de outro paciente. Corrigido para aceitar apenas `charge_id` e derivar tudo do registro no banco.

## Consequencias

**Positivas:**
- Ciphertext nunca sai do servidor.
- Separacao clara: mutations internas (Server Actions, KEK) vs integracoes (Edge Functions, segredos Supabase).
- Wrappers de autorizacao garantem que nenhuma action confia em guard de layout.
- `create-charge` com `charge_id`-only impede manipulacao de paciente/valor.

**Negativas:**
- Rotas de prontuario usam Node runtime.
- Acoplamento com Next.js (aceitavel).
- Latencia Server Action → Edge Function (~100-200ms) para criar cobranca (aceitavel).
- Wrappers adicionam ~10 linhas por action. Justificado: Server Actions sao endpoints publicos.

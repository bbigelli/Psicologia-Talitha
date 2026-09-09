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
| Ficha do paciente com historico clinico | Server Component (`runtime='nodejs'`) | Decifra prontuario no server; client recebe HTML |
| Dashboard financeiro (KPIs) | Server Component | Agregacao SQL no server |
| Formulario de cadastro/cobranca | Client Component | Precisa de react-hook-form, zod resolver, interatividade |
| Agenda (interativa, drag?) | Client Component | Interacao rica, TanStack Query para refresh |
| Sala de video | Client Component | LiveKit SDK, WebRTC, estado de midia |
| Sala de espera (polling) | Client Component | TanStack Query com `refetchInterval` |
| Portal do paciente (home) | Server Component | Busca de dados, renderizacao simples |

### Server Actions vs Route Handlers vs Edge Functions

| Tipo de operacao | Mecanismo | Razao |
|-----------------|-----------|-------|
| Mutation interna (CRUD paciente, sessao, evolucao) | **Server Action** | Validacao zod, cifra com KEK, audit log, revalidacao de cache |
| Auth callback (PKCE) | **Route Handler** | Precisa de endpoint HTTP GET padrao |
| Download de recibo PDF | **Route Handler** (`runtime='nodejs'`) | Precisa gerar PDF com CPF decifrado, retornar como response |
| Webhook externo (Asaas) | **Edge Function** | Endpoint publico, `verify_jwt=false`, segredos de pagamento no Supabase |
| Emissao de token LiveKit | **Edge Function** | Segredos LiveKit no Supabase, 8 pre-condicoes, SDK compativel com Deno |
| Cron (lembretes, regua cobranca) | **Edge Function** | Disparado por pg_cron, `CRON_SECRET`, segredos de email no Supabase |

### Criacao de cobrancas no Asaas

Server Action invoca Edge Function via `supabase.functions.invoke('create-charge', { body })`. Isso mantem a `ASAAS_API_KEY` no dominio Supabase, sem duplicar no EasyPanel.

## Alternativas descartadas

- **Client Components para tudo com data fetching via useEffect:** renderiza dados sensiveis no browser; ciphertext precisaria ser enviado ao client para decifrar (impossivel — KEK esta no server); pior performance (waterfall).
- **Route Handlers para toda mutation:** boilerplate excessivo (definir rota, metodo, parsing manual). Server Actions eliminam esse overhead e integram com revalidacao de cache.
- **Edge Functions para mutations internas:** exigiria mover KEK para `supabase secrets` (viola ADR-0001) ou fazer duas chamadas (Edge Function + callback ao Next.js para cifrar).
- **Toda logica no Next.js (webhook como Route Handler, token como Route Handler):** colocaria segredos de integracao (Asaas, LiveKit) no EasyPanel, misturando dominios de confianca desnecessariamente.

## Consequencias

**Positivas:**
- Ciphertext de prontuario nunca sai do servidor — client recebe apenas HTML renderizado.
- Separacao clara: mutations internas (Server Actions, KEK no EasyPanel) vs integracoes externas (Edge Functions, segredos no Supabase).
- Server Actions integram com cache do Next.js (revalidatePath, revalidateTag).
- Edge Functions isoladas da aplicacao — bug num modulo nao afeta o outro.

**Negativas:**
- Rotas de prontuario usam Node runtime (cold start maior que Edge).
- Server Actions criam acoplamento com o framework Next.js — migrar para outro framework exigiria reescrever as mutations. Aceitavel para o escopo do projeto.
- Chamadas Server Action → Edge Function (`supabase.functions.invoke`) adicionam latencia (~100-200ms) para operacoes que cruzam dominios (ex: criar cobranca). Aceitavel para o volume.

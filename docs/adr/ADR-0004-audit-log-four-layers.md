# ADR-0004: Audit log com 4 camadas cumulativas de imutabilidade

## Status: Accepted

## Contexto

O sistema trata dado pessoal sensivel de saude mental. A LGPD (art. 37, art. 46) e o CFP exigem rastreabilidade de quem acessou qual prontuario, quando e qual operacao. O audit log tem valor probatorio em auditoria do CRP e em comunicacao a ANPD.

A aplicacao usa `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS. O owner da tabela ignora policies sem `FORCE ROW LEVEL SECURITY`. Nenhuma camada isolada entrega imutabilidade real.

## Decisao

**4 camadas cumulativas, todas obrigatorias:**

1. **RLS + `FORCE ROW LEVEL SECURITY`:** SELECT apenas para `psychologist`. Nenhuma policy de INSERT/UPDATE/DELETE (ausencia = negado).
2. **Triggers de bloqueio:** `BEFORE UPDATE OR DELETE FOR EACH ROW` + `BEFORE TRUNCATE FOR EACH STATEMENT` → `RAISE EXCEPTION`. Cobre `service_role` e bugs da aplicacao.
3. **`REVOKE` explicito:** `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon, service_role`. INSERT apenas via funcao `SECURITY DEFINER`.
4. **Hash chain:** `prev_hash` (hash da linha anterior) + `row_hash` (SHA-256 da linha atual) calculados em trigger `BEFORE INSERT`. Ancora externa semanal (ultimo hash + contagem exportados para fora do banco).

**Escrita:** funcao unica `SECURITY DEFINER` (`log_audit`) que deriva `actor_id` de `auth.uid()` — nunca de parametro. Metadata jsonb com allowlist de chaves; proibido conteudo clinico (D1/D2/D5).

**Sincrono vs assincrono:** log sincrono e bloqueante para escrita/alteracao de prontuario e emissao de token; assincrono com retry para leitura.

## Alternativas descartadas

- **Apenas RLS:** nao protege contra `service_role` (que a aplicacao usa). UPDATE/DELETE trivial.
- **Apenas trigger:** um superuser ou insider do provedor pode desabilitar triggers e reescrever. Sem hash chain, a reescrita e indetectavel.
- **Tabela append-only por convencao:** sem trigger, nada impede UPDATE/DELETE via query direta. Convencao nao e controle.
- **Audit trail externo (SaaS):** custo recorrente, transferencia internacional de dado sensivel, dependencia de terceiro para prova legal.

## Consequencias

**Positivas:**
- Cada camada cobre uma classe de ataque que as demais nao cobrem. A combinacao e defense-in-depth real.
- Hash chain torna reescrita retroativa detectavel — sustenta o log como evidencia em auditoria CFP/ANPD.
- Ancora externa semanal (email/objeto em bucket) permite verificacao independente do banco.
- Funcao `SECURITY DEFINER` garante que `actor_id` vem de `auth.uid()`, eliminando forja de identidade.

**Negativas:**
- Complexidade: 4 mecanismos para manter e testar. Justificado pela severidade do dado (saude mental).
- Hash chain adiciona uma query de leitura (ultima linha) a cada insert. Volume deste projeto (dezenas de logs/dia) absorve sem impacto.
- Trigger `BEFORE TRUNCATE FOR EACH STATEMENT` e facil de esquecer — a maioria dos projetos so cobre `FOR EACH ROW`. Documentado explicitamente.
- Log sincrono para escrita adiciona latencia a operacoes de prontuario (~5ms). Aceitavel.

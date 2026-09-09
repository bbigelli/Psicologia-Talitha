# ADR-0002: Sala de espera no Postgres em vez de room do LiveKit

## Status: Accepted

## Contexto

O MVP exige sala de espera para a sessao de video: o paciente aguarda e a psicologa admite manualmente. O requisito critico e que "paciente A nunca ve paciente B" — quebra de sigilo em sessao de psicoterapia e o dano mais grave que o produto pode causar.

Duas abordagens:
1. **Room do LiveKit** como sala de espera: paciente entra no room com midia desabilitada e aguarda a psicologa habilitar.
2. **Estado no Postgres:** paciente marca presenca no banco; psicologa admite; token LiveKit so e emitido apos admissao.

## Decisao

**Sala de espera e estado no Postgres (`sessions.waiting_since`, `sessions.admitted_at`), fora do LiveKit. Nenhum token de midia e emitido antes de `admitted_at IS NOT NULL`.**

Fluxo:
1. Paciente clica "Entrar" → pre-flight de dispositivos
2. Paciente entra na sala de espera → `UPDATE sessions SET waiting_since = now()` (RLS: so propria sessao)
3. Paciente faz polling do proprio registro a cada 3-5s (TanStack Query `refetchInterval`) sob RLS
4. Psicologa ve fila de espera (Realtime apenas para ela) e admite → `UPDATE sessions SET admitted_at = now()`
5. Paciente detecta `admitted_at != null` → solicita token LiveKit
6. Edge Function verifica pre-condicao 8 (`admitted_at IS NOT NULL`) → emite token

## Alternativas descartadas

- **Room do LiveKit como sala de espera:** o paciente ja teria credencial de midia (token) antes da admissao. Um token vazado ou reutilizado daria acesso ao room. Alem disso, o tempo de espera consumiria minutos do free tier (5.000 min/mes) — com 4 sessoes/dia de 50min + espera de 5min, o overhead de espera somaria ~100 min/mes desnecessarios. E o mais importante: em um room compartilhado, o LiveKit permitiria que participantes vissem metadados uns dos outros (presence), violando o isolamento.

## Consequencias

**Positivas:**
- Nenhuma credencial de midia existe antes da admissao — a superficie de ataque e eliminada, nao mitigada.
- Nao ha objeto "sala de espera compartilhada" — nao ha como listar dois pacientes num mesmo canal.
- RLS garante que o paciente ve apenas o proprio registro. Realtime (que nao tem RLS de dados por padrao) e restrito a psicologa.
- Nao consome minutos do LiveKit durante a espera.

**Negativas:**
- Polling a cada 3-5s gera queries pequenas ao Supabase. Volume insignificante (1 paciente esperando por vez).
- Latencia de admissao: ate 5s entre o clique da psicologa e o paciente perceber. Aceitavel.
- A psicologa precisa de Realtime para ver a fila em tempo real, adicionando uma subscription client-side. Apenas no componente WaitingList.

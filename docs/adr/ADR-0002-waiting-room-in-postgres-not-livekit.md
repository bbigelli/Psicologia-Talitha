# ADR-0002: Sala de espera no Postgres em vez de room do LiveKit

## Status: Accepted

## Contexto

O MVP exige sala de espera para a sessao de video: o paciente aguarda e a psicologa admite manualmente. O requisito critico e que "paciente A nunca ve paciente B" — quebra de sigilo em sessao de psicoterapia e o dano mais grave que o produto pode causar.

Duas abordagens:
1. **Room do LiveKit** como sala de espera: paciente entra no room com midia desabilitada e aguarda a psicologa habilitar.
2. **Estado no Postgres:** paciente marca presenca no banco; psicologa admite; token LiveKit so e emitido apos admissao.

## Decisao

**Sala de espera e estado no Postgres (`sessions.waiting_since`, `sessions.admitted_at`), fora do LiveKit. Nenhum token de midia e emitido antes de `admitted_at IS NOT NULL`.**

**Invariante critica: RLS no Postgres e por linha, nao por coluna.** Uma policy `FOR UPDATE` autoriza escrita em **qualquer coluna** da linha. Se o paciente recebesse UPDATE em `sessions`, ele ganharia escrita em `admitted_at` (auto-admissao), `payment_status`, `status`, `scheduled_at` e `room_name` — derrubando todos os gates. Por isso, transicoes de estado passam **exclusivamente** por RPCs `SECURITY DEFINER` de assinatura estreita, e `REVOKE UPDATE ON sessions FROM authenticated, anon`.

Fluxo:
1. Paciente clica "Entrar" → pre-flight de dispositivos
2. Paciente chama RPC `enter_waiting_room(p_session_id)` — a funcao valida ownership por `auth.uid()`, valida janela temporal e status, e escreve **exclusivamente** `waiting_since`. Nenhum UPDATE direto.
3. Paciente faz polling do proprio registro a cada 3-5s (TanStack Query `refetchInterval`) sob RLS (SELECT apenas da propria sessao)
4. Psicologa ve fila de espera (Realtime apenas para ela) e chama RPC `admit_patient(p_session_id)` — a funcao exige `role = 'psychologist'` e escreve **exclusivamente** `admitted_at`
5. Paciente detecta `admitted_at != null` → solicita token LiveKit
6. Edge Function verifica pre-condicao 8 (`admitted_at IS NOT NULL`) → emite token

## Alternativas descartadas

- **Room do LiveKit como sala de espera:** o paciente ja teria credencial de midia (token) antes da admissao. Um token vazado ou reutilizado daria acesso ao room. O tempo de espera consumiria minutos do free tier. Em um room compartilhado, o LiveKit permitiria que participantes vissem metadados uns dos outros (presence), violando o isolamento.

- **UPDATE direto pelo paciente em `sessions` (v1.0 deste ADR):** RLS e por linha, nao por coluna. O paciente ganha escrita em `admitted_at`, `payment_status`, `status`, `scheduled_at` e `room_name` da propria sessao. Isso derruba o gate de admissao (auto-admissao) e habilita fraude financeira (`payment_status: 'paid'`). Identificado como Critico AC2 no Security Review da arquitetura.

## Consequencias

**Positivas:**
- Nenhuma credencial de midia existe antes da admissao.
- Nao ha objeto "sala de espera compartilhada".
- RLS garante que o paciente ve apenas o proprio registro.
- Nao consome minutos do LiveKit durante a espera.
- RPCs de assinatura estreita garantem que so as colunas autorizadas sao escritas.

**Negativas:**
- Polling a cada 3-5s gera queries pequenas ao Supabase. Volume insignificante.
- Latencia de admissao: ate 5s entre o clique da psicologa e o paciente perceber. Aceitavel.
- Complexidade: RPCs SECURITY DEFINER em vez de UPDATE direto. Justificado pela criticidade do dado.
- A psicologa precisa de Realtime para ver a fila em tempo real, adicionando uma subscription client-side.

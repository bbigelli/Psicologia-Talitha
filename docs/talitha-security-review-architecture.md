# Security Review — Arquitetura: Talitha Psicologia

**Versão:** 1.0
**Data:** 2026-09-09
**Momento:** 2º dos 3 obrigatórios (após System Architect)
**Entradas:** `docs/talitha-architecture.md` (v1.0), `docs/adr/ADR-0001..0006`, `CLAUDE.md`, `docs/talitha-security-review-prd.md`, `docs/talitha-prd.md` (emendas E1–E4), `docs/talitha-navigation-flow.md`, `docs/decisions.md`
**Classe de dado:** pessoal sensível de saúde mental (LGPD art. 5º II, art. 11) — severidade calibrada nesse patamar

## Status: ❌ Reprovada — 2 Críticos e 12 Altos novos; 8 correções pontuais requeridas ao Architect antes do Data Architect

---

## Resumo executivo

A arquitetura acerta nos problemas difíceis. Criptografia envelope com KEK fora do Supabase (ADR-0001), audit log em 4 camadas (ADR-0004), sala de espera fora do LiveKit (ADR-0002), webhook com re-consulta autoritativa e idempotência em nível de dados (ADR-0003/0005) — isso é trabalho de qualidade, e nenhuma dessas decisões precisa ser revisitada. A separação de domínios de confiança é real, não decorativa.

A afirmação de que **os 42 issues foram todos absorvidos é falsa**: 26 estão absorvidos com mecanismo suficiente, 11 estão parciais (citados sem carregar o mecanismo para o artefato de handoff) e 5 não foram absorvidos. Nenhum é inviável — mas 5 desapareceram do documento e vão desaparecer da implementação se não voltarem agora.

Os dois Críticos novos não são falhas de concepção, são lacunas de especificação que produzem código explorável por omissão: (1) a Edge Function `create-charge` não tem contrato de autorização e nem aparece na estrutura de pastas — a implementação natural aceita `patient_id` e valor do chamador, contrariando a regra 2 do próprio projeto; (2) o fluxo da sala de espera prescreve `UPDATE` do paciente na tabela `sessions`, e RLS no Postgres é por linha, não por coluna — o paciente ganha escrita em `admitted_at`, `status`, `scheduled_at` e `payment_status` da própria sessão, o que derruba o gate de admissão que o ADR-0002 existe para criar.

O padrão de risco dos Altos é consistente: **a arquitetura documenta invariantes sem instalar o mecanismo que as garante**. "Ciphertext nunca sai do servidor", "conteúdo clínico nunca em log", "MFA obrigatório", "toda action reautoriza" — as quatro são afirmações verdadeiras de intenção e falsas de enforcement. Cada uma tem correção barata e específica listada abaixo.

---

## 1. Matriz de absorção dos 42 issues do Security Review do PRD

Critério: **Absorvido** = existe mecanismo concreto que impede a implementação insegura. **Parcial** = requisito citado, mas com lacuna que permite implementar de forma insegura, ou mecanismo que não chegou ao artefato de handoff (seção 17 / ADR / checklist de deploy). **Não absorvido** = sem mecanismo, ou contornado.

### 1.1 Críticos

| # | Veredicto | Evidência na arquitetura | Lacuna |
|---|---|---|---|
| **C1** — consentimento de menor | ✅ **Absorvido** | Resolvido a montante pela emenda E1 (`docs/talitha-prd.md`). `CLAUDE.md` "Adultos apenas"; §5.1 `date_of_birth.refine(>= 18)`; §17.14 retenção fixa em 5 anos; fluxo de responsável legal inexistente | Enforcement é **só** o schema zod na Server Action. Sem `CHECK` no banco, qualquer caminho alternativo de escrita (RPC, seed, correção manual) cria menor. Ver AM/AB — requisito 18 para o Data Architect |
| **C2** — isolamento da sala de vídeo | ✅ **Absorvido** | §8.2 completa: 8 pré-condições na ordem, `room_name` 128 bits resolvido server-side, grants mínimos (`canPublishData:false`, `roomAdmin:false`, `identity=auth.uid()`), TTL 15 min, token só em memória, `deleteRoom` + limpeza > 2h; ADR-0002; §17.5-6; §13.3 gate (a)-(g) | Rate limit de 10 emissões/usuário/min (exigido no Módulo 2) desapareceu → ver AM10/M1. Guard da rota `/sala/[sessionId]` declarado como "auth + owner + admitido" na tabela §3.1, mas o middleware §7.1 não implementa verificação de ownership — a página renderiza e só a emissão de token barra. Defesa real intacta; documentação superestima o guard |
| **C3** — criptografia do prontuário | ✅ **Absorvido** | ADR-0001 + §9 completa: AES-256-GCM, DEK por registro, AAD `patient_id\|record_id`, KEK em env do EasyPanel, `runtime='nodejs'`, `kek_version`, rotação por re-wrap, crypto-shredding; §12.2.5 proíbe a KEK em `supabase secrets`; regra 9 da §16 e `CLAUDE.md` fazem disso motivo de reprovação em code review | Especificação correta; o **carregamento** das chaves é frágil (AA4) e o exemplo de código da §5.1 cifra o CPF com um `patientId` que ainda não existe (AA4) |
| **C4** — imutabilidade do audit log | ⚠️ **Parcial** | ADR-0004 + §10.1: RLS + `FORCE ROW LEVEL SECURITY`, triggers `BEFORE UPDATE OR DELETE FOR EACH ROW` **e** `BEFORE TRUNCATE FOR EACH STATEMENT`, `REVOKE` explícito, hash chain `prev_hash`/`row_hash`; escrita por `log_audit` `SECURITY DEFINER` com `actor_id` de `auth.uid()`; §17.3-4 | Camadas 1–3 concretas. A camada 4 está pela metade: **a âncora externa semanal não tem mecanismo** — não há Edge Function na estrutura, nem cron, nem destino, nem env var (AM1). Sem âncora, o insider que recomputa a cadeia inteira — exatamente a classe de ataque que a camada 4 existe para cobrir — permanece indetectável. E o `actor_id` derivado de `auth.uid()` é NULL em todo contexto `service_role`/Edge Function, o que apaga o ator justamente em `DENY_ROOM_TOKEN`, `LOGIN_FAILURE` e `WEBHOOK_REJECTED` (AA10) |

### 1.2 Altos

| # | Veredicto | Evidência na arquitetura | Lacuna |
|---|---|---|---|
| **A1** — custódia da KEK | ⚠️ **Parcial** | ADR-0001 "Consequências negativas" exige 2 cópias offline + teste de restauração; `docs/talitha-status.md` lista como blocker | O **checklist de deploy §14.3 não tem o item**. O gate operacional é o checklist, não a seção de consequências de um ADR. Sem isso, o go-live acontece com custódia não testada |
| **A2** — idempotência do webhook | ✅ **Absorvido** | §8.1 itens 4, 6, 7, 8; ADR-0005; §17.7-10 (`payment_webhook_events` PK, `receipt_counters` com `FOR UPDATE`, `receipts UNIQUE(charge_id)`, máquina monotônica) | — |
| **A3** — replay e validação do token do webhook | ✅ **Absorvido** | §8.1 itens 1-3, 5: `timingSafeEqual` antes de qualquer parsing, body ≤ 64 KB, frescor de 7 dias com 200+log, re-consulta `GET /v3/payments/{id}`; ADR-0003; `CLAUDE.md` "payload não é autoritativo" | `payload_sanitized` (exigido no Módulo 1) caiu do §17.7 → AM12 |
| **A4** — consentimento por finalidade | ✅ **Absorvido** | Route group `(consent)`, duas etapas (`/termos/atendimento`, `/termos/lgpd`); §17.11 `consents` append-only com `purpose` (enum por finalidade), `consent_text_hash`, `ip`, `user_agent`; audit `ACCEPT_CONSENT`/`REVOKE_CONSENT` síncrono | Armazenamento da **preferência de opt-out** de e-mail (a finalidade opcional) não está no §17 — a régua "respeita opt-out" (§8.3) sem coluna definida. Requisito 22 |
| **A5** — transferência internacional e operadores | ⚠️ **Parcial** | `sa-east-1` no §14.3 e §17.17 | **Região do LiveKit não é tratada em nenhum lugar.** O review pedia preferência por região sul-americana; mídia de sessão de psicoterapia roteada por SFU nos EUA é transferência internacional de dado sensível, mesmo sem gravação. Nominação de operadores e DPAs seguem como pendência humana (correto) |
| **A6** — política de conteúdo de e-mail + anti-spoofing | ✅ **Absorvido** | §8.3 completa: remetente neutro, allowlist de 9 assuntos, preheader explícito, proibições, regras de link; SPF/DKIM/DMARC `p=reject` no §14.3; `CLAUDE.md` amarra a allowlist | Falta a env var do remetente (`EMAIL_FROM`) na tabela §12.1 → AM10 |
| **A7** — CPF cifrado + blind index + descrição neutra | ✅ **Absorvido** | §9.2, §9.3 (HMAC-SHA256 com `CPF_INDEX_KEY`, `cpf_hmac UNIQUE`, "nunca SHA-256 puro"), §17.2; §8.1 "ao Asaas apenas name, cpfCnpj, email, mobilePhone"; descrição neutra em §8.1 e `CLAUDE.md` | Degradação silenciosa se `CPF_INDEX_KEY` faltar (AA4) |
| **A8** — IDOR no recibo | ✅ **Absorvido** | `GET /api/receipts/[id]/download` com guard "auth + owner", `runtime='nodejs'`, PDF on-demand sem persistência, nome de arquivo neutro (§8.3), PKs UUID (§17.15) | Sem `Cache-Control: no-store` na resposta (AA5) e sem padrão de código do Route Handler mostrando a verificação de ownership |
| **A9** — tokens de link de e-mail | ⚠️ **Parcial** | §8.3 e regra 15 da §16 definem a política (≥128 bits, hash no banco, uso único, expira no horário da sessão, escopo de uma ação, sem sessão autenticada); rota `/confirmar/[token]` criada | **Nenhuma das 17 exigências ao Data Architect prevê a tabela de tokens** (nem de convite, nem de ação). A política existe em prosa e não chega ao schema — o Data Architect pode omitir a tabela ou modelá-la com token em claro, sem `used_at`, sem `expires_at`. Requisito 19. Além disso a rota é uma página GET, o que consome token único em prefetch (AA8) |
| **A10** — Realtime da sala de espera | ✅ **Absorvido** | §6.1, §8.2 e ADR-0002: paciente faz polling do próprio registro sob RLS (`use-waiting-room.ts`), Realtime exclusivo da psicóloga | — |
| **A11** — retenção vs. eliminação | ⚠️ **Parcial** | §9.6 crypto-shredding com `PURGE_RECORD` + reautenticação MFA; §17.14 `retention_until` por trigger e DELETE físico bloqueado; ações `LGPD_REQUEST`/`EXPORT_DATA` no §10.4 | Falta a **eliminação seletiva por categoria** (tabela da seção 9 do review anterior): o que é congelado vs. eliminado/anonimizado na revogação, e o registro da **resposta fundamentada** (decisão + base legal citada + discriminação entre eliminado e retido). Sem isso o sistema só sabe negar em bloco. Nem a tabela `data_subject_requests` existe no handoff, apesar de `/portal/dados/solicitar` existir. Requisitos 20-21 |
| **A12** — gate estrutural de RLS e proibição de `patient_id` do client | ✅ **Absorvido** | §6.2.3, §16 regras 2, 19, 20; §17.15-16; `CLAUDE.md`; query de verificação `rowsecurity=false` → 0 linhas | O uso de `service_role` no Next.js é liberado de forma genérica ("quando precisa bypassar RLS") sem allowlist — corrói a RLS como última linha (AA9) |
| **A13** — audit log registra negativas | ✅ **Absorvido** | §10.4 inclui `DENY_ROOM_TOKEN` (com motivo), `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE`, `WEBHOOK_REJECTED`; §10.3 põe `DENY_ROOM_TOKEN` como síncrono bloqueante | Sem ator identificável nesses eventos (AA10) e sem origem definida para `p_ip`/`p_user_agent` (AM6) — as duas coisas que fazem o registro de negativa ter valor |
| **A14** — log síncrono para escrita | ✅ **Absorvido** | §10.3: tabela explícita — `CREATE/UPDATE/PURGE_RECORD`, `ISSUE/DENY_ROOM_TOKEN`, `ACCEPT/REVOKE_CONSENT` na mesma transação e bloqueantes; leitura assíncrona | O caminho assíncrono ("retry") não tem mecanismo: `VIEW_RECORD` é o evento mais frequente e o mais relevante em auditoria CFP, e fire-and-forget em Server Action perde o registro. Requisito 26 |
| **A15** — MFA da psicóloga | ✅ **Absorvido** | §7.3 (enroll/verify/challenge nativos, recovery codes, reautenticação em `PURGE_RECORD`/`EXPORT_DATA`/`END_TREATMENT`), gate no middleware §7.1.6a, `CLAUDE.md`, `docs/decisions.md` | O gate especificado testa **enrollment**, não `aal2` — uma sessão só-senha passa (AA3). O intent está correto no navigation-flow ("MFA Verify em TODO login"); o mecanismo escrito na arquitetura não entrega |
| **A16** — bootstrap de role | ✅ **Absorvido** | §7.5: signup público desabilitado, psicóloga por seed/migration, paciente só por convite, `app_metadata` escrito pelo server, RLS proíbe UPDATE de `profiles.role`; §16 regras 16-17; §17.13 | O "`app_metadata` **ou** `profiles.role`" nunca é resolvido (§7.1.5 e §16.16 repetem o OR) — middleware e RLS podem acabar consultando fontes diferentes (AM15) |

### 1.3 Médios e Baixos (compacto)

| # | Veredicto | Nota |
|---|---|---|
| M1 — rate limiting | ❌ **Não absorvido** | Nenhuma menção a rate limit em nenhum ponto da arquitetura: login, reenvio de convite, `issue-livekit-token` (10/min era requisito do Módulo 2), `/confirmar/[token]`, solicitação LGPD. Ver AM10 |
| M2 — rascunho de anotações | ❌ **Não absorvido** | `session-notes-panel.tsx` existe, o destino do rascunho não. **Reclassificado para Alto** (AA11) |
| M3 — retenção de audit/consents + TRUNCATE | ⚠️ **Parcial** | TRUNCATE coberto (§10.1 camada 2). Amarração da retenção de audit/consents ao `retention_until` ausente |
| M4 — política de sessão | ⚠️ **Parcial** | Revogação de sessões na revogação de consentimento está no navigation-flow §5. **Timeout de inatividade não existe** na arquitetura |
| M5 — política de senha | ❌ **Não absorvido** | Mínimo 10 caracteres e verificação contra base de senhas vazadas (nativo no Supabase Auth) não aparecem |
| M6 — headers HTTP | ✅ **Absorvido** | §7.4 acerta o essencial e evita a armadilha: `Permissions-Policy: camera=(self), microphone=(self)`, `media-src blob:`, `worker-src blob:`, `connect-src` com `wss://*.livekit.cloud`, HSTS, `frame-ancestors 'none'`. CSP fraca em `script-src` → AM4 |
| M7 — erro de terceiro literal | ✅ **Absorvido** | §8.1.3, §11.2, §11.3, §16 regra 13 |
| M8 — autenticação de cron | ✅ **Absorvido** | §8.3: `CRON_SECRET` em header + idempotência por (`session_id`,`reminder_type`) / (`charge_id`,`step`) |
| M9 — alteração de e-mail | ❌ **Não absorvido** | `/portal/perfil` é editável; nenhum double opt-in, nenhuma notificação ao endereço antigo. E-mail é a identidade de recuperação de senha |
| M10 — logs do Postgres / `pg_stat_statements` | ✅ **Absorvido** | Estruturalmente resolvido: toda cripto e o HMAC rodam em Node; ao SQL só transita ciphertext. É a consequência boa do ADR-0001 |
| M11 — dado de terceiro na anamnese | ⚠️ **Parcial** | Contato de emergência é cifrado (§9.2). Base legal e limitação de finalidade seguem como texto (pendência humana), sem registro estrutural |
| M12 — plano de resposta a incidente | ⚠️ **Parcial** | Permanece pendência humana legítima, mas **fora do checklist de deploy §14.3** — sem gate, não acontece |
| M13 — controle de entrega do export LGPD | ⚠️ **Parcial** | Política no navigation-flow §7 ("download autenticado, signed URL de vida curta"). Na arquitetura não há rota, não há bucket, e Supabase Storage aparece na stack §1 sem uma única definição de uso ou policy |
| M14 — `dangerouslySetInnerHTML` | ✅ **Absorvido** | §16 regra 6 + `CLAUDE.md` |
| B1 — source maps | ✅ **Absorvido** | §11.5, §14.2, §14.3 |
| B2 — `X-Robots-Tag` + robots.txt | ✅ **Absorvido** | §7.4 e §2 (`public/robots.txt`) — lista incompleta, ver AB1 |
| B3 — `Referrer-Policy` | ✅ **Absorvido** | §7.4 |
| B4 — `timestamptz` UTC | ⚠️ **Parcial** | §17.11 lista colunas de `consents` sem exigir `timestamptz` UTC; nenhuma regra global. Valor probatório depende disso |
| B5 — nome neutro do PDF | ✅ **Absorvido** | §8.3 |
| B6 — TTL de room | ✅ **Absorvido** | §8.2 (job de limpeza > 2h) |
| B7 — mensagens genéricas de login/reset | ❌ **Não absorvido** | §11.3 proíbe mensagem técnica, o que é outra coisa. Não revelar existência de conta não está escrito |
| B8 — `npm ci` | ✅ **Absorvido** | §14.1 com comentário explícito sobre lockfile poisoning, §14.3 |

### 1.4 Placar

| Veredicto | Crítico | Alto | Médio | Baixo | Total |
|---|---|---|---|---|---|
| ✅ Absorvido | 3 | 12 | 5 | 6 | **26** |
| ⚠️ Parcial | 1 | 4 | 5 | 1 | **11** |
| ❌ Não absorvido | 0 | 0 | 4 | 1 | **5** |
| | 4 | 16 | 14 | 8 | 42 |

**A afirmação "todos os 42 absorvidos, nenhum inviável" não se sustenta.** A segunda metade é verdadeira: nenhum dos 42 é inviável. A primeira não: 16 dos 42 chegaram incompletos ou não chegaram. O padrão é claro e tem uma causa única — **a seção 17 (o handoff real para o Data Architect) tem 17 itens, e vários requisitos de segurança que a arquitetura discute em prosa não foram traduzidos para ela**. Tabela de tokens de e-mail, `payload_sanitized`, categorias de eliminação seletiva, `data_subject_requests`, preferência de opt-out, `timestamptz` UTC, `CHECK` de idade: tudo discutido ou pressuposto, nada exigido. O Data Architect entrega o que a lista pede.

---

## 2. Issues novos introduzidos pela arquitetura

### 2.1 🔴 Crítico

#### AC1 — Edge Function `create-charge` sem contrato de autorização, e ausente da estrutura

**O que a arquitetura diz:** §6.1 e ADR-0006 definem "Server Action → `supabase.functions.invoke('create-charge', { body })`" como o caminho de criação de cobrança, para manter `ASAAS_API_KEY` no domínio Supabase. §8.1 item 2 confirma a decisão.

**O que falta:** a função **não existe na estrutura de pastas** (§2 lista `asaas-webhook`, `issue-livekit-token`, `delete-livekit-room`, `send-reminders`, `billing-rules` — nem `create-charge` nem `retry-charges`, esta última mencionada em §8.1). Não há `verify_jwt` definido, não há pré-condições (compare com as 8 explícitas de `issue-livekit-token`), não há especificação de quem é o chamador nem de como o `patient_id` e o valor são derivados. O `body` mencionado necessariamente carrega `patient_id` e `value` — o que contraria frontalmente a regra 2 da §16 e a regra do `CLAUDE.md` ("nenhuma função server aceita `patient_id` como parâmetro").

**Cenário de falha:** implementação natural — `verify_jwt = true`, lê `patient_id`, `value`, `due_date` do body, chama o Asaas. Um **paciente autenticado** obtém seu próprio JWT do Supabase (está no cookie/localStorage do browser dele) e chama `POST https://<projeto>.supabase.co/functions/v1/create-charge` diretamente, pulando a Server Action e todo o `getUser()`+role check dela. Resultados: cria cobranças arbitrárias na conta Asaas da psicóloga; cria cobranças **no nome de outro paciente** (`patient_id` do body), fazendo o Asaas enviar e-mail de cobrança a terceiro; cria cobrança de R$ 0,01 ou de valor absurdo; gera volume que degrada a conta Asaas. Com `verify_jwt = false` a situação é pior: o endpoint é público.

**Ação (Architect, antes do Data Architect):** especificar `create-charge` com o mesmo rigor de `issue-livekit-token` — `verify_jwt = true`; extrair `uid` do JWT; **exigir `role = 'psychologist'` verificado no banco**, nunca do JWT `user_metadata`; body com **apenas** `session_id` ou `charge_draft_id` (uuid, zod) — nunca `patient_id`, nunca `value`; derivar paciente e valor server-side a partir do registro já criado pela Server Action (o padrão correto é: Server Action valida, grava `charges` com `status='pending_creation'` e chama a function com o `charge_id`; a function lê o registro, chama o Asaas e atualiza); resposta genérica em qualquer falha; `CREATE_CHARGE` no audit log com ator. Incluir `create-charge` e `retry-charges` na estrutura §2 e na tabela de segredos §12.
**Responsável:** Architect (especificação) → Stack Agent (implementação).

#### AC2 — Paciente com `UPDATE` direto em `sessions`: auto-admissão e tampering de estado de pagamento

**O que a arquitetura diz:** ADR-0002 passo 2 — "Paciente entra na sala de espera → `UPDATE sessions SET waiting_since = now()` (RLS: só própria sessão)". §6.1 confirma o padrão de escrita pelo client. §8.2 põe `admitted_at IS NOT NULL` como pré-condição 8 da emissão de token, e §8.1 item 6 diz que o webhook atualiza `sessions.payment_status`.

**O problema:** **RLS no Postgres é por linha, não por coluna.** Uma policy `FOR UPDATE USING (patient_id = ...)` autoriza o paciente a escrever **qualquer coluna** daquela linha. Column-level privilege é outro mecanismo (`GRANT UPDATE(col)`), e a arquitetura não o menciona em nenhum ponto.

**Cenário de falha:** paciente autenticado, com a anon key e a própria sessão, executa do browser:
`supabase.from('sessions').update({ admitted_at: new Date() }).eq('id', minhaSessao)`
→ **auto-admissão**: passa a pré-condição 8 e obtém token LiveKit sem que a psicóloga tenha admitido. O gate de admissão — a razão de existir do ADR-0002 — deixa de existir, e a psicóloga pode ter a sala invadida enquanto ainda encerra o atendimento anterior. Variações do mesmo vetor: `{ scheduled_at: now }` para burlar a janela temporal da pré-condição 5; `{ payment_status: 'paid' }` para marcar a própria sessão como paga (fraude financeira direta, e a conciliação do webhook fica inconsistente); `{ status: 'cancelled' }` na sessão da própria agenda da psicóloga; `{ room_name: ... }` violando a unicidade e a derivação server-side exigida por C2.

**Ação (Architect + Data Architect, antes do schema):** o paciente **nunca** recebe `UPDATE` em `sessions`. A marcação de presença passa por RPC `SECURITY DEFINER` de assinatura estreita — `enter_waiting_room(p_session_id uuid)` — que valida ownership por `auth.uid()`, valida a janela temporal e o `status`, e escreve **exclusivamente** `waiting_since`. Como backstop, `REVOKE UPDATE ON sessions FROM authenticated` e, se algum UPDATE direto for mantido em qualquer tabela, `GRANT UPDATE(coluna) ` explícito e nada além. Mesmo tratamento para a admissão pela psicóloga (`admit_patient(p_session_id)`) e para cancelamento/remarcação, que já têm política de prazo server-side (navigation-flow §6). Atualizar ADR-0002 (passo 2) e §6.1.
**Responsável:** Architect (corrigir o fluxo) + Data Architect (RPC, REVOKE, grants de coluna).

### 2.2 🟠 Alto

#### AA1 — Server Actions são endpoints HTTP públicos; o padrão não obriga reautorização nem trata o proxy

**Situação:** o exemplo da §5.1 faz o certo — `getUser()` → checar `profile.role` → validar zod → executar. Mas é um exemplo, não um contrato: a §16 não tem regra dizendo "toda Server Action reautoriza", e nada impede uma action escrita em `src/lib/actions/*.ts` que confie no guard do layout que renderizou o formulário. Server Actions são endpoints HTTP com IDs estáveis, invocáveis por POST direto; o middleware pode nem cobri-las dependendo do `matcher`, e o guard de layout é irrelevante para elas.

**Cenário de falha:** `src/lib/actions/clinical-records.ts` exporta `submitEvolution(patientId, content)`. O autor assume que só a rota `/pacientes/[id]/evolucao` (guard psychologist) a chama. Um paciente autenticado descobre o Action ID no payload da própria página do portal (os IDs estão no bundle) e faz POST com `patientId` de outro paciente → escreve/lê prontuário. O mesmo vale para qualquer action de consentimento ou cobrança.

**Segundo vetor, específico do EasyPanel:** a proteção nativa de CSRF de Server Actions compara `Origin` com `Host`. Atrás do proxy reverso do EasyPanel, `Host` chega como o host interno e `x-forwarded-host` como o público; sem `experimental.serverActions.allowedOrigins` no `next.config.ts`, o resultado é ou quebra funcional em produção, ou a "correção" de relaxar a checagem.

**Ação:** (a) criar wrapper obrigatório em `src/lib/actions/_guard.ts` — `withPsychologist(fn)` / `withPatient(fn)` / `withConsent(fn)` — que faz `getUser()`, resolve role no banco, injeta o contexto e só então chama o corpo; nenhuma action exportada sem wrapper; (b) gate de code review: toda função exportada em `src/lib/actions/**` precisa estar envolvida — `grep -L "withPsychologist\|withPatient\|withPublicAction" src/lib/actions/*.ts` deve retornar vazio; (c) declarar na §16 que middleware e guard de layout **não protegem Server Actions**; (d) `allowedOrigins` com o domínio de produção no `next.config.ts` e no checklist de deploy.
**Responsável:** Architect (contrato + regra) → Stack Agent.

#### AA2 — Middleware tratado como camada de autorização, sem fail-closed explícito e sem mitigação de bypass

**Situação:** §7.1/§7.2 concentram no middleware o gate de MFA, o gate de consentimento e o roteamento por role; §3.2 diz "guard aplicado no layout". A arquitetura afirma "fail-closed" (§7.2), mas não diz o que acontece quando `supabase.auth.getUser()` **falha** — erro de rede, rate limit do Auth, timeout. Um `catch` que segue a request é fail-open, e é o que se escreve por default para não derrubar o app.

**Cenário de falha (1):** middleware do Next.js é bypassável por header em famílias de versões afetadas (classe CVE-2025-29927, `x-middleware-subrequest`). Se o middleware é a única camada que impõe MFA e consentimento, um request forjado alcança `/dashboard` e `/pacientes/[id]` — e essas páginas são Server Components que buscam dados. A RLS ainda protege **se** as policies de `clinical_records` negarem a paciente, o que é a última linha correta, mas nada na arquitetura obriga a página a reautorizar antes de consultar.
**Cenário de falha (2):** Supabase Auth responde 429 durante um pico (o middleware chama `getUser()` em **toda** request, inclusive assets não filtrados). Com tratamento permissivo, requests passam sem role resolvido — e o passo 8 ("role desconhecido → /login") só é alcançado se a chamada tiver sucesso.

**Ação:** (a) declarar explicitamente que o middleware é UX + defense-in-depth, **nunca** a fronteira de autorização; (b) toda página/layout de área protegida repete `getUser()` + role antes de qualquer query, e toda action usa o wrapper AA1; (c) `try/catch` do middleware **redireciona para `/login`** em qualquer erro; (d) fixar Next.js em versão com a correção do bypass, registrar a versão mínima no `package.json` e strip de `x-middleware-subrequest` no proxy do EasyPanel; (e) `matcher` explícito excluindo assets estáticos para reduzir chamadas ao Auth.
**Responsável:** Architect (declaração + guard duplo) → Stack Agent.

#### AA3 — Gate de MFA verifica enrollment, não nível de garantia (`aal2`) — recuperação de senha vira bypass

**Situação:** §7.1 passo 6a: "MFA não configurado? → Redirect /mfa/setup". §7.3 lista as APIs corretas. O navigation-flow §3.1 deixa a intenção clara ("MFA Verify acontece em TODO login subsequente"), mas a condição escrita na arquitetura é sobre **enrollment**, e uma sessão que autenticou só com senha (`aal1`) satisfaz "MFA configurado".

**Cenário de falha:** atacante com a senha da psicóloga (phishing, reuso, vazamento) faz `signInWithPassword` → sessão `aal1` válida → middleware vê o fator TOTP cadastrado, conclui "MFA ok", não exige o challenge → `/dashboard` e todos os prontuários. Variante mais provável: **fluxo de recuperação de senha**. O link do Supabase cai em `/api/auth/callback`, cria sessão `aal1`, permite trocar a senha; se o middleware não exigir `aal2`, quem controla o e-mail da psicóloga contorna o MFA inteiro. Isso anula E2, a regra do `CLAUDE.md` e A15.

**Ação:** o gate passa a ser: se `role = 'psychologist'` e `aal < aal2` → `/mfa/verify` (usar `mfa.getAuthenticatorAssuranceLevel()` ou o claim `aal` do JWT); enrollment só decide entre `/mfa/setup` e `/mfa/verify`. Recuperação de senha exige `aal2` **antes** de efetivar a troca, e a troca revoga as outras sessões. Recomendável levar `aal2` também à RLS das tabelas clínicas (`(auth.jwt()->>'aal') = 'aal2'`), que é a versão fail-closed da mesma regra e sobrevive a AA2. Reautenticação já prevista para `PURGE_RECORD`/`EXPORT_DATA`/`END_TREATMENT` deve ser challenge MFA, não senha.
**Responsável:** Architect (corrigir §7.1/§7.3) → Stack Agent + Data Architect (cláusula `aal` nas policies clínicas).

#### AA4 — Chaves de criptografia sem validação no boot; `CPF_INDEX_KEY` ausente degrada o blind index para HMAC de chave vazia

**Situação:** §9.3 mostra o código real que o Stack Agent vai copiar:
`const key = Buffer.from(process.env.CPF_INDEX_KEY!, 'base64')`
O `!` é uma asserção de tipo, não uma verificação. Em §9.1 a KEK é descrita como "carregada de `process.env.RECORD_ENCRYPTION_KEK_V1`", sem validação de presença ou de tamanho.

**Cenário de falha:** `CPF_INDEX_KEY` não configurada no EasyPanel (ou com nome trocado, ou vazia após uma edição no painel). `Buffer.from(undefined as any, 'base64')` produz buffer vazio; `createHmac('sha256', <buffer vazio>)` **não lança exceção** — devolve um HMAC determinístico com chave vazia, ou seja, um hash **sem chave**. O `cpf_hmac` de toda a base passa a ser exatamente o que A7 proibia: hash não-chaveado de um espaço de 10^11, quebrável por força bruta em minutos. E o sistema segue funcionando: unicidade continua detectada, nenhum erro aparece, e a degradação é silenciosa e permanente (os hashes gravados ficam errados e só se corrigem com o CPF em claro).
Para a KEK o risco é o inverso e menos grave: chave curta faz `createCipheriv` lançar — falha ruidosa, aceitável — mas uma KEK **de 32 bytes errada** (rotação mal feita) só aparece na primeira decifração falhada.

**Ação:** módulo `src/lib/crypto/keys.ts` que, no carregamento, valida cada chave — presente, base64 válido, **exatamente 32 bytes decodificados** — e lança na inicialização (fail-closed no boot, não em runtime). Proibir `!` e `as any` em leitura de env de chave (regra de code review). Após a leitura, guardar em `Buffer` de escopo de módulo e `delete process.env.RECORD_ENCRYPTION_KEK_V1` / `CPF_INDEX_KEY` (ver AA7). Teste unitário obrigatório: chave ausente/curta → throw; vetor conhecido de HMAC → valor esperado. Adicionar ao `.env.example` o comprimento exigido e ao checklist de deploy a verificação das 3 chaves.
**Correção adicional no mesmo lugar:** o exemplo da §5.1 chama `encryptField(parsed.cpf, patientId, 'cpf')` **antes** de o paciente existir — `patientId` não está definido naquele ponto. Como o AAD depende de `patient_id`, o UUID precisa ser gerado no server antes de cifrar (`crypto.randomUUID()`) e passado ao INSERT. Como está, o Stack Agent vai inventar um AAD (constante, ou vazio, ou o CPF), o que anula a ligação criptográfica ciphertext↔paciente exigida por C3.
**Responsável:** Architect (corrigir §5.1 e §9.3) → Stack Agent.

#### AA5 — Nenhuma diretiva de cache nas rotas que renderizam conteúdo clínico e no recibo com CPF

**Situação:** as rotas `/pacientes/[id]`, `/pacientes/[id]/evolucao` e `GET /api/receipts/[id]/download` produzem, respectivamente, HTML com evolução clínica decifrada e um PDF com CPF em claro. A arquitetura não define `dynamic`, `revalidate`, `fetchCache` nem `Cache-Control` em nenhuma delas; a §7.4 não tem header de cache; o §14 não trata do comportamento do proxy do EasyPanel.

**Cenário de falha:** (1) o Route Handler de recibo responde sem `Cache-Control`; o proxy reverso do EasyPanel (ou qualquer CDN colocado na frente depois) aplica heurística de cache sobre um `GET` de `application/pdf` e passa a servir **o recibo do paciente A para o paciente B** na mesma URL, ou mantém o PDF com CPF em cache de disco compartilhado. (2) Uma página de prontuário sem `force-dynamic` tem seu payload RSC — com o texto clínico já decifrado — armazenado no Full Route Cache / Data Cache do Next; a invalidação depende de `revalidatePath` correto, e um erro ali serve conteúdo clínico de um paciente na navegação de outro. (3) `revalidatePath('/pacientes')` no `createPatient` mostra que a superfície de cache já está em uso.

**Ação:** em toda rota que decifra dado (prontuário, anamnese, recibo, export): `export const dynamic = 'force-dynamic'`, `export const revalidate = 0`, `export const fetchCache = 'force-no-store'`. No Route Handler do recibo, resposta com `Cache-Control: private, no-store, max-age=0, must-revalidate`, `Pragma: no-cache`, `Content-Disposition: attachment; filename="recibo-{numero}.pdf"`, `Content-Type: application/pdf`, `X-Content-Type-Options: nosniff` (já global). Regra na §16: **plaintext clínico nunca entra em cache do Next nem em `unstable_cache`**. Adicionar ao checklist de deploy a verificação de que o proxy do EasyPanel não cacheia `/api/**` e as rotas autenticadas.
**Responsável:** Architect (regra + headers) → Stack Agent.

#### AA6 — `NEXT_PUBLIC_*` indisponíveis no estágio de build; o remédio óbvio grava segredo no histórico da imagem

**Situação:** o Dockerfile da §14.1 roda `npm run build` no stage `builder` **sem nenhuma env var** além de `NEXT_TELEMETRY_DISABLED`. Variáveis `NEXT_PUBLIC_*` são inlined no bundle em **build time**. §12.1 diz que elas vivem "EasyPanel / `.env`", sem distinguir build de runtime.

**Cenário de falha:** o build gera bundle com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` como `undefined` → o client do browser não conecta, a sala de vídeo não conecta (`NEXT_PUBLIC_LIVEKIT_URL`), links de e-mail saem quebrados (`NEXT_PUBLIC_SITE_URL`). Sob pressão, a correção que se aplica é declarar `ARG` para "as env vars" e passar tudo pelo EasyPanel — e `ARG`/`ENV` **persistem no histórico das camadas da imagem** (`docker history`, `docker inspect`), o que colocaria `SUPABASE_SERVICE_ROLE_KEY`, `RECORD_ENCRYPTION_KEK_V1` e `CPF_INDEX_KEY` dentro do artefato de imagem, fora de qualquer rotação.

**Ação:** no Dockerfile, declarar `ARG`/`ENV` **exclusivamente** para as 4 variáveis da allowlist `NEXT_PUBLIC_*` no stage `builder`; regra explícita na §14: **nenhum segredo como `ARG` ou `ENV` em nenhum stage** — segredos só como env de runtime injetada pelo EasyPanel no container em execução. Se algum segredo for necessário em build (não é o caso aqui), usar `RUN --mount=type=secret`. Gate de deploy: `docker history --no-trunc <imagem> | grep -E 'SERVICE_ROLE|KEK|CPF_INDEX|API_KEY|SECRET'` → 0 linhas.
**Responsável:** Architect (corrigir §14.1 + checklist) → Stack Agent / EasyPanel Agent.

#### AA7 — Supply chain no mesmo processo que detém a KEK

**Situação:** a decisão de manter a KEK e `CPF_INDEX_KEY` no runtime Node do Next.js (ADR-0001, correta pelas razões dadas) implica que **toda dependência npm da árvore de produção executa no processo que tem as duas chaves em `process.env`**. A arquitetura acerta em `npm ci` + lockfile versionado (§14.1) e em `productionBrowserSourceMaps: false`, mas: `npm ci` **executa lifecycle scripts** de todos os pacotes; não há gate de `npm audit` em lugar nenhum (nem no §14.3, nem na estratégia de testes §13); e as chaves permanecem em `process.env`, legíveis por qualquer módulo em runtime.

**Cenário de falha:** um pacote transitivo comprometido (o vetor mais comum de 2024-2026 em ecossistema npm) executa `postinstall` no build, ou lê `process.env.RECORD_ENCRYPTION_KEK_V1` em runtime e o exfiltra por uma requisição de rede. Vazada a KEK, todo o prontuário — inclusive backups e PITR — fica legível, e o crypto-shredding perde eficácia retroativa. É o pior cenário do produto e não tem remediação posterior.

**Ação:** (a) `npm ci --ignore-scripts` no Dockerfile, com allowlist manual e documentada dos pacotes que legitimamente precisam de script de instalação; (b) `npm audit --audit-level=high` como gate no checklist de deploy e em CI, e `npm audit` obrigatório no Security Audit (já é regra do POP); (c) após a validação de AA4, apagar as chaves de `process.env` (`delete process.env.X`) e manter apenas o `Buffer` de escopo de módulo — não impede um atacante determinado, mas elimina a coleta trivial; (d) minimizar a árvore de produção: nenhuma dependência nova no módulo de cripto além de `node:crypto`; (e) regra: nenhuma dependência que exija acesso amplo a env ou que faça telemetria de rede em runtime.
**Responsável:** Architect (Dockerfile + checklist + regra) → Stack Agent.

#### AA8 — `/confirmar/[token]` executa ação de estado em `GET`

**Situação:** §2 e §3.1 definem `/confirmar/[token]` como **página** pública (`page.tsx`, guard "público (token opaco)"). §8.3 especifica o token corretamente (≥128 bits, hash no banco, uso único, expira no horário da sessão, escopo de uma ação, sem sessão autenticada) e a decisão 6 do status file confirma o desenho. Não há especificação de que a ação exija POST.

**Cenário de falha:** o link é aberto por `GET` por quem não é o paciente — antivírus corporativo, proxy de segurança do provedor de e-mail, pré-visualizador de link, prefetch do cliente de e-mail, indexação de caixa postal. Se o handler da página consome o token e efetiva a ação, a presença é confirmada (ou a sessão **cancelada**) sem qualquer ato humano, e o token único queima antes do paciente clicar — que então recebe "link inválido". Em contexto de agenda com política de cobrança por cancelamento fora de prazo (navigation-flow §6), um cancelamento espúrio tem consequência financeira e clínica.
**Segundo vetor:** e-mail encaminhado, backup de caixa postal ou vazamento de provedor entrega o token a terceiro, que **cancela** a sessão de psicoterapia de outra pessoa e, com isso, revela que ela faz terapia e em que horário. Um token que também cancela é escalada de privilégio sobre um bearer de e-mail.
**Terceiro vetor:** sem rate limit (M1 não absorvido), a rota pública aceita tentativas ilimitadas — irrelevante contra 128 bits, relevante como amplificador de DoS e de enumeração de erro.

**Ação:** (a) o `GET` **apenas renderiza** uma tela de confirmação com o mínimo de informação (data e hora, sem nome do paciente, sem identificação da profissional, sem valor) e um formulário; a ação só é efetivada em **POST** (Server Action pública com o token no corpo), e o token é marcado `used_at` na mesma transação; (b) tokens **por ação**: um para confirmar, outro para cancelar — nunca um token que aceite `action` como parâmetro; (c) cancelamento por token respeita a política de prazo (fora do prazo → a tela informa e exige acesso ao portal autenticado); (d) headers da rota: `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`; (e) rate limit por IP e por token-prefix; (f) auditar `CONFIRM_ATTENDANCE`/`CANCEL_SESSION` com origem `email_token` e IP/UA.
**Responsável:** Architect (corrigir o desenho da rota) → Stack Agent + Data Architect (tabela de tokens, requisito 19).

#### AA9 — `service_role` no Next.js liberado sem allowlist — anula a RLS como última linha, no processo que detém a KEK

**Situação:** §6.2 regra 1 autoriza `SUPABASE_SERVICE_ROLE_KEY` em "Server Actions (quando precisa bypassar RLS para operações transacionais)" e em Route Handlers, sem critério, sem lista e sem exigência de justificação. A RLS é apresentada em toda a arquitetura como a última linha de defesa (§4, §17.16) — e um client `service_role` no mesmo processo remove essa linha para qualquer código que o instancie.

**Cenário de falha:** o autor de uma Server Action encontra um erro de RLS ao gravar (policy faltando, join bloqueado), troca o client por `service_role` para destravar, e a action passa a ler/escrever qualquer linha de qualquer paciente. A partir daí, um bug de derivação de `patient_id` — o risco que A12 aponta como o mais provável do produto — deixa de ser barrado pelo banco. Efeito colateral silencioso: dentro de `service_role`, `auth.uid()` é NULL, o que quebra `log_audit` (AA10) e apaga o rastro exatamente na operação mais privilegiada.

**Ação:** (a) regra: o client padrão de Server Action e Route Handler é o **client do usuário** (`@supabase/ssr`, RLS ativa); (b) `service_role` permitido apenas numa allowlist fechada, documentada na arquitetura, com justificação por item — candidatos legítimos aqui são poucos (criação do auth user no convite; leitura de sessão pela Edge Function de token; escrita transacional do webhook); (c) preferir **RPC `SECURITY DEFINER` de assinatura estreita chamada com o JWT do usuário** a client `service_role` — resolve a necessidade transacional, mantém `auth.uid()` e mantém o audit log correto; (d) isolar a construção do client `service_role` em um único módulo (`src/lib/supabase/admin.ts`) com comentário obrigatório de justificação, e gate de code review sobre importações desse módulo fora da allowlist.
**Responsável:** Architect (allowlist + regra) → Stack Agent + Data Architect (RPCs).

#### AA10 — Ator do audit log indefinido em contexto `service_role`/Edge Function: os eventos de ataque ficam sem autor

**Situação:** §10.2 e ADR-0004 definem `log_audit` `SECURITY DEFINER` com "`actor_id` derivado de `auth.uid()` — nunca de parâmetro". Correto contra forja de identidade. Mas §8.2 diz que `issue-livekit-token` "carrega a sessão com service_role", e §10.3 exige `DENY_ROOM_TOKEN` **síncrono e bloqueante**; §10.4 inclui `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE`, `WEBHOOK_REJECTED`.

**Cenário de falha:** em contexto `service_role`, `auth.uid()` retorna NULL. Então: um paciente troca `session_id` para tentar a sessão de outro → a Edge Function nega e chama `log_audit` → a linha grava `DENY_ROOM_TOKEN` com `actor_id = NULL`. A tentativa de acesso cruzado — o ataque que A13 existe para detectar e o teste (a) do gate 5.5 exige provar no log — fica registrada **sem quem tentou**. Idem `LOGIN_FAILURE` (não há sessão, logo não há `auth.uid()`) e `WEBHOOK_REJECTED`. Se, alternativamente, `log_audit` for chamada com o JWT do usuário mas a função tiver `actor_id NOT NULL`, o INSERT falha; e como `DENY_ROOM_TOKEN` é bloqueante, a falha do log vira falha da operação — trocando um problema de rastreabilidade por um de disponibilidade.

**Ação:** duas funções, não uma. (a) `log_audit(...)` para contexto de usuário: `actor_id := auth.uid()`, com `RAISE` se NULL; (b) `log_audit_system(p_actor_id uuid, p_actor_source text, ...)` executável **apenas** por `service_role` (via `REVOKE` de `authenticated`/`anon`), com `actor_source ∈ ('edge_function','webhook','cron','anonymous')` e `p_actor_id` obtido do JWT que a própria Edge Function validou (`getUser(jwt)` → `uid`) — nunca do body. (c) Coluna `actor_source NOT NULL` em `audit_log` para distinguir os dois caminhos, e `actor_id` nullable apenas quando `actor_source = 'anonymous'` (login falhado com e-mail inexistente, webhook rejeitado). (d) Para `LOGIN_FAILURE`, gravar o e-mail tentado em coluna dedicada e **hash/parcial** (não é PII clínica, mas é enumerável) + IP.
**Responsável:** Data Architect (assinaturas e constraints) + Architect (declarar o padrão de chamada por contexto).

#### AA11 — Rascunho de anotações da sessão sem definição de armazenamento (M2, reclassificado de 🟡 para 🟠)

**Situação:** a arquitetura cria `src/components/video/session-notes-panel.tsx` e o navigation-flow §3.3 diz que o registro de evolução vem "pré-carregado com anotações da sessão". Não há: onde o rascunho é guardado, se é cifrado, quando é eliminado, nem regra proibindo `localStorage`. A §9.2 lista os campos cifrados e o rascunho **não está lá**. O Módulo 2 do review anterior exigia "auto-save server-side cifrado" e o Módulo 4 exigia eliminar o rascunho ao incorporá-lo.

**Por que subiu para Alto:** no PRD isso era uma ambiguidade de story ("salvas localmente"); agora existe um componente na arquitetura e nenhuma coluna cifrada correspondente. O caminho de menor esforço para o Stack Agent é `localStorage` (persiste anotação clínica em disco do dispositivo, que pode ser compartilhado, sem cifra e sem expiração) ou uma coluna `text` em claro em `sessions` (conteúdo clínico fora do envelope, dentro do banco, legível com a `SERVICE_ROLE_KEY` — furando o ADR-0001 pela lateral). Nos dois casos o dado mais sensível do produto sai do único mecanismo que a arquitetura construiu para protegê-lo.

**Ação:** rascunho é **conteúdo clínico** e segue a §9 sem exceção: tabela `session_note_drafts` com envelope completo (AAD `patient_id|session_id`), auto-save por Server Action com `runtime='nodejs'`, RLS só para a psicóloga, sem policy de SELECT para paciente, `DELETE` na mesma transação que grava a evolução definitiva, e retenção máxima curta (job que apaga rascunhos de sessões encerradas há mais de N dias). No client, o texto vive em estado React; regra explícita na §16: **proibido `localStorage`/`sessionStorage`/IndexedDB para qualquer campo clínico** (equiparar à regra 14 do token LiveKit).
**Responsável:** Architect (§9.2 + regra) + Data Architect (tabela) → Stack Agent.

#### AA12 — ADR-0001 declara uma proteção que o deploy não entrega: KEK e `SERVICE_ROLE_KEY` no mesmo env, acesso ao painel não tratado

**Situação:** ADR-0001 afirma que "vazamento de `SUPABASE_SERVICE_ROLE_KEY` não expõe prontuário — a chave está em outro domínio". §12.1, no entanto, coloca `SUPABASE_SERVICE_ROLE_KEY`, `RECORD_ENCRYPTION_KEK_V1`, `CPF_INDEX_KEY` e `RESEND_API_KEY` **no mesmo env do EasyPanel**, no mesmo container. Nada na arquitetura trata do controle de acesso ao painel do EasyPanel, da visibilidade de env vars em `docker inspect` / `/proc/1/environ` / UI do painel, dos logs de build, nem de quem tem credencial de acesso ao host.

**Cenário de falha:** qualquer um destes eventos entrega **as duas** chaves de uma vez: acesso ao painel do EasyPanel (senha reutilizada, sem 2FA, login compartilhado); `docker exec` no host; um backup/config do EasyPanel copiado para fora; um build log que ecoe env. Nesse cenário o atacante lê o banco com `service_role` **e** decifra o prontuário com a KEK. A separação de domínios continua valendo para o vetor que motivou o ADR (comprometimento do lado Supabase: chave vazada em repo, acesso de suporte do provedor, dump de banco), mas o ADR está escrito como se protegesse contra tudo — e é assim que decisões futuras vão ser tomadas.

**Ação:** (a) corrigir ADR-0001 declarando o risco residual em uma linha honesta: "protege contra comprometimento no domínio Supabase; **não** protege contra comprometimento do host/painel EasyPanel, onde KEK e SERVICE_ROLE_KEY coexistem"; (b) controles operacionais no checklist de deploy e como pendência humana: 2FA obrigatório na conta EasyPanel, contas nomeadas sem login compartilhado, inventário escrito de quem tem acesso ao painel e ao host, revisão desse acesso antes do go-live; (c) nenhum `echo`/`printenv` em script de build ou entrypoint; (d) considerar, como hardening futuro (não MVP), mover a operação de wrap/unwrap da DEK para um serviço isolado ou KMS — registrar como opção descartada com justificativa em vez de silêncio.
**Responsável:** Architect (ADR + checklist) + pendência do dev/cliente (acesso ao painel).

### 2.3 🟡 Médio

| # | Issue | Ação | Responsável |
|---|---|---|---|
| **AM1** | **Âncora externa do hash chain sem mecanismo** (C4 parcial). §10.1 e ADR-0004 citam "âncora externa semanal"; não há Edge Function, cron, destino, nem env var | Criar `anchor-audit-log` (cron semanal, `CRON_SECRET`): exporta último `row_hash` + contagem + timestamp para fora do banco (e-mail à psicóloga e/ou objeto em bucket privado versionado), e uma função de verificação que recalcula a cadeia entre duas âncoras. Sem isso, declarar no ADR que a camada 4 é parcial | Architect + Data Architect |
| **AM2** | **Concorrência do hash chain.** `prev_hash` lido no trigger `BEFORE INSERT` sem serialização | `pg_advisory_xact_lock` (ou tabela âncora de uma linha com `FOR UPDATE`) antes de ler o último hash. Sem isso, dois inserts concorrentes (webhook + ação da psicóloga) forkam a cadeia — indistinguível de tampering — ou colidem em índice único e, por serem bloqueantes, derrubam uma operação de prontuário | Data Architect |
| **AM3** | **`RESEND_API_KEY` única duplicada em dois domínios de confiança** (§12.1). Dobra a superfície: a chave dá envio autenticado no domínio (passa DMARC → phishing de pagamento em nome da psicóloga, o vetor de A6) e, na API do Resend, leitura de e-mails já enviados (data/hora de compromisso). A divisão em si **se justifica** (e-mail user-initiated no Next.js evita latência; cron precisa da chave no Supabase); o erro é ser a **mesma** chave | Duas chaves distintas, cada uma com escopo *sending-only* e restrita ao domínio de envio: `RESEND_API_KEY_APP` (EasyPanel) e `RESEND_API_KEY_CRON` (`supabase secrets`). Rotação e revogação independentes, e um vazamento é atribuível ao domínio. Atualizar §12.1 e ADR-0001 (que registra a duplicação como "risco baixo" — é baixo com duas chaves, não com uma) | Architect |
| **AM4** | **CSP fraca** (§7.4): `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Com `unsafe-inline` a CSP deixa de ser defesa contra XSS — e o XSS relevante aqui (M14) executa na sessão da psicóloga, que acessa todos os prontuários. `'unsafe-eval'` não é necessário em produção. Faltam `base-uri`, `form-action`, `object-src`, `frame-src`; `connect-src` usa `https://*.supabase.co` em vez do projeto | CSP com nonce por request + `'strict-dynamic'` (gerado no middleware, propagado ao `<script>`); remover `unsafe-eval` em produção; acrescentar `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `frame-src 'none'`; fixar `connect-src` no host do projeto Supabase e no host LiveKit da conta. Manter `style-src 'unsafe-inline'` (Tailwind) é aceitável | Architect + Stack Agent |
| **AM5** | **Ciphertext exposto ao browser client.** A §16 regra 11 afirma "ciphertext nunca sai do servidor", mas §6.1 usa o browser client para leituras do paciente. Um `select('*')` em `patients` ou `anamnesis` entrega `cpf_ciphertext`, `cpf_dek_wrapped`, `cpf_hmac` ao browser e ao cache do React Query — não é quebrável, mas viola a invariante declarada e amplia a superfície | `REVOKE` de coluna nas colunas de ciphertext/DEK/HMAC para `authenticated` (ou expor views sem elas); regra: **queries do browser client sempre com lista explícita de colunas — `select('*')` proibido** em tabelas com campos cifrados | Data Architect + Stack Agent |
| **AM6** | **`p_ip`/`p_user_agent` do audit log sem origem definida** (§10.2 recebe como parâmetros). Se vierem do client, são forjáveis e o log perde valor probatório; atrás do proxy do EasyPanel, `x-forwarded-for` bruto também é forjável se não houver regra de confiança | Derivar sempre de `headers()` no server / `req.headers` na Edge Function; definir a regra de confiança do proxy (usar o **último** hop confiável, não o primeiro valor de XFF), documentar em §10.2, e nunca aceitar IP/UA de body | Architect + Stack Agent |
| **AM7** | **A regra "conteúdo clínico nunca em log" não tem mecanismo** — é uma linha no `CLAUDE.md` e uma tabela na §11.4. O padrão da §11.2 (`error.message` apenas) é correto e não é enforçado; e `console.error(error)` em erro do Postgres pode carregar `details`/`hint` com valores de coluna | Módulo único `src/lib/logger.ts` (+ equivalente em Deno para Edge Functions) com **allowlist de chaves serializáveis** (`event_type`, `session_id`, `patient_id`, `action`, `status`, `error_code`) e redação do resto; gate de code review: `console.(log\|error\|warn\|info)` fora de `logger.ts` = reprovação; proibido logar objeto de erro inteiro (`PostgrestError`, resposta do Asaas, payload de webhook) | Architect (regra + módulo) → Stack Agent + Code Reviewer |
| **AM8** | **Remarcação não reseta o estado da sala de espera.** §17.5 define `room_name` com `DEFAULT`, o que não regenera em UPDATE; `admitted_at`/`waiting_since` persistem | Trigger em `sessions`: ao alterar `scheduled_at`, resetar `waiting_since` e `admitted_at` para NULL e **regenerar `room_name`** (o review anterior exigia "remarcação gera novo"). Sem isso, um paciente admitido em sessão anterior obtém token 15 min antes do novo horário sem nova admissão | Data Architect |
| **AM9** | **Busca decrypt-then-filter: semântica de auditoria e correção.** §9.4 decifra 20 registros por página para filtrar. Duas consequências não tratadas: (a) conteúdo clínico é acessado sem gerar `VIEW_RECORD`, criando acesso não auditado ao dado que o audit log existe para rastrear; (b) filtrar dentro da página faz a busca só encontrar o que já está na página corrente — o que empurra a implementação para "decifrar tudo". **DoS e timing:** avaliados e considerados 🟢 — a única chamadora é a psicóloga (auto-DoS), o volume é ~1500 registros no total, e um canal de timing exigiria que o atacante fosse a própria psicóloga. Não inflar | Registrar `SEARCH_RECORDS` (patient_id, contagem de resultados, **nunca o termo** — o termo é conteúdo clínico) e definir que a busca decifra o conjunto do paciente com limite superior explícito (ex.: 500 registros/consulta) em vez de "página corrente". Plaintext nunca em cache | Architect + Data Architect |
| **AM10** | **Inventário de env incompleto e com item sem consumidor.** Faltam: `EMAIL_FROM` (remetente neutro é requisito de A6 e está hardcoded no doc), `ASAAS_BASE_URL` (sandbox vs. produção — sem env, a URL é hardcoded e a virada para produção é edição de código, com risco de cobrança real em teste), `LIVEKIT_URL` em `supabase secrets` (a Edge Function de `deleteRoom` não lê `NEXT_PUBLIC_*`), `SITE_URL` em `supabase secrets` (as Edge Functions de cron montam links do portal). Sobra: `CRON_SECRET` no EasyPanel **não tem consumidor** (o disparo é por pg_cron dentro do Postgres) — least privilege manda remover. E o segredo usado pelo pg_cron não pode ficar em claro na definição do job | Corrigir a tabela §12.1 (13 → 16 vars, com coluna "quem lê"); `CRON_SECRET` só em `supabase secrets` + Vault para o job pg_cron; `ASAAS_BASE_URL` obrigatório com o valor de sandbox no `.env.example` | Architect + Data Architect (Vault) |
| **AM11** | **Open redirect em `/api/auth/callback`.** A rota é pública (PKCE) e o padrão do Supabase usa `next`/`redirect_to` da query string. Não há validação especificada. E o checklist §14.3 não inclui a configuração de Site URL / Redirect URLs no Dashboard do Supabase | Validar o destino contra allowlist de **paths internos** (`startsWith('/')` + rejeitar `//`, `\`, URL absoluta); fallback por role. Acrescentar ao checklist: Site URL e Redirect URLs restritas ao domínio de produção | Architect + Stack Agent |
| **AM12** | **`payment_webhook_events` sem exigência de sanitização** (§17.7 pede só `asaas_event_id` PK; o Módulo 1 exigia `payload_sanitized` sem CPF nem nome) | Requisito explícito: a tabela **não** armazena payload bruto; apenas allowlist (`event_type`, `payment_id`, `status`, `value`, `due_date`, `received_at`). CPF e nome nunca | Data Architect |
| **AM13** | **Ambiente do gate 5.5 indefinido — o gate bloqueante não é executável como especificado.** §13.3 lista (a)-(g), mas: (e)(f)(g) exigem manipular `admitted_at`, `scheduled_at` e consentimento (precisa de seeding com `service_role`); (b) exige ler o `room_name` de outra sessão (idem); o login da psicóloga em E2E exige **gerar TOTP** (MFA obrigatório), o que a §13 não menciona; e não há definição de projeto Supabase de teste nem de credenciais LiveKit de teste. Rodar contra produção não é opção | Definir na §13: projeto Supabase dedicado a teste, script de seeding com `service_role` (test-only), geração de TOTP no Playwright a partir do secret semeado, chave LiveKit de dev, e `docs/credentials.md` no `.gitignore`. Sem isso, o gate que compensa C2 não roda | Architect → QA |
| **AM14** | **Biblioteca de PDF não especificada.** O recibo é gerado on-demand no processo que detém a KEK. Sem indicação, o caminho comum é headless browser | Mandatar PDF em JS puro (`pdfkit` ou `pdf-lib`); **proibir** puppeteer/playwright/chromium para geração de PDF (centenas de MB, execução de motor de renderização e superfície de SSRF no mesmo processo da KEK) | Architect |
| **AM15** | **Fonte canônica do role não resolvida.** "`app_metadata.role` **ou** `profiles.role`" aparece em §7.1.5, §16.16 e §17.13 sem decisão | Decidir: `profiles.role` como fonte de verdade (é o que a RLS consegue consultar), espelhado em `app_metadata` por trigger para o caminho rápido do middleware; declarar que **a RLS nunca confia apenas no claim do JWT** e que troca de role revoga sessões (JWT antigo continua válido até o refresh) | Architect + Data Architect |

### 2.4 🟢 Baixo

| # | Issue | Ação |
|---|---|---|
| **AB1** | `robots.txt` (§2) bloqueia só `/portal`, `/dashboard`, `/pacientes`, `/financeiro` | Acrescentar `/agenda`, `/perfil`, `/sala`, `/convite`, `/confirmar`, `/termos`, `/onboarding`, `/mfa`, `/api` |
| **AB2** | Logout não limpa estado no client. População que usa dispositivo compartilhado | Reset do cache do React Query no logout + `Clear-Site-Data: "cache", "storage"` na resposta de logout |
| **AB3** | Ordem do middleware divergente: §7.1 checa MFA antes do onboarding; navigation-flow §2.1 checa onboarding antes do MFA | Alinhar (MFA primeiro é o correto: o gate de autenticação precede o de completude de perfil) |
| **AB4** | `consents.subject_type (patient\|guardian)` (§17.11) é resíduo de C1, eliminado pela emenda E1 | Remover `guardian` do enum; manter `subject_type` só se houver outro uso, senão remover a coluna |
| **AB5** | Sem plano de rotação para `CPF_INDEX_KEY` (§9.5 cobre só a KEK). Rotação exige recomputar o HMAC de todos os CPFs, o que exige o plaintext, que exige a KEK | Documentar o procedimento (ordem: decifrar com KEK → recomputar HMAC → gravar → versionar `cpf_index_version`) ou declarar explicitamente que a chave não é rotacionável sem esse job |
| **AB6** | Headers adicionais baratos | `Cross-Origin-Opener-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none`; `Referrer-Policy: no-referrer` específico em `/confirmar/*` e `/convite/*` (token no path) |
| **AB7** | Re-aceite após revogação sem máquina de estado. A revogação congela o prontuário como read-only (navigation-flow §5); o middleware redireciona para `/termos` no próximo login, e um novo aceite descongela? Indefinido | Definir: novo aceite reativa o tratamento e o prontuário sai de read-only, com `ACCEPT_CONSENT` registrando que se trata de reativação; ou exigir ação deliberada da psicóloga. Auditar as duas transições |

**Total de issues novos:** 2 🔴 · 12 🟠 · 15 🟡 · 7 🟢 = **36**

---

## 3. Veredicto

### ❌ Reprovada

Não por fragilidade de concepção — a arquitetura é sólida onde o produto é difícil — mas porque **dois Críticos produzem código explorável por omissão** (AC1 e AC2) e ambos alteram o input do Data Architect. Modelar o schema antes de corrigi-los significa modelar as policies erradas de `sessions` e nenhuma tabela de tokens de ação.

Correção estimada: **uma rodada**. Nenhum item exige redesenho, troca de decisão ou revisão de ADR estrutural. São oito edições de especificação.

### 3.1 Correções requeridas ao Architect (bloqueiam o Data Architect)

| # | Correção | Onde | Issue |
|---|---|---|---|
| 1 | Especificar `create-charge` (verify_jwt, role verificada no banco, body só com `charge_id`/`session_id`, derivação server-side de paciente e valor, resposta genérica, audit com ator) e incluir `create-charge` + `retry-charges` na estrutura §2 e na tabela §12 | §2, §6.1, §8.1, ADR-0006 | AC1 |
| 2 | Remover o `UPDATE` direto do paciente em `sessions`: presença e admissão por RPC `SECURITY DEFINER` de assinatura estreita; declarar que RLS não é column-level | §6.1, ADR-0002 passo 2 | AC2 |
| 3 | Declarar que middleware e guard de layout **não são** a fronteira de autorização; toda página reautoriza; toda Server Action passa por wrapper (`withPsychologist`/`withPatient`); middleware falha fechado em erro de `getUser()`; `allowedOrigins` no `next.config.ts` | §7.1, §7.2, §16 | AA1, AA2 |
| 4 | Corrigir o gate de MFA para nível de garantia (`aal2`), não enrollment, e cobrir o fluxo de recuperação de senha | §7.1, §7.3 | AA3 |
| 5 | Corrigir o exemplo da §5.1 (UUID do paciente gerado no server antes de cifrar, por causa do AAD) e o carregamento de chaves da §9.3 (validação de presença e de 32 bytes no boot; proibido `!`) | §5.1, §9.1, §9.3 | AA4 |
| 6 | Adicionar diretivas de cache (`force-dynamic`, `no-store`) às rotas que decifram, e corrigir o Dockerfile: `NEXT_PUBLIC_*` como `ARG` no builder, nenhum segredo como `ARG`/`ENV`, `npm ci --ignore-scripts` | §7.4, §11, §14.1, §16 | AA5, AA6, AA7 |
| 7 | Definir o rascunho de anotações da sessão como conteúdo clínico cifrado (tabela + envelope + eliminação), e proibir storage local para campo clínico | §9.2, §16 | AA11 |
| 8 | Corrigir ADR-0001 com o risco residual do host/EasyPanel; completar o checklist §14.3 (teste de restauração da KEK, plano de incidente, Redirect URLs do Supabase, `npm audit`, verificação das 3 chaves, `docker history` sem segredo) | ADR-0001, §14.3 | AA12, A1, M12 |

### 3.2 Ressalvas obrigatórias ao Stack Agent (implementação)

Não bloqueiam o Data Architect, mas são condição de aprovação em code review:

1. Wrapper de autorização em **toda** Server Action exportada; nenhuma action confia em guard de layout (AA1).
2. Módulo `logger.ts` único com allowlist de chaves; `console.*` fora dele reprova; nunca logar objeto de erro do Postgres, resposta do Asaas ou payload de webhook (AM7).
3. Validação de chaves no boot com falha ruidosa; proibido `process.env.X!` em código de cripto (AA4).
4. `no-store` + `force-dynamic` em toda rota que decifra; `Content-Disposition: attachment` no recibo (AA5).
5. `/confirmar/[token]`: GET só renderiza, POST executa; tokens separados por ação (AA8).
6. Browser client sempre com lista explícita de colunas; `select('*')` proibido onde houver ciphertext (AM5).
7. Rate limiting: login, reenvio de convite (3/paciente/hora), `issue-livekit-token` (10/usuário/min), `/confirmar/*`, solicitação LGPD (M1).
8. Política de senha: mínimo 10 + verificação de senha vazada habilitada no Supabase Auth; timeout de inatividade configurado (M5, M4).
9. Alteração de e-mail com double opt-in no novo endereço + notificação ao antigo; reenvio de convite sem revelar existência de conta (M9, B7).
10. Nenhum PDF por headless browser (AM14); `npm ci --ignore-scripts` + `npm audit --audit-level=high` no gate de deploy (AA7).
11. `x-forwarded-for` tratado com regra de confiança do proxy antes de virar evidência de auditoria (AM6).
12. Export LGPD: definir a rota/mecanismo de entrega (preferência: geração on-demand como o recibo, sem persistir; se persistir, bucket privado + signed URL de 60s + expiração do artefato) — M13, hoje sem mecanismo na arquitetura.

### 3.3 Pendências humanas novas ou reforçadas (não implementáveis por agente)

Somam-se às 11 do review anterior, que permanecem válidas:

12. **Acesso ao painel do EasyPanel e ao host:** 2FA obrigatório, contas nomeadas (sem login compartilhado), inventário escrito de quem tem acesso, revisão antes do go-live. A KEK é tão segura quanto esse acesso (AA12).
13. **Região do LiveKit Cloud:** provisionar/confirmar região sul-americana; se indisponível no free tier, declarar a transferência internacional de mídia ao titular no consentimento (A5).
14. **Duas chaves distintas no Resend**, com escopo *sending-only* por domínio (AM3).
15. **Ambiente de teste dedicado:** projeto Supabase de teste + credenciais LiveKit de dev, sem os quais o gate 5.5 não roda (AM13).
16. **Versão mínima do Next.js** definida contra o bypass de middleware, e política de atualização (AA2).

---

## 4. Requisitos para o Data Architect

### 4.1 Correções aos 17 requisitos da §17 da arquitetura

| Item §17 | Correção |
|---|---|
| **5** (`sessions.room_name`) | Mantém `text UNIQUE NOT NULL DEFAULT ('s_' \|\| encode(gen_random_bytes(16),'hex'))`, **e** trigger que regenera `room_name` e zera `waiting_since`/`admitted_at` quando `scheduled_at` muda (AM8) |
| **6** (`waiting_since`, `admitted_at`) | Paciente e psicóloga **não** recebem `UPDATE` na tabela. Transições apenas por RPC `SECURITY DEFINER`: `enter_waiting_room(p_session_id)` (escreve só `waiting_since`) e `admit_patient(p_session_id)` (escreve só `admitted_at`, exige role psychologist). `REVOKE UPDATE ON sessions FROM authenticated, anon` (AC2) |
| **7** (`payment_webhook_events`) | Acrescentar: **sem payload bruto**; colunas de allowlist apenas; CPF e nome completo proibidos (AM12) |
| **11** (`consents`) | `subject_type` sem `guardian` (E1/AB4); acrescentar coluna de **preferência de comunicação** (opt-out de lembretes) vinculada à finalidade opcional (A4); todos os timestamps `timestamptz` UTC (B4) |
| **13** (`profiles.role`) | Definir `profiles.role` como fonte canônica, com trigger de espelhamento para `app_metadata`; RLS proíbe UPDATE da coluna por qualquer usuário, inclusive o próprio; policies clínicas não confiam apenas no claim do JWT (AM15) |
| **14** (`retention_until`) | Retenção **fixa em 5 anos** (E1) — não modelar `is_minor_at_start` nem a regra de 20 anos; acrescentar `CHECK` de idade ≥ 18 em `patients` (requisito 18) |
| **Global** | Todos os campos de tempo com valor probatório (`audit_log`, `consents`, `receipts`, `sessions`) em `timestamptz`, gravados em UTC (B4) |

### 4.2 Requisitos adicionais (18 a 32)

18. **`CHECK` de idade no banco:** `patients` com constraint que rejeita `date_of_birth` correspondente a menos de 18 anos na data de cadastro. Hoje o único enforcement de E1/C1 é o schema zod na Server Action; qualquer RPC, seed ou correção manual cria menor e invalida a base legal do tratamento.
19. **Tabela de tokens de e-mail** (A9, hoje ausente do handoff): `email_action_tokens(id uuid pk, token_hash text unique not null, purpose enum('invite','confirm_attendance','cancel_attendance'), patient_id uuid, session_id uuid, expires_at timestamptz not null, used_at timestamptz, created_ip inet, created_at timestamptz)`. Token **nunca** em claro; `used_at` marcado na mesma transação da ação; um token por ação (nunca um token que aceite a ação como parâmetro); TTL 72h para convite e "horário da sessão" para confirmação; RLS sem nenhuma policy para `authenticated`/`anon` (acesso só por RPC `SECURITY DEFINER`).
20. **Eliminação seletiva por categoria** (A11): marcar cada categoria de dado como retida por obrigação regulatória vs. eliminável, conforme a tabela da seção 9 do review do PRD. Concretamente: telefone, preferências de comunicação e contato de emergência precisam ser elimináveis/anonimizáveis sem tocar no prontuário; o prontuário e a identificação mínima vinculada a ele são congeláveis, não elimináveis, até `retention_until`.
21. **`data_subject_requests`** (A11/M13): `id uuid, patient_id, type enum('access','deletion','correction','portability'), requested_at, due_at (15 dias), status, decision text, legal_basis text, eliminated_categories jsonb, retained_categories jsonb, responded_at, artifact_expires_at`. A resposta fundamentada é requisito de conformidade, não relatório: sem a decisão e a base legal registradas, não há prova de atendimento.
22. **Preferência de comunicação** (A4/M8): tabela ou colunas para opt-out por canal/finalidade, consultadas pela régua e pelos lembretes antes de cada envio, e vinculadas ao consentimento opcional correspondente.
23. **`session_note_drafts`** (AA11): envelope completo (`content_ciphertext`, `content_iv`, `content_tag`, `dek_wrapped`, `dek_iv`, `dek_tag`, `kek_version`), AAD `patient_id|session_id`, RLS só para a psicóloga (nenhuma policy de SELECT para `patient`), `DELETE` na transação que grava a evolução, job de limpeza para rascunhos órfãos.
24. **`log_audit` + `log_audit_system`** (AA10): duas funções. A de usuário deriva `actor_id` de `auth.uid()` e falha se NULL; a de sistema recebe `p_actor_id` (extraído pela Edge Function do JWT que ela mesma validou) e é executável **apenas** por `service_role`. Coluna `actor_source NOT NULL` com enum `('user','edge_function','webhook','cron','anonymous')`; `actor_id` nullable somente quando `actor_source = 'anonymous'`.
25. **Serialização do hash chain** (AM2): `pg_advisory_xact_lock` (ou âncora de linha única com `FOR UPDATE`) no trigger `BEFORE INSERT` do `audit_log`, antes de ler o `row_hash` anterior. Documentar que a ausência disso forka a cadeia sob concorrência e derruba operações com log bloqueante.
26. **Caminho assíncrono do audit log** (A14): definir o mecanismo — tabela de outbox (`audit_log_pending`) drenada por cron, ou tornar `VIEW_RECORD` síncrono (custo ~5ms, volume irrelevante neste produto). Fire-and-forget em Server Action perde o registro do evento mais frequente e mais relevante em auditoria CFP.
27. **`REVOKE` de coluna nos campos cifrados** (AM5): `cpf_ciphertext`, `cpf_iv`, `cpf_tag`, `cpf_dek_*`, `cpf_hmac`, e os equivalentes em `clinical_records`/`anamnesis`/`session_note_drafts`, não selecionáveis por `authenticated`. Alternativa: views sem essas colunas para o consumo do browser client.
28. **RLS de `clinical_records`, `anamnesis` e derivados — explicitar a proibição:** nenhuma policy concede SELECT de `clinical_records` a `patient` (regra de negócio permanente do `CLAUDE.md`). Para `anamnesis`, o paciente tem INSERT/UPDATE/SELECT da própria linha (ele a preenche) sem acesso às colunas de ciphertext (item 27); a psicóloga tem SELECT das linhas dos seus pacientes; ninguém tem DELETE durante a retenção. Isto está no review do PRD e **não** está entre os 17 itens do handoff.
29. **`aal2` nas policies clínicas** (AA3): cláusula `(auth.jwt()->>'aal') = 'aal2'` nas policies de SELECT/INSERT/UPDATE de `clinical_records`, `anamnesis` e `session_note_drafts`. É a versão fail-closed do gate de MFA e a única que sobrevive a um bypass de middleware.
30. **`profiles`** (não modelada no handoff): `user_id` (FK auth.users), `role`, `onboarding_completed`, `full_name`, `crp`, dados profissionais. `onboarding_completed` é consultado pelo middleware; `role` é a fonte canônica (item 4.1/13).
31. **`CRON_SECRET` no Vault** (AM10): o segredo consumido pelos jobs pg_cron não fica em claro na definição do job (`cron.job` é legível por quem tem acesso ao banco). Usar `vault.decrypted_secrets` na chamada `net.http_post`, e `timingSafeEqual` na comparação dentro da Edge Function.
32. **Idempotência dos lembretes e da régua** (M8, já decidido em §8.3): constraints `UNIQUE (session_id, reminder_type)` e `UNIQUE (charge_id, step)` — precisam existir como constraint, não como verificação na aplicação.

### 4.3 Verificações que o Data Architect deve deixar executáveis

- `select tablename from pg_tables where schemaname='public' and rowsecurity=false;` → **0 linhas** (A12, §17.16)
- `select relname from pg_class where relforcerowsecurity = false and relname = 'audit_log';` → 0 linhas
- Tentativa de `UPDATE`/`DELETE`/`TRUNCATE` em `audit_log` como `service_role` → exceção do trigger
- `UPDATE sessions SET admitted_at = now()` como `authenticated` (paciente) → erro de permissão (AC2)
- `select` de coluna de ciphertext como `authenticated` → erro de permissão (item 27)
- Verificação da cadeia de hash entre duas âncoras → função dedicada (AM1)

---

## 5. Próximo passo

1. **Architect** aplica as 8 correções da seção 3.1 (uma rodada, todas de especificação).
2. **Security Review** confirma as correções — verificação pontual, não novo review completo.
3. **Data Architect** com a seção 4 como entrada obrigatória, junto com a §17 corrigida.
4. **Security Review do schema** (3º momento obrigatório).

As ressalvas da seção 3.2 seguem para o Backlog como requisitos de implementação, e as pendências da 3.3 para o dev/cliente.

---

## 6. Re-verificacao (rodada 2)

**Data:** 2026-09-09
**Entrada:** `docs/talitha-architecture.md` v1.1, `docs/adr/ADR-0001-*.md`, `ADR-0002-*.md`, `ADR-0006-*.md`, `CLAUDE.md` (6 regras novas)
**Criterio:** o mesmo da rodada 1 -- mencionar o requisito nao e fecha-lo; fechado e quando existe mecanismo que **impede** a implementacao insegura.

### 6.1 Tabela das 8 correcoes

| # | Correcao | Veredicto | Evidencia |
|---|----------|-----------|-----------|
| 1 | **AC1 -- `create-charge` especificada** | **Fechada** | Secao 8.1 (9 pre-condicoes): `verify_jwt=true`; pre-cond. 2 exige `role = psychologist` verificado no banco; pre-cond. 3 aceita **apenas** `charge_id` (zod); pre-cond. 4 carrega o registro e **verifica `charges.psychologist_id == uid`** (fecha o IDOR); pre-cond. 5 deriva paciente/valor do banco. Estrutura secao 2 inclui `create-charge/` e `retry-charges/`. Tabela secao 12.1 lista `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`. ADR-0006 documenta o fluxo `charge_id`-only e registra a alternativa descartada com cenario de falha. |
| 2 | **AC2 -- RLS nao e column-level / RPCs** | **Fechada** | Secao 4.4 nova: declara a invariante. Secao 6.1 especifica 3 RPCs (`enter_waiting_room`, `admit_patient`, `cancel_session`). Secao 8.2 e secao 17.6 confirmam: `enter_waiting_room` escreve **so** `waiting_since` e valida ownership por `auth.uid()`; `admit_patient` escreve **so** `admitted_at` e exige `role = psychologist` no banco. `REVOKE UPDATE ON sessions FROM authenticated, anon` declarado na secao 17.6. ADR-0002 reescrito com a alternativa descartada "UPDATE direto (v1.0)" e referencia a AC2. Nenhum UPDATE/INSERT direto do client permanece em `charges` (Server Action + Edge Function), `clinical_records` (secao 17.28 nenhuma policy de patient), `consents` (append-only), `profiles` (UPDATE de `role` proibido por RLS, secao 17.13). |
| 3 | **AA1/AA2 -- wrappers e middleware nao e fronteira** | **Fechada** | Secao 7.1 abre com "O middleware e UX + defense-in-depth. NAO e a fronteira de autorizacao." Fail-closed: "try { getUser() } catch { Redirect /login } -- fail-closed em QUALQUER erro" (secao 7.1 passo 2). Secao 7.2 tabela de 5 camadas de defesa. Secao 5.1 mostra `withPsychologist` com `getUser()` + role no banco + `aal2`. `_guard.ts` na estrutura secao 2. Secao 16.20-21 codifica como regras. Secao 14.2 `allowedOrigins`. ADR-0006 declara Server Actions como endpoints HTTP publicos e o wrapper como obrigatorio. CLAUDE.md regra correspondente presente. |
| 4 | **AA3 -- aal2 e recuperacao de senha** | **Fechada** | Secao 7.1.6a: "aal < aal2? Redirect /mfa/verify (verifica NIVEL DE GARANTIA, nao enrollment)". Secao 7.3: sessao `aal1` nao passa, mesmo com TOTP cadastrado; recuperacao de senha exige MFA challenge antes de efetivar e revoga outras sessoes. Secao 5.1 wrapper: `getAuthenticatorAssuranceLevel()` com check `aal2`. Secao 7.2 camada 5: `(auth.jwt()->>'aal') = 'aal2'` em policies clinicas. Secao 17.13 e secao 17.28 incluem clausula `aal2`. Secao 16.22 codifica como regra. CLAUDE.md regra correspondente presente. |
| 5 | **AA4 -- validacao de chaves no boot e AAD** | **Fechada** | Secao 9.1 `loadKey()`: verifica presenca, base64, exatamente 32 bytes, `delete process.env[envName]` apos carregar; lancamento na inicializacao. Comentarios explicitamente proibem `!`. Secao 5.1 corrigido: `const patientId = crypto.randomUUID()` **antes** de `encryptField(parsed.cpf, patientId, 'cpf')` -- AAD usa UUID real. Secao 9.3 blind-index importa de `keys.ts`, nao de `process.env`. Secao 13 inclui teste `keys.test.ts`. |
| 6 | **AA5/AA6/AA7 -- cache, Dockerfile, supply chain** | **Fechada** | Cache: secao 3 acrescenta `force-dynamic` + `fetchCache='force-no-store'` nas rotas de paciente; secao 7.4 `Cache-Control: private, no-store` para rotas que decifram; secao 16.17 regra. Dockerfile secao 14.1: `npm ci --ignore-scripts` (l.626); somente `NEXT_PUBLIC_*` como ARG (l.636-643); nenhum segredo; stage 3 so runtime. Secao 14.3 checklist: `docker history` sem segredo, `npm audit --audit-level=high`. Secao 12.2.6 regra explicita. Secao 16.19 regra. CLAUDE.md regras correspondentes presentes. |
| 7 | **AA11 -- rascunho como conteudo clinico cifrado** | **Fechada** | Secao 9.2 inclui `session_note_drafts` com AAD `patient_id\|session_id`. Descricao: auto-save por Server Action `runtime='nodejs'`, RLS so psicologa, DELETE com evolucao definitiva, job de limpeza 7 dias. Secao 17.1 inclui colunas de envelope. Secao 17.23 especificacao completa. Secao 16.16 proibe `localStorage`/`sessionStorage`/IndexedDB para campo clinico. CLAUDE.md regra correspondente presente. |
| 8 | **AA12/A1/M12 -- risco residual e checklist** | **Fechada** | ADR-0001 secao "Risco residual" (l.48-57): declara que a separacao nao protege contra comprometimento do host/EasyPanel; lista cenarios e controles operacionais. Checklist secao 14.3 (l.680-699): 20 itens, incluindo custodia KEK com teste de restauracao (l.695), plano de incidente (l.696), 2FA EasyPanel (l.697), Redirect URLs (l.692), `npm audit` (l.693), `docker history` (l.684), verificacao das 3 chaves (l.686), versao do Next.js (l.699). |

**Placar: 8 Fechadas / 0 Parciais / 0 Nao fechadas.**

### 6.2 Cobertura da secao 17 (32 requisitos) contra a secao 4

#### 6.2.1 Correcoes da secao 4.1 na secao 17

| Correcao 4.1 | Item secao 17 | Status |
|---|---|---|
| Secao 17.5 -- trigger de remarcacao em `room_name` | Secao 17.5 (l.761): trigger que regenera `room_name` e zera `waiting_since`/`admitted_at` quando `scheduled_at` muda | Coberto |
| Secao 17.6 -- REVOKE UPDATE, RPCs | Secao 17.6 (l.762): `REVOKE UPDATE ON sessions FROM authenticated, anon`; ambas RPCs especificadas com assinatura estreita | Coberto |
| Secao 17.7 -- sem payload bruto | Secao 17.7 (l.763): "Sem payload bruto -- colunas de allowlist apenas; CPF e nome completo proibidos" | Coberto |
| Secao 17.11 -- sem guardian, preferencias, timestamptz | Secao 17.11 (l.767): "Sem subject_type = guardian"; preferencia de comunicacao; timestamptz UTC | Coberto |
| Secao 17.13 -- profiles.role canonico | Secao 17.13 (l.769): "fonte canonica"; trigger espelha para `app_metadata`; RLS proibe UPDATE de `role`; clausula `aal2` | Coberto |
| Secao 17.14 -- retencao fixa 5 anos + CHECK idade | Secao 17.14 (l.770): retencao fixa; secao 17.18 (l.777): CHECK >= 18 | Coberto |
| Global -- timestamptz UTC | Secao 17.14 (l.770): "Todos os campos com valor probatorio em timestamptz UTC" | Coberto |

**7/7 cobertos.**

#### 6.2.2 Requisitos adicionais da secao 4.2 na secao 17

| Req. 4.2 | Item secao 17 | Status |
|---|---|---|
| 18. CHECK idade no banco | Secao 17.18 (l.777) | Coberto -- texto identico |
| 19. Tabela `email_action_tokens` | Secao 17.19 (l.778) | Coberto -- colunas, hash, `used_at` transacional, TTL, RLS so RPC |
| 20. Eliminacao seletiva por categoria | Secao 17.20 (l.779) | Coberto -- categorias eliminaveis vs. congelaveis |
| 21. `data_subject_requests` | Secao 17.21 (l.780) | Coberto -- colunas, `decision`, `legal_basis`, resposta fundamentada |
| 22. Preferencia de comunicacao | Secao 17.22 (l.781) | Coberto |
| 23. `session_note_drafts` | Secao 17.23 (l.782) | Coberto -- envelope, AAD, RLS, DELETE, job |
| 24. `log_audit_system` | Secao 17.24 (l.783) + secao 17.4 (l.760) | Coberto -- REVOKE EXECUTE, enum `actor_source` |
| 25. Serializacao hash chain | Secao 17.25 (l.784) | Coberto -- `pg_advisory_xact_lock` |
| 26. Caminho assincrono audit log | Secao 17.26 (l.785) | Coberto -- outbox ou sincrono |
| 27. REVOKE SELECT colunas cifradas | Secao 17.27 (l.786) | Coberto -- todas as tabelas listadas |
| 28. RLS `clinical_records`/`anamnesis` -- proibicao | Secao 17.28 (l.787) | Coberto -- nenhum SELECT ao patient; `anamnesis` sem ciphertext; `aal2` |
| 29. `aal2` nas policies clinicas | Secao 17.13 (l.769) + secao 17.28 (l.787) | Coberto -- clausula declarada em ambos |
| 30. `profiles` (tabela) | Secao 17.13 (l.769) | Coberto -- colunas, trigger, RLS |
| 31. `CRON_SECRET` no Vault | Secao 17.30 (l.789) | Coberto -- `vault.decrypted_secrets`, `timingSafeEqual` |
| 32. Idempotencia lembretes/regua | Secao 17.29 (l.788) | Coberto -- constraints UNIQUE como constraints de banco |

**15/15 cobertos.**

#### 6.2.3 Verificacoes da secao 4.3 na secao 17

| Verificacao 4.3 | Secao 17 | Status |
|---|---|---|
| `rowsecurity=false` -> 0 linhas | Secao 17.32 (l.791) | Coberto |
| `relforcerowsecurity=false` para `audit_log` -> 0 | Secao 17.32 (l.791) | Coberto |
| UPDATE/DELETE/TRUNCATE em `audit_log` -> excecao | Secao 17.32 (l.791) | Coberto |
| UPDATE `sessions` como paciente -> erro | Secao 17.32 (l.791) | Coberto |
| SELECT ciphertext como `authenticated` -> erro | Secao 17.32 (l.791) | Coberto |
| Verificacao do hash chain -> funcao dedicada | Secao 17.32 (l.791) | Coberto |

**6/6 cobertos.**

**Conclusao da cobertura:** a secao 17 com 32 requisitos cobre 100% da secao 4 deste review (7 correcoes + 15 adicionais + 6 verificacoes). Nenhum requisito de seguranca ficou fora do handoff. Adicionalmente, a secao 17 inclui 2 itens extras nao pedidos pela secao 4: secao 17.31 (tabela `charges` com `pending_creation` e `psychologist_id`, para AC1) e secao 17.32 (verificacoes executaveis).

### 6.3 Regras novas do CLAUDE.md

6 regras adicionadas. Avaliacao de clareza e sobrevivencia a sessao futura sem este contexto:

| Regra | Conteudo | Avaliacao |
|---|---|---|
| RLS nao e column-level | Transicoes por RPC SECURITY DEFINER, nunca UPDATE direto | Clara, acionavel, auto-contida |
| Toda Server Action usa wrapper | withPsychologist/withPatient/withPublicAction; middleware NAO e fronteira | Clara, acionavel; cita os nomes dos wrappers |
| MFA e aal2, nao enrollment | Sessao so-senha nao passa; recuperacao exige MFA | Clara, distingue os dois conceitos, acionavel |
| Nenhum segredo como ARG/ENV no Dockerfile | Segredos so como env de runtime (EasyPanel) | Clara, acionavel |
| Proibido localStorage para campo clinico | Inclui rascunho de anotacoes | Clara, cita o caso especifico mais provavel |
| Plaintext clinico nunca em cache do Next.js | `force-dynamic` + `no-store` em toda rota que decifra | Clara, acionavel, prescreve o mecanismo |

**Avaliacao: as 6 regras sao especificas, acionaveis e auto-contidas. Uma sessao futura sem o contexto deste review as respeita.**

### 6.4 Regressoes

A v1.1 usa extensivamente a notacao "(Identico a v1.0)" para secoes nao alteradas. Isso significa que o documento e um diff sobre a v1.0, nao um documento autonomo. Nao e uma regressao de seguranca -- o conteudo nao foi perdido -- mas e uma fragilidade documental: se a v1.0 for removida do historico, secoes como 4.1-4.3, 9.4-9.6, 11.1-11.3 e 13.1-13.2 ficam sem corpo.

**Regressoes de seguranca: nenhuma identificada.** Nenhum mecanismo da v1.0 foi removido ou enfraquecido. A reescrita foi estritamente aditiva. As correcoes nao alteraram decisoes de arquitetura existentes (envelope encryption, audit log, LiveKit fora do Supabase, webhook com re-consulta) -- apenas acrescentaram os mecanismos de enforcement que faltavam.

Itens que estavam ausentes na v1.0 e continuam ausentes na v1.1 (nao sao regressoes -- ja catalogados como AM/AB e agora cobertos na secao 18 como requisitos de implementacao ao Stack Agent):
- Rate limiting (M1): secao 18.7
- Mensagens genericas de login (B7): secao 11.5
- Politica de senha (M5): secao 18.8
- Alteracao de email (M9): secao 18.9

### 6.5 Issues novos

Nenhum issue novo de severidade Critica ou Alta identificado nesta rodada.

**Observacao informacional:** o documento v1.1 e um diff, nao documento completo. Recomenda-se que, ao longo do desenvolvimento, secoes marcadas "(Identico a v1.0)" sejam inline-adas no documento principal para que a v1.1 seja auto-contida. Nao e bloqueante.

### 6.6 Veredicto final

## APROVADA

As 8 correcoes exigidas na rodada 1 foram todas fechadas com mecanismos concretos, nao com prosa:

- **AC1 (Critico):** `create-charge` agora tem 9 pre-condicoes, verifica ownership (`psychologist_id == uid`), aceita apenas `charge_id`, e esta na estrutura de pastas, na tabela de segredos e no ADR-0006. O IDOR esta fechado.
- **AC2 (Critico):** `REVOKE UPDATE ON sessions`, RPCs de assinatura estreita com ownership e role check, invariante documentada na secao 4.4. O auto-admissao/tampering esta fechado.
- **AA1-AA12 (Altos):** todos com mecanismo implementavel, codificados em regras da secao 16, requisitos da secao 17 e secao 18, e regras do CLAUDE.md.

A secao 17 (32 requisitos) cobre 100% dos requisitos da secao 4 deste review. O Data Architect recebe um handoff completo e verificavel, sem lacunas entre a prosa do documento e o que o handoff exige.

**O Data Architect esta liberado para comecar.**


---

## Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Security Review da arquitetura: matriz de absorção dos 42 issues do review do PRD (26 absorvidos / 11 parciais / 5 não absorvidos), 36 issues novos (2🔴 / 12🟠 / 15🟡 / 7🟢), veredicto de reprovação com 8 correções pontuais ao Architect, 12 ressalvas ao Stack Agent, 5 pendências humanas novas, 15 requisitos adicionais + 7 correções ao handoff do Data Architect |
| 1.1 | 2026-09-09 | Re-verificacao (rodada 2): 8/8 correcoes fechadas, secao 17 cobre 100% da secao 4, nenhuma regressao, nenhum issue novo. Veredicto: APROVADA. Data Architect liberado |

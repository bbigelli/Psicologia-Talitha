# Security Review — PRD: Talitha Psicologia

**Modo:** Security Review (planejamento — pós-PO)
**Versão:** 1.0
**Data:** 2026-09-09
**Documentos revisados:** `docs/talitha-prd.md`, `docs/talitha-user-stories.md` (36 stories), `docs/decisions.md`
**Stack modelada:** Next.js 16 (App Router, TS strict) · Supabase (Auth, Postgres/RLS, Edge Functions, Storage) · LiveKit Cloud · Asaas · e-mail transacional · EasyPanel
**Destinatários:** System Architect, Data Architect, Stack Agent (nextjs-agent), Backlog Agent

---

## Resumo executivo

O PRD é maduro em compliance para um documento de produto — reconhece CFP 11/2018, LGPD art. 5º II e art. 11, retenção 5/20 anos, audit log e criptografia. O problema não é ausência de intenção, é **ausência de mecanismo**: as exigências estão declaradas como propriedades desejadas ("log imutável", "criptografado em repouso", "paciente A nunca vê paciente B") sem a especificação técnica que as torna verdadeiras. Declaração sem mecanismo produz sistema que *parece* conforme.

Este sistema trata dado pessoal sensível de saúde mental. O modelo de ameaça é assimétrico: a psicóloga tem **uma única conta** que dá acesso a **todos** os prontuários, e o produto expõe **um endpoint público sem autenticação** (webhook Asaas) e **credenciais de mídia em tempo real** (token LiveKit) na internet. Um vazamento aqui não é incidente de TI — é dano irreparável ao titular e responsabilidade da psicóloga junto ao CRP.

Foram identificados **4 issues Críticos, 16 Altos, 14 Médios e 8 Baixos** (42 no total). Nenhum é bug (não há código) — todos são lacunas de especificação que, se não fechadas antes da implementação, produzem vulnerabilidade explorável. Os quatro Críticos **bloqueiam o System Architect**: sem decisão sobre eles, a arquitetura será construída sobre premissa errada e o retrabalho será estrutural.

**Veredicto:** Review concluído. Requisitos documentados abaixo são de implementação obrigatória. Os 4 Críticos e os 16 Altos devem ser absorvidos pelo `architecture.md` e pelo `data-architecture.md` — não são "recomendações", são pré-condições de conformidade legal.

---

## 1. Classificação de dados

Classificação estendida com a categoria **Sensível-LGPD** (art. 5º, II), que não existe no catálogo padrão e é a categoria dominante deste produto.

| # | Categoria de dado | Exemplos concretos no produto | Classificação | Base legal do tratamento | Requisito de proteção |
|---|---|---|---|---|---|
| D1 | Evolução clínica | Texto de evolução por sessão, humor/estado geral, anotações de sessão (US-205, US-401) | **Sensível-LGPD** | Consentimento específico e destacado (art. 11, I); após revogação: obrigação regulatória CFP (art. 11, II, "a") | Criptografia application-level AES-256-GCM; chave fora do Supabase; nunca no client; audit log em toda operação; nunca em log/e-mail/Asaas/LiveKit |
| D2 | Anamnese | Motivo da busca, tratamento anterior, medicação psicoativa, condições de saúde (US-402) | **Sensível-LGPD** | idem D1 | idem D1. Campo `medicação` e `condições de saúde` são dado de saúde stricto sensu |
| D3 | Existência do vínculo terapêutico | O fato de que a pessoa X é paciente de psicoterapia; data/hora de sessão | **Sensível-LGPD** (inferência direta de condição psicológica) | idem D1 | Não pode aparecer em assunto de e-mail, remetente, descrição de cobrança, nome de arquivo, URL, `identity` do LiveKit, log de terceiro |
| D4 | Contato de emergência (dado de terceiro) | Nome, telefone, parentesco de terceiro informado na anamnese (US-402) | Confidencial | Legítimo interesse do controlador para proteção da vida (art. 7º, VII / art. 11, II, "e") — **não** consentimento do terceiro | Criptografar junto com a anamnese; não usar para nenhuma outra finalidade; não enviar comunicação de marketing/lembrete a esse contato |
| D5 | CPF do paciente e do responsável legal | Cadastro (US-002), customer Asaas (US-102), recibo IRPF (US-406) | Confidencial | Execução de contrato + obrigação fiscal (art. 7º, V e II) | Criptografado em repouso; unicidade via blind index HMAC com chave (nunca SHA-256 puro); mascarado em toda UI e log; enviado ao Asaas apenas no mínimo necessário |
| D6 | Identificação e contato | Nome, e-mail, telefone, data de nascimento, `is_minor` | Interno | Execução de contrato (art. 7º, V) | RLS; nunca em URL/query string; e-mail nunca revela D3 |
| D7 | Dados do responsável legal | Nome, CPF, e-mail, telefone, parentesco | Confidencial | Execução de contrato + representação legal (art. 14) | idem D5/D6; base do consentimento de menor (ver C1) |
| D8 | Credenciais de acesso | Senha, refresh token, cookies de sessão | Confidencial | — | Supabase Auth (bcrypt); cookies `HttpOnly`/`Secure`/`SameSite=Lax`; `getUser()` server-side, nunca `getSession()`; MFA TOTP obrigatório para a psicóloga (A15) |
| D9 | Registro de consentimento | Versão, hash do texto, timestamp UTC, IP, user-agent, forma de coleta (US-004/005) | Confidencial | Prova de conformidade (art. 37) | Append-only imutável; retido junto com o prontuário; IP é dado pessoal e sua coleta deve constar no próprio texto do consentimento |
| D10 | Audit log | `user_id`, `patient_id`, ação, timestamp, IP, UA (US-405) | Confidencial | Obrigação legal (art. 37, art. 46) e prova em processo ético | Append-only real (4 camadas — ver seção 4); nunca contém D1/D2; retenção = retenção do prontuário |
| D11 | Dados financeiros | Valor, status, vencimento, `asaas_payment_id`, `asaas_customer_id`, recibo numerado | Interno / Confidencial (o recibo agrega D3+D5) | Execução de contrato + obrigação fiscal 5 anos | RLS; recibo acessado por UUID nunca por número sequencial; PDF não público; descrição de cobrança neutra |
| D12 | Metadados de sessão de vídeo | `room_name`, `admitted_at`, duração, qualidade de conexão | **Sensível-LGPD** (é D3 materializado) | idem D1 | `room_name` aleatório 128 bits, único por sessão, nunca reutilizado; `identity` do LiveKit = `auth.uid()`, nunca nome/e-mail |
| D13 | Conteúdo de mídia (áudio/vídeo) | Stream WebRTC da sessão | **Sensível-LGPD** | idem D1 | **Não persistido** (gravação fora do MVP — decisão registrada). DTLS-SRTP do WebRTC é obrigatório. Nenhum artefato em Storage |
| D14 | Segredos de integração | Asaas API key, webhook token, LiveKit key/secret, `SERVICE_ROLE_KEY`, chave de criptografia, API key de e-mail | **Restrito** | — | Ver inventário na seção 7. Nenhum com prefixo `NEXT_PUBLIC_` |
| D15 | Credenciais profissionais da psicóloga | CRP, status e-Psi, especialidade | Público (por exigência CFP 11/2018) | Obrigação regulatória | Exibição ao paciente é requisito, não risco |
| D16 | CPF/dados pessoais da psicóloga | CPF (recibo), telefone, e-mail profissional | Confidencial | Obrigação fiscal | Não exibir CPF publicamente (US-001 já acerta); aparece apenas no recibo |

**Consequência estrutural:** as categorias D1, D2, D3, D12 e D13 fazem deste produto um sistema de dados de saúde. Isso significa que **a existência de um registro já é o dado sensível** — não basta proteger o conteúdo da evolução se o assunto do e-mail, o extrato bancário ou o log do LiveKit revelam que a pessoa faz terapia. Metade dos issues Altos deste review decorre disso.

---

## 2. Threat model STRIDE por superfície

### 2.1 Superfície: Autenticação e onboarding (Supabase Auth, convite, termos)

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Atacante usa link de convite interceptado (e-mail em backup/breach) e cria a senha antes do paciente legítimo | Convite: token de 256 bits, **hash** armazenado no banco (nunca em claro), uso único, TTL 72h (US-003 já define), invalidado ao primeiro uso. Reenvio invalida o anterior. Após criação de senha, e-mail de notificação "sua conta foi ativada" ao mesmo endereço |
| **S**poofing | Phishing em nome da psicóloga pedindo pagamento (domínio sem proteção anti-spoof) | SPF + DKIM + DMARC `p=reject` no domínio de envio (A6). Sem DMARC qualquer um envia como a psicóloga |
| **T**ampering | Cliente envia `role: "psychologist"` no signup / auto-atribuição de role | Role **nunca** vem do client nem de `user_metadata` (editável pelo usuário via API). Role vive em `app_metadata` (só service_role escreve) ou em tabela `profiles.role` com RLS que proíbe UPDATE da coluna. Bootstrap da psicóloga por seed/migration, não por auto-cadastro (A16) |
| **R**epudiation | "Eu nunca aceitei esse termo" | `consents` append-only com versão + **hash SHA-256 do texto exato exibido** + timestamp UTC + IP + UA (A4/D9) |
| **I**nformation Disclosure | Enumeração de pacientes: mensagem de erro distingue "e-mail já existe" | US-002 expõe "Já existe um paciente cadastrado com este e-mail/CPF" — aceitável porque **só a psicóloga autenticada vê**. Em fluxo público (login, reset), mensagem genérica sempre. US-003 já acerta no convite expirado ("sem expor dados do paciente") |
| **D**enial of Service | Brute force de senha; flood de reenvio de convite | Supabase Auth rate limits habilitados no Dashboard (Auth → Rate Limits) — verificar, não assumir. Rate limit próprio no reenvio de convite (máx 3/paciente/hora) |
| **E**levation of Privilege | Conta da psicóloga comprometida = **todos** os prontuários | **MFA TOTP obrigatório** na conta `psychologist` (A15). Único controle proporcional ao valor do alvo. Senha forte + verificação contra base de senhas vazadas |

### 2.2 Superfície: Portal do paciente

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Sessão do paciente reutilizada em dispositivo compartilhado (celular de família) | Cookies `HttpOnly`/`Secure`/`SameSite=Lax`; logout revoga no servidor; timeout de inatividade (M4); sem "manter conectado" indefinido |
| **T**ampering | Request envia `patient_id` de outro paciente para ler sessões/pagamentos/recibos | **Nenhuma função server aceita `patient_id`, `psychologist_id` ou `role` como parâmetro.** Sempre `getUser()` → resolver `patients.user_id = auth.uid()` (A12) |
| **R**epudiation | Paciente nega ter cancelado sessão fora do prazo (impacto financeiro) | Audit log de ações do paciente: `CANCEL_SESSION`, `RESCHEDULE`, `CONFIRM_ATTENDANCE`, `REVOKE_CONSENT` com IP/UA |
| **I**nformation Disclosure | IDOR clássico: `/recibos/002-2026` serve o PDF de outro paciente | Rota por UUID, nunca por número sequencial (A8). Número é *conteúdo* do documento. Bucket privado ou geração on-demand |
| **I**nformation Disclosure | Canal Realtime da sala de espera entrega nome de outro paciente | Paciente **não** assina canal de fila. Faz polling do próprio registro (`sessions.admitted_at`) sob RLS (A10) |
| **D**enial of Service | Paciente automatiza solicitações LGPD / cancelamentos para saturar a psicóloga | Rate limit por usuário; US-408 já bloqueia solicitação duplicada pendente |
| **E**levation of Privilege | Paciente acessa rota da psicóloga (`/dashboard`, `/pacientes`) | Middleware Next.js com `getUser()` + checagem de role server-side **e** RLS no banco. Duas camadas — a UI não é controle de acesso |

### 2.3 Superfície: Sala de vídeo (LiveKit + sala de espera)

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Paciente A obtém token para o room da sessão de B → assiste/participa de psicoterapia alheia. **Pior cenário do produto** | Emissão server-side com as 8 pré-condições da seção 5. Grant restrito a `room: <room_name da própria sessão>`. LiveKit rejeita token de outro room |
| **S**poofing | Token vazado (log, histórico do browser, screenshot de DevTools) reutilizado | TTL de 15 min; token só em memória (nunca `localStorage`/`sessionStorage`/URL); `deleteRoom` ao encerrar |
| **T**ampering | Client envia `roomName` e o backend confia | **O client nunca envia `roomName`.** Envia apenas `session_id`; o servidor resolve `session_id → room_name`. `roomName` nunca é calculável pelo client |
| **T**ampering | Paciente publica mídia antes de ser admitido | Nenhum token é emitido antes de `admitted_at IS NOT NULL`. Sala de espera é estado no Postgres, não room do LiveKit (decisão da seção 5) |
| **R**epudiation | Não há registro de quem entrou em qual sessão | Audit log em `ISSUE_ROOM_TOKEN` **e** em `DENY_ROOM_TOKEN` com motivo (A13). Negativa é o sinal de intrusão mais importante do sistema |
| **I**nformation Disclosure | `identity`/`metadata` do LiveKit com nome completo, e-mail ou CPF vazam para o LiveKit Cloud e para o outro participante | `identity = auth.uid()`. `name` = primeiro nome apenas. `metadata` vazio ou `{"role":"patient"}`. Nunca D1/D2/D5 |
| **I**nformation Disclosure | `room_name` derivado de dado enumerável ou de PII (ex: `talitha-maria-2026-09-09-14h`) | `room_name` = 128 bits aleatórios (`'s_' || encode(gen_random_bytes(16),'hex')`), único por sessão, gerado no servidor |
| **D**enial of Service | Enumeração/flood no endpoint de emissão de token; consumo malicioso do free tier LiveKit (5.000 min/mês) | Rate limit 10 tokens/usuário/min; janela temporal de ±15/+30 min sobre o horário agendado; `deleteRoom` server-side ao encerrar e TTL máximo de room (2h) |
| **E**levation of Privilege | Token do paciente com `roomAdmin`/`roomCreate` permite expulsar/mutar a psicóloga ou criar rooms | Grants explícitos e mínimos (seção 5). Ações administrativas via `RoomServiceClient` server-side, nunca por grant no token do browser |

### 2.4 Superfície: Webhook de pagamento (Edge Function pública)

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Terceiro descobre a URL e envia `PAYMENT_RECEIVED` falso → cobrança marcada como paga, recibo fiscal emitido sem pagamento | `asaas-access-token` validado com comparação **time-safe** contra segredo de ≥32 bytes, **antes** de qualquer parsing de body ou query. Rejeitar 401 |
| **T**ampering | Payload legítimo capturado e reenviado com valor alterado | Asaas não assina o corpo (só token estático) → **não confiar no payload como fonte de verdade de valor.** Ao receber evento relevante, re-consultar `GET /v3/payments/{id}` na API do Asaas com a API key e usar a resposta autoritativa. Custa 1 request e elimina a classe inteira |
| **T**ampering / Replay | Token estático torna qualquer request capturado replayável para sempre | Idempotência por `asaas_event_id` (seção 6) + janela de frescor de 7 dias sobre `dateCreated` (rejeitar mais antigo com **200** + log, para não travar a fila do Asaas) + TLS obrigatório |
| **R**epudiation | Conciliação divergente sem trilha | `payment_webhook_events` guarda payload **sanitizado** (sem CPF), `received_at`, `processed_at`, resultado |
| **I**nformation Disclosure | `console.log(payload)` na Edge Function → CPF, nome e valor nos logs do Supabase Dashboard | Logar apenas `event`, `payment.id`, `status`. Nunca payload completo. Nunca CPF |
| **I**nformation Disclosure | Erro do Asaas repassado literalmente ao client (US-102 prevê `[mensagem do Asaas]`) | Mensagem genérica ao usuário; detalhe apenas no log server-side (M7) |
| **D**enial of Service | Endpoint público sem auth de plataforma; flood com bodies grandes | `verify_jwt = false` é **necessário** aqui — logo o token é a única barreira. Limitar body a 64 KB; rejeitar antes de parsear; nenhum trabalho caro inline (PDF de recibo é gerado on-demand, não no webhook) — também atende o SLA de <2s do Asaas |
| **E**levation of Privilege | Edge Function usa `SERVICE_ROLE_KEY` e escreve em qualquer tabela; um bug de validação vira escrita arbitrária | Escopo mínimo: a função escreve apenas em `payment_webhook_events`, `charges`, `receipts`, `sessions.payment_status`. Preferir uma função `SECURITY DEFINER` no Postgres com assinatura estreita em vez de queries livres com service_role |

### 2.5 Superfície: Prontuário (evolução, anamnese, histórico)

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Sessão da psicóloga sequestrada = leitura de todos os prontuários | MFA TOTP (A15); reautenticação para ações sensíveis (eliminação após retenção, revogação) |
| **T**ampering | Evolução alterada retroativamente para encobrir conduta | Audit log `UPDATE_RECORD` **na mesma transação** da escrita (A14) + versionamento: manter versão anterior em `clinical_record_versions` (append-only). Prontuário é documento com valor probatório em processo ético |
| **T**ampering | XSS armazenado: texto de evolução renderizado como HTML executa na sessão da psicóloga (que acessa tudo) | Proibir `dangerouslySetInnerHTML` no render de qualquer campo de prontuário/anamnese. JSX escapa por padrão — a regra existe para impedir a "melhoria" futura de rich text (M14) |
| **R**epudiation | Acesso a prontuário sem rastro | Audit log em `VIEW_RECORD` (assíncrono com retry aceitável) e em `CREATE/UPDATE/DELETE_RECORD` (síncrono e bloqueante) |
| **I**nformation Disclosure | Dump do banco / `SERVICE_ROLE_KEY` vazada / backup exposto / insider do provedor lê evolução em claro | Criptografia application-level com KEK **fora do Supabase** (seção 3). Esta é a decisão que separa "conforme" de "teatro de conformidade" |
| **I**nformation Disclosure | Busca no histórico (US-403) exige índice sobre plaintext | Sem índice em plaintext. Decrypt-then-filter server-side com paginação — volume real (20-30 pacientes, dezenas de evoluções) suporta. Blind index por token é pós-MVP e vaza padrões |
| **I**nformation Disclosure | Rascunho de anotações da sessão salvo em `localStorage` (US-205/US-206 preveem "salvas localmente") deixa conteúdo clínico em disco de dispositivo possivelmente compartilhado | Auto-save server-side (a cada 5s, já previsto). Cache local apenas em memória; se houver persistência local, limpar ao encerrar sessão e nunca em `localStorage` (M2) |
| **D**enial of Service | Perda da chave de criptografia inutiliza prontuário sob guarda legal obrigatória | Custódia formal da chave: 2 cópias offline em locais distintos + teste de restauração documentado (A1) |
| **E**levation of Privilege | Paciente lê a própria evolução (decisão do PO: prontuário não é visível ao paciente) | RLS de `clinical_records`: **nenhuma** policy concede SELECT a role `patient`. Ausência de policy = negado |

### 2.6 Superfície: Audit log

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Entrada forjada atribuindo acesso a outro ator | Escrita exclusivamente por função `SECURITY DEFINER` que deriva `actor_id` de `auth.uid()` — nunca de parâmetro |
| **T**ampering | `SERVICE_ROLE_KEY` faz `UPDATE`/`DELETE` no log. **RLS não protege contra service_role** | Trigger `BEFORE UPDATE OR DELETE` com `RAISE EXCEPTION` + trigger `BEFORE TRUNCATE FOR EACH STATEMENT` + `REVOKE` + `FORCE ROW LEVEL SECURITY` (seção 4) |
| **T**ampering | Superuser (ou o provedor) desabilita triggers e reescreve o log | Hash chain `prev_hash`/`row_hash` calculado em trigger `BEFORE INSERT` + âncora externa semanal (último hash + contagem exportados para fora do banco). Não impede — torna **detectável** |
| **R**epudiation | Log sem IP/UA não sustenta prova | `ip`, `user_agent`, `occurred_at` (timestamptz UTC) obrigatórios |
| **I**nformation Disclosure | Log acumula conteúdo clínico por conveniência de debug | Schema sem coluna de texto livre de conteúdo. `metadata jsonb` com allowlist de chaves; proibido gravar D1/D2/D5 |
| **D**enial of Service | Falha de escrita do log bloqueia atendimento clínico | Distinção obrigatória: **leitura** → log assíncrono com retry (não bloqueia); **escrita/alteração de prontuário** → log na mesma transação (bloqueia). A17 |
| **E**levation of Privilege | Paciente lê audit log | Policy SELECT apenas para `psychologist`. Leitura do próprio log registra `VIEW_AUDIT_LOG` (recursão desejada) |

### 2.7 Superfície: Painel da psicóloga (dashboard, agenda, financeiro)

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | Único ponto de falha total do sistema | MFA TOTP obrigatório (A15) |
| **T**ampering | Valor de cobrança manipulado no client antes de ir ao Asaas | Validação server-side com zod; valor > 0; vencimento ≥ hoje (US-102 já define as regras — a exigência aqui é que sejam validadas **no server**, não só no form) |
| **T**ampering | Régua de cobrança / lembretes disparados por terceiro (cron sem autenticação) | `CRON_SECRET` validado em toda função de cron; header, não query string (M8) |
| **R**epudiation | Psicóloga nega ter cancelado cobrança/eliminado dado após retenção | Audit log de ações administrativas: `CANCEL_CHARGE`, `END_TREATMENT`, `PURGE_RECORD`, `EXPORT_DATA`, com reautenticação nas duas últimas |
| **I**nformation Disclosure | Dashboard/agenda indexados por buscador ou vazando via Referer | `X-Robots-Tag: noindex` nas áreas autenticadas + `robots.txt`; `Referrer-Policy: strict-origin-when-cross-origin` (B2/B3) |
| **D**enial of Service | Dashboard carregando 500 cobranças sem paginação | Agregação em SQL (não em JS); paginação obrigatória |
| **E**levation of Privilege | Segunda conta criada por auto-cadastro assume role `psychologist` | Bootstrap controlado: role atribuída por seed/migration; signup público **desabilitado** para role psychologist; convite é o único caminho para `patient` (A16) |

### 2.8 Superfície: E-mail transacional e jobs de cron

| STRIDE | Ameaça concreta | Mitigação obrigatória |
|---|---|---|
| **S**poofing | E-mail forjado em nome da psicóloga pedindo pagamento em outra conta | SPF + DKIM + DMARC `p=reject` (A6) |
| **S**poofing | Link "Confirmar Presença"/"Não poderei ir" (US-305) é bearer token em e-mail — qualquer um com acesso ao e-mail age como o paciente | Token 128 bits, hash no banco, uso único, expira no horário da sessão, escopo = **uma ação em uma sessão**, e **não** cria sessão autenticada de navegador (A9) |
| **T**ampering | Manipulação de parâmetros no link de confirmação (`?session_id=`) | Token opaco no path resolve para a ação; nenhum identificador de negócio no link |
| **R**epudiation | "Nunca recebi o lembrete" (disputa de no-show com impacto financeiro) | Registrar `sent_at`, provider `message_id`, status de entrega por lembrete (US-304 já prevê o indicador na agenda) |
| **I**nformation Disclosure | **Assunto "Sua sessão de terapia amanhã às 15h" na tela de bloqueio revela tratamento psicológico a qualquer pessoa próxima ao paciente** — inclusive em contexto de violência doméstica | Política de conteúdo de e-mail da seção 8. Assunto/preheader/remetente por allowlist, sem D3 |
| **I**nformation Disclosure | Nome de arquivo do PDF do recibo com nome do paciente e "psicologia" fica na pasta Downloads compartilhada | Nome neutro: `recibo-{numero}.pdf` (B5) |
| **D**enial of Service | Endpoint de cron público dispara envio em massa → reputação do domínio queimada e custo | `CRON_SECRET` + idempotência por (`session_id`, `reminder_type`) para não reenviar |
| **E**levation of Privilege | Provider de e-mail comprometido lê histórico de comunicações | Consequência direta da política de conteúdo: se o e-mail não contém D1/D2/D3, o comprometimento do provider tem impacto limitado. "Notify, don't inform" |

---

## 3. Criptografia do prontuário em repouso — decisão (US-404)

O PO encaminhou a decisão. **Ela está tomada abaixo.** O Architect implementa; não reabrir sem justificativa técnica nova.

### 3.1 Quem consegue ler o prontuário em cada cenário de comprometimento

| Cenário de comprometimento | pgcrypto (`pgp_sym_encrypt`, chave passada pela app) | Supabase Vault (`pgsodium`) | **Application-level (KEK fora do Supabase)** |
|---|---|---|---|
| Backup/dump do Postgres vaza | Ilegível — **exceto** se a chave apareceu em `pg_stat_statements` ou nos logs de query, que também estão no dump | Ilegível se a root key não veio no dump | **Ilegível** |
| `SUPABASE_SERVICE_ROLE_KEY` vaza (o segredo mais copiado de qualquer projeto) | Atacante lê ciphertext; mas pode habilitar/ler `pg_stat_statements` e capturar a chave que a app envia nas queries → **legível** | Pode ler `vault.decrypted_secrets` e chamar decrypt → **legível** | **Ilegível** — a chave nunca esteve no Supabase |
| SQL injection na aplicação | Legível (a app tem a chave) | Legível | Legível (a app tem a chave) — mitigar com client parametrizado + zod, não com escolha de cripto |
| Host da aplicação (EasyPanel) comprometido | Legível | Legível | Legível — é o único cenário onde as três empatam |
| Insider/processo do provedor de banco acessa storage | Ilegível (chave é externa) | **Legível** — root key vive no mesmo provedor | **Ilegível** |
| Logs do Postgres capturam queries | **Chave exposta em claro** | Ok | Ok |
| Erro de configuração de RLS | Ilegível (RLS não é a defesa; a chave é) | Legível se a policy permitir chamar decrypt | **Ilegível** |

Os dois cenários **mais prováveis** neste projeto — vazamento de `SERVICE_ROLE_KEY` e exposição de backup/dump — são exatamente onde `pgcrypto` e Vault colapsam e application-level resiste. Além disso, o próprio US-404 já exige "chave de criptografia NUNCA armazenada no mesmo banco de dados": `pgcrypto` com chave em `app.settings` e Vault com root key no mesmo provedor violam o espírito dessa exigência.

### 3.2 Decisão

**Criptografia application-level AES-256-GCM com envelope encryption, executada na camada server do Next.js (runtime Node), com a KEK residindo no EasyPanel — nunca no Supabase.**

- **Algoritmo:** AES-256-GCM (autenticado — detecta tampering do ciphertext; `pgp_sym_encrypt` e AES-CBC não dão isso de graça). IV de 12 bytes aleatório por operação, nunca reutilizado.
- **Envelope:** cada registro tem sua própria **DEK** (Data Encryption Key, 32 bytes aleatórios). O conteúdo é cifrado com a DEK; a DEK é cifrada ("wrapped") com a **KEK** e armazenada na própria linha.
  - **Por que envelope e não chave única direta:** (1) rotação de KEK re-cifra apenas as DEKs (poucos bytes por linha), não todo o texto clínico — resolve o critério de aceite de rotação do US-404 sem batch pesado; (2) habilita **crypto-shredding**: destruir a DEK de um registro elimina o dado de forma efetiva **inclusive nos backups e no PITR onde o ciphertext persiste**. Esse é o único mecanismo honesto de "eliminação" num Postgres gerenciado com backup — e é o que sustenta a posição da seção 9.
- **Onde a chave vive:** variável de ambiente `RECORD_ENCRYPTION_KEK_V1` (32 bytes base64) no **EasyPanel**, injetada no runtime do container Next.js. Domínio de confiança deliberadamente distinto do banco: **dado no Supabase, chave no EasyPanel.** Nunca em `supabase secrets`, nunca em tabela, nunca em `NEXT_PUBLIC_*`, nunca no repositório.
- **Onde a criptografia acontece:** Server Actions / Route Handlers do Next.js com `export const runtime = 'nodejs'`. **O Edge runtime do Next.js não expõe `node:crypto` completo** — declarar o runtime explicitamente é requisito de implementação, não detalhe. Nunca no client, nunca em Edge Function do Supabase (isso levaria a chave de volta ao domínio do banco).
- **Escopo dos campos cifrados:** conteúdo de evolução (D1), campos de anamnese (D2), contato de emergência (D4) e **CPF** (D5 — ver A7). Nome/e-mail/telefone permanecem em claro: são necessários para operação e RLS, e cifrá-los quebraria busca e unicidade sem ganho proporcional.
- **Schema (para o Data Architect):**

```sql
-- por registro cifrado
content_ciphertext  bytea    not null,
content_iv          bytea    not null,   -- 12 bytes
content_tag         bytea    not null,   -- 16 bytes (GCM auth tag)
dek_wrapped         bytea    not null,   -- DEK cifrada com a KEK
dek_iv              bytea    not null,
dek_tag             bytea    not null,
kek_version         smallint not null default 1,
-- AAD = patient_id::text || '|' || record_id::text  (impede troca de ciphertext entre pacientes)
```

- **AAD (Additional Authenticated Data):** vincular o ciphertext ao `patient_id` + `record_id`. Sem AAD, um atacante com escrita no banco move o ciphertext do paciente A para a linha do paciente B e a descriptografia funciona — mistura de prontuários com falha clínica grave. Com AAD, a verificação de tag falha.
- **Rotação:** nova env `RECORD_ENCRYPTION_KEK_V2`; job re-wrapa DEKs e incrementa `kek_version`. Manter V1 disponível até 0 registros em V1.
- **Custódia (A1, obrigatório):** procedimento escrito com 2 cópias offline da KEK em locais/custódias distintas + **teste de restauração executado e documentado antes do go-live**. Perder a KEK = perder prontuário sob guarda legal obrigatória de 5/20 anos. Este é o maior risco operacional do produto e não tem remediação técnica posterior.
- **Descartado:** `pgcrypto` (chave transita por SQL e vaza em logs/`pg_stat_statements`); Supabase Vault para conteúdo clínico (root key no mesmo provedor do dado — não satisfaz a separação exigida). **Vault permanece recomendado para armazenar segredos de terceiros** se o Architect preferir a `supabase secrets` — são usos diferentes.
- **Impacto aceito:** busca no histórico (US-403) passa a ser decrypt-then-filter server-side com paginação; sem índice, sem filtro SQL sobre conteúdo. Volume real (20-30 pacientes) suporta com folga. Blind index por token fica pós-MVP e vaza padrões de frequência — não é gratuito.

---

## 4. Audit log imutável — decisão (US-405)

Nenhuma camada isolada entrega imutabilidade. **RLS não protege contra `service_role`, e a aplicação usa `service_role`.** As 4 camadas abaixo são cumulativas e todas obrigatórias.

**Camada 1 — RLS restritivo (contra o cliente autenticado)**

```sql
alter table audit_log enable row level security;
alter table audit_log force row level security;  -- crítico: sem isto o OWNER da tabela ignora as policies

create policy audit_log_select_psychologist on audit_log
  for select to authenticated
  using (exists (select 1 from profiles p where p.user_id = auth.uid() and p.role = 'psychologist'));
-- Nenhuma policy de INSERT/UPDATE/DELETE. Ausência de policy = negado.
```

**Camada 2 — Triggers de bloqueio (contra `service_role` e contra a própria aplicação)**

```sql
create or replace function audit_log_block_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only (LGPD art. 37 / CFP): % is not permitted', tg_op;
end $$;

create trigger audit_log_no_update before update on audit_log
  for each row execute function audit_log_block_mutation();
create trigger audit_log_no_delete before delete on audit_log
  for each row execute function audit_log_block_mutation();
-- TRUNCATE NÃO dispara trigger FOR EACH ROW — precisa deste, que quase todo projeto esquece:
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_block_mutation();
```

**Camada 3 — `REVOKE` explícito (defense in depth na camada de GRANT)**

```sql
revoke update, delete, truncate on audit_log from authenticated, anon, service_role;
grant  select on audit_log to authenticated;   -- RLS filtra
-- INSERT apenas via função SECURITY DEFINER
```

**Camada 4 — Hash chain (tamper-evidence contra superuser/provedor)**

```sql
-- calculado em trigger BEFORE INSERT
prev_hash bytea,                 -- row_hash da última linha inserida
row_hash  bytea not null,        -- sha256(prev_hash || canonical_json(new_row_sem_row_hash))
```

Um superuser pode desabilitar triggers e reescrever linhas. O encadeamento não impede — torna **detectável**, e é o que permite sustentar o log como evidência em auditoria CFP/ANPD. Complemento de custo quase nulo: job semanal exporta `(último row_hash, contagem, timestamp)` para fora do banco (e-mail à psicóloga e/ou objeto em bucket privado) — âncora externa que detecta reescrita retroativa em massa.

**Escrita — função única, `SECURITY DEFINER`, `actor_id` derivado de `auth.uid()`, nunca de parâmetro:**

```sql
create or replace function log_audit(
  p_patient_id uuid, p_action text, p_target_id uuid,
  p_ip inet, p_user_agent text, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$ ... $$;
```

**Ações mínimas a registrar:** `VIEW_RECORD`, `CREATE_RECORD`, `UPDATE_RECORD`, `VIEW_ANAMNESIS`, `VIEW_AUDIT_LOG`, `ISSUE_ROOM_TOKEN`, **`DENY_ROOM_TOKEN`** (com motivo), `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE`, `ACCEPT_CONSENT`, `REVOKE_CONSENT`, `END_TREATMENT`, `PURGE_RECORD`, `EXPORT_DATA`, `LGPD_REQUEST`, `CANCEL_SESSION`, `CANCEL_CHARGE`.

**Correção obrigatória ao US-405 (A17):** a story permite que falha de log não bloqueie a operação. Isso é correto para **leitura** (bloquear consulta clínica por falha de log tem custo assistencial), e **errado para escrita**. Regra final:

| Operação | Gravação do log | Comportamento em falha |
|---|---|---|
| `VIEW_*` | assíncrona com retry | não bloqueia |
| `CREATE_*` / `UPDATE_*` / `PURGE_*` / `ISSUE_ROOM_TOKEN` / consentimentos | **mesma transação** do dado | **bloqueia** — não existe alteração de prontuário sem rastro |

**Descartado:** apenas RLS (não protege contra service_role); apenas trigger (não protege contra superuser e não dá evidência); tabela append-only sem trigger (nada impede UPDATE).

---

## 5. Token LiveKit — especificação (US-202/203/204)

**Garantia central a provar:** *paciente A jamais obtém token para a room da sessão do paciente B.*

### 5.1 Derivação e validação do `roomName`

- Coluna `sessions.room_name text unique not null default ('s_' || encode(gen_random_bytes(16),'hex'))` — **128 bits aleatórios, gerados no servidor no momento da criação da sessão**.
- **Não usar `session_id` puro** como `roomName`: embora UUID v4 não seja enumerável, o `session_id` circula em requests e logs do client e passaria a ser credencial de acesso indireta; e a rotação (remarcação) exigiria trocar a identidade da sessão.
- **Não derivar de PII nem de dado previsível** — nunca nome, data, horário, CPF, e-mail, sequencial.
- **O client nunca envia `roomName`.** Envia apenas `session_id`; o servidor resolve `session_id → room_name`. Regra absoluta.
- **Um `room_name` por sessão, nunca reutilizado.** Em recorrência semanal, cada ocorrência tem o seu — senão o token da sessão passada abre a próxima. Remarcação gera novo `room_name`.

### 5.2 Emissão — Edge Function `issue-livekit-token`

Pré-condições, **todas** verificadas server-side, na ordem, com falha → negação:

1. `Authorization: Bearer <supabase access token>` presente; `supabase.auth.getUser(jwt)` retorna `uid`. **Nunca aceitar `user_id`, `patient_id` ou `role` do body.**
2. Body contém **apenas** `session_id` (uuid, validado por zod).
3. Carregar a sessão com service_role: `id, room_name, patient_id, psychologist_id, scheduled_at, duration_minutes, status, admitted_at`.
4. **Autorização:** `uid == session.psychologist_id` (perfil host) **ou** `uid == (select user_id from patients where id = session.patient_id)` (perfil participante). Qualquer outro → negar.
5. **Janela temporal:** `now()` entre `scheduled_at - 15min` e `scheduled_at + duration + 30min`. Fora → negar. Um token não serve para a sessão de amanhã.
6. **Estado:** `status not in ('cancelled','completed','no_show')`.
7. **Gate de compliance (para `patient`):** existe aceite vigente do termo CFP **e** do consentimento LGPD nas versões atuais, e o consentimento não está revogado. US-004 exige isso — e o gate tem que estar **aqui**, não no botão da UI.
8. **Gate de admissão (para `patient`):** `session.admitted_at is not null`. **Antes da admissão nenhum token é emitido.**

**Falha em qualquer passo:** resposta **404 genérica idêntica** para "sessão não existe" e "sessão não é sua" — não criar oráculo de existência. Registrar `DENY_ROOM_TOKEN` com motivo real no audit log.

### 5.3 Grants — mínimo privilégio

| Grant | Psicóloga | Paciente | Razão |
|---|---|---|---|
| `roomJoin` | `true` | `true` | necessário |
| `room` | `<room_name da sessão>` | `<room_name da sessão>` | **exato**, nunca wildcard. LiveKit rejeita o token em qualquer outro room |
| `canPublish` | `true` | `true` (só após admissão) | mídia bidirecional |
| `canSubscribe` | `true` | `true` | idem |
| `canPublishData` | `false` | `false` | **anotações da sessão nunca trafegam por data channel** (US-205 exige que o paciente não as veja) |
| `canUpdateOwnMetadata` | `false` | `false` | evita injeção de metadata |
| `roomCreate` | `false` | `false` | room criado server-side |
| `roomAdmin` | `false` | `false` | kick/mute via `RoomServiceClient` server-side; sem privilégio administrativo em token de browser |
| `roomRecord` / `recorder` | `false` | `false` | gravação fora do MVP |
| `hidden` | `false` | `false` | — |
| `identity` | `auth.uid()` | `auth.uid()` | `identity` é visível ao outro participante e vai para os logs do LiveKit Cloud — **nunca PII** |
| `name` | primeiro nome | primeiro nome | mínimo necessário para reconhecimento mútuo |
| `metadata` | `{"role":"psychologist"}` | `{"role":"patient"}` | nunca D1/D2/D5 |

### 5.4 Lifetime, refresh e revogação

- **TTL = 15 minutos.** O TTL do LiveKit governa o momento do *join*; após conectado, a sessão persiste independentemente. Logo TTL curto é exatamente a proteção correta: um token vazado tem janela de 15 min.
- **Armazenamento no client:** apenas em memória (estado do React). **Nunca** `localStorage`, `sessionStorage`, cookie, URL ou query string. Descartar ao desmontar.
- **Refresh:** não há refresh de token LiveKit. Reconexão automática (US-206, ≤30s) reutiliza a conexão existente. Em "Tentar Novamente" após timeout, o client **solicita novo token** e a Edge Function revalida as 8 pré-condições — inclusive se a sessão foi encerrada nesse intervalo.
- **Revogação:** LiveKit não revoga JWT emitido. Ao "Encerrar Sessão", a Edge Function chama `RoomServiceClient.deleteRoom(room_name)` **server-side** — não confiar no client desconectar. Isso encerra o acesso de fato, evita room esquecido aberto (US-204 cita 2h) e protege o free tier. Job de limpeza: `deleteRoom` em rooms com idade > 2h.
- **Rate limit:** máx 10 emissões por usuário/minuto. Enumeração de UUID v4 é impraticável, mas o limite contém abuso de custo e alimenta detecção.

### 5.5 Sala de espera — como validar "paciente A nunca vê paciente B"

**Decisão: a sala de espera não é um room do LiveKit.** É estado no Postgres (`sessions.waiting_since`, `sessions.admitted_at`). Isso atende o requisito não-funcional do US-202 ("sala de espera não consome minutos do LiveKit") e, mais importante, **elimina a existência de credencial de mídia antes da admissão**.

Controles que, combinados, provam o isolamento:

1. Não existe entidade "sala de espera compartilhada" — não há objeto que possa listar dois pacientes.
2. RLS em `sessions`: paciente vê apenas `patient_id = (select id from patients where user_id = auth.uid())`. Uma query de "quem está esperando" feita pelo paciente retorna, no máximo, a própria linha.
3. A fila de espera da psicóloga é query/view autorizada apenas para `role = 'psychologist'`.
4. **Paciente não assina canal Realtime de fila.** Faz polling do próprio registro (3-5s) sob RLS. Realtime `broadcast`/`presence` não têm RLS de dados por padrão e vazariam identidade de terceiro (A10). Realtime só para a psicóloga, que legitimamente vê todos.
5. Nenhum token emitido antes de `admitted_at` → antes da admissão não há participante nem mídia no room.
6. Um `room_name` aleatório de 128 bits por sessão, nunca reutilizado.
7. Grant do paciente restrito ao `room` exato → token de A apresentado no room de B é rejeitado pelo próprio LiveKit.
8. `deleteRoom` ao encerrar → room não fica aberto para o próximo.

**Teste de aceitação obrigatório (para o QA Agent, bloqueante da sprint de vídeo):** com dois pacientes e duas sessões no mesmo horário, tentar — (a) trocar `session_id` no request de token; (b) apresentar o token de A ao room de B; (c) assinar o canal Realtime de B; (d) `GET` da sessão de B por id; (e) pedir token antes da admissão; (f) pedir token 3h antes do horário; (g) pedir token com consentimento revogado. **Todas devem falhar**, e (a)/(b) devem gerar `DENY_ROOM_TOKEN` no audit log. Resultado documentado em `docs/talitha-qa-*.md`.

---

## 6. Webhook Asaas — especificação (US-104)

Endpoint público na internet, sem autenticação de plataforma (`verify_jwt = false` é **necessário** — o Asaas não envia JWT do Supabase). Logo o token é a única barreira e precisa ser tratado como tal.

### 6.1 Validação do `authToken`

- Asaas envia o header **`asaas-access-token`** com o valor configurado no painel. **Não é HMAC sobre o corpo** — não há assinatura criptográfica do payload.
- Segredo de **≥32 bytes aleatórios**, em `supabase secrets` (`ASAAS_WEBHOOK_TOKEN`), rotacionável.
- Comparação em **tempo constante** (`crypto.timingSafeEqual` sobre buffers de mesmo tamanho), nunca `===` sobre string.
- **Validar antes de qualquer outra coisa**: antes de parsear o body inteiro, antes de qualquer query, antes de qualquer log. Falha → `401` e encerra.
- Limitar body a **64 KB**; rejeitar acima.

### 6.2 Consequência de não haver assinatura do corpo: não confiar no payload

Como o token é estático e o corpo não é assinado, o payload **não é fonte autoritativa**. Requisito: ao receber evento relevante, **re-consultar `GET /v3/payments/{id}`** na API do Asaas usando a `ASAAS_API_KEY` e usar a resposta como verdade para status, valor e data. Custa um request, roda dentro do SLA de 2s, e elimina de uma vez tampering de valor/status e boa parte do risco de replay.

### 6.3 Replay

Token estático significa que qualquer request capturado é replayável indefinidamente. Defesas cumulativas:

1. **Idempotência forte** (6.4) — um replay processado duas vezes não produz efeito, o que já neutraliza a maior parte do impacto.
2. **Janela de frescor:** rejeitar eventos cujo `dateCreated` seja mais antigo que **7 dias**. Responder **HTTP 200** + log (não 4xx) para não travar a fila de retentativas do Asaas.
3. **TLS obrigatório** (impede captura em trânsito).
4. Rotação do token em caso de suspeita; monitorar volume anômalo de requests com token inválido.
5. *Opcional (hardening):* allowlist de IP, se e quando o Asaas publicar faixas estáveis. Não é requisito.

### 6.4 Idempotência — nenhum recibo duplicado, nenhuma conciliação dupla

```sql
create table payment_webhook_events (
  asaas_event_id text primary key,            -- id do evento enviado pelo Asaas
  event_type     text not null,
  payment_id     text not null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  result         text,
  payload_sanitized jsonb not null            -- SEM CPF, SEM nome completo
);
```

Fluxo obrigatório na Edge Function:

1. Validar token (6.1) → falha = 401.
2. Validar frescor (6.3).
3. `insert into payment_webhook_events (asaas_event_id, ...) values (...) on conflict (asaas_event_id) do nothing returning asaas_event_id;`
4. **Se não retornou linha → evento já processado.** Responder `200` imediatamente, **sem nenhum side-effect**.
5. Se retornou, re-consultar `GET /v3/payments/{id}` (6.2) e processar **dentro de uma única transação**: atualizar `charges`, `sessions.payment_status`, criar `receipt`, gravar `processed_at`.
6. Responder `200`. Erro interno → `500` (o Asaas fará retry, e o retry é seguro por construção).

**Se o Asaas não fornecer um id de evento estável**, derivar chave determinística: `sha256(event_type || payment_id || status || coalesce(paymentDate,'') || value)`. Documentar qual das duas foi usada.

**Salvaguardas adicionais em nível de dados (cinto e suspensório, para o Data Architect):**

- `receipts`: `unique (charge_id)` — no máximo um recibo por cobrança.
- **Numeração sequencial sem lacuna nem duplicata:** contador dedicado por ano em tabela `receipt_counters (year int primary key, last_number int)` lido com `select ... for update` **na mesma transação** da criação do recibo. `sequence` do Postgres não serve: gera lacunas em rollback, e o US-406 exige sequência sem lacunas.
- **Máquina de estados monotônica:** webhooks chegam fora de ordem (`PAYMENT_OVERDUE` depois de `PAYMENT_RECEIVED`). Guardar `last_event_at` e proibir regressão de estado: `paid` só sai para `refunded`/`chargeback`, nunca para `overdue`/`pending`.
- **Estorno (US-406):** `PAYMENT_REFUNDED` marca o recibo como `cancelled` (nunca deleta) e mantém o número consumido — lacuna por cancelamento é o único caso legítimo.

### 6.5 Outras regras

- **Nunca logar o payload completo** — contém CPF, nome e valor. Logar apenas `event_type`, `payment_id`, `status`.
- **Nenhum trabalho caro inline:** geração do PDF do recibo é **on-demand no download**, não no webhook. Atende o SLA de 2s e reduz superfície de armazenamento.
- **Escopo mínimo de escrita:** preferir uma função `SECURITY DEFINER` de assinatura estreita a queries livres com `service_role`.
- **Erro do Asaas nunca vai literal para o client** (US-102 prevê `[mensagem do Asaas]` — corrigir, M7).

---

## 7. Inventário de segredos

| Segredo | Onde vive | Quem lê | Nunca aparece em |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | env do container Next.js (EasyPanel); disponível por padrão em Edge Functions | Server Actions, Route Handlers, Edge Functions | `NEXT_PUBLIC_*`, bundle do client, repo, logs |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | env público **por design** | client | — (são públicos; RLS é a proteção, não o segredo) |
| `ASAAS_API_KEY` | `supabase secrets set` | Edge Functions de cobrança/assinatura/consulta | client, repo, logs, mensagens de erro |
| `ASAAS_WEBHOOK_TOKEN` | `supabase secrets set` | Edge Function do webhook | logs, repo |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `supabase secrets set` | Edge Function `issue-livekit-token` e `deleteRoom` | client, repo, logs |
| `NEXT_PUBLIC_LIVEKIT_URL` | env público | client (`wss://…`) | — (pública) |
| **`RECORD_ENCRYPTION_KEK_V1`** | **env do EasyPanel — deliberadamente fora do Supabase** | runtime Node do Next.js | Supabase (secrets ou banco), Edge Function, repo, logs, backup do banco |
| `CPF_INDEX_KEY` (HMAC do blind index) | env do EasyPanel | runtime Node do Next.js | idem acima |
| `RESEND_API_KEY` (ou equivalente) | env do EasyPanel se o envio for pelo Next.js; `supabase secrets` se por Edge Function/cron | função de envio | client, repo, logs |
| `CRON_SECRET` | env do EasyPanel + `supabase secrets` (ambos os lados) | disparador e função de cron | query string (usar header), repo |
| Token de convite / confirmação de presença / aceite do responsável | **gerados aleatoriamente e armazenados como hash** no banco | função que valida | armazenamento em claro, log, URL de analytics |

**Regras invioláveis:**

1. **Nenhum segredo com prefixo `NEXT_PUBLIC_`.** No Next.js, `NEXT_PUBLIC_*` é inlined no bundle do client em build time — é equivalente a publicar. Allowlist única: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_SITE_URL`.
2. **Gate de Code Review / CI:** `grep -rE 'NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|API_KEY|TOKEN|PASSWORD|KEK)'` deve retornar zero. Adicionar ao checklist do code-reviewer-agent.
3. `.env`, `.env.local`, `.env.production` no `.gitignore`; `.env.example` versionado **sem valores reais**.
4. **Separação de domínio de confiança é intencional e não deve ser "simplificada":** segredos de terceiros no Supabase; **chave de criptografia no EasyPanel**. Mover a KEK para `supabase secrets` por conveniência anula a proteção da seção 3 e é motivo de reprovação em code review.
5. Nunca logar segredo, CPF, conteúdo clínico ou payload de webhook. Logs de Edge Function ficam visíveis no Supabase Dashboard.
6. Rotação: Asaas/LiveKit/e-mail rotacionáveis a qualquer momento; KEK via `kek_version` + re-wrap de DEKs.

---

## 8. E-mail transacional — política de conteúdo

**Premissa:** o assunto, o preheader e o nome do remetente aparecem na notificação da tela de bloqueio do celular. Qualquer pessoa fisicamente próxima ao paciente lê. Em contexto de saúde mental — e especialmente em contexto de violência doméstica ou de ambiente familiar hostil — isso pode ter consequência de **segurança física** para o titular, não apenas de privacidade.

**Regra de ouro:** nenhum e-mail pode revelar, no **assunto**, no **preheader** ou no **remetente**, que o destinatário faz psicoterapia, quem é a profissional, ou data/hora de sessão.

**Padrão arquitetural: "notify, don't inform".** O e-mail informa que existe algo no portal e leva ao portal autenticado. O detalhe fica atrás de login.

**Remetente:** nome e domínio sem "psicologia", "psi", "terapia", "clínica" ou o nome completo da profissional. Configurável por env. Ex.: `From: "Talitha" <nao-responda@notificacoes.{dominio}>`.

**Assuntos — allowlist (nenhum assunto fora desta lista):**

| Gatilho | Assunto aprovado | Proibido |
|---|---|---|
| Convite de primeiro acesso | `Seu acesso ao portal` | "Convite da Dra. Talitha — Psicologia" |
| Lembrete 24h | `Lembrete do seu compromisso de amanhã` | "Sua sessão de terapia amanhã às 15h" |
| Lembrete 1h | `Seu compromisso começa em 1 hora` | qualquer menção a sessão/terapia/consulta |
| Confirmação de presença | `Confirmação do seu compromisso` | — |
| Cobrança D-3 | `Aviso de vencimento` | "Pagamento da sua sessão de terapia" |
| Cobrança D+3 / D+7 | `Pagamento pendente` | — |
| Recibo disponível | `Documento disponível no seu portal` | "Recibo de atendimento psicológico" |
| Remarcação/cancelamento | `Alteração no seu compromisso` | "Sua sessão foi cancelada pela psicóloga" |
| Segurança (conta ativada, senha alterada) | `Atividade na sua conta` | — |

**Preheader:** definido explicitamente e igualmente neutro em todo template. Se não for definido, o cliente de e-mail usa a primeira linha do corpo — e é ali que o vazamento reaparece.

**Corpo:** pode ser mais específico (o corpo exige abrir o e-mail), mas **nunca** conteúdo clínico (D1/D2), nunca dados de anamnese, nunca CPF completo, nunca valores no assunto. Data/hora e valor no corpo são aceitáveis e necessários para lembrete e cobrança.

**Links:**

- **Nunca** link de acesso direto à sala de vídeo com token embutido. O link vai para o portal; o paciente autentica; o token é emitido no server. E-mail é reencaminhado, fica em backup e aparece em breach — não pode ser credencial.
- **Exceção controlada (US-305, "Confirmar Presença" / "Não poderei ir"):** é um bearer token em e-mail e só é aceitável com **todas** estas condições — token ≥128 bits, **hash** armazenado no banco, uso único, expira no horário da sessão, escopo restrito a **uma ação em uma sessão**, e **não cria sessão autenticada de navegador** (não emite cookie, não dá acesso ao portal). Sem isso é vetor de spoofing (A9).
- Nenhum dado em query string (`?email=`, `?patient_id=`) — vaza em `Referer` e em logs de terceiros. Token opaco no path.

**Anti-spoofing (obrigatório, A6):** SPF, DKIM e **DMARC `p=reject`** no domínio de envio. Sem DMARC, qualquer um envia e-mail em nome da psicóloga — vetor direto de fraude de pagamento contra pacientes em situação de vulnerabilidade.

**Preferência do titular:** opt-out do canal e-mail com consequência explicitada ("você deixará de receber lembretes"), registrado como preferência e respeitado pela régua e pelos lembretes.

**Descrição da cobrança no Asaas (minimização, A7):** a `description` aparece no boleto, no PIX, no extrato e no e-mail enviado pelo próprio Asaas — canais que a psicóloga não controla e que terceiros podem ver. Usar descrição **neutra**: `Prestação de serviços profissionais — Ref. MM/AAAA`. A descrição específica ("Sessão de atendimento psicológico online"), necessária para dedução no IR, fica **apenas no recibo**, que o paciente baixa deliberadamente do portal.

---

## 9. Retenção vs. direito de eliminação — posição defensável

A tensão é real e não se resolve escolhendo um lado. Posição a adotar e documentar:

**A LGPD não cria direito absoluto de eliminação.** O art. 16, I autoriza (e a obrigação regulatória exige) a conservação para cumprimento de obrigação legal ou regulatória; o art. 11, II, "a" fornece base legal para tratamento de dado sensível sem consentimento nessa hipótese; o art. 18, §4º prevê que o atendimento ao pedido do titular observa as demais normas aplicáveis. A Resolução CFP 001/2009 e a Res. CFP 11/2018 estabelecem guarda mínima de **5 anos** do prontuário — **20 anos** quando o paciente era menor no início do atendimento (posição já adotada no PRD; manter).

**Consequência operacional:** a revogação do consentimento (art. 8º, §5º) encerra o tratamento **para a finalidade de prestação do serviço** — para de agendar, de cobrar, de enviar e-mail, de emitir token de sala. **Não** dispara eliminação do prontuário, cuja base legal migra de consentimento para obrigação regulatória. **Isso precisa estar escrito no próprio texto do consentimento LGPD** (A4/C1), antes do aceite — senão a psicóloga fica em posição indefensável: prometeu eliminação que a lei a proíbe de executar.

**O que evita a defesa preguiçosa de "guardamos tudo por 5 anos":** eliminação **seletiva** por categoria. O sistema deve ser capaz de eliminar o que não está sob retenção.

| Categoria | Base legal após revogação | Na revogação | No pedido de eliminação |
|---|---|---|---|
| Evolução clínica, anamnese (D1, D2) | Obrigação regulatória CFP (art. 11, II, "a" + art. 16, I) | Congelar: read-only, `deleted_at` | **Negar** até `retention_until`, com resposta fundamentada por escrito |
| Identificação mínima vinculada ao prontuário (nome, CPF, nascimento) | idem — prontuário não identificado não cumpre a finalidade legal | Congelar | Negar até `retention_until` |
| Cobranças, recibos (D11) | Obrigação fiscal (5 anos) | Congelar | Negar até 5 anos |
| Consentimentos, audit log (D9, D10) | Prova de conformidade (art. 37) | Congelar | Negar durante a retenção do prontuário |
| Telefone, preferências de comunicação, contato de emergência, dados do responsável não usados em recibo | Consentimento / execução de contrato | **Eliminar ou anonimizar** — não são necessários à guarda | **Atender** |
| Rascunho de anotações da sessão (US-205) já incorporado à evolução | nenhuma | **Eliminar** ao salvar a evolução | Atender |
| Conta de autenticação (Supabase Auth user) | nenhuma após encerramento | Revogar sessões e desativar | **Atender:** deletar o auth user, preservando `patients` com a identificação exigida pelo prontuário |
| Mídia de vídeo (D13) | — | — | Nada a eliminar: não há gravação. Argumento forte de minimização |

**Eliminação verificável após `retention_until`:** eliminação nunca automática (US-407 acerta). Quando executada, o mecanismo oficial é **crypto-shredding**: apagar o ciphertext **e destruir a DEK** do registro. Isso é o único método honesto de eliminação num Postgres gerenciado com backup e PITR, onde o ciphertext persiste em cópias que a aplicação não alcança. Sem envelope encryption (seção 3) não existe eliminação real — apenas eliminação aparente. Registrar `PURGE_RECORD` no audit log com reautenticação.

**Backups:** declarar na política de privacidade que a eliminação lógica não remove imediatamente de backups, que estes têm prazo de expiração definido, e que a inutilização criptográfica é imediata. Verificar o prazo de retenção de backup/PITR do plano Supabase contratado (pendência do dev).

**Resposta ao titular:** obrigatória em até 15 dias, registrando no audit log **a decisão, o fundamento legal citado e a discriminação entre o que foi eliminado e o que foi retido**. US-408 tem o fluxo; falta o registro da decisão fundamentada (A11).

---

## 10. Issues por severidade

Nenhum destes é bug — não há código. Todos são lacunas de especificação que, se não fechadas antes da implementação, **produzem** vulnerabilidade. A severidade reflete o impacto da vulnerabilidade resultante.

### 🔴 Crítico — bloqueiam o System Architect

**C1 — Consentimento de paciente menor coletado do próprio menor (LGPD art. 14 + CFP)**
US-004 coloca "aceite por responsável legal em nome do paciente menor" **fora de escopo** e resolve com "o menor aceita com ciência do responsável". Isso não é consentimento válido. O art. 14 exige consentimento **específico e destacado** de pai/mãe ou responsável legal para tratamento de dado de criança e adolescente, e o CFP exige autorização do responsável para atendimento de menor. Um clique do menor no portal não substitui nenhum dos dois — a base legal de todo o tratamento clínico desse paciente fica inválida, junto com o atendimento em si.
**Ação (decisão tomada, sem exigir login para o responsável — respeita a decisão do PO):** se `patient.is_minor`, o fluxo de aceite dos dois termos é direcionado ao **e-mail do responsável legal** por meio de link de **uso único, token ≥128 bits com hash no banco, TTL 72h**, sem criar sessão autenticada. Registrar `guardian_name`, `guardian_cpf` (cifrado), IP, UA, timestamp UTC, versão e hash do texto. **Bloquear emissão de token de sala** até esse aceite existir. O aceite do menor pode ser coletado adicionalmente como assentimento, mas não substitui o do responsável.
**Responsável:** Architect (fluxo + gate) + Data Architect (`consents.subject_type`, `guardian_*`) + pendência do dev (texto jurídico).

**C2 — Isolamento da sala de vídeo sem especificação de derivação/validação de `roomName` e sem gate de admissão na emissão de token**
O PRD declara "paciente A nunca vê paciente B" como critério de aceite, mas não especifica como. O caminho natural de implementação — `roomName = session_id`, token emitido ao entrar na sala de espera — permite que um paciente com o `session_id` de outro (ou reutilizando o próprio token) entre na sessão de terapia alheia. Impacto: quebra de sigilo profissional em sessão de psicoterapia, o dano mais grave que este produto pode causar.
**Ação:** implementar a seção 5 integralmente — `room_name` aleatório de 128 bits por sessão, resolvido server-side a partir de `session_id`; 8 pré-condições de emissão; grants mínimos; TTL 15 min; sala de espera fora do LiveKit; `deleteRoom` no encerramento; teste de aceitação (a)-(g) do item 5.5 como gate de sprint.
**Responsável:** Architect + Data Architect (`sessions.room_name`, `admitted_at`) + QA (teste bloqueante).

**C3 — Abordagem de criptografia do prontuário indefinida, com risco de colocar a chave no domínio de confiança do dado**
US-404 deixa a escolha em aberto. `pgcrypto` (chave transita por SQL, vaza em logs e `pg_stat_statements`) e Supabase Vault (root key no mesmo provedor do dado) fazem com que um único vazamento de `SUPABASE_SERVICE_ROLE_KEY` — o segredo mais copiado de qualquer projeto — exponha **todo o prontuário em claro**. Ambas violam o próprio requisito do US-404 ("chave NUNCA armazenada no mesmo banco").
**Ação:** implementar a seção 3 — AES-256-GCM application-level, envelope (DEK por registro + KEK), AAD vinculando `patient_id`+`record_id`, KEK em env do **EasyPanel**, `runtime = 'nodejs'` nas rotas que cifram/decifram.
**Responsável:** Architect (ADR) + Data Architect (colunas) + Stack Agent.

**C4 — Imutabilidade do audit log não especificada; RLS não protege contra `service_role`**
US-405 exige log imutável "via policy ou trigger". A aplicação usa `service_role`, que **ignora RLS**; e o owner da tabela ignora policies sem `FORCE ROW LEVEL SECURITY`. Com a especificação atual, `UPDATE`/`DELETE` no audit log é trivial a partir da própria aplicação — o que destrói simultaneamente a defesa contra repúdio e a prova de conformidade em auditoria CFP/ANPD.
**Ação:** implementar as 4 camadas da seção 4 (RLS + `FORCE`, triggers de UPDATE/DELETE **e TRUNCATE**, `REVOKE`, hash chain com âncora externa semanal) + escrita via `SECURITY DEFINER` com `actor_id` derivado de `auth.uid()`.
**Responsável:** Data Architect.

### 🟠 Alto

**A1 — Custódia da chave de criptografia inexistente.** Perder a KEK torna irrecuperável prontuário sob guarda legal obrigatória de 5/20 anos, sem remediação técnica posterior. → Procedimento escrito, 2 cópias offline em custódias distintas, **teste de restauração executado e documentado antes do go-live**. *Architect + pendência do dev.*

**A2 — Idempotência do webhook não especificada em nível de dados.** Sem chave de idempotência, `unique (charge_id)` em `receipts`, contador transacional e máquina de estados monotônica, um retry do Asaas gera **dois recibos fiscais** e conciliação dupla. → Seção 6.4. *Data Architect + Stack Agent.*

**A3 — Webhook replayável indefinidamente e validação de token não especificada.** Token estático sem janela de frescor, sem comparação time-safe, sem ordem de validação, sem limite de body, e payload tratado como autoritativo. → Seções 6.1-6.3, incluindo re-consulta a `GET /v3/payments/{id}`. *Architect + Stack Agent.*

**A4 — Consentimento LGPD agregado em um único checkbox.** US-005 cobre com um aceite: tratamento clínico, compartilhamento com o Asaas, comunicação por e-mail e retenção. O art. 11, I exige consentimento **específico e destacado** por finalidade. O PO colocou granularidade "fora de escopo" — aqui isso não é feature nice-to-have, é o que torna o consentimento válido para dado sensível. → Aceite principal (clínico, obrigatório) + checkbox **destacado e obrigatório** para compartilhamento com o Asaas (nominado) + checkbox **opcional** para lembretes por e-mail com aviso de visibilidade em notificação + menção à transferência internacional (A5) + declaração de que a retenção pós-revogação se dá por obrigação regulatória. Guardar `consent_text_hash`, IP e UA como **obrigatórios** (o PRD marca IP como "opcional"). *Architect + pendência do dev (texto).*

**A5 — Transferência internacional e operadores não tratados (art. 33, art. 39).** Supabase, LiveKit, Resend e Asaas são **operadores**; a psicóloga é a **controladora**. O PRD não os nomina ao titular, não menciona transferência internacional de dado sensível de saúde, e não prevê DPA. → Nominar os operadores no consentimento e na política de privacidade; declarar transferência internacional; **provisionar o projeto Supabase em região São Paulo (`sa-east-1`)** e preferir região sul-americana no LiveKit para reduzir a exposição; contratar/aceitar DPA de cada operador. *Architect (região) + pendência do dev/cliente (DPAs e texto).*

**A6 — E-mail transacional sem política de conteúdo e sem anti-spoofing.** Assunto revelando terapia na tela de bloqueio; domínio sem DMARC permite phishing de pagamento em nome da psicóloga. → Seção 8 completa, incluindo SPF/DKIM/DMARC `p=reject`. *Architect + Stack Agent + pendência do dev (DNS).*

**A7 — CPF: contradição entre stories, blind index inseguro e descrição de cobrança reveladora.** US-002 exige CPF "criptografado em repouso"; US-404 declara criptografia de CPF **fora de escopo**. Além disso, unicidade de CPF via hash sem chave é quebrável por força bruta (espaço de 10^11). → CPF cifrado com a mesma infra da seção 3 **+ blind index `cpf_hmac = HMAC-SHA256(cpf, CPF_INDEX_KEY)`** com `unique`, chave separada em env do EasyPanel. **CPF precisa ser persistido** (recibo IRPF exige o número completo; unicidade de cadastro também) — não pode ficar só no Asaas. Ao Asaas enviar apenas `name`, `cpfCnpj`, `email`, `mobilePhone` — nada de nascimento, dados clínicos ou nome do responsável em observação. Descrição de cobrança neutra (seção 8). *Data Architect + Stack Agent.*

**A8 — IDOR no recibo (US-406).** Numeração sequencial (`001/2026`) combinada com download é convite a enumeração. → Rota e chave de acesso por **UUID**; número sequencial é conteúdo do documento, nunca identificador de rota. Bucket **privado** se houver persistência; preferir **geração on-demand sem persistir PDF** (volume baixíssimo, uma superfície a menos). Se persistir: `createSignedUrl(path, 60)` gerado server-side após verificar ownership, nunca `getPublicUrl`. *Architect + Data Architect.*

**A9 — Links de ação em e-mail sem especificação de token (US-305, US-003).** "Confirmar Presença"/"Não poderei ir" e o convite são bearer tokens em e-mail. → Token ≥128 bits, **hash** no banco, uso único, TTL definido (sessão / 72h), escopo de uma ação em um recurso, **sem criar sessão autenticada**. *Architect + Data Architect.*

**A10 — Realtime da sala de espera pode vazar identidade de outro paciente.** Supabase Realtime `broadcast`/`presence` não têm RLS de dados por padrão. → Paciente **não** assina canal de fila; faz polling do próprio registro sob RLS. Realtime apenas para a psicóloga. *Architect.*

**A11 — Direito de eliminação vs. retenção sem posição documentada e sem eliminação seletiva.** Risco de negar indevidamente (exposição a sanção ANPD) ou atender indevidamente (violação de guarda CFP), e ausência de mecanismo de eliminação eficaz diante de backups. → Seção 9: tabela de base legal por categoria, eliminação seletiva, crypto-shredding, resposta fundamentada registrada em audit log. *Architect + Data Architect + pendência do dev (texto da política).*

**A12 — Ausência de gate estrutural de RLS e de proibição de `patient_id` vindo do client.** É a origem mais provável de IDOR neste produto. → (a) Nenhuma migration passa em code review se cria tabela sem `enable row level security` + ao menos uma policy; (b) verificação obrigatória `select tablename from pg_tables where schemaname='public' and rowsecurity = false;` deve retornar **0 linhas**; (c) **nenhuma** função server aceita `patient_id`/`psychologist_id`/`role` como parâmetro — sempre `getUser()` → derivar; (d) `getUser()` sempre, **nunca** `getSession()` em server-side; (e) todas as PKs de entidades expostas em URL são `uuid` (`gen_random_uuid()`), proibido `bigserial`/`identity`. *Data Architect + Code Reviewer.*

**A13 — Audit log registra apenas sucesso.** Sem `DENY_ROOM_TOKEN`, `LOGIN_FAILURE` e `MFA_CHALLENGE_FAILURE`, o sistema não detecta o ataque mais relevante que pode sofrer: paciente A tentando acessar dados de B. → Registrar negativas com motivo. *Data Architect + Architect.*

**A14 — US-405 permite que falha do audit log não bloqueie a operação, inclusive escrita.** Abre a porta a alteração de prontuário sem rastro. → Log **síncrono e bloqueante** para escrita/alteração/purge/emissão de token; assíncrono com retry apenas para leitura. *Data Architect + Stack Agent.*

**A15 — Ausência de MFA na conta da psicóloga.** Uma única conta acessa **todos** os prontuários; é o alvo de maior valor do sistema, e o PRD só prevê senha (US-003 até lista MFA como fora de escopo). → **MFA TOTP obrigatório** para `role = 'psychologist'` (nativo no Supabase Auth, custo baixo). Opcional para pacientes. Reautenticação em `PURGE_RECORD` e `EXPORT_DATA`. *Architect + Stack Agent.*

**A16 — Bootstrap de role sem controle (elevação de privilégio).** Nada no PRD impede que um segundo cadastro assuma `role = 'psychologist'` e leia todos os prontuários. → Role em `app_metadata` ou em `profiles.role` com RLS que **proíbe UPDATE da coluna**; nunca em `user_metadata` (editável pelo próprio usuário via API); role da psicóloga atribuída por seed/migration; signup público desabilitado; convite é o único caminho para `patient`. *Architect + Data Architect.*

### 🟡 Médio

**M1 — Rate limiting não especificado** em login, reenvio de convite, emissão de token LiveKit, solicitação LGPD e endpoints de cron. Verificar os limites nativos do Supabase Auth no Dashboard antes de implementar limitador próprio.

**M2 — Rascunho de anotações da sessão (US-205/206) sem definição de armazenamento.** "Salvas localmente" pode significar `localStorage` — conteúdo clínico em disco de dispositivo possivelmente compartilhado. → Auto-save server-side cifrado; cache local só em memória; limpar ao encerrar; eliminar o rascunho ao incorporá-lo à evolução.

**M3 — Retenção de audit log e de consentimentos não amarrada operacionalmente** ao `retention_until` do prontuário; `TRUNCATE` não coberto por trigger row-level (ver seção 4).

**M4 — Gestão de sessão sem política.** Falta timeout de inatividade, revogação de todas as sessões ao revogar consentimento / encerrar atendimento / trocar senha.

**M5 — Política de senha fraca para conta com acesso a dado sensível.** US-003 pede 8 caracteres com 1 letra e 1 número. → Mínimo 10, verificação contra base de senhas vazadas (recurso nativo do Supabase Auth), bloqueio progressivo.

**M6 — Headers HTTP não antecipados; risco de retrabalho com o LiveKit.** CSP precisa de `connect-src` com `https://{projeto}.supabase.co wss://{projeto}.supabase.co wss://*.livekit.cloud`, `media-src blob:`, `worker-src blob:`; e `Permissions-Policy` precisa **permitir** `camera=(self), microphone=(self)` — um `camera=()` genérico quebra a sala de vídeo. Mais HSTS `max-age=31536000; includeSubDomains`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Detalhamento completo no Security Review da arquitetura.

**M7 — Erro de terceiro repassado literalmente ao client** (US-102 prevê `[mensagem do Asaas]`). → Mensagem genérica ao usuário; detalhe apenas no log server-side.

**M8 — Cron/Edge Functions de lembrete e régua sem autenticação de disparo.** → `CRON_SECRET` em header + idempotência por (`session_id`, `reminder_type`) para não reenviar.

**M9 — Alteração de e-mail do paciente sem verificação** (double opt-in no novo endereço + notificação ao antigo). Reenvio de convite não deve permitir enumeração.

**M10 — Logs do Postgres e `pg_stat_statements` podem capturar dado sensível** se qualquer criptografia ou comparação de segredo for feita via SQL. Consequência direta da decisão da seção 3 — reforçar como regra.

**M11 — Anamnese contém dado de terceiro** (contato de emergência, D4) sem base legal declarada e sem limitação de finalidade. → Declarar base (proteção da vida) no consentimento; proibir uso do contato para qualquer outra finalidade.

**M12 — Ausência de plano de resposta a incidente (art. 48).** Para dado sensível de saúde é exigível: quem detecta, quem comunica, prazo, template de comunicação à ANPD e aos titulares. → Documento operacional de uma página; pendência do dev/cliente com apoio do Architect.

**M13 — Export LGPD (US-408) sem controle de entrega.** O arquivo gerado agrega dados pessoais e não pode ser enviado por e-mail nem ficar em bucket público. → Download autenticado no portal, signed URL de vida curta, expiração do artefato, registro no audit log.

**M14 — Renderização de conteúdo clínico.** Proibir `dangerouslySetInnerHTML` em qualquer campo de prontuário/anamnese. JSX escapa por padrão; a regra existe para bloquear a introdução futura de rich text sem sanitização — um XSS armazenado aqui executa na sessão da psicóloga, que acessa todos os prontuários.

### 🟢 Baixo

**B1** — `productionBrowserSourceMaps: false` no `next.config.ts`.
**B2** — `X-Robots-Tag: noindex` nas áreas autenticadas + `robots.txt` bloqueando `/portal`, `/dashboard`, `/pacientes`.
**B3** — `Referrer-Policy: strict-origin-when-cross-origin` para não vazar URLs do portal a terceiros.
**B4** — Todos os registros de consentimento e audit em `timestamptz` UTC, com fuso explicitado na exibição — consistência importa para valor probatório.
**B5** — Nome do PDF do recibo neutro (`recibo-{numero}.pdf`), sem nome do paciente nem "psicologia" — o arquivo fica na pasta Downloads, frequentemente compartilhada.
**B6** — TTL server-side de room (`deleteRoom` em rooms > 2h) como hardening de custo e privacidade, complementando o aviso visual do US-204.
**B7** — Mensagens de erro de login/reset genéricas (não revelar existência de conta). US-003 já acerta no convite expirado — manter o padrão.
**B8** — `npm ci` (não `npm install`) no Dockerfile/EasyPanel, com `package-lock.json` versionado, contra lockfile poisoning.

---

## 11. Requisitos de segurança por módulo

Escritos para implementação direta. Cada item é verificável.

### Módulo 0 — Autenticação, onboarding e compliance

- [ ] **MFA TOTP obrigatório** para `role = 'psychologist'` (Supabase Auth); opcional para `patient`. Reautenticação em `PURGE_RECORD` e `EXPORT_DATA`.
- [ ] Role em `app_metadata` ou `profiles.role` com RLS que **proíbe UPDATE da coluna pelo próprio usuário**. Nunca em `user_metadata`.
- [ ] Signup público desabilitado. Psicóloga provisionada por seed/migration. Paciente só por convite emitido pela psicóloga.
- [ ] Convite: token 256 bits, **SHA-256 do token** armazenado (nunca em claro), uso único, TTL 72h, invalidado no primeiro uso e ao reenviar. E-mail de notificação após ativação.
- [ ] Senha: mínimo 10 caracteres, verificação contra base de senhas vazadas habilitada no Supabase Auth.
- [ ] `supabase.auth.getUser()` em **todo** código server-side (Middleware, Server Components, Server Actions, Route Handlers). **Nunca `getSession()`** — não revalida o JWT e aceita sessão revogada.
- [ ] Cookies via `@supabase/ssr` `createServerClient`: `HttpOnly`, `Secure`, `SameSite=Lax`. Timeout de inatividade configurado.
- [ ] `consents`: append-only, colunas `subject_type` (`patient` | `guardian`), `version`, **`consent_text_hash`**, `accepted_at` (timestamptz UTC), `ip` (inet), `user_agent`, `revoked_at`, `purpose` (enum por finalidade). Corpo dos textos em tabela versionada imutável.
- [ ] **Consentimento por finalidade** (A4): aceite clínico obrigatório + compartilhamento com Asaas (destacado, obrigatório, operador nominado) + lembretes por e-mail (opcional, com aviso de visibilidade em notificação) + declaração de transferência internacional + declaração de retenção pós-revogação por obrigação regulatória.
- [ ] **Fluxo de menor (C1):** `patients.is_minor` derivado da data de nascimento; aceite dos dois termos coletado do **responsável** por link de uso único ao e-mail dele (token ≥128 bits, hash no banco, TTL 72h, sem criar sessão autenticada); registro de `guardian_name` e `guardian_cpf` (cifrado); primeira sessão bloqueada até o aceite existir.
- [ ] Gate de compliance **server-side** (não na UI): sem aceite vigente dos dois termos, negar emissão de token de sala e acesso a funcionalidades de atendimento.
- [ ] Revogação de consentimento tem efeitos técnicos definidos: bloqueia emissão de token de sala, para régua de cobrança e lembretes, revoga sessões ativas, congela prontuário como read-only.
- [ ] Rate limits nativos do Supabase Auth verificados e habilitados; limite próprio no reenvio de convite (3/paciente/hora).
- [ ] Audit: `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `MFA_CHALLENGE_FAILURE`, `ACCEPT_CONSENT`, `REVOKE_CONSENT`, `INVITE_SENT`, `INVITE_REDEEMED`.

### Módulo 1 — Financeiro e Asaas

- [ ] `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` em `supabase secrets`. **Nenhuma** chamada ao Asaas a partir do client.
- [ ] Webhook: token validado com `timingSafeEqual` **antes de qualquer parsing, query ou log**; body limitado a 64 KB; `verify_jwt = false` documentado como necessário e compensado pelo token.
- [ ] Janela de frescor de 7 dias sobre `dateCreated`; fora dela → `200` + log (não 4xx).
- [ ] Payload **não** é autoritativo: re-consultar `GET /v3/payments/{id}` antes de conciliar.
- [ ] `payment_webhook_events(asaas_event_id primary key, ...)` com `insert ... on conflict do nothing returning`; se não retornou linha, responder `200` sem side-effect. `payload_sanitized` sem CPF nem nome completo.
- [ ] Processamento em transação única; `receipts` com `unique (charge_id)`; numeração via `receipt_counters` com `select ... for update` na mesma transação (sequence do Postgres não atende — gera lacunas).
- [ ] Máquina de estados monotônica: `paid` só regride para `refunded`/`chargeback`.
- [ ] `description` da cobrança **neutra** (`Prestação de serviços profissionais — Ref. MM/AAAA`); natureza clínica apenas no recibo.
- [ ] Ao Asaas: apenas `name`, `cpfCnpj`, `email`, `mobilePhone`. Nada mais.
- [ ] Validação server-side com zod: valor > 0, vencimento ≥ hoje, paciente pertence à psicóloga.
- [ ] Nunca logar payload completo nem CPF. Erros do Asaas nunca literais ao client.
- [ ] Nenhum trabalho caro no webhook (PDF gerado on-demand) — SLA de 2s.
- [ ] Régua e lembretes: `CRON_SECRET` em header; idempotência por (`charge_id`, `step`); respeitar opt-out; verificar status antes de enviar.
- [ ] Audit: `CANCEL_CHARGE`, `CREATE_CHARGE`, `CREATE_SUBSCRIPTION`, `WEBHOOK_REJECTED`.

### Módulo 2 — Sala de vídeo

- [ ] `LIVEKIT_API_KEY`/`SECRET` em `supabase secrets`. Token emitido **apenas** pela Edge Function `issue-livekit-token`.
- [ ] `sessions.room_name` = `'s_' || encode(gen_random_bytes(16),'hex')`, `unique not null`, gerado no servidor, um por sessão, **nunca reutilizado**; remarcação gera novo.
- [ ] Client envia **apenas** `session_id`. Nunca `roomName`, nunca `patient_id`, nunca `role`.
- [ ] As 8 pré-condições da seção 5.2, na ordem. Falha → **404 genérico idêntico** para inexistente e não-autorizado.
- [ ] Grants exatos da tabela 5.3. `canPublishData: false` nos dois perfis. `identity = auth.uid()`; `metadata` sem PII.
- [ ] TTL 15 min. Token só em memória no client. Nunca em `localStorage`/URL.
- [ ] **Sala de espera fora do LiveKit**: estado em `sessions.waiting_since`/`admitted_at`. Nenhum token antes de `admitted_at`.
- [ ] Paciente faz **polling do próprio registro** sob RLS. Realtime apenas para a psicóloga.
- [ ] `deleteRoom(room_name)` server-side ao encerrar + job de limpeza para rooms > 2h.
- [ ] Ações administrativas (kick/mute) via `RoomServiceClient` server-side, nunca por grant no token.
- [ ] Rate limit de 10 emissões/usuário/min.
- [ ] Anotações da sessão **nunca** por data channel; auto-save server-side cifrado.
- [ ] Audit: `ISSUE_ROOM_TOKEN`, **`DENY_ROOM_TOKEN`** (com motivo), `SESSION_STARTED`, `SESSION_ENDED`.
- [ ] Teste de aceitação (a)-(g) do item 5.5 executado e documentado — **gate bloqueante da sprint**.

### Módulo 3 — Agenda e lembretes

- [ ] Conflito de horário validado **server-side** (constraint de exclusão ou verificação transacional), não só no form.
- [ ] Cancelamento/remarcação: verificar ownership e política de prazo no server; paciente só age na própria sessão.
- [ ] Links de confirmação de presença: token ≥128 bits, hash no banco, uso único, expira no horário da sessão, escopo de uma ação em uma sessão, **sem criar sessão autenticada**.
- [ ] Assuntos de e-mail pela allowlist da seção 8; preheader neutro definido em todos os templates; nenhum dado em query string.
- [ ] Lembretes idempotentes por (`session_id`, `reminder_type`); não enviar para sessão cancelada.
- [ ] SPF, DKIM e DMARC `p=reject` no domínio de envio.
- [ ] Audit: `CANCEL_SESSION`, `RESCHEDULE_SESSION`, `CONFIRM_ATTENDANCE`, `REMINDER_SENT`.

### Módulo 4 — Prontuário e recibos

- [ ] Criptografia da seção 3: AES-256-GCM, envelope DEK/KEK, AAD = `patient_id|record_id`, `kek_version`, KEK em env do **EasyPanel**, `runtime = 'nodejs'`.
- [ ] Campos cifrados: evolução, anamnese, contato de emergência, CPF (paciente e responsável).
- [ ] Blind index `cpf_hmac = HMAC-SHA256(cpf, CPF_INDEX_KEY)` com `unique` para checar duplicidade sem decifrar. **Nunca SHA-256 puro de CPF.**
- [ ] Decriptação **exclusivamente server-side**. Ciphertext nunca sai do server. Busca no histórico = decrypt-then-filter com paginação, sem índice em plaintext.
- [ ] RLS de `clinical_records`/`anamnesis`: **nenhuma** policy concede SELECT a `patient` (prontuário não é visível ao paciente — decisão do PO).
- [ ] Audit log das 4 camadas da seção 4. Log **síncrono** para escrita, assíncrono para leitura. Sem coluna de conteúdo clínico; `metadata jsonb` com allowlist de chaves.
- [ ] Versionamento de evolução: alteração preserva a versão anterior em tabela append-only.
- [ ] `retention_until` calculado por trigger a partir de `is_minor_at_start` (5 ou 20 anos) no encerramento. `DELETE` físico bloqueado por trigger durante a retenção.
- [ ] Eliminação após retenção: manual, com reautenticação, via **crypto-shredding** (apagar ciphertext **e** destruir a DEK). `PURGE_RECORD` no audit log.
- [ ] Eliminação seletiva por categoria conforme a tabela da seção 9; resposta ao titular com fundamento legal registrada em audit log.
- [ ] Recibo: acesso por **UUID**, nunca pelo número sequencial; PDF gerado on-demand sem persistir (preferência) ou em bucket **privado** com `createSignedUrl` de 60s após verificar ownership. Nunca `getPublicUrl`. Nome de arquivo neutro.
- [ ] Export LGPD: download autenticado, signed URL de vida curta, artefato expirável, sem conteúdo clínico (decisão do PO), registrado em audit log.
- [ ] Proibido `dangerouslySetInnerHTML` em qualquer campo de prontuário/anamnese.

### Transversal (todos os módulos)

- [ ] **Toda** tabela em `public` com `enable row level security` + ao menos uma policy. `select tablename from pg_tables where schemaname='public' and rowsecurity=false;` → **0 linhas**. Migration sem RLS = reprovação em code review.
- [ ] **Nenhuma** função server aceita `patient_id`, `psychologist_id` ou `role` como parâmetro.
- [ ] Todas as PKs de entidades expostas em URL são `uuid` com `gen_random_uuid()`. Proibido `bigserial`/`identity`.
- [ ] Validação com **zod** em toda boundary server (Server Action, Route Handler, Edge Function).
- [ ] Nenhum segredo com prefixo `NEXT_PUBLIC_` fora da allowlist da seção 7; gate de grep no code review.
- [ ] Nenhum log com segredo, CPF, conteúdo clínico ou payload de webhook.
- [ ] Erros: mensagem genérica ao client, detalhe apenas no log server-side. Sem stack trace em produção.
- [ ] `npm ci` no build; `package-lock.json` versionado.
- [ ] CORS das Edge Functions restrito ao domínio de produção — nunca `*`.

---

## 12. Ajustes recomendados ao PRD

O PRD **não foi editado**. Os itens abaixo alteram escopo ou contrariam decisão registrada, e cabe ao orquestrador decidir.

| # | Story/seção | Ajuste recomendado | Motivo | Severidade |
|---|---|---|---|---|
| P1 | US-004 — "Fora do escopo: aceite por responsável legal em nome do paciente menor... o menor aceita com ciência do responsável" | **Remover do "fora de escopo".** Aceite do responsável por link de uso único ao e-mail dele passa a ser requisito do MVP | LGPD art. 14 + CFP. Sem isso a base legal de todo o tratamento de paciente menor é inválida | 🔴 C1 |
| P2 | US-005 — "Fora do escopo: gestão granular de consentimento" | **Remover parcialmente.** Granularidade por **finalidade** (clínico / Asaas / e-mail) entra no MVP; granularidade por **tipo de dado** permanece fora | Art. 11, I exige consentimento específico e destacado. Contraria a decisão do PO deliberadamente | 🟠 A4 |
| P3 | US-404 — "Fora do escopo: criptografia de outros campos (nome, e-mail, CPF)" | **CPF entra no escopo** (cifrado + blind index HMAC). Nome, e-mail e telefone permanecem em claro | Contradiz o próprio US-002 ("CPF criptografado em repouso"); hash sem chave de CPF é brute-forçável | 🟠 A7 |
| P4 | US-003 — "Fora do escopo: MFA / autenticação de dois fatores" | **MFA TOTP obrigatório para a psicóloga** entra no MVP. Opcional para pacientes | Uma conta acessa todos os prontuários. É o alvo de maior valor do sistema | 🟠 A15 |
| P5 | US-405 — "falha do audit log NÃO bloqueia a operação principal" | Qualificar: não bloqueia **leitura**; **bloqueia escrita/alteração/purge/emissão de token** | Caso contrário existe alteração de prontuário sem rastro | 🟠 A14 |
| P6 | US-406 — recibo numerado sequencialmente + download | Explicitar que o **acesso é por UUID**, nunca pelo número, e que o PDF não é público | IDOR direto em documento que agrega dado sensível + CPF | 🟠 A8 |
| P7 | Seção "Requisitos de Compliance" | Acrescentar: identificação do controlador (psicóloga, com contato), canal de atendimento ao titular (art. 18, §1º), prazo de resposta, **lista nominal dos operadores** (Supabase, LiveKit, Asaas, provedor de e-mail) e **declaração de transferência internacional** (art. 33) | Ausentes. Sem canal divulgado e sem informação sobre operadores/transferência, a informação ao titular é incompleta | 🟠 A5 |
| P8 | Seção "Requisitos Não-Funcionais → Segurança" | Trocar "criptografado em repouso" por "AES-256-GCM application-level com chave fora do provedor de banco"; e "audit log imutável" por "append-only garantido por trigger + REVOKE + RLS forçado + hash chain" | Declaração sem mecanismo não é requisito verificável | 🔴 C3/C4 |
| P9 | US-104 — "Fora do escopo: dashboard de eventos de webhook (monitoramento)" | Manter fora, mas incluir alerta mínimo à psicóloga quando houver evento de webhook não processado por >24h | Falha silenciosa de conciliação produz cobrança indevida a paciente que já pagou | 🟡 |
| P10 | US-205/US-206 — "anotações salvas localmente" | Especificar: memória, não `localStorage`; auto-save server-side cifrado; rascunho eliminado ao ser incorporado à evolução | Conteúdo clínico em disco de dispositivo compartilhado | 🟡 M2 |
| P11 | Seção "Fora do MVP" | Acrescentar linha explícita: **plano de resposta a incidente (art. 48)** é documento operacional obrigatório antes do go-live — não é feature, mas não pode faltar | Dado sensível de saúde; comunicação à ANPD e aos titulares tem prazo | 🟡 M12 |

---

## 13. Pendências do dev / cliente (não são itens técnicos)

Nenhuma destas é implementável por agente. São ações humanas cuja ausência impede conformidade real, independentemente da qualidade do código.

1. **Cadastro ativo no e-Psi** (e-psi.cfp.org.br) e CRP ativo da psicóloga — **pré-requisito legal** para atendimento online (Res. CFP 11/2018). Já consta como blocker no status file; permanece.
2. **DPA / contrato de operador (LGPD art. 39)** com cada operador: Supabase, LiveKit, Asaas e provedor de e-mail. Verificar cláusulas de tratamento, subprocessadores e transferência internacional.
3. **Base para transferência internacional (art. 33)** de dado sensível de saúde. Mitigação técnica recomendada: provisionar Supabase em `sa-east-1` (São Paulo) e preferir região sul-americana no LiveKit. O envio de e-mail provavelmente sairá dos EUA — declarar ao titular.
4. **Encarregado (DPO):** para profissional individual, a ANPD (Guia de Agentes de Tratamento de Pequeno Porte) dispensa a nomeação formal, **mas exige canal de comunicação divulgado ao titular**. Definir e publicar o canal (e-mail).
5. **Textos jurídicos:** termo de atendimento online (CFP), consentimento LGPD segmentado por finalidade (A4/P2), consentimento do responsável legal (C1), política de privacidade. Revisão por profissional do direito é recomendável — o sistema versiona e registra o hash do texto, mas não redige o conteúdo.
6. **Custódia da chave de criptografia (A1):** definir onde ficam as 2 cópias offline, quem tem acesso, e executar/documentar um teste de restauração **antes do go-live**. Perder a KEK é perda irreversível de prontuário sob guarda legal obrigatória.
7. **DNS do domínio de envio:** SPF, DKIM e DMARC `p=reject`. Escolher domínio/subdomínio de envio que não revele a natureza do serviço (A6).
8. **Credenciais:** Asaas sandbox (API key + webhook token), LiveKit Cloud (key, secret, URL). Já constam como blockers.
9. **Retenção de backup/PITR** do plano Supabase contratado — necessário para declarar prazos corretos na política de privacidade (seção 9).
10. **Plano de resposta a incidente (art. 48):** uma página com quem detecta, quem comunica, prazo e templates de comunicação à ANPD e aos titulares.
11. **Decisão de negócio:** confirmar se o produto atenderá pacientes menores de idade no MVP. Se **não**, C1 e boa parte de A5/P1 saem do escopo imediato e o MVP fica materialmente mais simples. Recomendação técnica: se não houver demanda concreta por menores no lançamento, **postergar** o atendimento a menores para v1.1 e implementar `is_minor` apenas como bloqueio de cadastro. Isso remove um Crítico do caminho da primeira release.

---

## 14. Próximo passo

**Design & UI** — o produto tem UI a especificar em todas as superfícies, e há requisitos deste review que precisam nascer no design, não serem enxertados depois:

- fluxo de consentimento segmentado por finalidade, com checkboxes destacados (A4);
- fluxo de aceite pelo responsável legal a partir de link de e-mail (C1);
- sala de espera como estado do portal, sem qualquer elemento que sugira fila compartilhada (5.5);
- estados de negação de acesso à sala (fora da janela, sem consentimento, não admitido) — hoje inexistentes nas stories;
- tela de MFA/enrollment TOTP para a psicóloga (A15);
- avisos de retenção e da resposta fundamentada a pedido de eliminação (seção 9).

Em seguida, **System Architect**, que deve absorver este documento como entrada obrigatória, produzir ADRs para as decisões das seções 3, 4, 5 e 6, e retornar para o **Security Review da arquitetura** (segundo dos três momentos obrigatórios).

---

## Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-09 | Security Review do PRD — classificação de dados (16 categorias), STRIDE em 8 superfícies, decisões de criptografia/audit log/token LiveKit/webhook, 42 issues classificados (4🔴 / 16🟠 / 14🟡 / 8🟢), requisitos por módulo, 11 ajustes ao PRD, 11 pendências humanas |

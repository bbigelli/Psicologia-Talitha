# Decisões Técnicas — Talitha Psicologia

Registro de decisões de produto, arquitetura e técnicas. Ver `~/.claude/CLAUDE.md` seção "Historico de Decisoes por Projeto".

### [2026-09-09] Stack: Next.js 16 + App Router
**Contexto:** O produto tem três superfícies — landing pública (aquisição de pacientes via busca orgânica), área da psicóloga e portal do paciente.
**Decisão:** Next.js 16 com App Router e TypeScript strict, em vez de Vite/SPA.
**Motivo:** SEO real na landing, camada server-side para rotas multi-perfil, e o profile tem `nextjs-agent` + `easypanel-agent` (validação de deploy) dedicados.
**Escopo:** Todo o app web.

### [2026-09-09] Vídeo: LiveKit Cloud
**Contexto:** Substituir Google Meet / WhatsApp por sala de atendimento própria dentro do app.
**Decisão:** LiveKit Cloud (free tier 5.000 min/mês) com UI 100% própria.
**Motivo:** ~10x mais barato por minuto que Daily.co acima do free tier; SDK server roda em Deno (compatível com Supabase Edge Functions para emissão de token); permite sala de espera, anotações laterais e identidade visual Talitha. Self-hostável no futuro sem trocar de SDK.
**Alternativas descartadas:** Daily.co Prebuilt (UI pronta, mas 10x mais caro e pouca customização); Jitsi self-hosted (grátis, mas custo de VPS e manutenção de segurança).
**Escopo:** Módulo de atendimento em vídeo.

### [2026-09-09] Paciente tem portal com login
**Contexto:** Definir se o paciente acessa por link mágico ou tem conta própria.
**Decisão:** Portal do paciente com autenticação (Supabase Auth), com área de próximas sessões, histórico de pagamentos, recibos e acesso à sala.
**Motivo:** Reduz trabalho manual recorrente da psicóloga e habilita recibo IRPF e histórico. Custo aceito: escopo maior no MVP.
**Escopo:** Auth, RLS multi-perfil (psicóloga / paciente), portal.

### [2026-09-09] Pagamentos: Asaas, sandbox primeiro
**Contexto:** Recebimento de sessões e pacotes mensais.
**Decisão:** Asaas como gateway. Desenvolvimento inteiro contra `https://api-sandbox.asaas.com/v3`; produção (`https://api.asaas.com/v3`) só após QA Final + Security Audit.
**Motivo:** Sandbox permite simular confirmação de pagamento (botão "CONFIRMAR PAGAMENTO") e testar o ciclo completo de webhooks sem valor real.
**Regra de segurança:** API key do Asaas nunca no client — vive em Supabase Edge Function via `supabase secrets`. Webhook valida `authToken` forte antes de processar.
**Escopo:** Módulo financeiro.

### [2026-09-09] MVP com escopo completo (4 módulos)
**Contexto:** Definição do corte da primeira versão.
**Decisão:** MVP inclui os 4 módulos — Dashboard financeiro + Asaas, Sala de vídeo + sala de espera, Agenda + lembretes anti-no-show, Prontuário + recibos IRPF.
**Motivo:** Decisão explícita do dev. É um MVP grande — será quebrado em sprints sequenciais pelo Backlog Agent, com QA aprovando cada uma antes da seguinte.
**Escopo:** Planejamento e backlog.

### [2026-09-09] Gravação de sessão fora do MVP
**Contexto:** Gravar atendimento psicológico envolve dado pessoal sensível e risco jurídico.
**Decisão:** Não gravar sessões no MVP. Se entrar em fase futura, só com consentimento explícito registrado por sessão e armazenamento criptografado.
**Motivo:** Recomendação técnica aceita — reduz superfície de risco LGPD sem perda funcional para o atendimento.
**Escopo:** Módulo de vídeo.

### [2026-09-09] Nome correto do produto: Talitha Psicologia
**Contexto:** A demanda inicial trazia "Taltiha", mas o repositório criado pelo dev é `Psicologia-Talitha`.
**Decisão:** O nome correto é **Talitha**. Pasta, arquivos de docs e todas as menções corrigidas antes do commit inicial.
**Escopo:** Naming em todo o projeto — código, docs e UI.

### [2026-09-09] Lembretes anti-no-show por e-mail no MVP
**Contexto:** WhatsApp tem taxa de leitura muito superior no Brasil, mas a Cloud API da Meta exige verificação de negócio, aprovação de template e tem custo por mensagem.
**Decisão:** E-mail transacional no MVP. WhatsApp fica para v1.1, avaliado pela taxa de abertura real.
**Alternativas descartadas:** WhatsApp Cloud API no MVP (atrasaria 1–2 semanas); botão de envio manual via wa.me (exige clique da psicóloga por paciente).
**Escopo:** Módulo de agenda e régua de cobrança.

### [2026-09-09] Landing page pública fora do MVP
**Contexto:** SEO foi um dos motivos da escolha do Next.js, mas os 4 módulos já formam um MVP de ~5–7 sprints.
**Decisão:** Landing entra como sprint complementar após o app estar operando. A estrutura do Next.js já a acomoda sem retrabalho.
**Escopo:** Roadmap.

### [2026-09-09] Decisões conservadoras do PO — validadas
**Contexto:** O PO Agent tomou decisões de escopo sem poder consultar o dev (limitação de agentes spawnados).
**Decisões aceitas sem alteração:**
- Responsável legal de paciente menor **não tem login próprio** no MVP; dados ficam no cadastro do paciente e o recibo sai no CPF do responsável.
- **RBAC com roles fixos** — apenas `psychologist` e `patient`. Prática solo não justifica roles dinâmicos.
- **Prontuário não é visível ao paciente** — evolução clínica é sigilosa, acesso exclusivo da psicóloga.
- **Export LGPD não inclui conteúdo clínico** — o titular acessa seus dados cadastrais, financeiros e de agenda; evolução clínica é compartilhada apenas a critério profissional.
- **Tom dos e-mails de cobrança respeitoso, nunca agressivo** — contexto de saúde mental.
**Escopo:** Produto e permissões.

### [2026-09-09] Talitha não atende pacientes menores de 18 anos
**Contexto:** O Security Review classificou como **Crítico (C1)** o consentimento de menor sendo coletado do próprio menor — violação do art. 14 da LGPD e do CFP, o que invalidaria a base legal de todo o tratamento clínico daquele paciente.
**Decisão:** A prática é exclusivamente adulta, de forma permanente. Cadastro valida idade ≥ 18 e bloqueia menores.
**Efeitos:** Persona "Responsável Legal" removida do produto; retenção de prontuário fixa em **5 anos** (a regra CFP de 20 anos não é modelada); recibo IRPF sempre no CPF do próprio paciente; nenhum fluxo de aceite de responsável legal. Resolve C1 e remove a complexidade de retenção variável do schema.
**Escopo:** Cadastro de paciente, consentimento, prontuário, recibos, modelo de dados.

### [2026-09-09] MFA TOTP obrigatório para a psicóloga
**Contexto:** O PO havia deixado MFA fora do MVP; o Security Review contrariou e tornou obrigatório.
**Decisão:** MFA TOTP obrigatório para o perfil `psychologist`. MFA para paciente fica fora do MVP.
**Motivo:** A conta da psicóloga dá acesso ao prontuário de todos os pacientes — é a chave do cofre. Senha isolada não é posição defensável perante o CRP em caso de invasão. Custo aceito: configuração única de app autenticador + 6 dígitos no login.
**Escopo:** Autenticação.

### [2026-09-09] Criptografia de prontuário: envelope AES-256-GCM com KEK fora do Supabase
**Contexto:** O PO deixou a abordagem aberta; o Security Review avaliou três caminhos.
**Decisão:** AES-256-GCM application-level, envelope DEK/KEK, AAD = `patient_id|record_id`, **KEK em variável de ambiente do EasyPanel** (fora do Supabase), rota com `runtime='nodejs'`.
**Motivo:** Com `pgcrypto` ou Supabase Vault, um único vazamento de `SUPABASE_SERVICE_ROLE_KEY` expõe todo o prontuário em claro — a chave ficaria no mesmo domínio de confiança do dado, anulando o próprio requisito.
**Impacto aceito:** Busca no histórico de evoluções vira decrypt-then-filter, sem índice em plaintext.
**Alternativas descartadas:** `pgcrypto` (chave vaza em logs e `pg_stat_statements`); Vault para conteúdo clínico (root key no mesmo provedor).
**Escopo:** Prontuário. Mover a KEK para `supabase secrets` "por simplicidade" é motivo de reprovação em code review.

### [2026-09-09] Conformidade CFP migrada da Resolução 11/2018 para a 09/2024
**Contexto:** O planejamento inicial foi feito sobre a Resolução CFP nº 11/2018, que exigia cadastro na plataforma e-Psi. O dev corrigiu: a **Resolução CFP nº 09/2024** substituiu as Resoluções 11/2018 e 04/2020, revogou a obrigatoriedade do e-Psi, e a plataforma foi desativada em 31/08/2024.
**Decisão:** Toda conformidade CFP do produto passa a se referir à Resolução 09/2024. Menções a e-Psi nos docs anteriores são históricas e não devem ser implementadas. O CRP ativo continua obrigatório.
**Efeito material — não é só remoção:** a 09/2024 desloca a decisão para a avaliação técnica da própria psicóloga, que **responde diretamente pelos critérios usados**, e exige que a **avaliação de viabilidade do atendimento remoto seja registrada no prontuário, com data**. Isso é um requisito funcional novo (Emenda E6) que substitui o e-Psi como o item de conformidade CFP do software — e é mais relevante, porque é o documento que protege a psicóloga perante o CRP.
**Outros efeitos:** o termo de consentimento passa a exigir cláusulas de formato online, política de faltas e queda de conexão (E7); as vedações automáticas de atendimento em crise, emergência, violência e desastre foram revogadas, então o app **não** deve bloquear esses casos por regra rígida (E8).
**Escopo:** Prontuário, consentimento, onboarding da psicóloga, e qualquer validação de elegibilidade de caso.

### [2026-09-09] service_role mantém grant residual em funções authenticated-only
**Contexto:** Após a normalização canônica dos grants (migration 15), o QA mapeou as 9 funções × 3 papéis e encontrou 4 células divergentes: `service_role` retém `EXECUTE` em `log_audit`, `enter_waiting_room`, `admit_patient` e `cancel_session`, que deveriam ser exclusivas de `authenticated`.
**Causa:** o `ALTER DEFAULT PRIVILEGES` do Supabase inclui `service_role` entre os papéis que recebem grant direto, e a normalização revogou de `PUBLIC`, `anon` e `authenticated` — não de `service_role`.
**Decisão:** não corrigir. As quatro funções têm gate interno de `auth.uid() IS NULL`, e `service_role` não tem `auth.uid()` — então a chamada falha com `P0001` antes de qualquer efeito. O privilégio existe, a ação não.
**Risco aceito:** defense-in-depth de uma camada em vez de duas nessas quatro funções. Aceitável porque `service_role` só é alcançável do servidor (garantido em código por `import 'server-only'` em `admin.ts`), e o gate interno é o mesmo mecanismo que protege contra `anon`.
**Revisar se:** alguma dessas funções perder o gate de `auth.uid()`, ou se `service_role` passar a ser usada em contexto onde `auth.uid()` esteja populado.
**Escopo:** Grants de função.

### [2026-09-09] Verificação V18 pendente de execução no SQL Editor
**Contexto:** A V18 varre o catálogo inteiro via `has_function_privilege` para listar qualquer função executável por `anon`. O QA validou as 9 funções conhecidas funcionalmente (todas `42501`), mas a varredura genérica exige `SET ROLE`, que o PostgREST não permite.
**Decisão:** V18 fica como verificação manual no SQL Editor do dashboard, a rodar antes de cada deploy, até que o projeto tenha um cliente Postgres direto nos testes.
**Pendência técnica:** adicionar `pg` como devDependency habilitaria `SET ROLE` nos testes de integração e automatizaria a V18 — vale avaliar na Sprint 2, quando o QA precisar testar RLS por papel autenticado.
**Escopo:** Verificações de segurança do banco.

### [2026-09-10] Deploy de Edge Functions pendente — falta Personal Access Token do Supabase
**Contexto:** A Sprint 4 criou a primeira Edge Function (`send-reminders`). Deploy e `supabase secrets set` exigem um **Personal Access Token de conta** do Supabase (`~/.supabase/access-token`), que não existe nesta máquina. As chaves de projeto já fornecidas (anon, service_role, database password) não servem para isso.
**Decisão:** seguir o desenvolvimento com as Edge Functions **escritas e versionadas, mas não deployadas**. A lógica de decisão é extraída em função pura e testada isoladamente, para que a ausência de deploy não deixe o comportamento sem cobertura.
**Consequência aceita:** nenhum fluxo que dependa de Edge Function é testável ponta a ponta até o deploy — lembretes (Sprint 4), **webhook do Asaas (Sprint 5)** e emissão de token do LiveKit (Sprint 6). O webhook do Asaas é o mais crítico: é ele que concilia pagamento com sessão, e sua idempotência e validação de `authToken` só se provam contra o endpoint real.
**Como resolver quando o dev decidir:** gerar token em supabase.com/dashboard/account/tokens, colocar em `docs/credentials.md`; ou o dev roda `npx supabase login` + `functions deploy` + `secrets set` no próprio terminal.
**Também pendente:** o agendamento do job (pg_cron no Supabase vs serviço externo) não foi decidido. Sem agendamento, a function existe e nunca é chamada.
**Escopo:** Todas as Edge Functions do projeto.

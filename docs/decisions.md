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

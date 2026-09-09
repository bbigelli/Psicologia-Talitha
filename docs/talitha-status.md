# Status: talitha-psicologia
## Fase atual: Planejamento -- Security Review da arquitetura concluido (REPROVADA), proximo passo correcoes do Architect
## Ultimo agente: Security Agent (Review de arquitetura)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md)
- Security Review (arquitetura): CONCLUIDO -- **REPROVADA** (docs/talitha-security-review-architecture.md)
- Correcoes do Architect (8 itens): -- pendente <- PROXIMO PASSO
- Data Architect: -- bloqueado ate as correcoes 1, 2 e 5 (alteram o input do schema)
- Security Review (schema): -- pendente
- Backlog: -- pendente

### Outputs do System Architect
- `docs/talitha-architecture.md` -- Arquitetura completa:
  - Estrutura de pastas `src/` com route groups por perfil ((auth), (consent), (psychologist), (patient), (video))
  - Fronteiras de confianca: browser / Next.js Node / Supabase Edge Functions / Postgres
  - Padrao de modulo de dominio com exemplo ponta a ponta (schema -> action -> hook -> componente)
  - Padrao de acesso a dados (Server Component vs TanStack Query vs Server Action)
  - Autenticacao e autorizacao (middleware, guards, MFA, headers HTTP, bootstrap de roles)
  - Integracoes: Asaas (webhook Edge Function, cobranca via invoke, retry), LiveKit (token Edge Function, 8 pre-condicoes, grants), Resend (user-initiated + cron)
  - Modulo de criptografia: envelope AES-256-GCM, DEK/KEK, AAD, blind index CPF, crypto-shredding
  - Audit log 4 camadas: RLS+FORCE, triggers, REVOKE, hash chain
  - Tratamento de erros e observabilidade (o que nunca pode ser logado)
  - Tabela de variaveis de ambiente (12 vars, localizacao, classificacao)
  - Estrategia de testes (Vitest + Playwright, gate 5.5 detalhado)
  - Build e deploy EasyPanel (Dockerfile multi-stage, standalone output)
  - 17 requisitos explicitados para o Data Architect absorver
  - 20 regras tecnicas do projeto

- `docs/adr/` -- 6 ADRs:
  - ADR-0001: Criptografia envelope com KEK fora do Supabase
  - ADR-0002: Sala de espera no Postgres, fora do LiveKit
  - ADR-0003: Webhook Asaas em Edge Function
  - ADR-0004: Audit log com 4 camadas de imutabilidade
  - ADR-0005: Numeracao de recibo com contador transacional
  - ADR-0006: Fronteira Server/Client Component e Server Actions

- `CLAUDE.md` -- Regras especificas do projeto (regras de negocio permanentes + tecnicas + pointers para docs)

### Decisoes tomadas pelo Architect (spawnado, sem AskUserQuestion)

1. **Stack confirmada como Next.js 16 App Router + TypeScript strict** (decisao ja fechada em docs/decisions.md, sem alternativa a propor).

2. **Webhook do Asaas em Edge Function do Supabase (nao Route Handler do Next.js).** Razao: segredos de pagamento (ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN) ficam no dominio Supabase; verify_jwt=false e nativo; isolamento; a Edge Function nao precisa da KEK.

3. **Emissao de token LiveKit em Edge Function do Supabase.** Razao: segredos LiveKit em supabase secrets; SDK compativel com Deno; verificacao de 8 pre-condicoes server-side.

4. **Emails divididos: user-initiated via Next.js (Resend SDK), cron-based via Edge Functions (Resend API).** Implica RESEND_API_KEY duplicado em EasyPanel e supabase secrets. Alternativa descartada: todas as emails por Edge Function (adicionaria latencia e complexidade para emails user-initiated).

5. **Cobrancas no Asaas via Server Action -> supabase.functions.invoke('create-charge').** Mantem ASAAS_API_KEY exclusivamente no dominio Supabase. O Server Action valida com zod e chama a Edge Function.

6. **Rota `/confirmar/[token]` como pagina publica em (auth)** para links de acao em email (confirmar/cancelar presenca). Token opaco no path, sem criar sessao autenticada.

7. **PDF de recibo gerado on-demand em Route Handler** (`/api/receipts/[id]/download`, runtime='nodejs') porque precisa decifrar CPF (KEK no EasyPanel). Sem persistencia de PDF — uma superficie a menos.

### Outputs do Security Review da arquitetura

- `docs/talitha-security-review-architecture.md` -- veredicto **Reprovada**:
  - **Matriz de absorcao dos 42 issues:** 26 absorvidos / 11 parciais / 5 nao absorvidos.
    A afirmacao do Architect de que todos os 42 foram absorvidos nao se sustenta; a causa e unica --
    varios requisitos discutidos em prosa nao foram traduzidos para a secao 17 (o handoff real).
    - Criticos: C1, C2, C3 absorvidos; **C4 parcial** (ancora externa do hash chain sem mecanismo).
    - Altos: 12 absorvidos; **A1, A5, A9, A11 parciais**.
    - Nao absorvidos: M1 (rate limiting), M2 (rascunho de anotacoes), M5 (politica de senha),
      M9 (alteracao de e-mail), B7 (mensagens genericas de login/reset).
  - **36 issues novos:** 2 Critico / 12 Alto / 15 Medio / 7 Baixo.
    - **AC1** -- Edge Function `create-charge` sem contrato de autorizacao e ausente da estrutura:
      paciente autenticado invoca direto e cria cobranca arbitraria (inclusive no nome de terceiro).
    - **AC2** -- paciente com `UPDATE` direto em `sessions` (ADR-0002 passo 2): RLS e por linha,
      nao por coluna -- auto-admissao na sala e tampering de `payment_status`/`status`/`scheduled_at`.
  - **8 correcoes requeridas ao Architect** (todas de especificacao, 1 rodada estimada) -- secao 3.1.
  - **12 ressalvas obrigatorias ao Stack Agent** -- secao 3.2 (vao para o Backlog).
  - **5 pendencias humanas novas** -- secao 3.3.
  - **15 requisitos adicionais + 7 correcoes** ao handoff do Data Architect -- secao 4.

### Decisoes tomadas pelo Security Agent (spawnado, sem AskUserQuestion)

1. **Veredicto Reprovada em vez de "aprovada com ressalvas".** Os dois Criticos alteram o input do
   Data Architect (policies de `sessions` e tabela de tokens de acao) -- modelar o schema antes de
   corrigi-los produz retrabalho garantido. Alternativa descartada: aprovar com ressalvas e deixar
   AC1/AC2 para o Stack Agent, o que colocaria uma auto-admissao explotavel dentro do schema.
2. **M2 (rascunho de anotacoes) reclassificado de Medio para Alto.** No PRD era ambiguidade de story;
   agora existe um componente na arquitetura sem coluna cifrada correspondente, e o caminho de menor
   esforco (`localStorage` ou coluna em claro) tira conteudo clinico do envelope do ADR-0001.
3. **DoS e timing na busca decrypt-then-filter avaliados como Baixo, nao inflados.** A unica chamadora
   e a psicologa (auto-DoS), volume total ~1500 registros. O problema real ali e semantica de
   auditoria (acesso a conteudo clinico sem `VIEW_RECORD`) -- registrado como Medio (AM9).
4. **Duplicacao do `RESEND_API_KEY` julgada justificada, com correcao.** A divisao entre dominios se
   sustenta; o erro e ser a *mesma* chave. Recomendado duas chaves distintas com escopo sending-only
   (AM3), em vez de unificar o envio num unico dominio.

### Blockers
- GitHub CLI (`gh`) nao instalado -- repositorio remoto nao criado.
- Credenciais Asaas Sandbox (API key + webhook token) nao fornecidas.
- Credenciais LiveKit Cloud (API key + secret + URL) nao fornecidas.
- Confirmar cadastro ativo no e-Psi (CFP) da psicologa.
- Custodia da KEK nao definida (procedimento escrito + 2 copias offline + teste de restauracao).
- DNS: SPF + DKIM + DMARC p=reject no dominio de envio.
- Acesso ao painel EasyPanel sem controle definido (2FA, contas nomeadas, inventario de acesso).
  A KEK e tao segura quanto esse acesso -- ver AA12 do review de arquitetura.
- Ambiente de teste dedicado (projeto Supabase de teste + credenciais LiveKit de dev) inexistente:
  sem ele o gate 5.5 (isolamento da sala) nao e executavel -- ver AM13.
- Regiao do LiveKit Cloud nao confirmada (preferencia sul-americana, A5).

### Pendencias tecnicas
- 11 issues do Security Review do PRD em estado **parcial** e 5 **nao absorvidos** -- ver matriz
  na secao 1 de docs/talitha-security-review-architecture.md
- 36 issues novos do Security Review da arquitetura (2C / 12A / 15M / 7B)
- 12 ressalvas obrigatorias ao Stack Agent -- entram no Backlog como requisitos de implementacao
- 16 pendencias humanas acumuladas (11 do review do PRD + 5 novas)

### Proximo passo
**Architect** aplica as 8 correcoes da secao 3.1 de `docs/talitha-security-review-architecture.md`.
Todas sao de especificacao -- nenhuma exige redesenho ou revisao de decisao estrutural; 1 rodada
estimada. Depois: verificacao pontual pelo Security Agent (nao um novo review completo) e, com as
correcoes 1, 2 e 5 aplicadas, liberacao do **Data Architect** tendo a secao 4 do review como entrada
obrigatoria junto com a secao 17 corrigida da arquitetura. Em seguida, Security Review do schema
(3o momento obrigatorio).

# Status: talitha-psicologia
## Fase atual: Planejamento -- System Architect concluido, proximo passo Security Review da arquitetura
## Ultimo agente: System Architect
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md) <- CONCLUIDO
- Security Review (arquitetura): -- pendente <- PROXIMO PASSO
- Data Architect: -- pendente
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

### Blockers
- GitHub CLI (`gh`) nao instalado -- repositorio remoto nao criado.
- Credenciais Asaas Sandbox (API key + webhook token) nao fornecidas.
- Credenciais LiveKit Cloud (API key + secret + URL) nao fornecidas.
- Confirmar cadastro ativo no e-Psi (CFP) da psicologa.
- Custodia da KEK nao definida (procedimento escrito + 2 copias offline).
- DNS: SPF + DKIM + DMARC p=reject no dominio de envio.

### Pendencias tecnicas
- 16 issues Alto e 14 Medio do Security Review -- responsaveis atribuidos
- 11 pendencias humanas do Security Review (DPAs, DNS, textos juridicos)

### Proximo passo
Ativar **Security Review da arquitetura** (segundo dos tres momentos obrigatorios). Entradas: `docs/talitha-architecture.md`, `docs/adr/`, `CLAUDE.md`, mais os documentos anteriores. O Security Review valida se a arquitetura absorveu corretamente os 42 issues e identifica lacunas novas. Em seguida: Data Architect.

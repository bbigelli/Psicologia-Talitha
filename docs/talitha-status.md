# Status: talitha-psicologia
## Fase atual: Planejamento -- Correcoes do Architect aplicadas, proximo passo Data Architect
## Ultimo agente: System Architect (correcoes pos-Security Review)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: OK (docs/decisions.md)
- PO / PRD + stories: OK (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): OK (docs/talitha-security-review-prd.md)
- Design & UI: OK (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: OK v1.1 (docs/talitha-architecture.md + docs/adr/ + CLAUDE.md) <- CORRECOES APLICADAS
- Security Review (arquitetura): OK (docs/talitha-security-review-architecture.md)
- Data Architect: -- pendente <- PROXIMO PASSO
- Security Review (schema): -- pendente
- Backlog: -- pendente

### Correcoes aplicadas (v1.0 -> v1.1)

8 correcoes do Security Review da arquitetura:

| # | Correcao | Arquivos alterados |
|---|----------|--------------------|
| 1 | `create-charge` especificada (verify_jwt, role no banco, body so charge_id) | architecture.md (secoes 2, 8.1, 12.1), ADR-0006 |
| 2 | Removido UPDATE direto em `sessions`; RPC SECURITY DEFINER; RLS nao e column-level | architecture.md (secoes 4.4, 6.1, 8.2, 16, 17), ADR-0002 |
| 3 | Middleware nao e fronteira; wrappers obrigatorios; fail-closed; allowedOrigins | architecture.md (secoes 2, 5.1, 7.1, 7.2, 16), ADR-0006 |
| 4 | Gate de MFA corrigido para aal2; recuperacao de senha coberta | architecture.md (secoes 7.1, 7.3, 16) |
| 5 | Exemplo corrigido (UUID antes de cifrar); keys.ts com validacao; proibido `!` | architecture.md (secoes 2, 5.1, 9.1, 9.3) |
| 6 | force-dynamic/no-store; Dockerfile (ARGs, --ignore-scripts, sem segredos) | architecture.md (secoes 3, 7.4, 14.1, 14.3, 16) |
| 7 | Rascunho como conteudo clinico cifrado (session_note_drafts); proibido localStorage | architecture.md (secoes 9.2, 16, 17) |
| 8 | ADR-0001 risco residual; checklist 14.3 completo | ADR-0001, architecture.md (secao 14.3) |

Alem das 8: secao 17 reescrita (32 requisitos), nova secao 18 (12 requisitos Stack Agent), CLAUDE.md atualizado (6 regras novas), ADR-0006 atualizado.

### Blockers
- GitHub CLI nao instalado
- Credenciais Asaas Sandbox nao fornecidas
- Credenciais LiveKit Cloud nao fornecidas
- Cadastro e-Psi a confirmar
- Custodia da KEK nao definida
- DNS (SPF/DKIM/DMARC) pendente
- 2FA na conta EasyPanel
- Regiao do LiveKit Cloud a confirmar
- Duas chaves Resend a criar
- Ambiente de teste dedicado
- Versao minima do Next.js a fixar

### Proximo passo
Ativar **Data Architect**. Entradas: `docs/talitha-architecture.md` (v1.1, secao 17 com 32 requisitos), `docs/talitha-security-review-architecture.md` (secao 4), `docs/talitha-security-review-prd.md`, `docs/decisions.md`.

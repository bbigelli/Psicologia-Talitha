# Status: talitha-psicologia
## Fase atual: Planejamento — PO concluido, aguardando Security Review
## Ultimo agente: PO Agent
## Branch: main (repositorio local inicializado, sem remote)

### Planejamento
- Decisoes de stack e escopo: ✅ (docs/decisions.md)
- PO / PRD + stories: ✅ (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): — pendente ← PROXIMO PASSO
- Design & UI: — pendente
- System Architect: — pendente
- Security Review (arquitetura): — pendente
- Data Architect: — pendente
- Security Review (schema): — pendente
- Backlog: — pendente

### Outputs do PO
- `docs/talitha-prd.md` — PRD completo: 3 personas, 4 modulos MVP, compliance CFP/LGPD, integracoes (Asaas, LiveKit, email transacional), hipoteses, metricas, riscos
- `docs/talitha-user-stories.md` — 36 user stories em 5 epicos (0-4), todas com criterios de aceite (happy path + edge cases + estados vazios/loading/erro)
- Classificacao: **Projeto novo** — fluxo completo de planejamento

### Decisoes tomadas pelo PO (requerem validacao do dev)
1. **Responsavel legal sem login proprio no MVP** — dados do responsavel ficam no cadastro do paciente. Recibos emitidos no CPF do responsavel. Login proprio do responsavel e pos-MVP.
2. **Lembretes via email no MVP** — WhatsApp API descartada por custo e complexidade. Se taxa de leitura de email for baixa pos-deploy, priorizar integracao WhatsApp em v1.1.
3. **Landing page fora do MVP** — os 4 modulos ja formam um MVP grande. Next.js foi escolhido para suportar SEO no futuro, mas o MVP foca nos modulos confirmados. Landing pode ser adicionada em sprint complementar.
4. **RBAC com roles fixos (Abordagem A)** — apenas 2 roles: `psychologist` e `patient`. Pratica solo, sem necessidade de roles dinamicos.
5. **Tom dos emails de cobranca** — respeitoso e profissional, nunca agressivo (contexto de saude mental). Definido como requisito nao-funcional.
6. **Prontuario NAO visivel ao paciente** — dado clinico sigiloso, apenas a psicologa acessa evolucoes. Paciente ve apenas dados do portal (sessoes, pagamentos, recibos, anamnese propria).
7. **Export LGPD nao inclui conteudo clinico** — evolucoes sao sigilosas e compartilhaveis apenas a criterio da psicologa, conforme etica profissional.

### Blockers
- GitHub CLI (`gh`) nao instalado nesta maquina — repositorio remoto em github.com/bbigelli ainda nao criado.
- Credenciais Asaas Sandbox (API key) ainda nao fornecidas pelo dev.
- Credenciais LiveKit Cloud (API key + secret + URL do projeto) ainda nao fornecidas.
- Confirmar se a psicologa ja possui cadastro ativo no e-Psi (CFP) — requisito legal para atendimento online.
- Servico de email transacional nao definido (sugestao do PO: Resend, decisao do System Architect).

### Pendencias tecnicas
- (vazio)

### Proximo passo
Ativar Security Review do PRD — o PRD contem autenticacao, integracao externa com Asaas (pagamento), integracao com LiveKit (video), dados sensiveis de saude (LGPD), criptografia de prontuario e audit log. Security Review e obrigatorio antes de prosseguir.

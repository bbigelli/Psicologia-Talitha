# Status: talitha-psicologia
## Fase atual: Planejamento — Design & UI concluido, proximo passo System Architect
## Ultimo agente: Design & UI Agent
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: ✅ (docs/decisions.md)
- PO / PRD + stories: ✅ (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): ✅ (docs/talitha-security-review-prd.md)
- Design & UI: ✅ (docs/talitha-design-system.md + docs/talitha-wireframes.md + docs/talitha-navigation-flow.md)
- System Architect: — pendente ← PROXIMO PASSO
- Security Review (arquitetura): — pendente
- Data Architect: — pendente
- Security Review (schema): — pendente
- Backlog: — pendente

### Outputs do PO
- `docs/talitha-prd.md` — PRD completo: 3 personas (1 removida por E1), 4 modulos MVP, compliance CFP/LGPD, integracoes (Asaas, LiveKit, email transacional), hipoteses, metricas, riscos
- `docs/talitha-user-stories.md` — 36 user stories em 5 epicos (0-4), todas com criterios de aceite (happy path + edge cases + estados vazios/loading/erro)
- Classificacao: **Projeto novo** — fluxo completo de planejamento

### Outputs do Security Review (PRD)
- `docs/talitha-security-review-prd.md` — review completo: classificacao de dados (16 categorias), threat model STRIDE em 8 superficies, 42 issues (4 Critico / 16 Alto / 14 Medio / 8 Baixo), requisitos por modulo, inventario de segredos
- 4 Criticos resolvidos: C1 resolvido pela Emenda E1 (sem menores); C2/C3/C4 com decisoes tecnicas definidas no review

### Outputs do Design & UI
- `docs/talitha-design-system.md` — Design system completo:
  - Direcao visual "Acolher" (Sage Teal): paleta acolhedora com primario HSL(168, 30%, 38%), backgrounds warm off-white, contraste WCAG AA verificado
  - Tokens CSS variables (light + dark) prontos para colar em globals.css
  - Tailwind config extend pronto para colar
  - Tipografia Inter via next/font, escala de uso documentada
  - Sistema de icones lucide-react com mapeamento por contexto
  - Inventario de componentes Atomic Design: 10+ atoms (shadcn), 8 molecules, 14 organisms, 5 templates
  - Estados de componentes (Button, Input, Card, SessionSlot, StatusBadge)
  - Comportamento responsivo tabulado por componente e breakpoint (2 perfis)
  - Estrategia de loading (skeleton vs spinner por tipo de conteudo)
  - Acessibilidade WCAG AA: contraste, touch targets, ARIA, focus, keyboard, prefers-reduced-motion
  - Politica de conteudo discreto (termos neutros no portal do paciente)
  - Complementos aprovados: **Vaul** (drawer mobile) + **TanStack Table** (tabelas financeiras)
- `docs/talitha-wireframes.md` — 34 telas especificadas em ASCII:
  - 19 telas psicologa (login, MFA setup/verify, onboarding, dashboard, agenda, pacientes, ficha com 5 tabs, evolucao, sala de video, pre-flight, admissao, cobranca, inadimplentes)
  - 12 telas paciente (criar senha, 2 telas de consentimento segmentado, portal home, sala de espera, sala de video, anamnese, pagamentos, documentos, perfil com consentimentos)
  - 3 telas compartilhadas (404, 500, estados de negacao de acesso a sala)
  - Todos os estados criticos documentados (loading, vazio, erro, sucesso, reconexao, negacao)
  - Mobile e desktop onde o layout muda significativamente
- `docs/talitha-navigation-flow.md` — Fluxo de navegacao:
  - Mapa de rotas hierarquico (todas as rotas do app)
  - Guards de autenticacao com logica de redirect (middleware)
  - Guard de sala de video (8 pre-condicoes server-side)
  - 7 maquinas de estado: onboarding psicologa (com MFA), convite paciente (com consentimento), entrada na sessao (pre-flight -> espera -> admissao -> sala -> encerramento), agendamento (com conflito), pagamento (cobranca -> webhook -> recibo), revogacao de consentimento, solicitacao LGPD
  - Transicoes e animacoes tabuladas

### Decisoes tomadas pelo Design Agent (spawnado, sem AskUserQuestion)

1. **Direcao visual "Acolher" (Sage Teal):** escolhida por equilibrio entre calor e profissionalismo. Alternativas descartadas: "Sereno" (Cool Blue, frio demais para contexto de terapia) e "Terra" (Warm Earth, tendencia visual fragil e conflito com dashboard financeiro). Se o dev preferir ajustar a paleta, os tokens sao editaveis sem impacto estrutural.

2. **Termos neutros no portal do paciente:** header mostra apenas "Talitha" (sem "Psicologia"), sessoes chamadas de "compromissos", recibos chamados de "documentos", pagamentos generico. Decisao baseada no requisito de discretion do PRD e na politica de email do Security Review. O painel da psicologa usa termos clinicos livremente.

3. **Navegacao da psicologa em mobile: hamburger menu (Sheet) em vez de bottom nav.** Justificativa: o painel e desktop-first e o uso mobile e eventual. Bottom nav consumiria espaco de tela permanente para um caso de uso secundario. Se o dev preferir bottom nav, a mudanca e simples (PsychologistBottomNav ja pode ser derivado do PatientBottomNav).

4. **Vaul recomendado para drawers mobile** (portal do paciente e acoes contextuais na agenda). Justificativa: shadcn Sheet e lateral e nao ergonomico em mobile; Vaul segue padrao nativo de bottom drawer.

5. **TanStack Table recomendado para tabelas financeiras e audit log** (cobrancas, inadimplentes, recibos, audit). Justificativa: volume de ate 500 cobrancas (requisito do PRD) + necessidade de sort/filter/paginacao. Nao recomendado para listas simples (pacientes, sessoes do paciente).

6. **Tremor NAO recomendado.** KPI cards e grafico de receita sao atendidos com shadcn Card + recharts diretamente. Tremor traria uma segunda linguagem visual que poderia conflitar com a paleta acolhedora.

7. **Fundo da sala de video sempre dark** (mesmo em light mode). Justificativa: otimiza contraste e foco visual no video. Padrão de todas as plataformas de video.

8. **Consentimento LGPD segmentado em 3 secoes** (clinico obrigatorio + Asaas obrigatorio + email opcional) conforme requisito A4 do Security Review. Cada secao com checkbox proprio e destaque visual diferenciado (obrigatorio vs opcional).

9. **Sala de espera: animacao "breathe" em vez de spinner.** Contexto de saude mental — transmitir calma, nao urgencia. Pulsacao suave (4s cycle) em vez de rotacao rapida.

10. **Radius 0.625rem (10px).** Equilibrio entre suavidade e profissionalismo. Nem afiado (corporativo/frio) nem arredondado demais (infantil/casual).

### Blockers
- GitHub CLI (`gh`) nao instalado nesta maquina — repositorio remoto em github.com/bbigelli ainda nao criado.
- Credenciais Asaas Sandbox (API key + webhook token) ainda nao fornecidas pelo dev.
- Credenciais LiveKit Cloud (API key + secret + URL do projeto) ainda nao fornecidas.
- Confirmar se a psicologa ja possui cadastro ativo no e-Psi (CFP) — requisito legal para atendimento online.
- Servico de email transacional nao definido (sugestao do PO: Resend, decisao do System Architect).
- Custodia da chave de criptografia (KEK) nao definida.

### Pendencias tecnicas
- 16 issues Alto e 14 Medio do Security Review — responsaveis atribuidos (Architect / Data Architect / Stack Agent)
- 11 pendencias humanas do Security Review (DPAs, DNS, textos juridicos, etc.)

### Proximo passo
Ativar **System Architect**. Entradas obrigatorias: `docs/talitha-prd.md`, `docs/talitha-user-stories.md`, `docs/talitha-security-review-prd.md`, `docs/talitha-design-system.md`, `docs/talitha-wireframes.md`, `docs/talitha-navigation-flow.md`, `docs/decisions.md`. O Architect deve produzir `docs/talitha-architecture.md`, ADRs (criptografia, audit log, token LiveKit, webhook), `CLAUDE.md` do projeto, e retornar para Security Review da arquitetura.

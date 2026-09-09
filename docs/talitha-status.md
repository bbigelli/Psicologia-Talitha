# Status: talitha-psicologia
## Fase atual: Planejamento — Security Review (PRD) concluido, proximo passo Design & UI
## Ultimo agente: Security Agent (Modo 1 — Security Review do PRD)
## Branch: feature/planning-docs

### Planejamento
- Decisoes de stack e escopo: ✅ (docs/decisions.md)
- PO / PRD + stories: ✅ (docs/talitha-prd.md + docs/talitha-user-stories.md)
- Security Review (PRD): ✅ (docs/talitha-security-review-prd.md)
- Design & UI: — pendente ← PROXIMO PASSO
- System Architect: — pendente
- Security Review (arquitetura): — pendente
- Data Architect: — pendente
- Security Review (schema): — pendente
- Backlog: — pendente

### Outputs do PO
- `docs/talitha-prd.md` — PRD completo: 3 personas, 4 modulos MVP, compliance CFP/LGPD, integracoes (Asaas, LiveKit, email transacional), hipoteses, metricas, riscos
- `docs/talitha-user-stories.md` — 36 user stories em 5 epicos (0-4), todas com criterios de aceite (happy path + edge cases + estados vazios/loading/erro)
- Classificacao: **Projeto novo** — fluxo completo de planejamento

### Outputs do Security Review (PRD)
- `docs/talitha-security-review-prd.md` — review completo: classificacao de dados (16 categorias, incl. Sensivel-LGPD), threat model STRIDE em 8 superficies, 42 issues classificados (**4 Critico / 16 Alto / 14 Medio / 8 Baixo**), requisitos de seguranca por modulo, inventario de segredos, 11 ajustes recomendados ao PRD, 11 pendencias do dev/cliente
- **4 Criticos bloqueiam o System Architect:**
  1. **C1** — Consentimento de paciente menor coletado do proprio menor (US-004 coloca aceite do responsavel "fora de escopo") — viola LGPD art. 14 + CFP; base legal do tratamento clinico do menor fica invalida
  2. **C2** — Isolamento da sala de video sem especificacao de derivacao/validacao de `roomName` nem gate de admissao na emissao de token — risco de paciente A entrar na sessao de terapia de B
  3. **C3** — Criptografia de prontuario indefinida; `pgcrypto`/Supabase Vault colocam a chave no mesmo dominio de confianca do dado, entao um leak de `SERVICE_ROLE_KEY` expoe todo o prontuario em claro
  4. **C4** — Imutabilidade do audit log nao especificada; RLS nao protege contra `service_role`, que e o que a aplicacao usa

### Decisoes tomadas pelo Security Agent (spawnado, sem acesso a AskUserQuestion)
1. **Criptografia de prontuario:** AES-256-GCM application-level com envelope encryption (DEK por registro + KEK), AAD = `patient_id|record_id`, KEK em env do **EasyPanel** (deliberadamente fora do Supabase), `runtime = 'nodejs'` nas rotas que cifram. Descartados: `pgcrypto` (chave vaza em logs/`pg_stat_statements`) e Supabase Vault para conteudo clinico (root key no mesmo provedor do dado). Envelope tambem habilita crypto-shredding, unico mecanismo honesto de eliminacao com backup/PITR
2. **Sala de espera fora do LiveKit:** estado no Postgres (`waiting_since`/`admitted_at`); nenhum token emitido antes da admissao. Descartado: token com `canPublish:false` na sala de espera
3. **Consentimento de menor:** link de uso unico assinado ao e-mail do responsavel, sem login proprio (respeita a decisao do PO). Descartados: dar login ao responsavel; manter o menor aceitando (invalido)
4. **Audit log:** 4 camadas cumulativas (RLS + `FORCE ROW LEVEL SECURITY`; triggers de UPDATE/DELETE **e TRUNCATE**; `REVOKE`; hash chain com ancora externa semanal). Descartado: apenas RLS ou apenas trigger
5. **CPF:** persistido (recibo IRPF exige o numero completo), cifrado + blind index `HMAC-SHA256` com chave. Descartados: CPF em claro; CPF apenas no Asaas
6. **MFA TOTP obrigatorio para a psicologa** (US-003 listava MFA como fora de escopo). Uma conta acessa todos os prontuarios
7. **Recibo gerado on-demand**, sem PDF persistido no Storage no MVP; acesso por UUID, nunca pelo numero sequencial
8. **Paciente faz polling do proprio registro** em vez de assinar canal Realtime da fila de espera (broadcast/presence nao tem RLS de dados)
9. **Descricao de cobranca neutra no Asaas** (`Prestacao de servicos profissionais — Ref. MM/AAAA`); natureza clinica so no recibo

### Decisoes tomadas pelo PO (requerem validacao do dev)
1. **Responsavel legal sem login proprio no MVP** — mantida pelo Security Review (o aceite do responsavel foi resolvido por link de uso unico, sem login)
2. **Lembretes via email no MVP** — mantida, com politica de conteudo de e-mail obrigatoria (assunto/preheader/remetente nao podem revelar que o destinatario faz terapia)
3. **Landing page fora do MVP** — mantida
4. **RBAC com roles fixos (Abordagem A)** — mantida, com bootstrap controlado (role por seed/migration, nunca auto-atribuivel)
5. **Tom dos emails de cobranca respeitoso** — mantida
6. **Prontuario NAO visivel ao paciente** — mantida (RLS de `clinical_records` sem policy de SELECT para `patient`)
7. **Export LGPD nao inclui conteudo clinico** — mantida
8. **Granularidade de consentimento fora de escopo (US-005)** — ⚠️ **contrariada deliberadamente pelo Security Review**: granularidade por *finalidade* (clinico / Asaas / e-mail) e requisito de validade do consentimento para dado sensivel (art. 11, I). Granularidade por *tipo de dado* permanece fora
9. **Criptografia de CPF fora de escopo (US-404)** — ⚠️ **contrariada**: contradiz o proprio US-002 e hash sem chave de CPF e brute-forcavel
10. **MFA fora de escopo (US-003)** — ⚠️ **contrariada** para a conta da psicologa

### Blockers
- GitHub CLI (`gh`) nao instalado nesta maquina — repositorio remoto em github.com/bbigelli ainda nao criado.
- Credenciais Asaas Sandbox (API key + webhook token) ainda nao fornecidas pelo dev.
- Credenciais LiveKit Cloud (API key + secret + URL do projeto) ainda nao fornecidas.
- Confirmar se a psicologa ja possui cadastro ativo no e-Psi (CFP) — requisito legal para atendimento online.
- Servico de email transacional nao definido (sugestao do PO: Resend, decisao do System Architect).
- **Decisao de negocio pendente:** o MVP atendera pacientes menores de idade? Se **nao**, o Critico C1 sai do caminho da primeira release e o MVP fica materialmente mais simples (recomendacao tecnica: postergar menores para v1.1, implementando `is_minor` apenas como bloqueio de cadastro).
- **Custodia da chave de criptografia (KEK)** nao definida — 2 copias offline em custodias distintas + teste de restauracao documentado sao obrigatorios antes do go-live. Perder a KEK = perda irreversivel de prontuario sob guarda legal de 5/20 anos.

### Pendencias tecnicas
- 16 issues **Alto** e 14 **Medio** documentados em `docs/talitha-security-review-prd.md` secao 10 — todos com responsavel atribuido (Architect / Data Architect / Stack Agent). Os Altos sao pre-condicao de conformidade, nao recomendacao.
- 11 **pendencias humanas** (secao 13 do review): DPA com Supabase/LiveKit/Asaas/provedor de e-mail, base para transferencia internacional (art. 33), canal de atendimento ao titular, textos juridicos, DNS com SPF/DKIM/DMARC `p=reject`, plano de resposta a incidente (art. 48), retencao de backup/PITR do plano Supabase contratado.

### Proximo passo
Ativar **Design & UI**. O review levantou telas e estados que precisam nascer no design, nao serem enxertados depois: consentimento segmentado por finalidade com checkboxes destacados; aceite do responsavel legal a partir de link de e-mail; sala de espera como estado do portal sem qualquer elemento de fila compartilhada; estados de negacao de acesso a sala (fora da janela, sem consentimento, nao admitido) — inexistentes nas stories; enrollment de MFA TOTP para a psicologa; avisos de retencao e resposta fundamentada a pedido de eliminacao.

Em seguida, **System Architect**, com `docs/talitha-security-review-prd.md` como entrada obrigatoria e ADRs para as decisoes das secoes 3 (criptografia), 4 (audit log), 5 (token LiveKit) e 6 (webhook Asaas). Depois, **Security Review da arquitetura** (segundo dos tres momentos obrigatorios).

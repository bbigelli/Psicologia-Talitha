# PRD: Talitha Psicologia

**Status:** Planejamento
**Versao:** 1.0
**Data:** 2026-09-09
**Classificacao da demanda:** Projeto novo — fluxo completo de planejamento

---

## TL;DR

Plataforma web para psicologa que atende exclusivamente online, substituindo ferramentas dispersas (Google Meet, WhatsApp, controle manual) por um sistema integrado com sala de video propria, gestao financeira automatizada, agenda inteligente e prontuario digital criptografado — em conformidade com CFP e LGPD.

---

## Problema

**O que esta acontecendo hoje que e ruim:**

A psicologa Talitha atende exclusivamente online e opera sem nenhum sistema integrado. As consequencias concretas sao:

1. **Descontrole financeiro** — nao sabe com clareza quanto entrou no mes, quanto tem a receber e quem esta inadimplente. Cobrar manualmente consome tempo e gera constrangimento com pacientes.
2. **Dependencia de ferramentas de terceiros** — sessoes acontecem pelo Google Meet ou WhatsApp Video. Nao ha identidade propria, nao ha controle sobre quem entra na sala, e o sigilo depende de configuracoes que a psicologa nao domina.
3. **Agenda e lembretes manuais** — controle de horarios provavelmente em agenda do celular ou planilha. Lembretes dependem de mensagem manual. No-shows frequentes sem sistema de confirmacao ou politica clara.
4. **Prontuario disperso e inseguro** — anotacoes clinicas possivelmente em documentos avulsos sem criptografia, sem controle de acesso e sem garantia de retencao legal.
5. **Recibos manuais** — emissao de recibos para deducao no IR dos pacientes e feita manualmente ou nao e feita.

**Para quem esse problema existe:**
- Para a psicologa: perda de tempo, perda de receita, risco de nao-conformidade legal.
- Para os pacientes: experiencia fragmentada, dificuldade de acessar recibos e historico, falta de profissionalismo percebido.

**Evidencia de que e um problema real:**
- A propria psicologa expressou as dores de descontrole financeiro e dependencia de ferramentas.
- Mercado de telepsicologia cresceu exponencialmente pos-pandemia — profissionais solo sao o perfil predominante.
- Resolucao CFP 11/2018 exige que a psicologa escolha ferramenta que preserve o sigilo — Meet/WhatsApp sao questionaveis.

---

## Personas e Jobs-to-be-Done

### Persona 1 — Dra. Talitha (Psicologa)

- **Perfil:** Psicologa com CRP ativo e cadastro no e-Psi. Atende exclusivamente online, com estimativa de 20-30 pacientes ativos. Trabalha sozinha, sem secretaria ou equipe de apoio. Usa celular e computador para atender.
- **Job principal:** Quando termino meu dia de atendimentos, quero ver de forma imediata quanto recebi, quanto falta receber e quem esta devendo, para nao perder tempo e dinheiro com controle manual.
- **Job secundario 1:** Quando atendo um paciente, quero uma sala de video com minha identidade e garantia de sigilo, para transmitir profissionalismo e cumprir as normas do CFP.
- **Job secundario 2:** Quando preciso consultar o historico de um paciente antes da sessao, quero um prontuario organizado, seguro e acessivel em poucos cliques, para dar continuidade ao tratamento com qualidade.
- **Job secundario 3:** Quando marco uma sessao, quero que o paciente receba lembretes automaticos e confirme presenca, para reduzir no-shows e otimizar minha agenda.
- **Dores atuais:** Cobranca manual constrangedora; sem visibilidade financeira; dependencia de Meet/WhatsApp; prontuario disperso; emissao manual de recibos; no-shows frequentes.
- **Ganhos esperados:** Cobranca automatizada e discreta; dashboard financeiro em tempo real; sala propria com sigilo garantido; prontuario criptografado com audit log; recibos automaticos; agenda com lembretes e confirmacao.

### Persona 2 — Paciente (Adulto)

- **Perfil:** Pessoa adulta em acompanhamento psicologico online com a Dra. Talitha. Agenda semanal fixa (mesmo horario toda semana). Usa celular como dispositivo principal para as sessoes.
- **Job:** Quando chega a hora da minha sessao, quero entrar na sala de video com o minimo de cliques e sem friccao tecnica, para focar no que importa: minha terapia.
- **Job secundario:** Quando preciso do recibo para o Imposto de Renda, quero acessar e baixar meus recibos a qualquer momento, para nao depender da psicologa enviar manualmente.
- **Dores atuais:** Recebe link por WhatsApp e as vezes perde; nao sabe se esta em dia com pagamentos; nao tem acesso facil a recibos; experiencia de sessao varia conforme a ferramenta usada.
- **Ganhos esperados:** Portal proprio com proximas sessoes, historico de pagamentos e recibos; acesso a sala com 2 cliques; lembretes automaticos com link direto; pagamento simples por PIX/boleto/cartao.

### Persona 3 — Responsavel Legal (Pai/Mae de Paciente Menor)

- **Perfil:** Pai ou mae de paciente menor de idade em acompanhamento. E quem autoriza o tratamento, paga as sessoes e precisa dos recibos no proprio CPF para deducao no IR.
- **Job:** Quando meu filho esta em atendimento, quero acompanhar os agendamentos e pagamentos, e receber os recibos no meu CPF, para organizar a rotina familiar e declarar no Imposto de Renda.
- **Dores atuais:** Depende da psicologa informar horarios e valores; nao recebe recibos de forma sistematica; nao tem visibilidade do historico.
- **Ganhos esperados:** Recibos emitidos automaticamente no CPF do responsavel; visibilidade de proximos agendamentos.

> **Decisao do PO (requer validacao do dev):** No MVP, o responsavel legal NAO tem login proprio. Suas informacoes (nome, CPF, email, telefone) sao armazenadas no cadastro do paciente. Recibos sao emitidos no CPF do responsavel quando o paciente e menor de idade. O responsavel recebe uma copia do recibo por email. Se for necessario dar login proprio ao responsavel, sera feature pos-MVP.

---

## Controle de Acesso (RBAC)

**Abordagem escolhida:** A (roles fixos)

**Justificativa:** Pratica solo com apenas 2 perfis de acesso (psicologa e paciente). Os roles sao previsiveis, nunca mudam, e nao precisam ser configuraveis. Nao ha necessidade de roles dinamicos.

**Roles do sistema:**

| Role | Descricao | Criado por |
|------|-----------|------------|
| `psychologist` | Acesso total a gestao: agenda, financeiro, prontuarios, sala de video | Sistema (fixo) |
| `patient` | Acesso ao proprio portal: sessoes, pagamentos, recibos, sala de video | Sistema (fixo) |

**Matriz de permissoes (alto nivel):**

| Recurso | psychologist | patient |
|---------|-------------|---------|
| Dashboard financeiro | CRUD + visualizacao | --- |
| Cobranças / assinaturas | CRUD | R (proprias) |
| Agenda (todos os pacientes) | CRUD | --- |
| Agenda (propria) | --- | R |
| Sala de video | Criar sala, admitir, encerrar | Entrar (propria sessao) |
| Prontuario | CRUD (todos os pacientes) | --- |
| Recibos | Gerar, visualizar (todos) | R + download (proprios) |
| Cadastro de pacientes | CRUD | --- |
| Perfil proprio | R + U | R + U |
| Anamnese | R (preenchida pelo paciente) | C + R + U (propria) |
| Audit log | R | --- |

---

## Integracoes Externas

| Integracao | Proposito | Sandbox disponivel? | Custo/Limite | Notas |
|-----------|-----------|-------------------|--------------|-------|
| Asaas | Cobrancas (PIX/boleto/cartao), assinaturas recorrentes, webhooks de pagamento | Sim (`api-sandbox.asaas.com/v3`) | Sandbox: gratis. Producao: taxa por transacao (~R$0,99 boleto, 1,99% cartao, R$0,99 PIX) | API key nunca no client — Edge Function via `supabase secrets`. PCI compliance delegado ao Asaas |
| LiveKit Cloud | Sala de video 1:1 com sala de espera e controles | Sim (free tier) | 5.000 min/mes gratis; pay-per-use apos | SDK server compativel com Deno (Edge Functions). Token JWT emitido via Edge Function |
| Email transacional | Lembretes de sessao, convites, recibos, notificacoes | TBD | TBD | Servico especifico a ser definido pelo System Architect (Resend recomendado pela DX com Next.js) |

**Webhooks recebidos:**
- Asaas -> Edge Function `/api/webhook/asaas` para eventos: `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_UPDATED`

**Webhooks enviados:** Nenhum no MVP.

---

## Hipoteses

| # | Hipotese | Metrica de validacao | Risco |
|---|----------|---------------------|-------|
| H1 | Cobranca automatizada via Asaas reduz inadimplencia significativamente | Taxa de inadimplencia cai de >30% (estimado) para <10% em 90 dias | Medio |
| H2 | Sala de video propria com sala de espera aumenta percepcao de profissionalismo e sigilo | Feedback qualitativo positivo de >80% dos pacientes nos 3 primeiros meses | Baixo |
| H3 | Lembretes automaticos 24h + 1h antes reduzem no-shows | Taxa de no-show cai >50% em relacao ao baseline | Baixo |
| H4 | Prontuario digital no proprio sistema reduz tempo de preparo pre-sessao | Tempo de consulta do historico cai de ~15min para <5min | Baixo |
| H5 | Recibos automaticos eliminam trabalho manual recorrente | Tempo gasto com emissao de recibos cai de ~1h/mes para zero | Baixo |

---

## Validacao de Riscos (Cagan)

| Risco | Avaliacao | Mitigacao |
|-------|-----------|-----------|
| **Valor** | **Baixo.** A psicologa expressou as dores diretamente. Todas as funcionalidades resolvem problemas reais e atuais. O mercado de telepsicologia valida a demanda. | Validacao direta com a psicologa durante o desenvolvimento. Entregas incrementais por sprint permitem feedback rapido. |
| **Usabilidade** | **Medio.** A psicologa nao e tech-savvy. O paciente pode estar em momento de vulnerabilidade emocional — friccao tecnica e inaceitavel. Celular e dispositivo principal. | Mobile-first obrigatorio. Fluxo do paciente: maximo 2 cliques para entrar na sala. Teste de camera/mic antes da sessao. Interface clean, sem sobrecarga de opcoes. |
| **Viabilidade** | **Medio.** LiveKit e Asaas tem APIs bem documentadas. Criptografia de prontuario exige decisao arquitetural cuidadosa. Compliance CFP/LGPD impoe requisitos nao-triviais (audit log, retencao, consentimento). | LiveKit SDK server roda em Deno (validado). Asaas tem sandbox completo. Criptografia e audit log serao detalhados pelo Security Review e Architect. Sprint incremental reduz risco de integracao. |
| **Negocio** | **Baixo.** Compliance CFP e LGPD sao requisitos conhecidos e atendidos no design. Custo operacional baixo (free tiers + Supabase). Modelo sustentavel. | Manter CRP e e-Psi visiveis no app. Audit log e consentimentos rastreavels. Security Review obrigatorio antes da implementacao. |

---

## Opportunity Solution Tree

```
Outcome: Psicologa tem pratica online profissional, eficiente e em conformidade legal
|
+-- Oportunidade 1: Falta de controle financeiro e inadimplencia
|   +-- Solucao A: Planilha automatizada (descartada — nao resolve cobranca)
|   +-- Solucao B: Integracao com gateway Asaas  <-- ESCOLHIDA
|   +-- Solucao C: Emissao manual de boleto (descartada — nao automatiza)
|
+-- Oportunidade 2: Dependencia de ferramentas de terceiros para sessao
|   +-- Solucao A: Continuar com Meet/WhatsApp (descartada — sem sigilo garantido, sem identidade)
|   +-- Solucao B: Sala de video propria com LiveKit  <-- ESCOLHIDA
|   +-- Solucao C: Jitsi self-hosted (descartada — custo de VPS e manutencao)
|
+-- Oportunidade 3: Alto indice de no-show por falta de lembretes
|   +-- Solucao A: Lembretes manuais via WhatsApp (descartada — trabalho recorrente)
|   +-- Solucao B: Lembretes automaticos com confirmacao  <-- ESCOLHIDA
|   +-- Solucao C: Cobranca retroativa de no-show (complementar, nao substitui prevencao)
|
+-- Oportunidade 4: Prontuario disperso e inseguro
    +-- Solucao A: Google Docs (descartada — sem criptografia, sem audit log, sem retencao)
    +-- Solucao B: Prontuario digital criptografado no app  <-- ESCOLHIDA
    +-- Solucao C: Software de prontuario separado (descartada — nao integra com agenda/financeiro)
```

---

## Story Map

```
[Onboarding]     -> [Agendamento]   -> [Lembrete]    -> [Sessao Video]  -> [Prontuario]    -> [Cobranca]       -> [Recibo]
     |                    |                |                  |                  |                  |                 |
Setup psicologa     Visualizar agenda  24h antes        Teste cam/mic     Evolucao          Cobranca PIX      Recibo IRPF      <- MVP
Cadastrar paciente  Criar c/ recorr.   1h antes         Sala de espera    Anamnese          Webhook concil.   Download PDF
Primeiro acesso     Bloquear conflit.  Confirmacao      Admissao          Historico         Assinatura recor.
Termos/LGPD         Cancelar c/ prazo                   Anotacoes lat.    Audit log         Regua cobranca
                    Remarcar                            Reconexao         Criptografia      Dashboard KPI
                                                                         Retencao/Soft del Inadimplentes
```

**Corte MVP:** Linha superior — todas as funcionalidades listadas fazem parte do MVP (4 modulos confirmados). O story map organiza a prioridade de implementacao dentro das sprints (definida pelo Backlog Agent).

---

## MVP — O que entra

### Modulo 0: Autenticacao, Onboarding e Compliance

| Feature | MoSCoW | Justificativa |
|---------|--------|---------------|
| Setup inicial da psicologa (CRP, e-Psi, dados profissionais) | Must | Sem isso nao ha operadora do sistema |
| Cadastro de paciente pela psicologa | Must | Sem pacientes nao ha atendimento |
| Primeiro acesso do paciente (convite, senha, termos) | Must | Paciente precisa de login para acessar portal e sala |
| Termo de consentimento para atendimento online | Must | Exigencia CFP — bloqueante legal |
| Consentimento LGPD (tratamento de dados sensiveis) | Must | Exigencia legal — dado de saude e sensivel |
| Portal do paciente (home com proximas sessoes e status) | Must | Ponto de entrada do paciente no sistema |
| Perfil da psicologa (CRP e e-Psi visiveis) | Must | Exigencia CFP e transparencia com o paciente |

### Modulo 1: Dashboard Financeiro + Asaas

| Feature | MoSCoW | Justificativa |
|---------|--------|---------------|
| Dashboard com KPIs (recebido, a receber, inadimplente, projecao) | Must | Dor principal da psicologa — visibilidade financeira |
| Cobranca avulsa via Asaas (PIX/boleto/cartao) | Must | Sem cobranca nao ha receita |
| Assinatura recorrente (pacote mensal de sessoes) | Must | Modelo de negocio recorrente da psicologa |
| Webhook de conciliacao (Asaas -> sistema) | Must | Sem conciliacao, o financeiro nao reflete a realidade |
| Regua de cobranca automatica | Should | Workaround: psicologa cobra manualmente. Mas automatizar e o objetivo |
| Painel de inadimplentes | Should | Dashboard cobre parcialmente; lista dedicada melhora gestao |
| Historico de pagamentos no portal do paciente | Must | Paciente precisa saber o que pagou e o que deve |

### Modulo 2: Sala de Video + Sala de Espera

| Feature | MoSCoW | Justificativa |
|---------|--------|---------------|
| Teste de camera e microfone (pre-sessao) | Must | Sem teste, problemas tecnicos so aparecem na sessao |
| Sala de espera (paciente aguarda admissao) | Must | Critico: paciente A nunca pode ver paciente B |
| Admissao pela psicologa | Must | Controle de quem entra na sala — sigilo |
| Sessao de video 1:1 | Must | Funcionalidade core do produto |
| Anotacoes rapidas em painel lateral | Should | Workaround: bloco de notas externo. Mas integrado e muito melhor |
| Reconexao automatica | Must | Conexao pode cair — sessao nao pode ser perdida por problema de rede |

### Modulo 3: Agenda + Lembretes Anti-No-Show

| Feature | MoSCoW | Justificativa |
|---------|--------|---------------|
| Visualizacao da agenda (visao semanal/diaria) | Must | Psicologa precisa ver seus horarios |
| Criacao de agendamento com recorrencia semanal | Must | Padrao de atendimento: mesmo horario toda semana |
| Bloqueio de conflito de horario | Must | Evita agendar dois pacientes no mesmo horario |
| Lembrete automatico 24h e 1h antes | Must | Principal arma contra no-show |
| Confirmacao de presenca pelo paciente | Should | Melhora previsibilidade, mas nao bloqueia a sessao se nao confirmar |
| Cancelamento com politica de prazo | Must | Define regras claras — evita cancelamentos de ultima hora |
| Remarcacao de sessao | Must | Psicologa e paciente precisam poder alterar horarios |
| Proximas sessoes no portal do paciente | Must | Paciente precisa saber quando e sua proxima sessao |

### Modulo 4: Prontuario + Recibos IRPF

| Feature | MoSCoW | Justificativa |
|---------|--------|---------------|
| Registro de evolucao por sessao | Must | Core do prontuario — anotacao clinica pos-sessao |
| Anamnese / ficha inicial | Must | Informacoes basicas do paciente antes do primeiro atendimento |
| Visualizacao do historico clinico | Must | Psicologa precisa consultar sessoes anteriores |
| Criptografia do prontuario em repouso | Must | LGPD — dado de saude e sensivel, criptografia e obrigatoria |
| Audit log de acesso ao prontuario | Must | LGPD e CFP — rastreabilidade de quem acessou o que |
| Recibo IRPF numerado automatico | Must | Elimina trabalho manual e permite deducao fiscal pelo paciente |
| Soft delete com politica de retencao (5a / 20a) | Must | CFP exige guarda minima de prontuario |
| Direito do titular (acesso/portabilidade dos dados) | Should | LGPD exige, mas para MVP pode ser acionado via solicitacao a psicologa com export manual |

---

## Fora do MVP — O que fica pra depois

| Feature | Motivo de exclusao | Quando revisar |
|---------|--------------------|----------------|
| Gravacao de sessao | Risco LGPD alto — decisao explicita do dev (docs/decisions.md) | Pos-MVP, com consentimento por sessao e armazenamento criptografado |
| App nativo (iOS/Android) | MVP e web (Next.js). Celular acessa via navegador (PWA possivel) | Apos validacao do MVP, se demanda justificar |
| Multi-profissional / clinica | Produto e para psicologa solo. Multi-tenant exige RBAC dinamico e complexidade de escopo | v2.0 se o produto escalar |
| Teleconsulta em grupo | Nao faz parte do modelo de atendimento individual | Sem previsao |
| Prescricao / medicacao | Psicologos nao prescrevem medicacao (atribuicao medica) | Fora do escopo permanente |
| Integracao com convenios (planos de saude) | Complexidade de integracao e certificacao sem retorno claro para pratica solo | v2.0 se demanda surgir |
| Marketplace / diretorio de psicologos | Produto e privado, nao e plataforma de marketplace | Fora do escopo permanente |
| Chat/mensagens entre sessoes | Adiciona responsabilidade clinica fora do horario — risco etico | Avaliar pos-MVP com limites claros |
| IA para anotacoes / transcricao | Depende de gravacao (fora do MVP) e compliance adicional | Pos-gravacao |
| WhatsApp API para lembretes | Custo e complexidade. MVP usa email transacional | v1.1 se taxa de leitura de email for baixa |
| Landing page publica (SEO) | Os 4 modulos ja formam um MVP grande. Arquitetura (Next.js) suporta facilmente | Sprint complementar pos-MVP ou incluida pelo Backlog se couber |
| Login proprio do responsavel legal | MVP armazena dados do responsavel no cadastro do paciente | v1.1 se houver demanda |
| Relatorios avancados / exportacao contabil | Dashboard cobre o basico. Exportacao para contador e nice-to-have | v1.1 |

---

## Requisitos de Compliance e Privacidade

> Esta secao e requisito funcional de primeira classe. Nenhuma feature pode ser implementada em desacordo com estas exigencias.

### Resolucao CFP n. 11/2018 — Atendimento Psicologico Online

1. **Cadastro no e-Psi:** A psicologa deve ter cadastro ativo no portal e-Psi (e-psi.cfp.org.br), alem do CRP ativo. O sistema deve armazenar e exibir o numero do CRP e o status do cadastro e-Psi.
2. **Sigilo profissional:** A ferramenta de atendimento online deve preservar o sigilo. A sala de video deve garantir que apenas psicologa e paciente estejam presentes. Sala de espera com admissao individual e obrigatoria.
3. **Prontuario:** Deve seguir as mesmas regras do prontuario presencial — guarda minima de 5 anos apos encerramento do atendimento. Para pacientes menores de idade no inicio do atendimento: 20 anos.
4. **Termo de atendimento online:** O paciente deve aceitar explicitamente o atendimento online antes da primeira sessao. Registro de data/hora/versao do termo.

### LGPD — Lei Geral de Protecao de Dados

1. **Dados sensiveis (art. 5, II):** Condicao psicologica e dado pessoal sensivel. Tratamento exige base legal especifica.
2. **Base legal:** Consentimento explicito do titular para tratamento de dados de saude (art. 11, I). Consentimento deve ser registrado com data/hora, versao do termo e forma de coleta.
3. **Criptografia:** Dados de prontuario devem ser criptografados em transito (TLS) e em repouso (criptografia application-level ou banco).
4. **Controle de acesso:** RLS obrigatorio. Paciente so acessa seus proprios dados. Psicologa acessa prontuarios dos proprios pacientes.
5. **Audit log:** Registrar quem acessou qual prontuario, quando e qual operacao (leitura, escrita, edicao). Log imutavel.
6. **Direito do titular:**
   - Acesso: paciente pode visualizar todos os seus dados no portal.
   - Portabilidade: paciente pode solicitar exportacao dos seus dados (MVP: processo manual acionado via solicitacao; pos-MVP: botao de export).
   - Eliminacao: respeitando os prazos de retencao do CFP (5 ou 20 anos), apos o prazo o dado pode ser eliminado a pedido do titular.
7. **Minimizacao:** Coletar apenas dados necessarios para a prestacao do servico.

### Retencao de Prontuario

| Tipo de paciente | Retencao minima | Contagem a partir de |
|-----------------|-----------------|---------------------|
| Adulto (>=18 anos no inicio) | 5 anos | Data de encerramento do atendimento |
| Menor de idade (<18 anos no inicio) | 20 anos | Data de encerramento do atendimento |

- Prontuario nunca sofre DELETE fisico durante o periodo de retencao — apenas soft delete (`deleted_at`).
- Apos o periodo de retencao, a eliminacao pode ocorrer (manual ou automatizada).
- O campo `retention_until` deve ser calculado automaticamente no cadastro/encerramento.

### Termo de Consentimento para Atendimento Online

- Apresentado ao paciente antes da primeira sessao.
- Conteudo: natureza do atendimento online, limitacoes, responsabilidades, sigilo, direito de recusa.
- Registro: data/hora de aceite, versao do termo, IP (opcional).
- Se o termo for atualizado, paciente deve aceitar a nova versao antes da proxima sessao.
- Paciente que nao aceita nao pode acessar a sala de video.

### Consentimento LGPD

- Apresentado junto ou apos o termo de atendimento online, como aceite separado.
- Conteudo: quais dados sao coletados, para que, por quanto tempo, com quem sao compartilhados (Asaas para pagamento), direitos do titular.
- Registro: data/hora, versao, forma de coleta.
- Revogavel a qualquer momento (consequencia: encerramento do atendimento, mantida a retencao legal).

---

## Fluxo Principal (Happy Path)

### Fluxo da Psicologa

1. **Onboarding:** Psicologa faz login pela primeira vez, preenche dados profissionais (CRP, e-Psi, especialidade), configura horarios de atendimento e valor da sessao.
2. **Cadastrar paciente:** Insere dados do paciente (nome, email, telefone, CPF, data de nascimento). Se menor, insere dados do responsavel legal. Sistema envia convite por email ao paciente.
3. **Agendar sessao:** Cria agendamento recorrente (ex: toda quarta, 14h). Sistema verifica conflitos e bloqueia se houver.
4. **Gerar cobranca:** Ao confirmar agendamento, sistema cria cobranca no Asaas (avulsa ou vinculada a assinatura). Paciente recebe link de pagamento.
5. **Antes da sessao:** Sistema envia lembretes automaticos (24h e 1h). Psicologa consulta prontuario do paciente (historico de evolucao).
6. **Sessao:** Psicologa abre a sala de video. Paciente entra na sala de espera. Psicologa admite o paciente. Sessao acontece. Psicologa faz anotacoes no painel lateral se desejar.
7. **Pos-sessao:** Psicologa registra evolucao no prontuario. Sistema gera recibo automaticamente. Se pagamento ja confirmado via webhook, sessao e marcada como paga.
8. **Dashboard:** Ao final do dia/semana/mes, psicologa visualiza KPIs financeiros no dashboard.

### Fluxo do Paciente

1. **Convite:** Recebe email com link para primeiro acesso.
2. **Onboarding:** Cria senha, aceita termo de atendimento online e consentimento LGPD.
3. **Anamnese:** Preenche ficha inicial (anamnese) antes da primeira sessao.
4. **Portal:** Ve proximas sessoes, status de pagamento, recibos disponiveis.
5. **Antes da sessao:** Recebe lembrete 24h e 1h antes com link para a sala.
6. **Pre-sessao:** Acessa teste de camera/microfone. Testa dispositivos.
7. **Sala de espera:** Entra na sala de espera. Aguarda admissao da psicologa.
8. **Sessao:** Sessao de video 1:1. Se conexao cair, sistema reconecta automaticamente.
9. **Pos-sessao:** Pode acessar recibos e historico de pagamentos no portal.

---

## Metricas de Sucesso

| Metrica | Baseline (estimado) | Meta | Prazo |
|---------|---------------------|------|-------|
| Taxa de inadimplencia | >30% | <10% | 90 dias apos lancamento |
| Taxa de no-show | ~20-30% | <10% | 60 dias apos lancamento |
| Tempo gasto em cobranca manual | ~2h/semana | <15min/semana | Imediato (pos-deploy) |
| Tempo de preparo pre-sessao (consulta prontuario) | ~15min | <5min | 30 dias apos lancamento |
| Tempo gasto em emissao de recibos | ~1h/mes | 0 (automatico) | Imediato |
| % de sessoes com pagamento confirmado antes do inicio | Desconhecido | >80% | 90 dias |
| Satisfacao do paciente com a experiencia de video | N/A | >4/5 (feedback qualitativo) | 90 dias |

---

## Criterios de Aceite do MVP

- [ ] Psicologa consegue cadastrar paciente, que recebe convite por email e faz primeiro acesso com aceite de termos
- [ ] Psicologa consegue criar agendamento recorrente semanal sem conflito de horario
- [ ] Paciente recebe lembretes automaticos 24h e 1h antes da sessao por email
- [ ] Paciente consegue testar camera/microfone, entrar na sala de espera e ser admitido pela psicologa
- [ ] Sessao de video 1:1 funciona com audio e video bidirecionais, com reconexao automatica
- [ ] Paciente A nunca ve paciente B na sala de espera ou na sessao
- [ ] Psicologa consegue fazer anotacoes no painel lateral durante a sessao
- [ ] Psicologa consegue registrar evolucao no prontuario apos a sessao
- [ ] Prontuario e criptografado em repouso e todo acesso gera registro no audit log
- [ ] Psicologa consegue gerar cobranca (PIX/boleto/cartao) via Asaas e o pagamento e conciliado automaticamente via webhook
- [ ] Paciente consegue ver historico de pagamentos e baixar recibos no portal
- [ ] Recibo e numerado sequencialmente, contem CRP da psicologa e CPF do paciente (ou responsavel legal)
- [ ] Dashboard exibe KPIs financeiros: recebido, a receber, inadimplente, projecao do mes
- [ ] Paciente aceita termo de atendimento online e consentimento LGPD antes da primeira sessao, com registro rastreavel
- [ ] CRP e status do e-Psi sao exibidos no perfil da psicologa (visivel ao paciente)
- [ ] Prontuario nao sofre DELETE fisico — soft delete com `retention_until` calculado automaticamente
- [ ] Toda a aplicacao funciona em mobile (320px+) sem perda funcional

---

## Requisitos Nao-Funcionais

- **Performance:** Paginas carregam em <2s. Dashboard financeiro renderiza com ate 500 cobranças sem degradacao. Sala de video inicia em <5s apos admissao.
- **Acessibilidade:** WCAG 2.1 AA nos fluxos principais (navegacao por teclado, contraste, labels semanticos). Particularmente importante no fluxo do paciente.
- **Seguranca:** Prontuario criptografado em repouso. RLS em todas as tabelas. API keys nunca no client-side. Webhook valida autenticidade antes de processar. Audit log imutavel.
- **Responsividade:** Mobile-first. Funcional em 320px+ (smartphone). Experiencia otimizada em tablet e desktop. Sala de video responsiva (video ocupa area maxima disponivel, painel de anotacoes colapsavel em mobile).
- **Disponibilidade:** Sala de video deve ser resiliente a quedas de conexao (reconexao automatica em <5s). Se reconexao falhar apos 30s, exibir mensagem clara com opcao de reentrar.
- **Retencao de dados:** Prontuarios retidos por 5 anos (adultos) ou 20 anos (menores) apos encerramento. Cobranças retidas por 5 anos (fiscal).
- **Conformidade:** CFP 11/2018, LGPD (dados sensiveis), boas praticas de seguranca para dados de saude.

---

## Suposicoes e Restricoes

### Suposicoes (a validar)

- A psicologa ja possui CRP ativo e cadastro no e-Psi. Se nao tiver, o sistema nao pode ser usado legalmente para atendimento online.
- Pacientes tem acesso a internet estavel o suficiente para videochamada (minimo 1 Mbps up/down).
- O volume de atendimentos e de ~20-30 pacientes/semana (uma psicologa solo). O sistema nao precisa escalar para centenas de sessoes simultaneas.
- Asaas sandbox e suficiente para todo o desenvolvimento e testes. Migracao para producao e apenas troca de URL + API key.
- Email transacional e lido pela maioria dos pacientes. Se nao for, WhatsApp sera necessario em v1.1.
- A psicologa e a unica operadora do sistema — nao ha secretaria, assistente ou outro profissional.

### Restricoes

- **Legais:** CFP 11/2018, LGPD, retencao de prontuario. Nao sao negociaveis.
- **Tecnicas:** Stack definida (Next.js 16, Supabase, LiveKit, Asaas) — nao substituir.
- **Orcamentarias:** Operar dentro dos free tiers (LiveKit 5000 min/mes, Supabase free tier) o maximo possivel. Producao tera custo apenas por transacao (Asaas) e excedente de minutos (LiveKit).
- **Gravacao:** Explicitamente fora do MVP por decisao de risco.
- **Ambiente de pagamento:** Desenvolvimento inteiro em sandbox. Producao so apos Security Audit.

---

## Riscos e Mitigacao

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Free tier do LiveKit nao cobrir o volume de atendimentos | Baixa (5000 min/mes ~ 83h ~ 4 sessoes/dia de 1h) | Medio | Monitorar uso. Escalar para plano pago se necessario. Self-host como opcao futura |
| Criptografia de prontuario adicionar complexidade e latencia | Media | Medio | Definir abordagem no Security Review. Testar performance com volume realista |
| Paciente nao ler email de lembrete (baixa taxa de abertura) | Media | Alto (no-show) | Monitorar taxa de no-show pos-deploy. Se alta, priorizar integracao WhatsApp |
| Asaas mudar termos/precos ou descontinuar sandbox | Baixa | Alto | Abstrair integracao atras de interface. Asaas e o maior gateway BR — risco baixo de descontinuacao |
| Reconexao de video falhar em redes instaveis | Media | Alto (sessao perdida) | LiveKit tem reconnect nativo. Implementar fallback com mensagem clara e link para reentrar |
| Compliance CFP/LGPD nao ser coberto adequadamente | Baixa (se Security Review rodar) | Critico | Security Review obrigatorio pos-PO, pos-Architect e pos-Data Architect. Audit trail desde o dia 1 |
| Responsavel legal precisar de acesso proprio (login) no MVP | Baixa | Baixo | Dados do responsavel ficam no cadastro do paciente. Login proprio e pos-MVP se houver demanda |

---

## Historico de Versoes

| Versao | Data | Mudanca |
|--------|------|---------|
| 1.0 | 2026-09-09 | Versao inicial — PRD completo com 4 modulos, compliance CFP/LGPD, 3 personas |

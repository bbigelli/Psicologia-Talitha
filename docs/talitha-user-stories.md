# User Stories: Talitha Psicologia
> ## ⚠️ AVISO DE PRECEDÊNCIA — leia antes de implementar qualquer item deste documento
>
> Este documento foi escrito antes das **Emendas E5 a E8** do PRD (`docs/talitha-prd.md`, seção no topo). Elas têm precedência sobre qualquer trecho aqui.
>
> - **Toda menção a "e-Psi" neste arquivo é obsoleta.** A Resolução CFP nº 09/2024 revogou o cadastro e-Psi e a plataforma foi desativada em 31/08/2024. Não implemente campo, validação, tela ou requisito de e-Psi. O CRP ativo continua obrigatório.
> - **Em vez disso, existe um requisito novo (E6):** registro datado de **viabilidade técnica do atendimento remoto** no prontuário — veredicto de adequação, justificativa e data, tratado como conteúdo clínico (cifrado, append-only). É o item que protege a psicóloga perante o CRP.
> - **O termo de consentimento (E7)** deve cobrir formato online, política de faltas e queda de conexão.
> - **Nenhuma validação automática de "caso inelegível" (E8)** — as vedações de atendimento em crise, emergência, violência e desastre foram revogadas; a decisão é clínica e fica registrada via E6.


**Versao:** 1.0
**Data:** 2026-09-09
**Referencia:** docs/talitha-prd.md

---

## Epico 0: Autenticacao, Onboarding e Compliance

**Outcome do epico:** Psicologa e pacientes conseguem acessar o sistema com identidade propria, em conformidade legal (CFP e LGPD), com termos aceitos e rastreavels.
**Metricas:** 100% dos pacientes com termos aceitos antes da primeira sessao; CRP e e-Psi visiveis no perfil.

---

### US-001: Setup Inicial da Psicologa

**Como** psicologa
**Quero** preencher meus dados profissionais ao acessar o sistema pela primeira vez
**Para** configurar o sistema para uso e exibir minhas credenciais legais aos pacientes

**Contexto:** Primeiro acesso da psicologa apos criacao da conta. Fluxo de onboarding obrigatorio antes de acessar qualquer funcionalidade. Dados preenchidos aqui sao exibidos no perfil publico e nos recibos.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa fez login pela primeira vez, quando acessa o sistema, entao e redirecionada para a tela de onboarding (nao pode pular)
- [ ] Dado que esta no onboarding, quando preenche nome completo, CRP (numero + regiao), status do cadastro e-Psi (ativo/pendente), CPF, telefone, email profissional, especialidade e valor padrao da sessao, entao os dados sao salvos e o perfil e criado
- [ ] Dado que completou o onboarding, quando acessa o sistema nas vezes seguintes, entao vai direto para o dashboard (nao repete onboarding)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o CRP informado nao segue o formato valido (ex: CRP XX/XXXXX), quando tenta salvar, entao exibe mensagem "Formato do CRP invalido. Use o formato CRP XX/XXXXX"
- [ ] Dado que o CPF informado e invalido (digitos verificadores), quando tenta salvar, entao exibe mensagem "CPF invalido. Verifique os numeros digitados"
- [ ] Dado que campos obrigatorios estao vazios, quando tenta salvar, entao destaca os campos faltantes com mensagem especifica por campo
- [ ] Estado vazio: tela de onboarding mostra campos vazios com placeholders indicativos (ex: "CRP 06/12345")
- [ ] Estado de loading: botao "Salvar" mostra spinner e desabilita durante o salvamento
- [ ] Estado de erro: se o salvamento falhar (rede/servidor), exibir toast "Nao foi possivel salvar seus dados. Tente novamente." com botao de retry

**Requisitos Nao-Funcionais:**
- [ ] Dados salvos criptografados em transito (TLS)
- [ ] CPF da psicologa armazenado apenas para emissao de recibos, nao exibido publicamente

**Fora do escopo desta story:**
- Validacao automatica do CRP junto ao conselho (verificacao manual pela psicologa)
- Consulta automatica ao portal e-Psi
- Upload de foto de perfil

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** Nenhuma (primeira story do sistema)

---

### US-002: Cadastro de Paciente pela Psicologa

**Como** psicologa
**Quero** cadastrar um novo paciente no sistema
**Para** que ele receba o convite de acesso e eu possa agendar sessoes e gerenciar seu atendimento

**Contexto:** A psicologa e a unica pessoa que cadastra pacientes. O paciente nunca se auto-cadastra (evita acesso nao autorizado). Ao cadastrar, o sistema envia email de convite automatico.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta logada, quando acessa a area de pacientes e clica em "Novo Paciente", entao ve o formulario de cadastro
- [ ] Dado que preenche nome completo, email, telefone, CPF, data de nascimento e clica em "Cadastrar", entao o paciente e criado no sistema com status "Convite pendente"
- [ ] Dado que o paciente e menor de idade (calculado pela data de nascimento), quando preenche os dados, entao o formulario exige tambem: nome do responsavel legal, CPF do responsavel, email do responsavel, telefone do responsavel, parentesco
- [ ] Dado que o paciente foi cadastrado, quando o salvamento e confirmado, entao o sistema envia email de convite ao paciente (ou ao responsavel, se menor) com link para primeiro acesso
- [ ] Dado que o convite foi enviado, quando a psicologa ve a lista de pacientes, entao o paciente aparece com badge "Convite pendente" ate completar o primeiro acesso

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o email informado ja existe no sistema (outro paciente), quando tenta cadastrar, entao exibe mensagem "Ja existe um paciente cadastrado com este email"
- [ ] Dado que o CPF informado ja existe no sistema, quando tenta cadastrar, entao exibe mensagem "Ja existe um paciente cadastrado com este CPF"
- [ ] Dado que a data de nascimento indica idade < 12 anos, quando preenche, entao exibe aviso informativo: "Paciente menor de 12 anos. Certifique-se de que o atendimento online e adequado para esta faixa etaria conforme orientacao do CFP"
- [ ] Dado que o envio de email falha, quando o cadastro e salvo, entao o paciente e criado normalmente e a psicologa ve aviso: "Paciente cadastrado, mas o email de convite falhou. Reenvie pela lista de pacientes."
- [ ] Estado vazio: lista de pacientes vazia mostra mensagem "Voce ainda nao tem pacientes cadastrados. Cadastre seu primeiro paciente para comecar." com botao "Novo Paciente"
- [ ] Estado de loading: botao "Cadastrar" mostra spinner durante o processamento
- [ ] Estado de erro: falha no salvamento exibe toast "Nao foi possivel cadastrar o paciente. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] CPF do paciente e do responsavel armazenados de forma segura (criptografados em repouso)
- [ ] Email de convite contem apenas link de acesso — nao inclui dados clinicos

**Fora do escopo desta story:**
- Importacao em lote de pacientes
- Paciente se auto-cadastrar
- Upload de foto do paciente

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-001 (setup da psicologa concluido)

---

### US-003: Primeiro Acesso do Paciente

**Como** paciente
**Quero** acessar o sistema pela primeira vez usando o link do convite
**Para** criar minha senha e ter acesso ao meu portal

**Contexto:** O paciente recebe um email com link de convite. Ao clicar, cria sua senha. Antes de acessar o portal, deve aceitar os termos obrigatorios (US-004 e US-005). Apos aceitar, ve o portal com proximas sessoes.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente recebeu o email de convite, quando clica no link, entao e direcionado para a tela de criacao de senha
- [ ] Dado que esta na tela de criacao de senha, quando informa e confirma uma senha valida (minimo 8 caracteres, ao menos 1 letra e 1 numero), entao a senha e salva e o paciente e autenticado
- [ ] Dado que criou a senha, quando e autenticado pela primeira vez, entao e redirecionado para o fluxo de aceite de termos (US-004 e US-005) antes de acessar o portal
- [ ] Dado que aceitou todos os termos, quando o fluxo de termos e concluido, entao e redirecionado para o portal do paciente (US-006) e o status muda de "Convite pendente" para "Ativo"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o link de convite expirou (mais de 72h), quando clica, entao ve mensagem "Este convite expirou. Entre em contato com sua psicologa para receber um novo convite." — sem expor dados do paciente
- [ ] Dado que o link ja foi usado (paciente ja criou senha), quando clica novamente, entao ve mensagem "Voce ja ativou sua conta. Faca login normalmente." com link para a tela de login
- [ ] Dado que a senha informada nao atende os requisitos minimos, quando tenta salvar, entao exibe mensagem indicando o que falta ("A senha deve ter pelo menos 8 caracteres, incluindo letra e numero")
- [ ] Dado que as senhas (senha e confirmacao) nao coincidem, quando tenta salvar, entao exibe "As senhas nao coincidem"
- [ ] Estado de loading: botao "Criar Senha" mostra spinner durante o processamento
- [ ] Estado de erro: falha na criacao de senha exibe mensagem "Nao foi possivel criar sua senha. Tente novamente." com botao de retry

**Fora do escopo desta story:**
- Login social (Google, etc.) — apenas email/senha no MVP
- Recuperacao de senha (story separada se necessario; Supabase Auth tem fluxo nativo)
- MFA / autenticacao de dois fatores

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-002 (paciente precisa existir e ter convite enviado)

---

### US-004: Termo de Consentimento para Atendimento Online

**Como** paciente
**Quero** ler e aceitar o termo de consentimento para atendimento online
**Para** que meu atendimento esteja em conformidade com a Resolucao CFP 11/2018 e eu esteja ciente das condicoes

**Contexto:** Exigencia legal. Apresentado ao paciente no primeiro acesso, apos criacao de senha. O paciente nao pode acessar nenhuma funcionalidade ate aceitar. Se o termo for atualizado (nova versao), o paciente deve aceitar a nova versao antes da proxima sessao.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente criou sua senha e e seu primeiro acesso, quando e redirecionado para o fluxo de termos, entao ve o Termo de Consentimento para Atendimento Online com o texto completo legivel e rolavel
- [ ] Dado que esta lendo o termo, quando rola ate o final e marca o checkbox "Li e aceito o Termo de Consentimento para Atendimento Online", entao o botao "Aceitar e Continuar" e habilitado
- [ ] Dado que clicou em "Aceitar e Continuar", quando o aceite e processado, entao o sistema registra: ID do paciente, versao do termo, data/hora do aceite (timestamp UTC), e avanca para o proximo termo (US-005)
- [ ] Dado que o termo foi atualizado para uma nova versao, quando o paciente acessa o sistema e ainda nao aceitou a nova versao, entao e redirecionado para aceitar a nova versao antes de prosseguir

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente tenta acessar a sala de video sem ter aceitado o termo, quando clica em "Entrar na Sala", entao e redirecionado para a tela de aceite com mensagem "Voce precisa aceitar o termo de consentimento antes de iniciar o atendimento"
- [ ] Dado que o paciente recusa o termo (fecha a pagina sem aceitar), quando tenta acessar o sistema novamente, entao o termo e apresentado novamente — nao pode ser ignorado
- [ ] Estado de loading: botao "Aceitar e Continuar" mostra spinner durante o registro do aceite
- [ ] Estado de erro: falha ao registrar o aceite exibe toast "Nao foi possivel registrar seu aceite. Tente novamente." com botao de retry

**Requisitos Nao-Funcionais:**
- [ ] Registro do aceite e imutavel — nao pode ser editado ou deletado
- [ ] Texto do termo e versionado — versoes anteriores sao mantidas para auditoria
- [ ] Termo deve ser legivel em mobile (texto com tamanho adequado, sem scroll horizontal)

**Fora do escopo desta story:**
- Assinatura digital / certificado digital
- Envio de copia do termo por email ao paciente (pos-MVP)
- Aceite por responsavel legal em nome do paciente menor (para MVP, o menor aceita com ciencia do responsavel)

**Prioridade:** Alta
**Tamanho:** P (<=1d)
**Dependencias:** US-003 (paciente precisa estar autenticado)

---

### US-005: Consentimento LGPD para Tratamento de Dados Sensiveis

**Como** paciente
**Quero** ler e aceitar o consentimento para tratamento dos meus dados pessoais e de saude
**Para** autorizar o uso necessario dos meus dados em conformidade com a LGPD

**Contexto:** Exigencia legal. Apresentado apos o termo de atendimento online (US-004). Consentimento separado porque a base legal e diferente (art. 11, I da LGPD — consentimento explicito para dados sensiveis). Revogavel a qualquer momento, com consequencia de encerramento do atendimento.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente aceitou o termo de atendimento online (US-004), quando avanca, entao ve o Termo de Consentimento LGPD com: quais dados sao coletados, finalidade de cada dado, por quanto tempo sao retidos, com quem sao compartilhados (Asaas para pagamento), e direitos do titular
- [ ] Dado que esta lendo o consentimento, quando rola ate o final e marca o checkbox "Li e autorizo o tratamento dos meus dados pessoais e de saude conforme descrito acima", entao o botao "Autorizar e Continuar" e habilitado
- [ ] Dado que clicou em "Autorizar e Continuar", quando o aceite e processado, entao o sistema registra: ID do paciente, versao do consentimento, data/hora do aceite (timestamp UTC)
- [ ] Dado que ambos os termos foram aceitos, quando o fluxo de termos e concluido, entao o paciente e redirecionado para o portal (US-006)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente quer revogar o consentimento depois, quando acessa as configuracoes do perfil e clica em "Revogar Consentimento de Dados", entao ve aviso: "Ao revogar o consentimento, seu atendimento sera encerrado. Seus dados serao mantidos pelo prazo legal (minimo 5 anos). Deseja prosseguir?" com opcoes "Confirmar Revogacao" e "Cancelar"
- [ ] Dado que o paciente confirma a revogacao, quando o processo e concluido, entao o sistema registra a revogacao com data/hora e notifica a psicologa por email
- [ ] Dado que o consentimento LGPD foi atualizado (nova versao), quando o paciente acessa o sistema, entao deve aceitar a nova versao antes de prosseguir
- [ ] Estado de loading: botao "Autorizar e Continuar" mostra spinner durante o registro
- [ ] Estado de erro: falha ao registrar exibe toast "Nao foi possivel registrar sua autorizacao. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Registro do consentimento e imutavel (append-only) — mesmo apos revogacao, o historico e mantido
- [ ] Consentimento deve ser legivel e compreensivel em linguagem nao-juridica

**Fora do escopo desta story:**
- Gestao granular de consentimento (aceitar/recusar por tipo de dado)
- Download do consentimento em PDF

**Prioridade:** Alta
**Tamanho:** P (<=1d)
**Dependencias:** US-004 (apresentado na sequencia)

---

### US-006: Portal do Paciente (Home)

**Como** paciente
**Quero** ver uma visao geral do meu atendimento ao acessar o portal
**Para** saber rapidamente minhas proximas sessoes, status de pagamento e acessos disponiveis

**Contexto:** Tela principal do paciente apos login. Ponto de entrada para todas as funcionalidades do portal. Deve ser simples, limpa e focada no proximo passo do paciente.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente esta logado, quando acessa o portal, entao ve: proximas sessoes agendadas (data, hora e botao para entrar na sala quando disponivel), status do proximo pagamento (em dia / pendente / atrasado), e link para "Meus Recibos"
- [ ] Dado que ha uma sessao agendada para hoje, quando o paciente ve a lista de proximas sessoes, entao a sessao do dia aparece destacada com botao "Entrar na Sala" habilitado (ate 15 minutos antes do horario agendado)
- [ ] Dado que nao ha sessoes para hoje, quando o paciente ve a lista, entao o botao "Entrar na Sala" nao aparece — apenas a informacao da proxima sessao futura

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao tem sessoes agendadas, quando acessa o portal, entao ve mensagem "Voce nao tem sessoes agendadas no momento. Entre em contato com sua psicologa para agendar."
- [ ] Dado que o paciente tem pagamento atrasado, quando acessa o portal, entao ve aviso discreto (nao alarmante): "Voce tem um pagamento pendente. Regularize para manter seu atendimento em dia." com link para detalhes
- [ ] Estado de loading: skeleton da pagina exibido enquanto carregam os dados (sessoes + pagamentos)
- [ ] Estado de erro: se dados nao carregarem, exibir "Nao foi possivel carregar suas informacoes. Tente recarregar a pagina."

**Requisitos Nao-Funcionais:**
- [ ] Mobile-first — layout funcional em 320px+
- [ ] Carrega em <2s

**Fora do escopo desta story:**
- Notificacoes push
- Mensagens da psicologa
- Edicao de perfil do paciente (story separada se necessario)

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-003 (paciente precisa estar autenticado e com termos aceitos)

---

### US-007: Perfil da Psicologa com CRP e e-Psi

**Como** paciente
**Quero** ver as credenciais profissionais da minha psicologa (CRP e e-Psi)
**Para** ter confianca de que o atendimento online e legitimo e autorizado pelo CFP

**Contexto:** Exigencia da Resolucao CFP 11/2018. O CRP e o status do e-Psi devem ser visiveis em algum lugar acessivel ao paciente (perfil da psicologa, footer ou pagina "Sobre"). A psicologa pode editar seus dados profissionais nesta mesma tela.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente esta no portal, quando acessa o perfil da psicologa (link no menu ou footer), entao ve: nome completo, CRP (numero e regiao), status do cadastro e-Psi, e especialidade
- [ ] Dado que a psicologa esta logada, quando acessa "Meu Perfil", entao pode editar: nome, CRP, status e-Psi, especialidade, valor padrao da sessao, telefone, email profissional
- [ ] Dado que a psicologa edita um campo e salva, quando o salvamento e confirmado, entao os dados atualizados sao refletidos imediatamente no perfil visivel ao paciente

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o status do e-Psi esta como "Pendente", quando o paciente ve o perfil, entao exibe aviso: "Cadastro no e-Psi em andamento" — sem impedir o uso do sistema (a verificacao e responsabilidade da psicologa)
- [ ] Estado de loading: dados do perfil com skeleton enquanto carregam
- [ ] Estado de erro: falha ao salvar edicao exibe toast "Nao foi possivel salvar as alteracoes. Tente novamente."

**Fora do escopo desta story:**
- Upload de foto de perfil
- Verificacao automatica do CRP ou e-Psi junto aos orgaos
- Certificados ou documentos comprobatorios

**Prioridade:** Alta
**Tamanho:** P (<=1d)
**Dependencias:** US-001 (dados preenchidos no onboarding)

---

---

## Epico 1: Dashboard Financeiro + Asaas

**Outcome do epico:** Psicologa tem visibilidade financeira completa em tempo real e cobranças automatizadas, reduzindo inadimplencia e eliminando controle manual.
**Metricas:** Taxa de inadimplencia <10%; tempo em cobranca manual <15min/semana; >80% dos pagamentos confirmados antes da sessao.

---

### US-101: Dashboard Financeiro com KPIs

**Como** psicologa
**Quero** ver um dashboard com indicadores financeiros do meu consultorio
**Para** saber rapidamente quanto recebi, quanto tenho a receber e quem esta inadimplente, sem depender de planilha

**Contexto:** Tela principal da psicologa ao fazer login. Exibe KPIs do mes atual com possibilidade de filtrar por periodo. Os dados vem das cobranças registradas no Asaas e conciliadas via webhook.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta logada, quando acessa o dashboard, entao ve os seguintes KPIs do mes atual: total recebido (R$), total a receber (cobranças pendentes), total inadimplente (cobranças vencidas nao pagas), e projecao do mes (recebido + a receber)
- [ ] Dado que existem cobranças no sistema, quando visualiza o dashboard, entao cada KPI mostra valor em reais formatado (R$ X.XXX,XX) e variacao percentual em relacao ao mes anterior (se houver dados)
- [ ] Dado que quer ver outro periodo, quando seleciona mes/ano no filtro, entao os KPIs atualizam para o periodo selecionado
- [ ] Dado que existem cobranças vencidas, quando ve o KPI de inadimplentes, entao pode clicar para ver a lista detalhada (US-106)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que e o primeiro mes de uso (sem dados anteriores), quando ve o dashboard, entao os KPIs mostram R$ 0,00 e a variacao percentual mostra "Sem dados do periodo anterior"
- [ ] Dado que nao existem cobranças no sistema, quando ve o dashboard, entao exibe mensagem "Nenhuma cobranca registrada ainda. Cadastre seus pacientes e crie a primeira cobranca." com link para a area de pacientes
- [ ] Estado de loading: cards de KPI mostram skeleton com animacao de pulse
- [ ] Estado de erro: falha ao carregar dados financeiros exibe "Nao foi possivel carregar os dados financeiros. Tente recarregar." com botao de retry

**Requisitos Nao-Funcionais:**
- [ ] Dashboard renderiza em <2s com ate 500 cobranças
- [ ] Mobile: KPIs empilham verticalmente em tela pequena

**Fora do escopo desta story:**
- Graficos de evolucao (pos-MVP)
- Exportacao de relatorio financeiro
- Filtro por paciente

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-104 (webhook precisa conciliar pagamentos para os KPIs refletirem a realidade)

---

### US-102: Cobranca Avulsa via Asaas

**Como** psicologa
**Quero** gerar uma cobranca para um paciente (PIX, boleto ou cartao)
**Para** que o paciente receba o link de pagamento e eu nao precise cobrar manualmente

**Contexto:** A psicologa pode gerar cobranca avulsa (fora de assinatura) para sessoes extras, reposicoes ou pacientes que nao tem pacote mensal. A cobranca e criada via API do Asaas. O Asaas envia notificacao de pagamento ao paciente (email com link).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta logada, quando acessa "Nova Cobranca" e seleciona o paciente, metodo de pagamento (PIX / boleto / cartao), valor, data de vencimento e descricao, entao a cobranca e criada no Asaas via Edge Function
- [ ] Dado que a cobranca foi criada com sucesso no Asaas, quando o processo e confirmado, entao o sistema salva o ID da cobranca do Asaas no banco local, associa ao paciente e (opcionalmente) a sessao agendada
- [ ] Dado que a cobranca foi criada, quando o Asaas processa, entao o paciente recebe notificacao com link de pagamento (email enviado pelo Asaas)
- [ ] Dado que a cobranca foi criada, quando a psicologa ve a lista de cobranças do paciente, entao a nova cobranca aparece com status "Pendente"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao esta cadastrado no Asaas ainda, quando a psicologa cria a primeira cobranca, entao o sistema cria o customer no Asaas automaticamente (usando CPF e email do paciente) antes de criar a cobranca
- [ ] Dado que a API do Asaas retorna erro (timeout, 500, dados invalidos), quando a criacao falha, entao exibe toast "Nao foi possivel criar a cobranca: [mensagem do Asaas]. Tente novamente." e nao salva nada localmente
- [ ] Dado que o valor informado e zero ou negativo, quando tenta criar, entao exibe "O valor da cobranca deve ser maior que R$ 0,00"
- [ ] Dado que a data de vencimento e no passado, quando tenta criar, entao exibe "A data de vencimento deve ser hoje ou futura"
- [ ] Estado de loading: botao "Gerar Cobranca" mostra spinner e desabilita; exibe texto "Criando cobranca no Asaas..."
- [ ] Estado de erro: se a Edge Function estiver indisponivel, exibir "Servico de pagamento temporariamente indisponivel. Tente novamente em alguns minutos."

**Requisitos Nao-Funcionais:**
- [ ] API key do Asaas NUNCA trafega pelo client — toda comunicacao via Edge Function
- [ ] CPF do paciente enviado ao Asaas e dado minimo necessario para criacao do customer (minimizacao LGPD)

**Fora do escopo desta story:**
- Cobranca recorrente / assinatura (US-103)
- Estorno / cancelamento de cobranca (story separada se necessario, ou via painel do Asaas)
- Parcelamento

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-002 (paciente precisa existir)

---

### US-103: Assinatura Recorrente (Pacote Mensal de Sessoes)

**Como** psicologa
**Quero** criar uma assinatura recorrente para um paciente com pacote mensal de sessoes
**Para** automatizar a cobranca mensal e ter previsibilidade de receita

**Contexto:** A psicologa oferece pacotes mensais (ex: 4 sessoes/mes por R$ 800). O Asaas gerencia a cobranca recorrente. O sistema rastreia quantas sessoes do pacote foram usadas no ciclo atual.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta logada, quando acessa "Nova Assinatura" e seleciona o paciente, valor mensal, dia de vencimento, quantidade de sessoes incluidas no pacote e data de inicio, entao a assinatura e criada no Asaas via Edge Function (`POST /v3/subscriptions`)
- [ ] Dado que a assinatura foi criada, quando o Asaas gera a primeira cobranca automaticamente, entao o webhook concilia o pagamento e o sistema registra: inicio do ciclo, sessoes incluidas, sessoes usadas (0)
- [ ] Dado que o paciente tem assinatura ativa, quando a psicologa registra uma sessao realizada, entao o contador de "sessoes usadas" no ciclo incrementa
- [ ] Dado que o paciente usou todas as sessoes do pacote no mes, quando a psicologa agenda uma sessao adicional, entao o sistema avisa: "Este paciente ja usou as X sessoes do pacote neste ciclo. Deseja criar uma cobranca avulsa para esta sessao?" com opcoes "Sim, cobrar avulsa" e "Nao, incluir sem cobranca"
- [ ] Dado que a psicologa quer ver as assinaturas ativas, quando acessa a area financeira, entao ve lista de assinaturas com: paciente, valor, dia de cobranca, sessoes usadas/total do ciclo, e status (ativa/pausada/cancelada)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente ja tem uma assinatura ativa, quando a psicologa tenta criar outra, entao exibe "Este paciente ja possui uma assinatura ativa. Cancele a atual antes de criar uma nova."
- [ ] Dado que o paciente cancela a assinatura (ou a psicologa cancela), quando a assinatura e cancelada no Asaas, entao o sistema registra o cancelamento e o paciente volta a ser cobrado avulsamente
- [ ] Dado que a cobranca recorrente do Asaas falha (cartao recusado, boleto vencido), quando o webhook notifica, entao o sistema atualiza o status para "Pagamento pendente" e a regua de cobranca e ativada
- [ ] Estado de loading: spinner durante criacao da assinatura no Asaas
- [ ] Estado de erro: falha na API do Asaas exibe toast com mensagem de erro especifica

**Fora do escopo desta story:**
- Planos com precos diferentes (ex: plano basico vs premium) — apenas um valor por assinatura
- Desconto por fidelidade
- Migracao entre planos

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-102 (infra de integracao com Asaas ja estabelecida)

---

### US-104: Webhook de Conciliacao de Pagamento (Asaas -> Sistema)

**Como** sistema (automatizado)
**Quero** receber e processar webhooks do Asaas quando o status de um pagamento mudar
**Para** manter o status financeiro atualizado automaticamente, sem intervencao manual da psicologa

**Contexto:** O Asaas envia webhooks para uma Edge Function quando eventos de pagamento ocorrem. A Edge Function valida a autenticidade, processa o evento e atualiza o banco. Isso e a base para o dashboard, regua de cobranca e status de pagamento do paciente.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o Asaas envia webhook com evento `PAYMENT_RECEIVED`, quando a Edge Function recebe, entao valida o `authToken`, identifica a cobranca local pelo ID do Asaas, e atualiza o status para "Pago" com data/hora do pagamento
- [ ] Dado que o Asaas envia webhook com evento `PAYMENT_OVERDUE`, quando processado, entao a cobranca local e marcada como "Vencida" e entra na regua de cobranca
- [ ] Dado que o Asaas envia webhook com evento `PAYMENT_REFUNDED`, quando processado, entao a cobranca local e marcada como "Estornada"
- [ ] Dado que o pagamento esta vinculado a uma sessao agendada, quando confirmado, entao a sessao tambem e marcada como "Paga"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o webhook chega com `authToken` invalido ou ausente, quando a Edge Function recebe, entao rejeita com HTTP 401 e nao processa (protecao contra webhook falsificado)
- [ ] Dado que o ID da cobranca no webhook nao existe no banco local, quando processado, entao loga o evento como "cobranca nao encontrada" e retorna HTTP 200 (nao reprocessar)
- [ ] Dado que o mesmo webhook e enviado duas vezes (retry do Asaas), quando processado pela segunda vez, entao e idempotente — nao duplica o registro de pagamento
- [ ] Dado que a Edge Function falha (erro interno), quando o Asaas nao recebe HTTP 200, entao o Asaas fara retry automatico — a Edge Function deve ser idempotente para lidar com retries
- [ ] Estado de erro: erros de processamento sao logados (nao exibidos ao usuario — e processo automatizado)

**Requisitos Nao-Funcionais:**
- [ ] Webhook processado em <2s (Asaas timeout)
- [ ] Idempotencia obrigatoria (mesmo evento processado N vezes produz o mesmo resultado)
- [ ] `authToken` do webhook armazenado em `supabase secrets` — nunca hardcoded

**Fora do escopo desta story:**
- Webhook de assinaturas (SUBSCRIPTION_*) — tratado como extensao desta story ou story separada
- Reconciliacao manual (psicologa confirmar pagamento que o webhook perdeu)
- Dashboard de eventos de webhook (monitoramento)

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-102 (cobranças precisam existir para serem conciliadas)

---

### US-105: Regua de Cobranca Automatica

**Como** psicologa
**Quero** que o sistema envie lembretes automaticos de pagamento aos pacientes antes e apos o vencimento
**Para** reduzir inadimplencia sem precisar cobrar pessoalmente (o que gera constrangimento)

**Contexto:** Sequencia automatizada de lembretes/acoes. Gatilho: status da cobranca. Execucao: cron job via Edge Function ou pg_cron. Os lembretes sao enviados por email.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que uma cobranca tem vencimento em 3 dias (D-3), quando o cron executa, entao o paciente recebe email: "Ola [Nome], sua sessao de terapia tem um pagamento com vencimento em [data]. Acesse aqui para pagar: [link Asaas]."
- [ ] Dado que uma cobranca venceu ha 3 dias (D+3) e nao foi paga, quando o cron executa, entao o paciente recebe email: "Ola [Nome], seu pagamento referente a [descricao] venceu em [data]. Regularize pelo link: [link Asaas]."
- [ ] Dado que uma cobranca venceu ha 7 dias (D+7) e nao foi paga, quando o cron executa, entao envia segundo lembrete ao paciente e notifica a psicologa: "O paciente [Nome] esta com pagamento vencido ha 7 dias."
- [ ] Dado que uma cobranca venceu ha 15 dias (D+15) e nao foi paga, quando o cron executa, entao o paciente e marcado como "Inadimplente" no sistema e a psicologa recebe notificacao destacada

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente pagou entre D-3 e o vencimento (webhook confirmou), quando o cron executa, entao nao envia mais lembretes para essa cobranca
- [ ] Dado que o envio de email falha, quando o cron processa, entao loga a falha e tenta novamente na proxima execucao do cron (nao marca como enviado)
- [ ] Dado que a psicologa quer desativar a regua para um paciente especifico, quando edita as configuracoes do paciente, entao pode marcar "Nao enviar lembretes automaticos" — os lembretes param mas a cobranca continua existindo
- [ ] Estado de erro: erros na regua sao logados e um resumo e disponivel para a psicologa na area financeira

**Requisitos Nao-Funcionais:**
- [ ] Emails de cobranca devem ter tom respeitoso e profissional — nunca agressivo (contexto de saude mental)
- [ ] Cron roda 1x por dia em horario comercial (ex: 9h)

**Fora do escopo desta story:**
- Lembretes por WhatsApp
- Cobranca automatica de multa/juros por atraso
- Bloqueio de acesso ao portal por inadimplencia

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-104 (webhook precisa estar funcionando para saber o que foi pago)

---

### US-106: Painel de Inadimplentes

**Como** psicologa
**Quero** ver uma lista dos pacientes com pagamentos vencidos
**Para** decidir como agir caso a caso (cobrar, renegociar, ou encerrar atendimento)

**Contexto:** Lista filtrada de pacientes com cobranças vencidas e nao pagas. Acessivel pelo dashboard (clicando no KPI de inadimplentes) ou pelo menu financeiro.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que existem pacientes com cobranças vencidas, quando a psicologa acessa o painel de inadimplentes, entao ve lista com: nome do paciente, valor total em aberto, cobranca mais antiga vencida (dias de atraso), e quantidade de cobranças vencidas
- [ ] Dado que clica em um paciente da lista, quando ve os detalhes, entao ve todas as cobranças vencidas daquele paciente com data de vencimento, valor e link para o pagamento no Asaas
- [ ] Dado que a lista tem muitos itens, quando existem mais de 20 registros, entao a lista e paginada

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que nenhum paciente esta inadimplente, quando acessa o painel, entao ve mensagem "Nenhum paciente inadimplente. Todos os pagamentos estao em dia!"
- [ ] Estado de loading: skeleton da lista enquanto carrega
- [ ] Estado de erro: falha ao carregar exibe "Nao foi possivel carregar a lista de inadimplentes. Tente novamente."

**Fora do escopo desta story:**
- Envio de cobranca diretamente desta tela (usa US-102)
- Renegociacao de divida (manual, fora do sistema)
- Bloqueio de agenda por inadimplencia

**Prioridade:** Media
**Tamanho:** P (<=1d)
**Dependencias:** US-104 (status de pagamento atualizado via webhook)

---

### US-107: Historico de Pagamentos no Portal do Paciente

**Como** paciente
**Quero** ver meu historico de pagamentos e status de cobranças pendentes
**Para** saber o que ja paguei, o que devo e ter controle financeiro do meu tratamento

**Contexto:** Acessivel pelo portal do paciente. Mostra cobranças pagas, pendentes e vencidas. Cada cobranca tem link para o pagamento (se pendente) e link para o recibo (se paga, US-406).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente esta logado no portal, quando acessa "Meus Pagamentos", entao ve lista de todas as suas cobranças ordenadas por data (mais recente primeiro)
- [ ] Dado que uma cobranca esta com status "Pendente", quando ve a lista, entao aparece badge "Pendente" com botao "Pagar" que abre o link de pagamento do Asaas
- [ ] Dado que uma cobranca esta com status "Pago", quando ve a lista, entao aparece badge "Pago" com botao "Ver Recibo" (US-406)
- [ ] Dado que uma cobranca esta com status "Vencida", quando ve a lista, entao aparece badge "Vencida" em vermelho discreto com botao "Regularizar" que abre o link de pagamento

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao tem cobranças, quando acessa a area, entao ve "Nenhum pagamento registrado ainda."
- [ ] Dado que o paciente tem assinatura ativa, quando ve o historico, entao as cobranças recorrentes aparecem com indicacao "Pacote Mensal" para diferenciar de avulsas
- [ ] Estado de loading: skeleton da lista
- [ ] Estado de erro: "Nao foi possivel carregar seu historico de pagamentos. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Paciente so ve suas proprias cobranças (RLS obrigatorio)

**Fora do escopo desta story:**
- Pagamento inline (dentro do app) — redireciona para pagina do Asaas
- Contestacao de cobranca
- Nota fiscal (apenas recibo)

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-104 (webhook atualiza status), US-006 (portal do paciente)

---

---

## Epico 2: Sala de Video + Sala de Espera

**Outcome do epico:** Psicologa atende em sala de video propria com identidade Talitha, garantindo sigilo (isolamento de pacientes) e experiencia profissional sem depender de ferramentas de terceiros.
**Metricas:** 100% das sessoes sem exposicao entre pacientes; reconexao em <5s; feedback positivo >80%.

---

### US-201: Teste de Camera e Microfone (Pre-Sessao)

**Como** paciente (ou psicologa)
**Quero** testar minha camera e microfone antes de entrar na sala de video
**Para** garantir que meus dispositivos estao funcionando e evitar problemas tecnicos durante a sessao

**Contexto:** Tela acessivel antes de entrar na sala de espera. Mostra preview da camera e nivel de audio do microfone. Permite trocar de dispositivo (camera/mic/alto-falante). Ambos os perfis (psicologa e paciente) usam esta tela.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o usuario (paciente ou psicologa) esta prestes a entrar na sala, quando clica em "Testar Dispositivos", entao ve: preview da camera em tempo real, indicador de nivel do microfone (barra animada respondendo ao som), e seletor de dispositivo (camera, microfone, alto-falante)
- [ ] Dado que o teste mostra camera e microfone funcionando, quando clica em "Tudo certo, entrar na sala", entao avanca para a sala de espera (paciente) ou para a sala de video (psicologa)
- [ ] Dado que o usuario quer trocar de dispositivo, quando seleciona outro no dropdown, entao o preview atualiza para o novo dispositivo

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o navegador nao tem permissao de camera/microfone, quando tenta testar, entao exibe mensagem: "Permita o acesso a camera e ao microfone nas configuracoes do seu navegador para continuar." com instrucoes visuais simplificadas
- [ ] Dado que o dispositivo nao tem camera (desktop sem webcam), quando tenta testar, entao exibe "Nenhuma camera detectada" mas permite continuar apenas com audio (sessao so audio — decisao da psicologa se aceita)
- [ ] Dado que o dispositivo nao tem microfone, quando tenta testar, entao exibe "Nenhum microfone detectado. Voce nao podera ser ouvido na sessao." e bloqueia o avanco (microfone e obrigatorio)
- [ ] Estado de loading: "Acessando seus dispositivos..." enquanto solicita permissoes do navegador
- [ ] Estado de erro: "Nao foi possivel acessar seus dispositivos. Verifique as permissoes do navegador e tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Funciona em Chrome, Firefox, Safari e Edge (versoes recentes)
- [ ] Mobile: funcional em navegador mobile (camera frontal como padrao)

**Fora do escopo desta story:**
- Teste de velocidade de conexao
- Gravacao de teste para playback
- Compartilhamento de tela (nao faz parte do MVP)

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** Nenhuma (pode ser desenvolvida independentemente)

---

### US-202: Sala de Espera do Paciente

**Como** paciente
**Quero** aguardar em uma sala de espera ate a psicologa me admitir
**Para** entrar na sessao de forma organizada e sem risco de ver outro paciente

**Contexto:** Apos testar dispositivos, o paciente entra na sala de espera. La, ve uma mensagem de aguardo. A psicologa recebe notificacao de que o paciente esta esperando. O paciente so entra na sala de video quando a psicologa admite. CRITICO: paciente A nunca pode ver ou ouvir paciente B.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente completou o teste de dispositivos, quando clica em "Entrar na Sala", entao e direcionado para a sala de espera onde ve: mensagem "Aguarde, sua psicologa ira admiti-lo(a) em instantes", animacao de aguardo, e seu video/audio desligados (nao transmitindo)
- [ ] Dado que o paciente esta na sala de espera, quando a psicologa esta na area de atendimento, entao ve notificacao: "[Nome do Paciente] esta aguardando na sala de espera" com botao "Admitir"
- [ ] Dado que a psicologa clicou em "Admitir", quando o paciente e admitido, entao a sala de espera se transforma na sala de video e a sessao inicia (US-204)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que outro paciente ja esta na sala de espera ou em sessao, quando um novo paciente tenta entrar, entao e colocado em sua propria sala de espera isolada — nunca compartilha com outro paciente (cada sessao e um room separado no LiveKit)
- [ ] Dado que o paciente esta na sala de espera ha mais de 10 minutos sem ser admitido, quando o tempo passa, entao exibe mensagem: "Sua psicologa pode estar finalizando outra sessao. Aguarde mais um momento."
- [ ] Dado que o paciente esta na sala de espera ha mais de 20 minutos, quando o tempo passa, entao exibe opcao: "Sua psicologa ainda nao esta disponivel. Deseja sair e tentar novamente mais tarde?"
- [ ] Dado que o paciente perde conexao na sala de espera, quando reconecta, entao volta para a sala de espera automaticamente (nao precisa refazer o teste)
- [ ] Dado que o paciente tenta acessar a sala de outro paciente (manipulacao de URL), quando o sistema verifica, entao bloqueia com "Voce nao tem acesso a esta sala" e redireciona para seu portal
- [ ] Estado de loading: animacao de espera (spinner ou animacao suave)
- [ ] Estado de erro: "A conexao com a sala caiu. Reconectando..." com tentativa automatica

**Requisitos Nao-Funcionais:**
- [ ] Cada sessao e um LiveKit room separado — isolamento total entre pacientes
- [ ] Video e audio do paciente so sao ativados APOS admissao pela psicologa
- [ ] Sala de espera nao consome minutos do LiveKit (paciente nao esta no room ainda)

**Fora do escopo desta story:**
- Chat na sala de espera
- Musica ambiente durante a espera
- Posicao na fila (nao ha fila — e atendimento individual agendado)

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-201 (teste de dispositivos precede a sala de espera)

---

### US-203: Admissao do Paciente pela Psicologa

**Como** psicologa
**Quero** ver quem esta aguardando e admitir o paciente na sala de video
**Para** controlar quem entra na sessao e garantir que estou pronta antes de iniciar

**Contexto:** A psicologa ve a lista de pacientes aguardando e pode admitir um de cada vez. O padrao e uma sessao por vez (1:1), mas a psicologa pode ter sessoes agendadas em sequencia.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta na area de atendimento, quando um ou mais pacientes estao na sala de espera, entao ve lista com: nome do paciente, horario agendado, e tempo de espera. Cada entrada tem botao "Admitir"
- [ ] Dado que a psicologa clica em "Admitir" para um paciente, quando o paciente e admitido, entao a psicologa entra na sala de video junto com o paciente (room do LiveKit e criado/conectado)
- [ ] Dado que a psicologa tem uma sessao em andamento e outro paciente esta esperando, quando ve a lista, entao o segundo paciente aparece com aviso: "Voce tem uma sessao em andamento. Finalize antes de admitir o proximo paciente."

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente saiu da sala de espera antes de ser admitido (fechou o navegador), quando a psicologa tenta admitir, entao o sistema exibe "O paciente nao esta mais na sala de espera" e remove da lista
- [ ] Dado que nenhum paciente esta aguardando, quando a psicologa ve a area de atendimento, entao ve "Nenhum paciente aguardando. Sua proxima sessao e as [horario] com [Nome]."
- [ ] Estado de loading: botao "Admitir" mostra spinner durante a conexao ao room
- [ ] Estado de erro: falha ao criar room no LiveKit exibe "Nao foi possivel iniciar a sala. Tente novamente."

**Fora do escopo desta story:**
- Recusar paciente (rejeitar admissao)
- Admissao automatica sem intervencao da psicologa

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-202 (sala de espera precisa existir)

---

### US-204: Sessao de Video 1:1

**Como** psicologa (e paciente)
**Quero** realizar uma sessao de terapia por video com audio e video bidirecionais
**Para** conduzir o atendimento psicologico online com qualidade e privacidade

**Contexto:** Sessao via LiveKit. Apos admissao, ambos veem video do outro e podem falar. Interface limpa com foco no video. Controles de camera, microfone e encerramento visiveis. Psicologa tem acesso ao painel de anotacoes (US-205).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente foi admitido, quando a sessao inicia, entao ambos (psicologa e paciente) veem o video do outro em tempo real com audio bidirecional
- [ ] Dado que a sessao esta em andamento, quando a psicologa ou paciente veem a interface, entao encontram controles de: ligar/desligar camera, ligar/desligar microfone, e "Encerrar Sessao"
- [ ] Dado que a psicologa clica em "Encerrar Sessao", quando a sessao e encerrada, entao ambos sao desconectados do room, o paciente ve mensagem "Sessao encerrada. Ate a proxima!", e a psicologa e direcionada para a tela de registro de evolucao (US-401)
- [ ] Dado que a sessao esta em andamento, quando a psicologa clica no icone de anotacoes, entao o painel lateral de anotacoes abre (US-205) sem interromper o video

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente tenta encerrar a sessao, quando clica em "Sair da Sessao", entao ve confirmacao: "Deseja sair da sessao? Se precisar voltar, basta acessar novamente pelo portal." — a sessao nao e encerrada para a psicologa (ela decide quando finaliza)
- [ ] Dado que a qualidade da conexao esta ruim, quando a latencia ultrapassa 500ms, entao exibe indicador visual de qualidade de conexao (icone amarelo/vermelho)
- [ ] Dado que a camera de um dos participantes esta desligada, quando o outro ve, entao ve avatar/inicial do nome em vez de video preto
- [ ] Dado que a sessao ultrapassa 2 horas (proteção contra room esquecido aberto), quando o tempo passa, entao exibe aviso discreto para a psicologa: "A sessao esta ativa ha mais de 2 horas."
- [ ] Estado de loading: "Conectando a sessao..." com indicador de progresso
- [ ] Estado de erro: falha na conexao com LiveKit exibe "Nao foi possivel conectar a sessao. Verifique sua conexao e tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Video inicia em <5s apos admissao
- [ ] Interface responsiva: video ocupa area maxima em mobile; em desktop, video principal + miniatura do self-view
- [ ] Nenhum dado de video e armazenado (sem gravacao)

**Fora do escopo desta story:**
- Gravacao da sessao (explicitamente fora do MVP)
- Compartilhamento de tela
- Chat de texto durante a sessao
- Sessao em grupo

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-203 (admissao precede a sessao)

---

### US-205: Anotacoes Rapidas Durante a Sessao

**Como** psicologa
**Quero** fazer anotacoes rapidas em um painel lateral enquanto atendo
**Para** registrar insights e pontos importantes sem perder o contato visual com o paciente

**Contexto:** Painel lateral que abre sobre a interface de video sem interromper a chamada. Anotacoes sao temporarias (rascunho) — sao salvas automaticamente e ficam disponiveis quando a psicologa for registrar a evolucao formal no prontuario (US-401). O paciente NAO ve as anotacoes.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a sessao esta em andamento, quando a psicologa clica no icone de anotacoes, entao um painel lateral abre (sem cobrir o video completamente — ocupando ~30% da tela em desktop, colapsavel/expansivel em mobile)
- [ ] Dado que o painel esta aberto, quando a psicologa digita, entao o texto e salvo automaticamente a cada 5 segundos (auto-save) sem feedback visual intrusivo
- [ ] Dado que a sessao e encerrada, quando a psicologa e direcionada para o registro de evolucao (US-401), entao as anotacoes da sessao sao pre-carregadas no campo de observacoes como rascunho editavel
- [ ] Dado que a psicologa quer fechar o painel, quando clica no icone de fechar ou no mesmo icone de anotacoes, entao o painel fecha e o video volta a ocupar a tela toda

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a psicologa nao fez nenhuma anotacao durante a sessao, quando e direcionada para a evolucao, entao o campo de observacoes esta vazio (sem pre-carregamento)
- [ ] Dado que a conexao cai durante a digitacao, quando reconecta (US-206), entao as anotacoes feitas ate o momento sao preservadas (salvas localmente)
- [ ] Dado que a psicologa esta em mobile, quando abre o painel de anotacoes, entao o painel ocupa a tela inteira como um modal com o video minimizado (picture-in-picture se suportado)
- [ ] Estado de erro: falha no auto-save exibe aviso discreto "Nao foi possivel salvar as anotacoes automaticamente. Suas anotacoes estao seguras localmente."

**Requisitos Nao-Funcionais:**
- [ ] Anotacoes NAO sao visiveis ao paciente (nunca transmitidas via LiveKit data channel)
- [ ] Auto-save nao gera latencia perceptivel na interface

**Fora do escopo desta story:**
- Formatacao rica (bold, italic, listas) — texto puro no MVP
- Templates de anotacao
- Anotacoes com audio (gravacao de voz)

**Prioridade:** Media
**Tamanho:** M (2-3d)
**Dependencias:** US-204 (sessao de video precisa estar funcionando)

---

### US-206: Reconexao Automatica

**Como** paciente (ou psicologa)
**Quero** que a sessao reconecte automaticamente se minha conexao cair
**Para** nao perder a sessao por um problema temporario de internet

**Contexto:** Redes moveis e Wi-Fi domestico podem ter quedas momentaneas. O LiveKit SDK tem mecanismo nativo de reconnect. A story define o comportamento e feedback visual durante a reconexao.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a sessao esta em andamento e a conexao de um participante cai, quando o SDK detecta a queda, entao inicia tentativa de reconexao automatica imediatamente
- [ ] Dado que a reconexao esta em andamento, quando o participante desconectado ve a tela, entao ve mensagem "Conexao perdida. Reconectando..." com indicador de progresso
- [ ] Dado que a reconexao esta em andamento, quando o outro participante (que nao caiu) ve a tela, entao ve "[Nome] perdeu a conexao. Aguardando reconexao..."
- [ ] Dado que a reconexao e bem-sucedida (em ate 30s), quando reconecta, entao o video e audio retomam automaticamente e as mensagens de reconexao desaparecem

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a reconexao falha apos 30 segundos, quando o timeout e atingido, entao o participante desconectado ve: "Nao foi possivel reconectar. Verifique sua conexao." com botoes "Tentar Novamente" e "Sair da Sessao"
- [ ] Dado que o participante clica em "Tentar Novamente", quando a nova tentativa e iniciada, entao tenta reconectar ao mesmo room (a sessao continua existindo no LiveKit enquanto o outro participante estiver conectado)
- [ ] Dado que ambos os participantes perderam conexao simultaneamente, quando ambos reconectam, entao o room persiste no LiveKit e ambos voltam a sessao normalmente
- [ ] Dado que a psicologa perdeu conexao e o paciente esta sozinho, quando o paciente ve a tela, entao ve "Sua psicologa perdeu a conexao. Aguardando retorno..." — o paciente NAO e desconectado automaticamente

**Requisitos Nao-Funcionais:**
- [ ] Reconexao em <5s para quedas momentaneas (< 5s de interrupcao)
- [ ] Timeout maximo de 30s antes de oferecer opcoes manuais
- [ ] Anotacoes feitas antes da queda sao preservadas (salvas localmente)

**Fora do escopo desta story:**
- Reconexao com mudanca de rede (ex: Wi-Fi para 4G) — depende do SDK
- Fallback para chamada telefonica
- Notificacao por email/SMS de que a sessao caiu

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-204 (sessao de video)

---

---

## Epico 3: Agenda + Lembretes Anti-No-Show

**Outcome do epico:** Psicologa tem agenda organizada com recorrencia, sem conflitos, e pacientes recebem lembretes automaticos que reduzem no-shows em >50%.
**Metricas:** Taxa de no-show <10%; 100% das sessoes com lembrete enviado; 0 conflitos de horario.

---

### US-301: Visualizacao da Agenda

**Como** psicologa
**Quero** ver minha agenda de atendimentos em visao semanal e diaria
**Para** ter clareza dos meus horarios e planejar meu dia

**Contexto:** Visao principal da agenda. Mostra sessoes agendadas com nome do paciente, horario, status (confirmada/pendente/cancelada) e indicacao de pagamento. Visao semanal como padrao, com opcao de visao diaria.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta logada, quando acessa a agenda, entao ve visao semanal com os 7 dias da semana e as sessoes agendadas distribuidas por horario
- [ ] Dado que ha sessoes agendadas, quando ve a agenda, entao cada bloco de sessao mostra: nome do paciente, horario (inicio-fim), status (confirmada/pendente/cancelada) diferenciado por cor, e indicador de pagamento (pago/pendente/vencido)
- [ ] Dado que quer ver detalhes de uma sessao, quando clica no bloco, entao ve popup/modal com detalhes: nome completo do paciente, horario, tipo (avulsa/pacote), status de pagamento, e acoes (cancelar, remarcar, abrir prontuario)
- [ ] Dado que quer mudar a visao, quando alterna entre "Semana" e "Dia", entao a exibicao muda conforme selecionado

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que nao ha sessoes na semana visualizada, quando ve a agenda, entao os horarios aparecem vazios com opcao de "Agendar sessao" em qualquer slot
- [ ] Dado que e a primeira vez usando a agenda (sem sessoes), quando acessa, entao ve mensagem "Sua agenda esta vazia. Cadastre seus pacientes e agende a primeira sessao." com links rapidos
- [ ] Estado de loading: skeleton dos blocos de horario
- [ ] Estado de erro: "Nao foi possivel carregar a agenda. Tente recarregar."

**Requisitos Nao-Funcionais:**
- [ ] Mobile: visao diaria como padrao em telas <768px (semana completa nao cabe)
- [ ] Navegacao entre semanas por seta ou swipe (mobile)

**Fora do escopo desta story:**
- Drag-and-drop para reagendar
- Visao mensal
- Sincronizacao com Google Calendar

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** Nenhuma (pode ser desenvolvida com dados mock)

---

### US-302: Criacao de Agendamento com Recorrencia Semanal

**Como** psicologa
**Quero** agendar sessoes recorrentes para um paciente (mesmo horario toda semana)
**Para** definir a rotina de atendimento sem precisar agendar cada sessao individualmente

**Contexto:** Padrao de atendimento psicologico: sessao semanal fixa. A psicologa define paciente, dia da semana, horario e duracao. O sistema gera as sessoes recorrentes automaticamente. Tambem permite agendar sessao avulsa (unica).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa esta na agenda, quando clica em "Nova Sessao" e seleciona o paciente, dia da semana, horario de inicio, duracao (padrao: 50min) e marca "Recorrencia semanal", entao o sistema verifica conflitos e cria as sessoes recorrentes para as proximas 12 semanas
- [ ] Dado que a recorrencia foi criada, quando a psicologa ve a agenda, entao todas as sessoes recorrentes aparecem nos proximos 3 meses com indicacao visual de que sao recorrentes
- [ ] Dado que a psicologa quer agendar sessao avulsa (unica), quando desmarca "Recorrencia semanal" e seleciona data especifica, entao apenas uma sessao e criada
- [ ] Dado que a recorrencia esta ativa ha 10 semanas, quando restam 2 semanas, entao o sistema gera automaticamente mais 12 semanas de sessoes (rolling window)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o horario selecionado ja tem outra sessao (conflito), quando tenta agendar, entao exibe "Este horario ja esta ocupado por [Nome do Paciente]. Escolha outro horario." (ver US-303)
- [ ] Dado que a recorrencia criaria sessoes em feriados (se houver calendario de feriados), quando gera as sessoes, entao feriados sao criados normalmente — a psicologa cancela individualmente se quiser
- [ ] Dado que a psicologa quer encerrar a recorrencia, quando acessa a configuracao da recorrencia e clica em "Encerrar Recorrencia", entao as sessoes futuras (nao realizadas) sao canceladas e as passadas sao mantidas
- [ ] Estado de loading: "Criando agendamento..." com spinner
- [ ] Estado de erro: "Nao foi possivel criar o agendamento. Tente novamente."

**Fora do escopo desta story:**
- Recorrencia em frequencia diferente de semanal (quinzenal, mensal)
- Agendamento pelo paciente (apenas a psicologa agenda)
- Horarios de funcionamento / bloqueio de horario pessoal

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-002 (paciente precisa existir), US-301 (agenda precisa estar visivel)

---

### US-303: Bloqueio de Conflito de Horario

**Como** psicologa
**Quero** que o sistema impeca agendar dois pacientes no mesmo horario
**Para** evitar sobreposicao de sessoes e confusao na agenda

**Contexto:** Regra de negocio aplicada na criacao e edicao de agendamentos. Considera a duracao da sessao (nao apenas o horario de inicio). Aplica-se a sessoes avulsas e recorrentes.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa tenta agendar uma sessao das 14h as 14h50, quando ja existe outra sessao das 14h as 14h50 no mesmo dia, entao o agendamento e bloqueado com mensagem "Conflito de horario: voce ja tem sessao com [Nome] das 14:00 as 14:50"
- [ ] Dado que a psicologa tenta agendar das 14h30 as 15h20, quando ja existe sessao das 14h as 14h50, entao bloqueia com "Conflito de horario: sobreposicao com sessao de [Nome] das 14:00 as 14:50"
- [ ] Dado que a psicologa tenta agendar das 15h as 15h50, quando existe sessao das 14h as 14h50, entao permite (nao ha sobreposicao — ha 10min de intervalo)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que uma recorrencia semanal e criada e um dos horarios futuros conflita com sessao avulsa ja existente, quando o sistema gera as sessoes, entao cria todas exceto a conflitante e avisa: "1 sessao nao foi criada por conflito de horario em [data]. As demais foram criadas."
- [ ] Dado que a psicologa tenta remarcar uma sessao para horario conflitante, quando seleciona o novo horario, entao recebe a mesma mensagem de conflito

**Fora do escopo desta story:**
- Buffer automatico entre sessoes (ex: 10min obrigatorio) — a psicologa gerencia
- Sugestao de horarios alternativos disponiveis

**Prioridade:** Alta
**Tamanho:** P (<=1d)
**Dependencias:** US-302 (criacao de agendamento)

---

### US-304: Lembrete Automatico 24h e 1h Antes da Sessao

**Como** paciente
**Quero** receber lembretes da minha sessao 24 horas e 1 hora antes
**Para** nao esquecer do horario e ter o link de acesso a sala pronto

**Contexto:** Lembretes enviados por email (canal do MVP). Cada lembrete contem: nome da psicologa, data/hora da sessao, e link para o portal (de onde o paciente acessa a sala). Executado via cron job (Edge Function ou pg_cron).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que uma sessao esta agendada para amanha, quando o cron executa 24h antes, entao o paciente recebe email: "Ola [Nome], sua sessao com [Psicologa] esta marcada para amanha, [dia], as [hora]. Acesse sua sala pelo link: [link portal]."
- [ ] Dado que uma sessao esta agendada para daqui a 1 hora, quando o cron executa 1h antes, entao o paciente recebe email: "Sua sessao com [Psicologa] comeca em 1 hora. Acesse: [link portal]. Dica: teste sua camera e microfone antes de entrar."
- [ ] Dado que o lembrete foi enviado, quando a psicologa consulta os detalhes da sessao na agenda, entao ve indicacao "Lembretes enviados: 24h ✓ / 1h ✓"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a sessao foi cancelada antes do horario do lembrete, quando o cron executa, entao NAO envia lembrete (verifica status da sessao antes de enviar)
- [ ] Dado que o envio de email falha, quando o cron processa, entao registra a falha e tenta novamente na proxima execucao (com flag para nao reenviar apos a sessao ter ocorrido)
- [ ] Dado que a sessao foi remarcada para outro horario apos o lembrete de 24h ter sido enviado, quando o novo horario se aproxima, entao envia novo lembrete com horario atualizado
- [ ] Dado que a sessao e agendada com menos de 24h de antecedencia, quando o cron roda, entao envia apenas o lembrete de 1h (se ainda houver tempo)
- [ ] Estado de erro: falhas de envio sao logadas e visiveis para a psicologa em painel de status de lembretes

**Requisitos Nao-Funcionais:**
- [ ] Cron executa a cada 15 minutos para capturar lembretes de 1h com precisao razoavel
- [ ] Emails devem ter tom acolhedor e profissional (contexto de saude mental)

**Fora do escopo desta story:**
- Lembretes por WhatsApp / SMS
- Lembrete para a psicologa (ela ja tem a agenda)
- Lembrete customizavel (conteudo fixo no MVP)

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-302 (sessoes precisam estar agendadas)

---

### US-305: Confirmacao de Presenca pelo Paciente

**Como** psicologa
**Quero** que o paciente confirme presenca na sessao
**Para** saber com antecedencia se ele vira e poder reagir caso nao confirme

**Contexto:** O email de lembrete de 24h inclui opcao de confirmar ou informar ausencia. A confirmacao e registrada no sistema. Se o paciente nao confirma nem informa ausencia, a sessao permanece como "Pendente de confirmacao".

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente recebeu o lembrete de 24h, quando o email contem links "Confirmar Presenca" e "Nao poderei ir", entao o paciente pode clicar em um dos dois
- [ ] Dado que o paciente clicou em "Confirmar Presenca", quando o sistema registra, entao a sessao e marcada como "Confirmada" e a psicologa ve o status atualizado na agenda
- [ ] Dado que o paciente clicou em "Nao poderei ir", quando o sistema registra, entao a sessao e marcada como "Paciente ausente (previsto)" e a psicologa recebe notificacao: "[Nome] informou que nao podera comparecer a sessao de [data/hora]"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao clicou em nenhum link ate 1h antes da sessao, quando o cron de 1h executa, entao a sessao permanece como "Pendente de confirmacao" e o lembrete de 1h e enviado normalmente
- [ ] Dado que o paciente confirmou mas depois quer cancelar, quando acessa o portal e a politica de prazo permite (US-306), entao pode cancelar normalmente
- [ ] Dado que o link de confirmacao e acessado apos a sessao ter sido realizada, quando o sistema recebe, entao ignora (exibindo "Esta sessao ja foi realizada")
- [ ] Estado de erro: link invalido ou expirado exibe "Este link nao e mais valido."

**Fora do escopo desta story:**
- Reagendamento automatico quando paciente informa ausencia
- Cobranca automatica por no-show
- Confirmacao por WhatsApp

**Prioridade:** Media
**Tamanho:** M (2-3d)
**Dependencias:** US-304 (lembrete precisa existir para incluir os links)

---

### US-306: Cancelamento de Sessao com Politica de Prazo

**Como** psicologa (ou paciente)
**Quero** cancelar uma sessao agendada respeitando a politica de prazo
**Para** ter regras claras que protejam ambas as partes contra cancelamentos de ultima hora

**Contexto:** A psicologa define a politica de cancelamento (prazo minimo de antecedencia). Se o paciente cancela dentro do prazo, a sessao e cancelada sem consequencia. Se cancela fora do prazo (muito em cima da hora), a sessao pode ser cobrada (decisao da psicologa).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa configurou politica de cancelamento com prazo de 24h de antecedencia, quando um paciente tenta cancelar com mais de 24h de antecedencia, entao a sessao e cancelada sem cobranca e a psicologa e notificada
- [ ] Dado que um paciente tenta cancelar com menos de 24h de antecedencia, quando envia o cancelamento, entao ve aviso: "O prazo de cancelamento sem cobranca (24h de antecedencia) ja passou. O valor da sessao podera ser cobrado conforme politica de cancelamento. Deseja prosseguir?" com opcoes "Sim, cancelar mesmo assim" e "Nao, manter a sessao"
- [ ] Dado que o paciente cancelou fora do prazo, quando a sessao e marcada como "Cancelada fora do prazo", entao a psicologa decide se mantem ou cancela a cobranca (acao manual)
- [ ] Dado que a psicologa cancela uma sessao, quando realiza o cancelamento, entao o paciente recebe email: "Sua sessao de [data/hora] foi cancelada pela psicologa. Entre em contato para reagendar." e a cobranca associada e cancelada (se existir e estiver pendente)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a sessao faz parte de uma recorrencia, quando e cancelada, entao apenas AQUELA sessao e cancelada — as futuras permanecem
- [ ] Dado que a psicologa nao configurou politica de cancelamento, quando um cancelamento e solicitado, entao nao ha restricao de prazo (cancelamento livre) — recomendar na UI que configure
- [ ] Dado que a sessao ja esta em andamento, quando tentam cancelar, entao nao permite: "Esta sessao ja esta em andamento e nao pode ser cancelada"
- [ ] Dado que a sessao ja ocorreu (passado), quando tentam cancelar, entao exibe "Sessoes passadas nao podem ser canceladas"
- [ ] Estado de loading: spinner durante processamento do cancelamento
- [ ] Estado de erro: falha ao cancelar exibe "Nao foi possivel cancelar a sessao. Tente novamente."

**Fora do escopo desta story:**
- Cobranca automatica de no-show/cancelamento tardio (decisao manual da psicologa)
- Reposicao automatica de sessao cancelada

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-302 (sessoes precisam existir)

---

### US-307: Remarcacao de Sessao

**Como** psicologa (ou paciente)
**Quero** remarcar uma sessao para outro horario
**Para** acomodar imprevistos sem perder a sessao

**Contexto:** A remarcacao e essencialmente um cancelamento + novo agendamento. A politica de prazo de cancelamento (US-306) se aplica. O sistema sugere horarios disponiveis.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa quer remarcar uma sessao, quando clica em "Remarcar" na sessao agendada e seleciona novo dia/horario, entao o sistema verifica conflitos, cancela a sessao original e cria a nova no horario escolhido
- [ ] Dado que a remarcacao foi feita, quando o paciente acessa o portal, entao ve a sessao atualizada com o novo horario e recebe email: "Sua sessao foi remarcada para [novo dia/hora]."
- [ ] Dado que o paciente quer remarcar (pelo portal), quando clica em "Remarcar" e a politica de prazo permite, entao ve os horarios disponiveis da psicologa e pode escolher um novo

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o novo horario tem conflito, quando tenta remarcar, entao exibe mensagem de conflito (US-303) e nao permite
- [ ] Dado que o paciente tenta remarcar fora do prazo de cancelamento, quando solicita, entao ve o mesmo aviso de US-306 sobre possivel cobranca
- [ ] Dado que a sessao remarcada tinha cobranca associada, quando remarcar, entao a cobranca e transferida para a nova data (se pendente) ou mantida (se ja paga)
- [ ] Estado de loading: "Remarcando sessao..." com spinner
- [ ] Estado de erro: "Nao foi possivel remarcar a sessao. Tente novamente."

**Fora do escopo desta story:**
- Sugestao inteligente de horarios baseada em historico
- Limite de remarcacoes por paciente

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-302 (agendamento), US-303 (conflito), US-306 (politica de prazo)

---

### US-308: Proximas Sessoes no Portal do Paciente

**Como** paciente
**Quero** ver minhas proximas sessoes agendadas no portal
**Para** saber quando e minha proxima sessao e ter o link de acesso pronto

**Contexto:** Area dedicada no portal do paciente (complementa o resumo do US-006). Lista as proximas sessoes com detalhes. Botao "Entrar na Sala" disponivel apenas no dia e horario da sessao.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente esta logado no portal, quando acessa "Minhas Sessoes", entao ve lista das proximas sessoes agendadas com: data, dia da semana, horario, status (confirmada/pendente) e botao de acao
- [ ] Dado que a sessao e hoje e falta menos de 15 minutos para comecar, quando o paciente ve a lista, entao o botao "Entrar na Sala" esta habilitado e destacado
- [ ] Dado que a sessao e futura (nao e hoje), quando o paciente ve, entao o botao "Entrar na Sala" esta desabilitado e mostra "Disponivel em [data]"

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao tem sessoes futuras, quando acessa a area, entao ve "Voce nao tem sessoes agendadas. Entre em contato com sua psicologa."
- [ ] Dado que a sessao foi cancelada, quando o paciente ve a lista, entao a sessao aparece com status "Cancelada" riscada e sem botao de acesso
- [ ] Estado de loading: skeleton da lista de sessoes
- [ ] Estado de erro: "Nao foi possivel carregar suas sessoes. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Paciente so ve suas proprias sessoes (RLS)
- [ ] Lista limitada as proximas 10 sessoes (evitar carregar meses de recorrencia)

**Fora do escopo desta story:**
- Historico de sessoes passadas (pos-MVP)
- Agendamento pelo paciente
- Calendario visual no portal do paciente

**Prioridade:** Alta
**Tamanho:** P (<=1d)
**Dependencias:** US-006 (portal do paciente), US-302 (sessoes agendadas)

---

---

## Epico 4: Prontuario + Recibos IRPF

**Outcome do epico:** Psicologa tem prontuario digital seguro, criptografado e em conformidade com CFP/LGPD, e pacientes recebem recibos automaticos para deducao no Imposto de Renda.
**Metricas:** 100% dos prontuarios criptografados; 100% dos acessos com audit log; tempo de emissao de recibo = 0 (automatico).

---

### US-401: Registro de Evolucao por Sessao

**Como** psicologa
**Quero** registrar a evolucao do paciente apos cada sessao de atendimento
**Para** documentar o progresso do tratamento e ter historico clinico organizado

**Contexto:** Tela de registro acessada apos encerrar a sessao de video (US-204) ou a qualquer momento pela area do paciente. Se houve anotacoes durante a sessao (US-205), elas sao pre-carregadas como rascunho. O conteudo e criptografado em repouso (US-404).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa encerrou uma sessao de video, quando e direcionada para o registro de evolucao, entao ve formulario com: data da sessao (pre-preenchida), duracao (calculada automaticamente), campo de "Evolucao / Observacoes" (texto livre, pre-carregado com anotacoes da sessao se houver), e campo de "Humor / Estado Geral" (selecao simples: bom, neutro, ansioso, triste, agitado, outro)
- [ ] Dado que a psicologa preencheu a evolucao e clicou em "Salvar", quando o registro e salvo, entao o conteudo e criptografado antes de ser persistido no banco e aparece no historico do paciente (US-403)
- [ ] Dado que a psicologa quer registrar evolucao fora do fluxo de video (ex: sessao que aconteceu por outro meio), quando acessa a ficha do paciente e clica em "Registrar Evolucao", entao ve o mesmo formulario com data editavel

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a psicologa tenta salvar sem preencher o campo de evolucao, quando clica em "Salvar", entao exibe "O campo de evolucao nao pode estar vazio"
- [ ] Dado que a psicologa quer editar uma evolucao ja salva, quando acessa o registro no historico e clica em "Editar", entao pode editar o conteudo — a edicao gera nova entrada no audit log (US-405)
- [ ] Dado que a psicologa esta preenchendo e fecha o navegador acidentalmente, quando volta ao sistema, entao ve rascunho salvo automaticamente (se auto-save estava ativo) com opcao de "Retomar rascunho" ou "Descartar"
- [ ] Estado de loading: "Salvando evolucao..." com spinner. Botao desabilitado durante o salvamento
- [ ] Estado de erro: "Nao foi possivel salvar a evolucao. Tente novamente. Seu texto esta preservado."

**Requisitos Nao-Funcionais:**
- [ ] Conteudo criptografado em repouso (ver US-404)
- [ ] Auto-save do rascunho a cada 30 segundos
- [ ] Evolucao so acessivel pela psicologa (paciente NAO ve — dado clinico sigiloso)

**Fora do escopo desta story:**
- Templates de evolucao (pos-MVP)
- Anexos (fotos, documentos)
- Classificacao CID/DSM
- Evolucao compartilhada com outro profissional

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-204 (sessao de video — para fluxo integrado), US-002 (paciente existente)

---

### US-402: Anamnese / Ficha Inicial do Paciente

**Como** psicologa
**Quero** enviar um formulario de anamnese para o paciente preencher antes da primeira sessao
**Para** ter as informacoes basicas e historico do paciente antes de iniciar o acompanhamento

**Contexto:** A anamnese e um questionario padrao que o paciente preenche pelo portal. A psicologa define quais campos quer (no MVP, campos fixos). O preenchimento e salvo e fica disponivel na ficha do paciente.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente completou o onboarding (termos aceitos), quando acessa o portal pela primeira vez, entao ve aviso: "Antes da sua primeira sessao, preencha sua ficha inicial." com botao "Preencher Ficha"
- [ ] Dado que o paciente acessa a ficha, quando ve o formulario, entao encontra campos: motivo da busca por terapia, historico de tratamento psicologico anterior (sim/nao, detalhes), uso de medicacao psicoativa (sim/nao, detalhes), condicoes de saude relevantes, contato de emergencia (nome, telefone, parentesco), e campo aberto para observacoes
- [ ] Dado que o paciente preencheu e enviou, quando o formulario e submetido, entao os dados sao salvos (criptografados) e a psicologa ve notificacao: "[Nome] preencheu a ficha inicial"
- [ ] Dado que a psicologa quer consultar a anamnese, quando acessa a ficha do paciente, entao ve secao "Anamnese" com todas as respostas

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao preencheu a anamnese, quando a psicologa acessa a ficha, entao ve "Anamnese: Nao preenchida" com opcao de "Reenviar lembrete"
- [ ] Dado que o paciente quer atualizar a anamnese (mudou de medicacao, por exemplo), quando acessa a ficha no portal, entao pode editar e reenviar — a versao anterior e mantida no historico
- [ ] Dado que campos obrigatorios nao foram preenchidos (motivo da busca e contato de emergencia), quando tenta enviar, entao exibe indicacao nos campos faltantes
- [ ] Estado de loading: "Enviando sua ficha..." com spinner
- [ ] Estado de erro: "Nao foi possivel enviar sua ficha. Tente novamente. Seus dados estao preservados."

**Requisitos Nao-Funcionais:**
- [ ] Dados da anamnese sao criptografados em repouso (dados de saude)
- [ ] Paciente so ve/edita a propria anamnese (RLS)

**Fora do escopo desta story:**
- Anamnese customizavel pela psicologa (campos fixos no MVP)
- Anamnese infantil (formulario diferenciado)
- Assinatura digital na anamnese

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-003 (paciente com acesso ao portal)

---

### US-403: Historico Clinico do Paciente

**Como** psicologa
**Quero** consultar o historico completo de evolucoes de um paciente
**Para** revisar sessoes anteriores e acompanhar o progresso do tratamento ao longo do tempo

**Contexto:** Visao cronologica de todas as evolucoes registradas para um paciente. Acessivel pela ficha do paciente. Inclui anamnese no topo e evolucoes por sessao em ordem cronologica.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa acessa a ficha de um paciente, quando clica em "Historico Clinico", entao ve: anamnese (se preenchida) no topo, seguida de lista cronologica de evolucoes (mais recente primeiro)
- [ ] Dado que existem evolucoes registradas, quando ve a lista, entao cada entrada mostra: data da sessao, duracao, estado geral registrado, e preview do texto de evolucao (primeiras 2 linhas)
- [ ] Dado que clica em uma evolucao, quando expande, entao ve o texto completo descriptografado
- [ ] Dado que quer buscar algo especifico, quando usa o campo de busca, entao filtra evolucoes que contenham o termo buscado (busca no texto descriptografado)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente nao tem evolucoes registradas, quando acessa o historico, entao ve "Nenhuma evolucao registrada ainda. Registre a primeira apos a sessao."
- [ ] Dado que o historico tem muitas entradas (>50 sessoes), quando carrega, entao carrega as 20 mais recentes com paginacao "Carregar mais"
- [ ] Estado de loading: skeleton das entradas do historico
- [ ] Estado de erro: "Nao foi possivel carregar o historico. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Descriptografia ocorre no server-side ou no client com chave apropriada — nunca expoe dados criptografados brutos ao frontend
- [ ] Cada visualizacao do historico gera registro no audit log (US-405)
- [ ] Paciente NAO tem acesso ao historico clinico (dado sigiloso, visivel apenas para a psicologa)

**Fora do escopo desta story:**
- Exportacao do historico em PDF
- Compartilhamento com outro profissional
- Timeline visual (grafico de humor ao longo do tempo)

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-401 (evolucoes registradas), US-402 (anamnese)

---

### US-404: Criptografia do Prontuario em Repouso

**Como** sistema (requisito tecnico de seguranca)
**Quero** que todos os dados de prontuario sejam criptografados antes de serem armazenados no banco
**Para** cumprir a LGPD (dados sensiveis) e proteger o sigilo clinico mesmo em caso de acesso indevido ao banco

**Contexto:** Dados de saude sao dados pessoais sensiveis (LGPD art. 5, II). A criptografia em transito (TLS) ja e padrao. Esta story trata da criptografia em repouso (at-rest) — os dados armazenados no banco devem ser ininteligiveis sem a chave de descriptografia. A abordagem especifica (application-level, pgcrypto, Supabase Vault) sera definida pelo Security Review e System Architect.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa salva uma evolucao, quando o registro e persistido no banco, entao o campo de texto da evolucao e armazenado criptografado (nao legivel em query direta no banco)
- [ ] Dado que a psicologa acessa uma evolucao, quando o sistema busca o registro, entao o conteudo e descriptografado antes de ser exibido
- [ ] Dado que um admin de banco (ou atacante) acessa a tabela de prontuarios diretamente, quando faz SELECT, entao ve dados criptografados ininteligiveis

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a chave de criptografia e rotacionada, quando o sistema processa a rotacao, entao re-criptografa os registros existentes com a nova chave (processo offline/batch)
- [ ] Dado que a descriptografia falha (chave incompativel, dado corrompido), quando o sistema tenta exibir, entao exibe mensagem "Nao foi possivel acessar este registro. Contate o suporte." e registra no log de erros
- [ ] Estado de erro: falhas de criptografia/descriptografia sao tratadas graciosamente sem expor dados parciais

**Requisitos Nao-Funcionais:**
- [ ] Algoritmo de criptografia: AES-256 (minimo recomendado para dados de saude)
- [ ] Chave de criptografia NUNCA armazenada no mesmo banco de dados
- [ ] Performance: criptografia/descriptografia nao deve adicionar mais que 100ms de latencia por operacao

**Fora do escopo desta story:**
- Criptografia de outros campos (nome, email, CPF) — apenas prontuario no MVP
- Criptografia end-to-end (E2EE) onde nem o servidor ve o dado em claro — complexidade alta para MVP

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** Definicao da abordagem pelo Security Review e System Architect

---

### US-405: Audit Log de Acesso ao Prontuario

**Como** psicologa (e para fins de compliance)
**Quero** que todo acesso ao prontuario de um paciente seja registrado automaticamente
**Para** ter rastreabilidade completa de quem acessou qual informacao e quando, conforme exigido pela LGPD

**Contexto:** Log imutavel (append-only) que registra toda operacao em dados de prontuario. Nao e editavel nem deletavel. A psicologa pode consultar o log de um paciente especifico. Em caso de auditoria (CFP, LGPD), o log serve como evidencia de conformidade.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa acessa o historico clinico de um paciente, quando a pagina e carregada, entao o sistema registra automaticamente: user_id (psicologa), patient_id, acao ("VIEW_RECORD"), timestamp (UTC), e IP do acesso
- [ ] Dado que a psicologa salva uma evolucao, quando o registro e salvo, entao o audit log registra: acao ("CREATE_RECORD"), com o ID do registro criado
- [ ] Dado que a psicologa edita uma evolucao, quando salva a edicao, entao o audit log registra: acao ("UPDATE_RECORD"), com o ID do registro editado
- [ ] Dado que a psicologa quer ver o audit log de um paciente, quando acessa a ficha do paciente e clica em "Log de Acesso", entao ve lista cronologica de todos os acessos aos dados daquele paciente

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o audit log falha ao registrar (erro de escrita), quando isso acontece, entao a operacao principal (visualizar/salvar) NAO e bloqueada — o log e registrado de forma assincrona com retry
- [ ] Dado que ninguem acessou o prontuario de um paciente, quando a psicologa ve o log, entao ve "Nenhum acesso registrado para este paciente"
- [ ] Dado que o log tem muitas entradas, quando carrega, entao exibe as 50 mais recentes com paginacao
- [ ] Estado de loading: skeleton da lista de logs
- [ ] Estado de erro: "Nao foi possivel carregar o log de acesso. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Log e IMUTAVEL — tabela de audit nao aceita UPDATE nem DELETE (apenas INSERT), aplicado via policy ou trigger no banco
- [ ] Log NAO contem o conteudo do prontuario — apenas metadados (quem, o que, quando)
- [ ] Retencao do audit log: mesma politica de retencao do prontuario (5 ou 20 anos)

**Fora do escopo desta story:**
- Dashboard de auditoria (graficos de acesso ao longo do tempo)
- Alertas de acesso suspeito (acesso fora do horario, volume anormal)
- Export do audit log em formato para auditores

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-401 (evolucao precisa existir para gerar logs)

---

### US-406: Recibo IRPF Numerado Automatico

**Como** paciente
**Quero** receber um recibo numerado com CPF apos cada pagamento confirmado
**Para** usar na declaracao do Imposto de Renda como despesa com saude

**Contexto:** Recibos de pagamento a psicologo sao dedutiveis no IR. O recibo deve conter dados especificos. Gerado automaticamente quando o webhook confirma pagamento. Disponivel para download no portal do paciente (PDF).

**Criterios de Aceite — Happy Path:**
- [ ] Dado que um pagamento e confirmado via webhook (US-104), quando o sistema processa, entao gera automaticamente um recibo contendo: numero sequencial (ex: 001/2026), nome e CPF da psicologa, CRP da psicologa, nome e CPF do paciente (ou do responsavel legal se menor), descricao do servico ("Sessao de atendimento psicologico online"), data do atendimento, valor pago, e forma de pagamento
- [ ] Dado que o recibo foi gerado, quando o paciente acessa "Meus Recibos" no portal, entao ve lista de recibos com data, valor e botao "Baixar PDF"
- [ ] Dado que o paciente clica em "Baixar PDF", quando o download e processado, entao recebe arquivo PDF formatado e imprimivel
- [ ] Dado que o paciente e menor de idade com responsavel legal cadastrado, quando o recibo e gerado, entao o CPF no recibo e do responsavel legal (nao do menor)

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a psicologa quer ver os recibos emitidos, quando acessa a area financeira > "Recibos", entao ve lista de todos os recibos emitidos com filtro por paciente e periodo
- [ ] Dado que houve estorno de pagamento, quando o webhook notifica, entao o recibo correspondente e marcado como "Cancelado" (nao deletado) e nao aparece mais na lista ativa do paciente
- [ ] Dado que a geracao do PDF falha, quando o paciente tenta baixar, entao exibe "Nao foi possivel gerar o recibo. Tente novamente em alguns instantes."
- [ ] Dado que o paciente nao tem recibos, quando acessa "Meus Recibos", entao ve "Nenhum recibo disponivel ainda. Recibos sao gerados automaticamente apos a confirmacao do pagamento."
- [ ] Estado de loading: spinner durante geracao/download do PDF
- [ ] Estado de erro: "Nao foi possivel carregar seus recibos. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Numeracao sequencial sem lacunas (exceto por cancelamentos)
- [ ] Paciente so ve e baixa seus proprios recibos (RLS)
- [ ] PDF gerado em <3s

**Fora do escopo desta story:**
- Nota fiscal (NFS-e) — apenas recibo simples
- Envio automatico do recibo por email apos pagamento (pos-MVP, mas facil de adicionar)
- Recibo anual consolidado para IR

**Prioridade:** Alta
**Tamanho:** G (4-5d)
**Dependencias:** US-104 (webhook confirma pagamento), US-002 (dados do paciente com CPF)

---

### US-407: Soft Delete e Politica de Retencao de Prontuario

**Como** sistema (requisito de compliance)
**Quero** que prontuarios nunca sejam deletados fisicamente e tenham data de retencao calculada automaticamente
**Para** cumprir a exigencia do CFP de guarda minima de 5 anos (adultos) ou 20 anos (menores)

**Contexto:** Quando o atendimento de um paciente e encerrado, o prontuario nao e deletado — recebe soft delete (`deleted_at`). O campo `retention_until` e calculado automaticamente com base na idade do paciente no inicio do atendimento. Dados so podem ser eliminados fisicamente apos o termino do periodo de retencao.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que a psicologa encerra o atendimento de um paciente adulto, quando marca como "Atendimento encerrado" no cadastro, entao o sistema registra `deleted_at` = agora e calcula `retention_until` = agora + 5 anos
- [ ] Dado que o paciente era menor de idade no inicio do atendimento, quando o atendimento e encerrado, entao `retention_until` = agora + 20 anos
- [ ] Dado que o atendimento foi encerrado, quando a psicologa acessa a ficha do paciente, entao ainda consegue visualizar o prontuario (dados nao sao apagados) com indicacao "Atendimento encerrado em [data]. Dados retidos ate [retention_until]."
- [ ] Dado que `retention_until` expirou, quando o sistema verifica (processo periodico ou manual), entao a psicologa recebe notificacao: "O prazo de retencao do prontuario de [Nome] expirou. Deseja manter ou eliminar os dados?" — eliminacao nunca e automatica

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que a psicologa tenta deletar fisicamente um prontuario cujo `retention_until` ainda nao expirou, quando tenta, entao o sistema bloqueia: "Este prontuario esta em periodo de retencao legal e nao pode ser eliminado ate [data]."
- [ ] Dado que o paciente solicita exclusao dos dados (LGPD), quando a psicologa recebe a solicitacao, entao o sistema verifica o `retention_until`: se expirado, permite eliminacao; se nao expirado, informa "Os dados deste paciente estao sob retencao legal obrigatoria (CFP) ate [data]. A eliminacao so sera possivel apos esta data."
- [ ] Dado que o paciente retoma o atendimento apos encerramento, quando a psicologa reativa, entao `deleted_at` e limpo, o historico anterior e preservado, e `retention_until` sera recalculado ao proximo encerramento
- [ ] Estado de erro: falha ao encerrar atendimento exibe "Nao foi possivel registrar o encerramento. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] DELETE fisico bloqueado a nivel de banco (policy/trigger) durante periodo de retencao
- [ ] Consultas padrao filtram `deleted_at IS NULL` — pacientes encerrados nao aparecem na listagem ativa

**Fora do escopo desta story:**
- Processo automatizado de eliminacao apos retencao (manual no MVP)
- Archiving de dados antigos para storage frio
- Anonimizacao como alternativa a eliminacao

**Prioridade:** Alta
**Tamanho:** M (2-3d)
**Dependencias:** US-401 (prontuario precisa existir)

---

### US-408: Direito do Titular — Acesso e Portabilidade dos Dados

**Como** paciente
**Quero** solicitar acesso a todos os meus dados pessoais armazenados no sistema
**Para** exercer meu direito de acesso e portabilidade conforme a LGPD

**Contexto:** LGPD garante ao titular o direito de acessar seus dados. No MVP, o paciente ja ve seus dados no portal (sessoes, pagamentos, recibos). Para dados que nao estao visiveis no portal (como dados cadastrais completos), o pedido e feito via solicitacao a psicologa, que gera um export.

**Criterios de Aceite — Happy Path:**
- [ ] Dado que o paciente acessa "Meus Dados" no portal, quando clica em "Solicitar Copia dos Meus Dados", entao o sistema registra a solicitacao e notifica a psicologa
- [ ] Dado que a psicologa recebe a solicitacao, quando acessa a area de notificacoes, entao ve "O paciente [Nome] solicitou copia dos seus dados (LGPD). Gere o export ate [data limite — 15 dias uteis]." com botao "Gerar Export"
- [ ] Dado que a psicologa clica em "Gerar Export", quando o sistema processa, entao gera um arquivo (JSON ou PDF) contendo: dados cadastrais, historico de sessoes (datas e duracoes, sem conteudo clinico sigiloso), historico de pagamentos e recibos, e termos aceitos

**Criterios de Aceite — Edge Cases e Erros:**
- [ ] Dado que o paciente ja solicitou e o pedido esta pendente, quando tenta solicitar novamente, entao ve "Voce ja tem uma solicitacao em andamento. A psicologa tem ate [data] para responder."
- [ ] Dado que a psicologa nao respondeu em 15 dias uteis, quando o prazo expira, entao o sistema envia lembrete a psicologa: "O prazo para atender a solicitacao de dados de [Nome] expira hoje."
- [ ] Estado de loading: "Registrando sua solicitacao..." com spinner
- [ ] Estado de erro: "Nao foi possivel registrar sua solicitacao. Tente novamente."

**Requisitos Nao-Funcionais:**
- [ ] Export NAO inclui conteudo de prontuario (evolucoes clinicas sao sigilosas e a criterio da psicologa compartilhar ou nao, conforme etica profissional)
- [ ] Solicitacao e resposta sao registradas no audit log

**Fora do escopo desta story:**
- Export automatico instantaneo (botao de download direto no portal)
- Eliminacao de dados pelo portal (requer validacao de retencao legal)
- Portabilidade para outro sistema (formato especifico)

**Prioridade:** Media
**Tamanho:** M (2-3d)
**Dependencias:** US-006 (portal do paciente), US-405 (audit log)

---

---

## Resumo de Contagem

| Epico | Quantidade de Stories |
|-------|---------------------|
| 0 — Auth, Onboarding e Compliance | 7 |
| 1 — Dashboard Financeiro + Asaas | 7 |
| 2 — Sala de Video + Sala de Espera | 6 |
| 3 — Agenda + Lembretes Anti-No-Show | 8 |
| 4 — Prontuario + Recibos IRPF | 8 |
| **Total** | **36** |
